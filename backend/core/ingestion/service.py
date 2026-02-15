import hashlib
import json
import time
from typing import Any, Dict, Optional

from core.logging_config import get_logger

from .connectors import TenderSourceConnector
from .models import IngestionResult
from .repository import IngestionRepository


logger = get_logger(__name__)


class IngestionService:
    def __init__(
        self,
        repository: IngestionRepository,
        max_retries: int = 2,
        retry_backoff_seconds: float = 0.0,
    ):
        self.repository = repository
        self.max_retries = max_retries
        self.retry_backoff_seconds = retry_backoff_seconds

    @staticmethod
    def _stable_hash(payload: Dict[str, Any]) -> str:
        encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

    @staticmethod
    def _normalize_idempotency_key(source: str, tender_id: str, revision_hash: str) -> str:
        base = f"normalize:{source}:{tender_id}:{revision_hash}"
        return hashlib.sha256(base.encode("utf-8")).hexdigest()

    def ingest(self, source: str, connector: TenderSourceConnector, job_name: str = "ingest_tenders") -> IngestionResult:
        result = IngestionResult()
        summaries = connector.fetch_tender_list()

        for summary in summaries:
            result.total += 1
            tender_start = time.perf_counter()
            tender_id = summary.tender_id
            revision_hash: Optional[str] = None

            try:
                detail = self._fetch_with_retry(connector, tender_id)
                raw_hash = self._stable_hash(detail.raw_payload)
                revision_hash = raw_hash

                tender_pk = self.repository.upsert_tender(
                    source=source,
                    tender_id=tender_id,
                    fields={
                        "title": detail.title or summary.title,
                        "agency": detail.agency,
                        "status": detail.status,
                    },
                )

                existing_revision = self.repository.get_revision_by_hash(tender_pk, revision_hash)
                if existing_revision:
                    revision = existing_revision
                    result.skipped_revisions += 1
                else:
                    revision = self.repository.create_tender_revision(
                        tender_pk,
                        {
                            "revision_hash": revision_hash,
                            "raw_content_hash": raw_hash,
                            "normalized_content_hash": raw_hash,
                            "source_payload": detail.raw_payload,
                            "normalized_payload": {},
                            "changed_fields": [],
                            "change_reason": "ingest_raw_payload",
                            "observed_at": detail.observed_at,
                        },
                    )
                    result.created_revisions += 1

                self.repository.update_tender_latest(tender_pk, revision)

                self.repository.upsert_raw_payload(
                    revision["id"],
                    {
                        "payload_type": "json",
                        "content_hash": raw_hash,
                        "content_json": detail.raw_payload,
                        "metadata": {"source": source, "tender_id": tender_id},
                    },
                )

                idempotency_key = self._normalize_idempotency_key(source, tender_id, revision_hash)
                enqueued = self.repository.enqueue_job(
                    job_name="normalize_tender",
                    idempotency_key=idempotency_key,
                    payload={
                        "source": source,
                        "tender_pk": tender_pk,
                        "tender_id": tender_id,
                        "tender_revision_pk": revision["id"],
                        "revision_hash": revision_hash,
                    },
                )
                if enqueued:
                    result.queued_jobs += 1

                duration_ms = int((time.perf_counter() - tender_start) * 1000)
                logger.info(
                    "ingestion_tender_processed",
                    extra={
                        "job_name": job_name,
                        "tender_id": tender_id,
                        "revision_hash": revision_hash,
                        "revision_id": revision.get("id"),
                        "status": "success",
                        "duration_ms": duration_ms,
                    },
                )
                logger.info("pipeline_metric", extra={"metric": "ingestion_success_rate", "value": 1, "stage": "ingest", "revision_id": revision.get("id"), "tender_id": tender_id})
            except Exception as exc:
                result.failed += 1
                idempotency_key = hashlib.sha256(f"{source}:{tender_id}".encode("utf-8")).hexdigest()
                self.repository.record_failed_job(
                    job_name=job_name,
                    idempotency_key=idempotency_key,
                    payload={"source": source, "tender_id": tender_id},
                    error_message=str(exc),
                )
                duration_ms = int((time.perf_counter() - tender_start) * 1000)
                logger.error(
                    "ingestion_tender_failed",
                    extra={
                        "job_name": job_name,
                        "tender_id": tender_id,
                        "revision_hash": revision_hash,
                        "revision_id": None,
                        "status": "failed",
                        "duration_ms": duration_ms,
                    },
                )
                logger.info("pipeline_metric", extra={"metric": "ingestion_success_rate", "value": 0, "stage": "ingest", "revision_id": None, "tender_id": tender_id})

        return result

    def _fetch_with_retry(self, connector: TenderSourceConnector, tender_id: str):
        last_error = None
        for attempt in range(self.max_retries + 1):
            try:
                return connector.fetch_tender_detail(tender_id)
            except Exception as exc:  # retry boundary
                last_error = exc
                if attempt < self.max_retries and self.retry_backoff_seconds > 0:
                    time.sleep(self.retry_backoff_seconds)
        raise last_error
