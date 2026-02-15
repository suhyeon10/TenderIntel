import hashlib
import json
import time
from typing import Dict, List, Optional

from core.logging_config import get_logger

from .models import ReindexStats, SearchQuery
from .repository import IndexingRepository


logger = get_logger(__name__)


class TenderIndexingService:
    def __init__(self, repository: IndexingRepository):
        self.repository = repository

    @staticmethod
    def _chunk_hash(text: str) -> str:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()

    @staticmethod
    def _vector_stub(text: str) -> Dict[str, object]:
        return {"provider": "stub", "model": "none", "text_hash": hashlib.sha256(text.encode("utf-8")).hexdigest()}

    def reindex(self, source: Optional[str] = None, job_name: str = "reindex_tenders") -> ReindexStats:
        stats = ReindexStats()
        revisions = self.repository.list_revisions_for_reindex(source=source)

        for revision in revisions:
            stats.scanned += 1
            started = time.perf_counter()

            payload = revision.normalized_payload or {}
            title = payload.get("title")
            agency = payload.get("agency")
            deadline = payload.get("deadline")
            region = payload.get("region")
            category = payload.get("category")
            budget = payload.get("budget") or {}
            budget_min = budget.get("min")
            budget_max = budget.get("max")
            urls = payload.get("urls") or []

            search_text = " ".join(
                [
                    str(v)
                    for v in [title, agency, region, category, deadline, " ".join(urls)]
                    if v
                ]
            )

            created_doc = self.repository.upsert_tender_document(
                {
                    "tender_pk": revision.tender_pk,
                    "tender_revision_pk": revision.tender_revision_pk,
                    "tender_id": revision.tender_id,
                    "source": revision.source,
                    "revision_hash": revision.revision_hash,
                    "title": title,
                    "agency": agency,
                    "deadline": deadline,
                    "region": region,
                    "category": category,
                    "budget_min": budget_min,
                    "budget_max": budget_max,
                    "urls": urls,
                    "search_text": search_text,
                }
            )
            if created_doc:
                stats.indexed_documents += 1
            else:
                stats.skipped_documents += 1

            chunks = self._build_attachment_chunks(
                tender_revision_pk=revision.tender_revision_pk,
                attachments=revision.attachments,
                revision_hash=revision.revision_hash,
            )
            for chunk in chunks:
                created_chunk = self.repository.upsert_tender_chunk(chunk)
                if created_chunk:
                    stats.indexed_chunks += 1

            duration_ms = int((time.perf_counter() - started) * 1000)
            logger.info(
                "indexing_revision_processed",
                extra={
                    "job_name": job_name,
                    "tender_id": revision.tender_id,
                    "revision_hash": revision.revision_hash,
                    "status": "success",
                    "duration_ms": duration_ms,
                },
            )

        return stats

    def _build_attachment_chunks(self, *, tender_revision_pk: str, attachments: List[Dict], revision_hash: str) -> List[Dict]:
        chunks: List[Dict] = []
        for idx, item in enumerate(attachments):
            filename = item.get("filename") or "unknown"
            mime = item.get("mime_type") or "application/octet-stream"
            url = (item.get("metadata") or {}).get("url")
            text = f"{filename} {mime} {url or ''}".strip()
            chunk_hash = self._chunk_hash(f"{tender_revision_pk}:{text}")
            chunks.append(
                {
                    "tender_revision_pk": tender_revision_pk,
                    "chunk_index": idx,
                    "chunk_hash": chunk_hash,
                    "chunk_text": text,
                    "metadata": {"filename": filename, "mime_type": mime, "url": url},
                    "vector_stub": self._vector_stub(text),
                    "revision_hash": revision_hash,
                }
            )
        return chunks

    def search(self, *, keyword: Optional[str], region: Optional[str], category: Optional[str], deadline_lte: Optional[str], limit: int = 20):
        return self.repository.search_documents(
            SearchQuery(
                keyword=keyword,
                region=region,
                category=category,
                deadline_lte=deadline_lte,
                limit=limit,
            )
        )
