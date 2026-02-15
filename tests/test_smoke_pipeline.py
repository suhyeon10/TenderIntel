import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from core.indexing.repository import InMemoryIndexingRepository
from core.indexing.service import TenderIndexingService
from core.ingestion.models import TenderDetail, TenderSummary
from core.ingestion.repository import InMemoryIngestionRepository
from core.ingestion.service import IngestionService
from core.matching_notify.models import Subscription, TenderRevisionContext
from core.matching_notify.repository import InMemoryMatchNotifyRepository
from core.matching_notify.service import MatchNotifyService
from core.normalization.repository import InMemoryNormalizationRepository
from core.normalization.service import NormalizationService
from core.indexing.models import IndexableRevision


class FakeConnector:
    def fetch_tender_list(self):
        return [TenderSummary(tender_id="T1", title="도로 사업")]

    def fetch_tender_detail(self, tender_id: str):
        return TenderDetail(
            tender_id=tender_id,
            title="서울 도로 유지보수",
            agency="서울시",
            status="open",
            raw_payload={
                "title": "서울 도로 유지보수",
                "agency": "서울시",
                "deadline": "2099-02-01",
                "budget": "1000000",
                "region": "서울",
                "category": "건설",
                "urls": ["https://example.com/t1"],
                "attachments": [{"filename": "spec.pdf", "url": "https://example.com/spec.pdf"}],
            },
        )


class SmokePipelineTest(unittest.TestCase):
    def test_ingest_normalize_index_match_notify_smoke(self):
        connector = FakeConnector()

        ingest_repo = InMemoryIngestionRepository()
        ingest_service = IngestionService(ingest_repo)
        ingest_result = ingest_service.ingest(source="nara", connector=connector)
        self.assertEqual(ingest_result.created_revisions, 1)

        raw_payload = connector.fetch_tender_detail("T1").raw_payload

        norm_repo = InMemoryNormalizationRepository()
        norm_service = NormalizationService(norm_repo)
        norm_result = norm_service.normalize_one(
            source="nara",
            tender_pk="nara:T1",
            tender_id="T1",
            raw_payload=raw_payload,
        )
        self.assertEqual(norm_result.status, "SUCCESS")

        idx_repo = InMemoryIndexingRepository(
            revisions=[
                IndexableRevision(
                    tender_pk="nara:T1",
                    tender_id="T1",
                    source="nara",
                    tender_revision_pk=norm_result.revision_id,
                    revision_hash=norm_result.revision_hash,
                    normalized_payload=norm_repo.revisions["nara:T1"][0]["normalized_payload"],
                    attachments=norm_repo.attachments,
                )
            ]
        )
        idx_service = TenderIndexingService(idx_repo)
        stats = idx_service.reindex(source="nara")
        self.assertEqual(stats.indexed_documents, 1)

        mn_repo = InMemoryMatchNotifyRepository(
            revisions={
                norm_result.revision_id: TenderRevisionContext(
                    tender_pk="nara:T1",
                    tender_id="T1",
                    source="nara",
                    tender_revision_pk=norm_result.revision_id,
                    revision_hash=norm_result.revision_hash,
                    normalized_payload=norm_repo.revisions["nara:T1"][0]["normalized_payload"],
                )
            },
            subscriptions=[
                Subscription(
                    id="sub-1",
                    user_id="u1",
                    channel="email",
                    is_active=True,
                    saved_filters={"region": "서울", "category": "건설", "deadline_lte": "2099-12-31"},
                    profile_fields={"preferred_categories": ["건설"], "preferred_regions": ["서울"], "min_budget": 1},
                )
            ],
        )
        mn_service = MatchNotifyService(mn_repo)
        mn_stats = mn_service.run_for_revision(norm_result.revision_id)
        self.assertEqual(mn_stats.notifications_sent, 1)


if __name__ == "__main__":
    unittest.main()
