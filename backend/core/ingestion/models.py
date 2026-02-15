from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class TenderSummary:
    tender_id: str
    title: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TenderDetail:
    tender_id: str
    raw_payload: Dict[str, Any]
    title: Optional[str] = None
    agency: Optional[str] = None
    status: Optional[str] = None
    attachment_metadata: List[Dict[str, Any]] = field(default_factory=list)
    observed_at: Optional[str] = None


@dataclass
class IngestionResult:
    total: int = 0
    created_revisions: int = 0
    skipped_revisions: int = 0
    queued_jobs: int = 0
    failed: int = 0
