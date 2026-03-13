from dataclasses import dataclass
from typing import Optional


@dataclass
class NormalizationResult:
    tender_id: str
    status: str
    revision_id: Optional[str] = None
    revision_hash: Optional[str] = None
    created_revision: bool = False
