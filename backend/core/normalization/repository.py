import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Protocol

from core.supabase_vector_store import SupabaseVectorStore


class NormalizationRepository(Protocol):
    def get_revision_by_hash(self, tender_pk: str, revision_hash: str) -> Optional[Dict[str, Any]]:
        ...

    def create_tender_revision(self, tender_pk: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        ...

    def update_tender_latest(self, tender_pk: str, revision: Dict[str, Any]) -> None:
        ...

    def upsert_raw_payload(self, tender_revision_pk: str, payload: Dict[str, Any]) -> bool:
        ...

    def upsert_attachment(self, tender_pk: str, tender_revision_pk: str, attachment: Dict[str, Any]) -> bool:
        ...


class SupabaseNormalizationRepository:
    def __init__(self):
        self.store = SupabaseVectorStore()
        self.store._ensure_initialized()
        self.sb = self.store.sb

    @staticmethod
    def _utc_now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def get_revision_by_hash(self, tender_pk: str, revision_hash: str) -> Optional[Dict[str, Any]]:
        result = self.sb.table("tender_revisions").select("id, revision_hash, raw_content_hash, normalized_content_hash, revision_status").eq("tender_pk", tender_pk).eq("revision_hash", revision_hash).limit(1).execute()
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
            "revision_status": payload.get("revision_status", "SUCCESS"),
            "error_message": payload.get("error_message"),
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
        existing = self.sb.table("raw_payloads").select("id").eq("tender_revision_pk", tender_revision_pk).eq("content_hash", payload["content_hash"]).limit(1).execute()
        if existing.data:
            return False
        self.sb.table("raw_payloads").insert({
            "tender_revision_pk": tender_revision_pk,
            "payload_type": payload.get("payload_type", "json"),
            "content_hash": payload["content_hash"],
            "content_json": payload.get("content_json"),
            "metadata": payload.get("metadata", {}),
        }).execute()
        return True

    def upsert_attachment(self, tender_pk: str, tender_revision_pk: str, attachment: Dict[str, Any]) -> bool:
        filename = attachment.get("filename", "unknown")
        content_hash = attachment.get("content_hash") or hashlib.sha256(
            json.dumps({"filename": filename, "metadata": attachment.get("metadata", {})}, sort_keys=True).encode("utf-8")
        ).hexdigest()

        existing = self.sb.table("attachments").select("id").eq("tender_revision_pk", tender_revision_pk).eq("filename", filename).eq("content_hash", content_hash).limit(1).execute()
        if existing.data:
            return False

        self.sb.table("attachments").insert({
            "tender_pk": tender_pk,
            "tender_revision_pk": tender_revision_pk,
            "attachment_type": attachment.get("attachment_type", "document"),
            "filename": filename,
            "storage_path": attachment.get("storage_path"),
            "mime_type": attachment.get("mime_type"),
            "byte_size": attachment.get("byte_size"),
            "content_hash": content_hash,
            "metadata": attachment.get("metadata", {}),
        }).execute()
        return True


@dataclass
class InMemoryNormalizationRepository:
    revisions: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)
    tenders: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    raw_payloads: List[Dict[str, Any]] = field(default_factory=list)
    attachments: List[Dict[str, Any]] = field(default_factory=list)

    def get_revision_by_hash(self, tender_pk: str, revision_hash: str) -> Optional[Dict[str, Any]]:
        for rev in self.revisions.get(tender_pk, []):
            if rev["revision_hash"] == revision_hash:
                return rev
        return None

    def create_tender_revision(self, tender_pk: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        revs = self.revisions.setdefault(tender_pk, [])
        revision = {"id": f"{tender_pk}:norm:{len(revs)+1}", "revision_number": len(revs) + 1, **payload}
        revs.append(revision)
        return revision

    def update_tender_latest(self, tender_pk: str, revision: Dict[str, Any]) -> None:
        self.tenders.setdefault(tender_pk, {})
        self.tenders[tender_pk].update({
            "current_revision_id": revision["id"],
            "latest_revision_hash": revision["revision_hash"],
            "latest_raw_content_hash": revision["raw_content_hash"],
            "latest_normalized_content_hash": revision["normalized_content_hash"],
        })

    def upsert_raw_payload(self, tender_revision_pk: str, payload: Dict[str, Any]) -> bool:
        for row in self.raw_payloads:
            if row["tender_revision_pk"] == tender_revision_pk and row["content_hash"] == payload["content_hash"]:
                return False
        self.raw_payloads.append({"tender_revision_pk": tender_revision_pk, **payload})
        return True

    def upsert_attachment(self, tender_pk: str, tender_revision_pk: str, attachment: Dict[str, Any]) -> bool:
        filename = attachment.get("filename", "unknown")
        content_hash = attachment.get("content_hash") or hashlib.sha256(
            json.dumps({"filename": filename, "metadata": attachment.get("metadata", {})}, sort_keys=True).encode("utf-8")
        ).hexdigest()

        for row in self.attachments:
            if row["tender_revision_pk"] == tender_revision_pk and row["filename"] == filename and row["content_hash"] == content_hash:
                return False

        self.attachments.append({
            "tender_pk": tender_pk,
            "tender_revision_pk": tender_revision_pk,
            "filename": filename,
            "content_hash": content_hash,
            **attachment,
        })
        return True
