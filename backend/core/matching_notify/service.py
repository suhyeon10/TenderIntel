import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from core.logging_config import get_logger

from .models import MatchExplanation, MatchNotifyStats, MatchOutcome, Subscription, TenderRevisionContext
from .notifiers import DummyNotificationProvider, NotificationProvider
from .repository import MatchNotifyRepository, build_event_key


logger = get_logger(__name__)


class MatchNotifyService:
    def __init__(
        self,
        repository: MatchNotifyRepository,
        notifier: Optional[NotificationProvider] = None,
        max_attempts: int = 3,
    ):
        self.repository = repository
        self.notifier = notifier or DummyNotificationProvider()
        self.max_attempts = max_attempts

    def run_for_revision(self, tender_revision_pk: str, job_name: str = "match_notify") -> MatchNotifyStats:
        started = time.perf_counter()
        stats = MatchNotifyStats()

        revision = self.repository.get_revision_context(tender_revision_pk)
        if not revision:
            raise ValueError(f"revision not found: {tender_revision_pk}")

        subscriptions = self.repository.list_active_subscriptions()
        for sub in subscriptions:
            stats.subscriptions_scanned += 1
            outcome = self._compute_match(sub, revision)
            self.repository.upsert_match_result(outcome)
            stats.matches_computed += 1

            if not outcome.matched:
                continue

            sent = self._notify_if_needed(sub, revision, outcome)
            if sent is True:
                stats.notifications_sent += 1
            elif sent is False:
                stats.notifications_skipped += 1
            else:
                stats.notifications_failed += 1

        duration_ms = int((time.perf_counter() - started) * 1000)
        logger.info(
            "match_notify_revision_processed",
            extra={
                "job_name": job_name,
                "tender_id": revision.tender_id,
                "revision_hash": revision.revision_hash,
                "revision_id": revision.tender_revision_pk,
                "status": "success",
                "duration_ms": duration_ms,
            },
        )
        return stats

    def _compute_match(self, sub: Subscription, revision: TenderRevisionContext) -> MatchOutcome:
        payload = revision.normalized_payload or {}
        filters = sub.saved_filters or {}
        profile = sub.profile_fields or {}

        hard_filters: Dict[str, bool] = {}
        matched = True

        region_required = filters.get("region")
        if region_required:
            hard_filters["region"] = payload.get("region") == region_required
            matched = matched and hard_filters["region"]

        category_required = filters.get("category")
        if category_required:
            hard_filters["category"] = payload.get("category") == category_required
            matched = matched and hard_filters["category"]

        deadline_lte = filters.get("deadline_lte")
        if deadline_lte:
            hard_filters["deadline_lte"] = (payload.get("deadline") or "9999-99-99") <= deadline_lte
            matched = matched and hard_filters["deadline_lte"]

        budget = payload.get("budget") or {}
        budget_min = budget.get("min")
        budget_max = budget.get("max")

        top_signals: List[str] = []
        score = 0.0

        preferred_categories = profile.get("preferred_categories") or []
        if payload.get("category") in preferred_categories:
            top_signals.append("category aligned with preferred profile")
            score += 35

        preferred_regions = profile.get("preferred_regions") or []
        if payload.get("region") in preferred_regions:
            top_signals.append("region aligned with preferred profile")
            score += 25

        budget_floor = profile.get("min_budget")
        if budget_floor is not None and budget_max is not None and budget_max >= budget_floor:
            top_signals.append("budget meets minimum threshold")
            score += 20

        urls = payload.get("urls") or []
        if urls:
            top_signals.append("source links available")
            score += 10

        if matched:
            score += 10

        risk_flags: List[str] = []
        if not payload.get("deadline"):
            risk_flags.append("missing_deadline")
        else:
            try:
                deadline = datetime.fromisoformat(payload["deadline"]).replace(tzinfo=timezone.utc)
                if deadline <= datetime.now(timezone.utc) + timedelta(days=7):
                    risk_flags.append("deadline_soon")
            except Exception:
                pass

        if budget_min is None and budget_max is None:
            risk_flags.append("missing_budget")

        explanation = MatchExplanation(hard_filters=hard_filters, top_signals=top_signals[:3], risk_flags=risk_flags)
        return MatchOutcome(
            subscription_pk=sub.id,
            tender_revision_pk=revision.tender_revision_pk,
            fit_score=round(min(score, 100.0), 2),
            matched=matched,
            explanation=explanation,
        )

    def _notify_if_needed(self, sub: Subscription, revision: TenderRevisionContext, outcome: MatchOutcome) -> Optional[bool]:
        event_key = build_event_key(sub.id, revision.tender_revision_pk)
        existing = self.repository.get_delivery_log(sub.id, sub.channel, event_key)

        if existing and existing.get("delivery_status") == "delivered":
            return False

        if existing:
            attempts = int(existing.get("attempt_count") or 0)
            if attempts >= int(existing.get("max_attempts") or self.max_attempts):
                return False
            delivery = existing
        else:
            delivery = self.repository.create_delivery_log(
                {
                    "subscription_pk": sub.id,
                    "tender_revision_pk": revision.tender_revision_pk,
                    "channel": sub.channel,
                    "event_type": "match_created",
                    "event_key": event_key,
                    "delivery_status": "queued",
                    "payload": {
                        "fit_score": outcome.fit_score,
                        "why_matched": {
                            "hard_filters": outcome.explanation.hard_filters,
                            "top_signals": outcome.explanation.top_signals,
                            "risk_flags": outcome.explanation.risk_flags,
                        },
                        "status_history": ["queued"],
                    },
                    "attempt_count": 0,
                    "max_attempts": self.max_attempts,
                }
            )

        attempt_count = int(delivery.get("attempt_count") or 0) + 1
        status_history = (delivery.get("payload") or {}).get("status_history", [])
        status_history = [*status_history, "processing"]

        self.repository.update_delivery_log(
            delivery["id"],
            {
                "delivery_status": "processing",
                "attempt_count": attempt_count,
                "attempted_at": datetime.now(timezone.utc).isoformat(),
                "payload": {**(delivery.get("payload") or {}), "status_history": status_history},
            },
        )

        try:
            provider_message_id = self.notifier.send(subscription=sub, revision=revision, outcome=outcome)
            status_history = [*status_history, "delivered"]
            self.repository.update_delivery_log(
                delivery["id"],
                {
                    "delivery_status": "delivered",
                    "provider_message_id": provider_message_id,
                    "delivered_at": datetime.now(timezone.utc).isoformat(),
                    "error_message": None,
                    "payload": {**(delivery.get("payload") or {}), "status_history": status_history},
                },
            )
            logger.info("pipeline_metric", extra={"metric": "notify_failures", "value": 0, "stage": "notify", "revision_id": revision.tender_revision_pk, "tender_id": revision.tender_id})
            return True
        except Exception as exc:
            status_history = [*status_history, "failed"]
            next_retry_at = datetime.now(timezone.utc) + timedelta(minutes=min(5 * attempt_count, 60))
            self.repository.update_delivery_log(
                delivery["id"],
                {
                    "delivery_status": "failed",
                    "error_message": str(exc),
                    "next_retry_at": next_retry_at.isoformat(),
                    "payload": {**(delivery.get("payload") or {}), "status_history": status_history},
                },
            )
            logger.info("pipeline_metric", extra={"metric": "notify_failures", "value": 1, "stage": "notify", "revision_id": revision.tender_revision_pk, "tender_id": revision.tender_id})
            return None
