from fastapi import APIRouter, Depends, Query

from core.indexing.repository import SupabaseIndexingRepository
from core.indexing.service import TenderIndexingService

router_tender_index = APIRouter(prefix="/api/v2/tenders", tags=["Tender Index"])


def get_indexing_service() -> TenderIndexingService:
    return TenderIndexingService(SupabaseIndexingRepository())


@router_tender_index.post("/reindex")
def reindex_tenders(
    source: str | None = Query(default=None),
    service: TenderIndexingService = Depends(get_indexing_service),
):
    stats = service.reindex(source=source)
    return {
        "status": "ok",
        "source": source,
        "scanned": stats.scanned,
        "indexed_documents": stats.indexed_documents,
        "indexed_chunks": stats.indexed_chunks,
        "skipped_documents": stats.skipped_documents,
    }


@router_tender_index.get("/search")
def search_tenders(
    q: str | None = Query(default=None),
    region: str | None = Query(default=None),
    category: str | None = Query(default=None),
    deadline_lte: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    service: TenderIndexingService = Depends(get_indexing_service),
):
    rows = service.search(
        keyword=q,
        region=region,
        category=category,
        deadline_lte=deadline_lte,
        limit=limit,
    )
    return {"count": len(rows), "results": rows}
