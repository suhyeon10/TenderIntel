"""Run matching and notifications for a single tender revision."""

import argparse

from core.matching_notify.repository import SupabaseMatchNotifyRepository
from core.matching_notify.service import MatchNotifyService


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("tender_revision_pk", help="Target tender revision UUID")
    args = parser.parse_args()

    service = MatchNotifyService(SupabaseMatchNotifyRepository())
    stats = service.run_for_revision(args.tender_revision_pk)
    print(
        {
            "tender_revision_pk": args.tender_revision_pk,
            "subscriptions_scanned": stats.subscriptions_scanned,
            "matches_computed": stats.matches_computed,
            "notifications_sent": stats.notifications_sent,
            "notifications_skipped": stats.notifications_skipped,
            "notifications_failed": stats.notifications_failed,
        }
    )


if __name__ == "__main__":
    main()
