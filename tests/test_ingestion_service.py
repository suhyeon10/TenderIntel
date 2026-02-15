import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from core.ingestion.models import TenderDetail, TenderSummary
from core.ingestion.repository import InMemoryIngestionRepository
from core.ingestion.service import IngestionService


class FakeConnector:
    def __init__(self, details, fail_ids=None):
        self.details = details
        self.fail_ids = set(fail_ids or [])

    def fetch_tender_list(self):
        return [TenderSummary(tender_id=t_id, title=f"Title-{t_id}") for t_id in self.details.keys()]

    def fetch_tender_detail(self, tender_id: str):
        if tender_id in self.fail_ids:
            raise RuntimeError(f"failed to fetch {tender_id}")
        return TenderDetail(
            tender_id=tender_id,
            title=f"Detail-{tender_id}",
            agency="Agency",
            status="open",
            raw_payload=self.details[tender_id],
        )


class IngestionServiceTests(unittest.TestCase):
    def test_idempotent_double_run_no_duplicates(self):
        repo = InMemoryIngestionRepository()
        connector = FakeConnector(details={"A-1": {"id": "A-1", "budget": 1000}})
        service = IngestionService(repository=repo)

        first = service.ingest(source="nara", connector=connector)
        second = service.ingest(source="nara", connector=connector)

        self.assertEqual(first.created_revisions, 1)
        self.assertEqual(second.created_revisions, 0)
        self.assertEqual(second.skipped_revisions, 1)

        tender_pk = "nara:A-1"
        self.assertEqual(len(repo.revisions[tender_pk]), 1)
        self.assertEqual(len(repo.raw_payloads), 1)
        self.assertEqual(repo.raw_payloads[0]["tender_revision_pk"], repo.revisions[tender_pk][0]["id"])
        self.assertEqual(len(repo.jobs), 1, "normalize job should be idempotent")

    def test_failure_path_records_failed_job(self):
        repo = InMemoryIngestionRepository()
        connector = FakeConnector(details={"A-1": {"id": "A-1"}, "A-2": {"id": "A-2"}}, fail_ids={"A-2"})
        service = IngestionService(repository=repo, max_retries=1)

        result = service.ingest(source="nara", connector=connector)

        self.assertEqual(result.total, 2)
        self.assertEqual(result.failed, 1)
        self.assertEqual(len(repo.failed_jobs), 1)
        self.assertEqual(repo.failed_jobs[0]["job_name"], "ingest_tenders")
        self.assertIn("A-2", repo.failed_jobs[0]["error_message"])


if __name__ == "__main__":
    unittest.main()
