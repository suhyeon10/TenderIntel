from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class Subscription:
    id: str
    user_id: Optional[str]
    channel: str
    is_active: bool
    saved_filters: Dict[str, Any] = field(default_factory=dict)
    profile_fields: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TenderRevisionContext:
    tender_pk: str
    tender_id: str
    source: str
    tender_revision_pk: str
    revision_hash: str
    normalized_payload: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MatchExplanation:
    hard_filters: Dict[str, Any]
    top_signals: List[str]
    risk_flags: List[str]


@dataclass
class MatchOutcome:
    subscription_pk: str
    tender_revision_pk: str
    fit_score: float
    matched: bool
    explanation: MatchExplanation


@dataclass
class MatchNotifyStats:
    subscriptions_scanned: int = 0
    matches_computed: int = 0
    notifications_sent: int = 0
    notifications_skipped: int = 0
    notifications_failed: int = 0
