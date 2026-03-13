import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Protocol

from core.supabase_vector_store import SupabaseVectorStore

from .models import MatchOutcome, Subscription, TenderRevisionContext


class MatchNotifyRepository(Protocol):
    def get_revision_context(self, tender_revision_pk: str) -> Optional[TenderRevisionContext]:
        ...

    def list_active_subscriptions(self) -> List[Subscription]:
        ...

    def upsert_match_result(self, outcome: MatchOutcome) -> bool:
        ...

    def get_delivery_log(self, subscription_pk: str, channel: str, event_key: str) -> Optional[Dict[str, Any]]:
        ...

    def create_delivery_log(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        ...

    def update_delivery_log(self, delivery_id: str, fields: Dict[str, Any]) -> None:
        ...


class SupabaseMatchNotifyRepository:
    def __init__(self):
        self.store = SupabaseVectorStore()
        self.store._ensure_initialized()
        self.sb = self.store.sb

    @staticmethod
    def _utc_now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def get_revision_context(self, tender_revision_pk: str) -> Optional[TenderRevisionContext]:
        rev = self.sb.table("tender_revisions").select("id,tender_pk,revision_hash,normalized_payload").eq("id", tender_revision_pk).limit(1).execute()
        if not rev.data:
            return None
        rev_row = rev.data[0]

        tender = self.sb.table("tenders").select("id,tender_id,source").eq("id", rev_row["tender_pk"]).limit(1).execute()
        if not tender.data:
            return None
        tender_row = tender.data[0]

        return TenderRevisionContext(
            tender_pk=tender_row["id"],
            tender_id=tender_row["tender_id"],
            source=tender_row["source"],
            tender_revision_pk=rev_row["id"],
            revision_hash=rev_row["revision_hash"],
            normalized_payload=rev_row.get("normalized_payload") or {},
        )

    def list_active_subscriptions(self) -> List[Subscription]:
        rows = self.sb.table("subscriptions").select("id,user_id,channel,is_active,criteria,profile_fields").eq("is_active", True).execute().data or []
        subs = []
        for row in rows:
            subs.append(
                Subscription(
                    id=row["id"],
                    user_id=row.get("user_id"),
                    channel=row.get("channel") or "email",
                    is_active=bool(row.get("is_active")),
                    saved_filters=row.get("criteria") or {},
                    profile_fields=row.get("profile_fields") or {},
                )
            )
        return subs

    def upsert_match_result(self, outcome: MatchOutcome) -> bool:
        existing = self.sb.table("match_results").select("id").eq("subscription_pk", outcome.subscription_pk).eq("tender_revision_pk", outcome.tender_revision_pk).limit(1).execute()
        payload = {
            "subscription_pk": outcome.subscription_pk,
            "tender_revision_pk": outcome.tender_revision_pk,
            "fit_score": outcome.fit_score,
            "is_match": outcome.matched,
            "explanation": {
                "hard_filters": outcome.explanation.hard_filters,
                "top_signals": outcome.explanation.top_signals,
                "risk_flags": outcome.explanation.risk_flags,
            },
        }
        if existing.data:
            self.sb.table("match_results").update(payload).eq("id", existing.data[0]["id"]).execute()
            return False
        self.sb.table("match_results").insert(payload).execute()
        return True

    def get_delivery_log(self, subscription_pk: str, channel: str, event_key: str) -> Optional[Dict[str, Any]]:
        result = self.sb.table("delivery_logs").select("*").eq("subscription_pk", subscription_pk).eq("channel", channel).eq("event_key", event_key).limit(1).execute()
        return result.data[0] if result.data else None

    def create_delivery_log(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        result = self.sb.table("delivery_logs").insert(payload).execute()
        return result.data[0]

    def update_delivery_log(self, delivery_id: str, fields: Dict[str, Any]) -> None:
        self.sb.table("delivery_logs").update(fields).eq("id", delivery_id).execute()


@dataclass
class InMemoryMatchNotifyRepository:
    revisions: Dict[str, TenderRevisionContext] = field(default_factory=dict)
    subscriptions: List[Subscription] = field(default_factory=list)
    match_results: List[Dict[str, Any]] = field(default_factory=list)
    delivery_logs: List[Dict[str, Any]] = field(default_factory=list)

    def get_revision_context(self, tender_revision_pk: str) -> Optional[TenderRevisionContext]:
        return self.revisions.get(tender_revision_pk)

    def list_active_subscriptions(self) -> List[Subscription]:
        return [s for s in self.subscriptions if s.is_active]

    def upsert_match_result(self, outcome: MatchOutcome) -> bool:
        for row in self.match_results:
            if row["subscription_pk"] == outcome.subscription_pk and row["tender_revision_pk"] == outcome.tender_revision_pk:
                row.update(
                    {
                        "fit_score": outcome.fit_score,
                        "is_match": outcome.matched,
                        "explanation": {
                            "hard_filters": outcome.explanation.hard_filters,
                            "top_signals": outcome.explanation.top_signals,
                            "risk_flags": outcome.explanation.risk_flags,
                        },
                    }
                )
                return False
        self.match_results.append(
            {
                "subscription_pk": outcome.subscription_pk,
                "tender_revision_pk": outcome.tender_revision_pk,
                "fit_score": outcome.fit_score,
                "is_match": outcome.matched,
                "explanation": {
                    "hard_filters": outcome.explanation.hard_filters,
                    "top_signals": outcome.explanation.top_signals,
                    "risk_flags": outcome.explanation.risk_flags,
                },
            }
        )
        return True

    def get_delivery_log(self, subscription_pk: str, channel: str, event_key: str) -> Optional[Dict[str, Any]]:
        for row in self.delivery_logs:
            if row["subscription_pk"] == subscription_pk and row["channel"] == channel and row["event_key"] == event_key:
                return row
        return None

    def create_delivery_log(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        row = {"id": f"dlv:{len(self.delivery_logs)+1}", **payload}
        self.delivery_logs.append(row)
        return row

    def update_delivery_log(self, delivery_id: str, fields: Dict[str, Any]) -> None:
        for row in self.delivery_logs:
            if row["id"] == delivery_id:
                row.update(fields)
                return


def build_event_key(subscription_pk: str, tender_revision_pk: str) -> str:
    return hashlib.sha256(f"match_notify:{subscription_pk}:{tender_revision_pk}".encode("utf-8")).hexdigest()
