import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Protocol

from core.supabase_vector_store import SupabaseVectorStore


class IngestionRepository(Protocol):
    def upsert_tender(self, source: str, tender_id: str, fields: Dict[str, Any]) -> str:
        ...

    def get_revision_by_hash(self, tender_pk: str, revision_hash: str) -> Optional[Dict[str, Any]]:
        ...

    def create_tender_revision(self, tender_pk: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        ...

    def update_tender_latest(self, tender_pk: str, revision: Dict[str, Any]) -> None:
        ...

    def upsert_raw_payload(self, tender_revision_pk: str, payload: Dict[str, Any]) -> bool:
        ...

    def enqueue_job(self, job_name: str, idempotency_key: str, payload: Dict[str, Any]) -> bool:
        ...

    def record_failed_job(self, job_name: str, idempotency_key: str, payload: Dict[str, Any], error_message: str) -> None:
        ...


class SupabaseIngestionRepository:
    """Production repository for ingestion pipeline stage."""

    def __init__(self):
        self.store = SupabaseVectorStore()
        self.store._ensure_initialized()
        self.sb = self.store.sb

    @staticmethod
    def _utc_now() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _hash_payload(payload: Dict[str, Any]) -> str:
        encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(encoded.encode("utf-8")).hexdigest()

    def upsert_tender(self, source: str, tender_id: str, fields: Dict[str, Any]) -> str:
        existing = self.sb.table("tenders").select("id").eq("source", source).eq("tender_id", tender_id).limit(1).execute()
        now = self._utc_now()

        if existing.data:
            tender_pk = existing.data[0]["id"]
            self.sb.table("tenders").update({
                "title": fields.get("title"),
                "agency": fields.get("agency"),
                "status": fields.get("status"),
                "last_seen_at": now,
            }).eq("id", tender_pk).execute()
            return tender_pk

        insert_result = self.sb.table("tenders").insert({
            "source": source,
            "tender_id": tender_id,
            "title": fields.get("title"),
            "agency": fields.get("agency"),
            "status": fields.get("status"),
            "first_seen_at": now,
            "last_seen_at": now,
        }).execute()
        return insert_result.data[0]["id"]

    def get_revision_by_hash(self, tender_pk: str, revision_hash: str) -> Optional[Dict[str, Any]]:
        result = self.sb.table("tender_revisions").select("id, revision_number, revision_hash, raw_content_hash, normalized_content_hash").eq("tender_pk", tender_pk).eq("revision_hash", revision_hash).limit(1).execute()
        return result.data[0] if result.data else None

    def create_tender_revision(self, tender_pk: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        latest = self.sb.table("tender_revisions").select("revision_number").eq("tender_pk", tender_pk).order("revision_number", desc=True).limit(1).execute()
        next_revision = (latest.data[0]["revision_number"] if latest.data else 0) + 1

        result = self.sb.table("tender_revisions").insert({
            "tender_pk": tender_pk,
            "revision_number": next_revision,
            "revision_hash": payload["revision_hash"],
            "raw_content_hash": payload["raw_content_hash"],
            "normalized_content_hash": payload["normalized_content_hash"],
            "source_payload": payload.get("source_payload", {}),
            "normalized_payload": payload.get("normalized_payload", {}),
            "changed_fields": payload.get("changed_fields", []),
            "change_reason": payload.get("change_reason"),
            "observed_at": payload.get("observed_at") or self._utc_now(),
        }).execute()
        return result.data[0]

    def update_tender_latest(self, tender_pk: str, revision: Dict[str, Any]) -> None:
        self.sb.table("tenders").update({
            "current_revision_id": revision["id"],
            "latest_revision_hash": revision["revision_hash"],
            "latest_raw_content_hash": revision["raw_content_hash"],
            "latest_normalized_content_hash": revision["normalized_content_hash"],
            "last_seen_at": self._utc_now(),
        }).eq("id", tender_pk).execute()

    def upsert_raw_payload(self, tender_revision_pk: str, payload: Dict[str, Any]) -> bool:
        content_hash = payload["content_hash"]
        existing = self.sb.table("raw_payloads").select("id").eq("tender_revision_pk", tender_revision_pk).eq("content_hash", content_hash).limit(1).execute()
        if existing.data:
            return False

        self.sb.table("raw_payloads").insert({
            "tender_revision_pk": tender_revision_pk,
            "payload_type": payload.get("payload_type", "json"),
            "content_hash": content_hash,
            "content_json": payload.get("content_json"),
            "source_url": payload.get("source_url"),
            "metadata": payload.get("metadata", {}),
        }).execute()
        return True

    def enqueue_job(self, job_name: str, idempotency_key: str, payload: Dict[str, Any]) -> bool:
        existing = self.sb.table("ingestion_jobs").select("id").eq("job_name", job_name).eq("idempotency_key", idempotency_key).limit(1).execute()
        if existing.data:
            return False

        self.sb.table("ingestion_jobs").insert({
            "job_name": job_name,
            "idempotency_key": idempotency_key,
            "status": "queued",
            "payload": payload,
        }).execute()
        return True

    def record_failed_job(self, job_name: str, idempotency_key: str, payload: Dict[str, Any], error_message: str) -> None:
        self.sb.table("failed_jobs").insert({
            "job_name": job_name,
            "idempotency_key": idempotency_key,
            "payload": payload,
            "error_message": error_message,
            "status": "failed",
        }).execute()


@dataclass
class InMemoryIngestionRepository:
    tenders: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    revisions: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)
    raw_payloads: List[Dict[str, Any]] = field(default_factory=list)
    jobs: List[Dict[str, Any]] = field(default_factory=list)
    failed_jobs: List[Dict[str, Any]] = field(default_factory=list)

    def upsert_tender(self, source: str, tender_id: str, fields: Dict[str, Any]) -> str:
        key = f"{source}:{tender_id}"
        if key not in self.tenders:
            self.tenders[key] = {
                "id": key,
                "source": source,
                "tender_id": tender_id,
            }
        self.tenders[key].update(fields)
        return key

    def get_revision_by_hash(self, tender_pk: str, revision_hash: str) -> Optional[Dict[str, Any]]:
        for rev in self.revisions.get(tender_pk, []):
            if rev["revision_hash"] == revision_hash:
                return rev
        return None

    def create_tender_revision(self, tender_pk: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        revs = self.revisions.setdefault(tender_pk, [])
        revision = {
            "id": f"{tender_pk}:rev:{len(revs)+1}",
            "revision_number": len(revs) + 1,
            **payload,
        }
        revs.append(revision)
        return revision

    def update_tender_latest(self, tender_pk: str, revision: Dict[str, Any]) -> None:
        self.tenders[tender_pk].update({
            "current_revision_id": revision["id"],
            "latest_revision_hash": revision["revision_hash"],
            "latest_raw_content_hash": revision["raw_content_hash"],
            "latest_normalized_content_hash": revision["normalized_content_hash"],
        })

    def upsert_raw_payload(self, tender_revision_pk: str, payload: Dict[str, Any]) -> bool:
        for item in self.raw_payloads:
            if item["tender_revision_pk"] == tender_revision_pk and item["content_hash"] == payload["content_hash"]:
                return False
        self.raw_payloads.append({"tender_revision_pk": tender_revision_pk, **payload})
        return True

    def enqueue_job(self, job_name: str, idempotency_key: str, payload: Dict[str, Any]) -> bool:
        for job in self.jobs:
            if job["job_name"] == job_name and job["idempotency_key"] == idempotency_key:
                return False
        self.jobs.append({
            "job_name": job_name,
            "idempotency_key": idempotency_key,
            "payload": payload,
            "status": "queued",
        })
        return True

    def record_failed_job(self, job_name: str, idempotency_key: str, payload: Dict[str, Any], error_message: str) -> None:
        self.failed_jobs.append({
            "job_name": job_name,
            "idempotency_key": idempotency_key,
            "payload": payload,
            "error_message": error_message,
            "status": "failed",
        })
