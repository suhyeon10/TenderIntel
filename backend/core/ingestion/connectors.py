from typing import List, Protocol

from .models import TenderDetail, TenderSummary


class TenderSourceConnector(Protocol):
    """Network/API access must stay behind this connector boundary."""

    def fetch_tender_list(self) -> List[TenderSummary]:
        ...

    def fetch_tender_detail(self, tender_id: str) -> TenderDetail:
        ...
