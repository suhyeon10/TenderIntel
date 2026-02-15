import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from core.matching_notify.models import Subscription, TenderRevisionContext
from core.matching_notify.repository import InMemoryMatchNotifyRepository
from core.matching_notify.service import MatchNotifyService


class FlakyNotifier:
    def __init__(self):
        self.calls = 0

    def send(self, **kwargs):
        self.calls += 1
        if self.calls == 1:
            raise RuntimeError("temporary send failure")
        return "msg-ok"


class StableNotifier:
    def __init__(self):
        self.calls = 0

    def send(self, **kwargs):
        self.calls += 1
        return f"msg-{self.calls}"


class MatchNotifyServiceTests(unittest.TestCase):
    def _build_repo(self):
        repo = InMemoryMatchNotifyRepository()
        repo.revisions["rev-1"] = TenderRevisionContext(
            tender_pk="nara:T1",
            tender_id="T1",
            source="nara",
            tender_revision_pk="rev-1",
            revision_hash="rh1",
            normalized_payload={
                "title": "서울 도로 유지보수",
                "agency": "서울시",
                "deadline": "2099-01-15",
                "region": "서울",
                "category": "건설",
                "budget": {"min": 100, "max": 300},
                "urls": ["https://example.com/t1"],
            },
        )
        repo.subscriptions.append(
            Subscription(
                id="sub-1",
                user_id="u1",
                channel="email",
                is_active=True,
                saved_filters={"region": "서울", "category": "건설", "deadline_lte": "2099-12-31"},
                profile_fields={"preferred_categories": ["건설"], "preferred_regions": ["서울"], "min_budget": 50},
            )
        )
        return repo

    def test_same_revision_twice_does_not_duplicate_notifications(self):
        repo = self._build_repo()
        notifier = StableNotifier()
        svc = MatchNotifyService(repository=repo, notifier=notifier)

        first = svc.run_for_revision("rev-1")
        second = svc.run_for_revision("rev-1")

        self.assertEqual(first.notifications_sent, 1)
        self.assertEqual(second.notifications_sent, 0)
        self.assertEqual(second.notifications_skipped, 1)
        self.assertEqual(len(repo.delivery_logs), 1)
        self.assertEqual(repo.delivery_logs[0]["delivery_status"], "delivered")
        self.assertEqual(notifier.calls, 1)
        self.assertEqual(len(repo.match_results), 1)
        why = repo.match_results[0]["explanation"]
        self.assertIn("hard_filters", why)
        self.assertIn("top_signals", why)
        self.assertIn("risk_flags", why)

    def test_delivery_status_transitions_and_retry(self):
        repo = self._build_repo()
        notifier = FlakyNotifier()
        svc = MatchNotifyService(repository=repo, notifier=notifier, max_attempts=3)

        first = svc.run_for_revision("rev-1")
        self.assertEqual(first.notifications_failed, 1)
        self.assertEqual(len(repo.delivery_logs), 1)
        self.assertEqual(repo.delivery_logs[0]["delivery_status"], "failed")
        self.assertEqual(repo.delivery_logs[0]["attempt_count"], 1)

        second = svc.run_for_revision("rev-1")
        self.assertEqual(second.notifications_sent, 1)
        self.assertEqual(repo.delivery_logs[0]["delivery_status"], "delivered")
        self.assertEqual(repo.delivery_logs[0]["attempt_count"], 2)

        history = repo.delivery_logs[0]["payload"].get("status_history", [])
        self.assertIn("queued", history)
        self.assertIn("processing", history)
        self.assertIn("failed", history)
        self.assertIn("delivered", history)


if __name__ == "__main__":
    unittest.main()
