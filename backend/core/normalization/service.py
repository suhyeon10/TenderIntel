import hashlib
import json
import time
from typing import Any, Dict, Optional

from core.logging_config import get_logger

from .models import NormalizationResult
from .parser import TenderNormalizer
from .repository import NormalizationRepository


logger = get_logger(__name__)


class NormalizationService:
    def __init__(self, repository: NormalizationRepository, parser: Optional[TenderNormalizer] = None):
        self.repository = repository
        self.parser = parser or TenderNormalizer()

    @staticmethod
    def _stable_hash(payload: Dict[str, Any]) -> str:
        encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

    @staticmethod
    def _revision_hash(source: str, tender_id: str, normalized_hash: str) -> str:
        return hashlib.sha256(f"normalize:{source}:{tender_id}:{normalized_hash}".encode("utf-8")).hexdigest()

    def normalize_one(
        self,
        *,
        source: str,
        tender_pk: str,
        tender_id: str,
        raw_payload: Dict[str, Any],
        observed_at: Optional[str] = None,
        job_name: str = "normalize_tender",
    ) -> NormalizationResult:
        started = time.perf_counter()
        raw_hash = self._stable_hash(raw_payload)

        try:
            canonical, attachments = self.parser.parse(raw_payload)
            normalized_hash = self._stable_hash(canonical)
            revision_hash = self._revision_hash(source, tender_id, normalized_hash)

            existing = self.repository.get_revision_by_hash(tender_pk, revision_hash)
            if existing:
                duration_ms = int((time.perf_counter() - started) * 1000)
                logger.info(
                    "normalization_tender_processed",
                    extra={
                        "job_name": job_name,
                        "tender_id": tender_id,
                        "revision_hash": revision_hash,
                        "revision_id": existing.get("id"),
                        "status": "noop",
                        "duration_ms": duration_ms,
                    },
                )
                return NormalizationResult(
                    tender_id=tender_id,
                    status="NOOP",
                    revision_id=existing["id"],
                    revision_hash=revision_hash,
                    created_revision=False,
                )

            revision = self.repository.create_tender_revision(
                tender_pk,
                {
                    "revision_hash": revision_hash,
                    "raw_content_hash": raw_hash,
                    "normalized_content_hash": normalized_hash,
                    "source_payload": raw_payload,
                    "normalized_payload": canonical,
                    "changed_fields": [],
                    "change_reason": "normalized_payload_changed",
                    "observed_at": observed_at,
                    "revision_status": "SUCCESS",
                },
            )

            self.repository.update_tender_latest(tender_pk, revision)
            self.repository.upsert_raw_payload(
                revision["id"],
                {
                    "payload_type": "json",
                    "content_hash": raw_hash,
                    "content_json": raw_payload,
                    "metadata": {"source": source, "tender_id": tender_id},
                },
            )

            for attachment in attachments:
                self.repository.upsert_attachment(tender_pk, revision["id"], attachment)

            duration_ms = int((time.perf_counter() - started) * 1000)
            logger.info(
                "normalization_tender_processed",
                extra={
                    "job_name": job_name,
                    "tender_id": tender_id,
                    "revision_hash": revision_hash,
                    "revision_id": revision.get("id"),
                    "status": "success",
                    "duration_ms": duration_ms,
                },
            )
            logger.info("pipeline_metric", extra={"metric": "normalize_failures", "value": 0, "stage": "normalize", "revision_id": revision.get("id"), "tender_id": tender_id})
            return NormalizationResult(
                tender_id=tender_id,
                status="SUCCESS",
                revision_id=revision["id"],
                revision_hash=revision_hash,
                created_revision=True,
            )
        except Exception as exc:
            failed_revision_hash = hashlib.sha256(
                f"normalize_failed:{source}:{tender_id}:{raw_hash}".encode("utf-8")
            ).hexdigest()

            existing_failed = self.repository.get_revision_by_hash(tender_pk, failed_revision_hash)
            if existing_failed:
                revision = existing_failed
            else:
                revision = self.repository.create_tender_revision(
                    tender_pk,
                    {
                        "revision_hash": failed_revision_hash,
                        "raw_content_hash": raw_hash,
                        "normalized_content_hash": raw_hash,
                        "source_payload": raw_payload,
                        "normalized_payload": {},
                        "changed_fields": [],
                        "change_reason": "normalization_parse_failed",
                        "observed_at": observed_at,
                        "revision_status": "FAILED",
                        "error_message": str(exc),
                    },
                )

            self.repository.upsert_raw_payload(
                revision["id"],
                {
                    "payload_type": "json",
                    "content_hash": raw_hash,
                    "content_json": raw_payload,
                    "metadata": {"source": source, "tender_id": tender_id, "parse_status": "failed"},
                },
            )

            duration_ms = int((time.perf_counter() - started) * 1000)
            logger.error(
                "normalization_tender_failed",
                extra={
                    "job_name": job_name,
                    "tender_id": tender_id,
                    "revision_hash": failed_revision_hash,
                    "revision_id": revision.get("id"),
                    "status": "failed",
                    "duration_ms": duration_ms,
                },
            )
            logger.info("pipeline_metric", extra={"metric": "normalize_failures", "value": 1, "stage": "normalize", "revision_id": revision.get("id"), "tender_id": tender_id})
            return NormalizationResult(
                tender_id=tender_id,
                status="FAILED",
                revision_id=revision["id"],
                revision_hash=failed_revision_hash,
                created_revision=not bool(existing_failed),
            )
