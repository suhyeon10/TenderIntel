import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from core.normalization.repository import InMemoryNormalizationRepository
from core.normalization.service import NormalizationService


class NormalizationServiceTests(unittest.TestCase):
    def test_same_input_no_new_revision(self):
        repo = InMemoryNormalizationRepository()
        service = NormalizationService(repository=repo)

        payload = {
            "title": "도로 정비 사업",
            "agency": "서울시",
            "deadline": "2026-10-01",
            "budget": "10000000",
            "region": "서울",
            "category": "건설",
            "urls": ["https://example.com/tender/1"],
            "attachments": [{"filename": "spec.pdf", "url": "https://example.com/spec.pdf"}],
        }

        first = service.normalize_one(source="nara", tender_pk="nara:T1", tender_id="T1", raw_payload=payload)
        second = service.normalize_one(source="nara", tender_pk="nara:T1", tender_id="T1", raw_payload=payload)

        self.assertEqual(first.status, "SUCCESS")
        self.assertTrue(first.created_revision)
        self.assertEqual(second.status, "NOOP")
        self.assertFalse(second.created_revision)
        self.assertEqual(len(repo.revisions["nara:T1"]), 1)
        self.assertEqual(len(repo.attachments), 1)

    def test_changed_input_creates_new_revision(self):
        repo = InMemoryNormalizationRepository()
        service = NormalizationService(repository=repo)

        payload_v1 = {
            "title": "도로 정비 사업",
            "agency": "서울시",
            "deadline": "2026-10-01",
            "budget": "10000000",
            "region": "서울",
            "category": "건설",
            "urls": ["https://example.com/tender/1"],
        }
        payload_v2 = dict(payload_v1)
        payload_v2["budget"] = "12000000"

        first = service.normalize_one(source="nara", tender_pk="nara:T2", tender_id="T2", raw_payload=payload_v1)
        second = service.normalize_one(source="nara", tender_pk="nara:T2", tender_id="T2", raw_payload=payload_v2)

        self.assertEqual(first.status, "SUCCESS")
        self.assertEqual(second.status, "SUCCESS")
        self.assertNotEqual(first.revision_hash, second.revision_hash)
        self.assertEqual(len(repo.revisions["nara:T2"]), 2)

    def test_parse_failure_creates_failed_revision_and_keeps_raw(self):
        repo = InMemoryNormalizationRepository()
        service = NormalizationService(repository=repo)

        bad_payload = {"agency": "서울시"}
        result = service.normalize_one(source="nara", tender_pk="nara:T3", tender_id="T3", raw_payload=bad_payload)

        self.assertEqual(result.status, "FAILED")
        self.assertEqual(len(repo.revisions["nara:T3"]), 1)
        self.assertEqual(repo.revisions["nara:T3"][0]["revision_status"], "FAILED")
        self.assertEqual(repo.raw_payloads[0]["tender_revision_pk"], result.revision_id)


if __name__ == "__main__":
    unittest.main()
