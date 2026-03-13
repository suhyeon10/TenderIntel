import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from core.indexing.models import IndexableRevision
from core.indexing.repository import InMemoryIndexingRepository
from core.indexing.service import TenderIndexingService


class IndexingServiceTests(unittest.TestCase):
    def _sample_revisions(self):
        return [
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

    def test_reindex_end_to_end_on_sample_data(self):
        repo = InMemoryIndexingRepository(revisions=self._sample_revisions())
        svc = TenderIndexingService(repo)

        stats = svc.reindex(source="nara")

        self.assertEqual(stats.scanned, 2)
        self.assertEqual(stats.indexed_documents, 2)
        self.assertEqual(stats.indexed_chunks, 2)
        self.assertEqual(len(repo.documents), 2)
        self.assertEqual(len(repo.chunks), 2)
        self.assertTrue(all(d.get("tender_revision_pk") for d in repo.documents))

    def test_idempotent_reindex_same_revision(self):
        repo = InMemoryIndexingRepository(revisions=self._sample_revisions())
        svc = TenderIndexingService(repo)

        first = svc.reindex(source="nara")
        second = svc.reindex(source="nara")

        self.assertEqual(first.indexed_documents, 2)
        self.assertEqual(second.indexed_documents, 0)
        self.assertEqual(second.skipped_documents, 2)
        self.assertEqual(len(repo.documents), 2)
        self.assertEqual(len(repo.chunks), 2)


if __name__ == "__main__":
    unittest.main()
