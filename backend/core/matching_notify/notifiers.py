from typing import Protocol

from .models import MatchOutcome, Subscription, TenderRevisionContext


class NotificationProvider(Protocol):
    def send(self, *, subscription: Subscription, revision: TenderRevisionContext, outcome: MatchOutcome) -> str:
        ...


class DummyNotificationProvider:
    """Default no-op provider for local/dev/tests. Returns deterministic message id."""

    def send(self, *, subscription: Subscription, revision: TenderRevisionContext, outcome: MatchOutcome) -> str:
        return f"dummy:{subscription.id}:{revision.tender_revision_pk}"
