from fastapi import APIRouter, Depends

from core.matching_notify.repository import SupabaseMatchNotifyRepository
from core.matching_notify.service import MatchNotifyService

router_match_notify = APIRouter(prefix="/api/v2/notify", tags=["Match Notify"])


def get_match_notify_service() -> MatchNotifyService:
    return MatchNotifyService(SupabaseMatchNotifyRepository())


@router_match_notify.post("/revisions/{tender_revision_pk}")
def run_match_notify(
    tender_revision_pk: str,
    service: MatchNotifyService = Depends(get_match_notify_service),
):
    stats = service.run_for_revision(tender_revision_pk)
    return {
        "status": "ok",
        "tender_revision_pk": tender_revision_pk,
        "subscriptions_scanned": stats.subscriptions_scanned,
        "matches_computed": stats.matches_computed,
        "notifications_sent": stats.notifications_sent,
        "notifications_skipped": stats.notifications_skipped,
        "notifications_failed": stats.notifications_failed,
    }
