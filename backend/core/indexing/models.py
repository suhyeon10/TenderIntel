from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class ReindexStats:
    scanned: int = 0
    indexed_documents: int = 0
    indexed_chunks: int = 0
    skipped_documents: int = 0


@dataclass
class IndexableRevision:
    tender_pk: str
    tender_id: str
    source: str
    tender_revision_pk: str
    revision_hash: str
    normalized_payload: Dict[str, Any] = field(default_factory=dict)
    attachments: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class SearchQuery:
    keyword: Optional[str] = None
    region: Optional[str] = None
    category: Optional[str] = None
    deadline_lte: Optional[str] = None
    limit: int = 20
