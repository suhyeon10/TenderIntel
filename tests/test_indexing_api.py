import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from api.routes_tender_index import search_tenders
from core.indexing.models import IndexableRevision
from core.indexing.repository import InMemoryIndexingRepository
from core.indexing.service import TenderIndexingService


class IndexingApiTests(unittest.TestCase):
    def setUp(self):
        self.repo = InMemoryIndexingRepository(
            revisions=[
                IndexableRevision(
                    tender_pk="nara:T1",
                    tender_id="T1",
                    source="nara",
                    tender_revision_pk="rev1",
                    revision_hash="h1",
                    normalized_payload={
                        "title": "서울 도로 유지보수",
                        "agency": "서울시",
                        "deadline": "2026-02-01",
                        "region": "서울",
                        "category": "건설",
                        "budget": {"min": 100, "max": 200},
                        "urls": ["https://a"],
                    },
                    attachments=[{"filename": "spec1.pdf", "mime_type": "application/pdf", "metadata": {"url": "https://a/spec1"}}],
                ),
                IndexableRevision(
                    tender_pk="nara:T2",
                    tender_id="T2",
                    source="nara",
                    tender_revision_pk="rev2",
                    revision_hash="h2",
                    normalized_payload={
                        "title": "부산 항만 개선",
                        "agency": "부산시",
                        "deadline": "2026-01-15",
                        "region": "부산",
                        "category": "인프라",
                        "budget": {"min": 150, "max": 300},
                        "urls": ["https://b"],
                    },
                    attachments=[{"filename": "spec2.pdf", "mime_type": "application/pdf", "metadata": {"url": "https://b/spec2"}}],
                ),
            ]
        )
        self.service = TenderIndexingService(self.repo)
        self.service.reindex(source="nara")

    def test_search_keyword_and_facets(self):
        data = search_tenders(
            q="도로",
            region="서울",
            category="건설",
            deadline_lte="2026-12-31",
            limit=20,
            service=self.service,
        )
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["tender_id"], "T1")

    def test_search_deadline_filter_excludes_late_items(self):
        data = search_tenders(
            q=None,
            region=None,
            category=None,
            deadline_lte="2026-01-20",
            limit=20,
            service=self.service,
        )
        ids = [row["tender_id"] for row in data["results"]]
        self.assertEqual(ids, ["T2"])


if __name__ == "__main__":
    unittest.main()
