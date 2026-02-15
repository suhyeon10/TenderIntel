# Manual Checklist: Match + Notify

Use this checklist to validate subscription-based matching and deduplicated notifications.

## 1) Seed data
- Insert one tender + one `tender_revisions` row (`revision_status='SUCCESS'`) with normalized payload fields: `title`, `agency`, `deadline`, `budget`, `region`, `category`, `urls`.
- Insert one active subscription in `subscriptions` with:
  - `criteria` (saved filters), e.g. `{ "region": "서울", "category": "건설", "deadline_lte": "2099-12-31" }`
  - `profile_fields`, e.g. `{ "preferred_categories": ["건설"], "preferred_regions": ["서울"], "min_budget": 50 }`

## 2) Run matcher + notifier
- Call API: `POST /api/v2/notify/revisions/{tender_revision_pk}`
  - or run script: `python backend/scripts/run_match_notify.py <tender_revision_pk>`

## 3) Verify match outputs
- `match_results` has one row for `(subscription_pk, tender_revision_pk)`.
- `fit_score` is populated.
- `explanation` contains:
  - `hard_filters`
  - `top_signals`
  - `risk_flags`

## 4) Verify notification dedupe
- Re-run for same revision.
- Confirm `delivery_logs` row count does **not** increase for same `(subscription_pk, channel, event_key)`.
- Confirm previously delivered notification is skipped (no duplicate send).

## 5) Verify retry behavior
- Force provider failure once (test/dummy provider).
- Confirm status transitions on same `delivery_logs` row:
  - `queued -> processing -> failed -> processing -> delivered`
- Confirm `attempt_count` increments and retry does not create duplicate rows.

