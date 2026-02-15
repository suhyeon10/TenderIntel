from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Protocol

from core.supabase_vector_store import SupabaseVectorStore

from .models import IndexableRevision, SearchQuery


class IndexingRepository(Protocol):
    def list_revisions_for_reindex(self, source: Optional[str] = None) -> List[IndexableRevision]:
        ...

    def upsert_tender_document(self, document: Dict[str, Any]) -> bool:
        ...

    def upsert_tender_chunk(self, chunk: Dict[str, Any]) -> bool:
        ...

    def search_documents(self, query: SearchQuery) -> List[Dict[str, Any]]:
        ...


class SupabaseIndexingRepository:
    def __init__(self):
        self.store = SupabaseVectorStore()
        self.store._ensure_initialized()
        self.sb = self.store.sb

    def list_revisions_for_reindex(self, source: Optional[str] = None) -> List[IndexableRevision]:
        tenders_query = self.sb.table("tenders").select("id,tender_id,source")
        if source:
            tenders_query = tenders_query.eq("source", source)
        tenders = tenders_query.execute().data or []

        results: List[IndexableRevision] = []
        for tender in tenders:
            revisions = self.sb.table("tender_revisions").select("id,revision_hash,normalized_payload,revision_status").eq("tender_pk", tender["id"]).eq("revision_status", "SUCCESS").execute().data or []
            for rev in revisions:
                attachments = self.sb.table("attachments").select("filename,mime_type,storage_path,metadata,content_hash").eq("tender_revision_pk", rev["id"]).execute().data or []
                results.append(
                    IndexableRevision(
                        tender_pk=tender["id"],
                        tender_id=tender["tender_id"],
                        source=tender["source"],
                        tender_revision_pk=rev["id"],
                        revision_hash=rev["revision_hash"],
                        normalized_payload=rev.get("normalized_payload") or {},
                        attachments=attachments,
                    )
                )
        return results

    def upsert_tender_document(self, document: Dict[str, Any]) -> bool:
        existing = self.sb.table("tender_index_documents").select("id").eq("tender_revision_pk", document["tender_revision_pk"]).limit(1).execute()
        if existing.data:
            self.sb.table("tender_index_documents").update(document).eq("id", existing.data[0]["id"]).execute()
            return False
        self.sb.table("tender_index_documents").insert(document).execute()
        return True

    def upsert_tender_chunk(self, chunk: Dict[str, Any]) -> bool:
        existing = self.sb.table("tender_index_chunks").select("id").eq("tender_revision_pk", chunk["tender_revision_pk"]).eq("chunk_hash", chunk["chunk_hash"]).limit(1).execute()
        if existing.data:
            return False
        self.sb.table("tender_index_chunks").insert(chunk).execute()
        return True

    def search_documents(self, query: SearchQuery) -> List[Dict[str, Any]]:
        q = self.sb.table("tender_index_documents").select("*")
        if query.keyword:
            q = q.ilike("search_text", f"%{query.keyword}%")
        if query.region:
            q = q.eq("region", query.region)
        if query.category:
            q = q.eq("category", query.category)
        if query.deadline_lte:
            q = q.lte("deadline", query.deadline_lte)
        q = q.order("deadline", desc=False).limit(query.limit)
        result = q.execute()
        return result.data or []


@dataclass
class InMemoryIndexingRepository:
    revisions: List[IndexableRevision] = field(default_factory=list)
    documents: List[Dict[str, Any]] = field(default_factory=list)
    chunks: List[Dict[str, Any]] = field(default_factory=list)

    def list_revisions_for_reindex(self, source: Optional[str] = None) -> List[IndexableRevision]:
        if not source:
            return list(self.revisions)
        return [r for r in self.revisions if r.source == source]

    def upsert_tender_document(self, document: Dict[str, Any]) -> bool:
        for i, row in enumerate(self.documents):
            if row["tender_revision_pk"] == document["tender_revision_pk"]:
                self.documents[i] = {**row, **document}
                return False
        self.documents.append(document)
        return True

    def upsert_tender_chunk(self, chunk: Dict[str, Any]) -> bool:
        for row in self.chunks:
            if row["tender_revision_pk"] == chunk["tender_revision_pk"] and row["chunk_hash"] == chunk["chunk_hash"]:
                return False
        self.chunks.append(chunk)
        return True

    def search_documents(self, query: SearchQuery) -> List[Dict[str, Any]]:
        rows = list(self.documents)
        if query.keyword:
            k = query.keyword.lower()
            rows = [r for r in rows if k in (r.get("search_text") or "").lower()]
        if query.region:
            rows = [r for r in rows if r.get("region") == query.region]
        if query.category:
            rows = [r for r in rows if r.get("category") == query.category]
        if query.deadline_lte:
            rows = [r for r in rows if (r.get("deadline") or "9999-99-99") <= query.deadline_lte]
        rows.sort(key=lambda r: r.get("deadline") or "9999-99-99")
        return rows[: query.limit]
