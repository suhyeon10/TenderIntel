# TenderIntel v2 Runbook (Ops)

This runbook covers production-oriented operations for the pipeline:

**Ingest → Normalize → Index → Match/Notify**

## 0) Key observability signals

Structured logs now include correlation fields:
- `job_name`
- `tender_id`
- `revision_hash`
- `revision_id` (=`tender_revision_pk`)
- `status`
- `duration_ms`

Metric-style log events (`pipeline_metric`) are emitted for:
- `ingestion_success_rate` (0/1)
- `normalize_failures` (0/1)
- `indexing_latency_ms`
- `notify_failures` (0/1)

---

## 1) Re-run jobs safely

### Reindex all revisions (or by source)
```bash
python backend/scripts/reindex_tenders.py
python backend/scripts/reindex_tenders.py --source nara
```

Idempotency guarantees:
- `tender_index_documents`: unique by `tender_revision_pk`
- `tender_index_chunks`: unique by `(tender_revision_pk, chunk_hash)`

### Re-run matching + notify for a revision
```bash
python backend/scripts/run_match_notify.py <tender_revision_pk>
```

Deduplication guarantees:
- deterministic `event_key = hash(subscription_pk, tender_revision_pk)`
- delivered events are skipped on re-run
- failed deliveries retry in-place (same `delivery_logs` row)

---

## 2) Inspect DLQ / failed jobs

### Ingestion/normalize failed jobs
```sql
SELECT id, job_name, idempotency_key, status, error_message, failed_at
FROM failed_jobs
ORDER BY failed_at DESC
LIMIT 100;
```

### Notification failures pending retry
```sql
SELECT id, subscription_pk, tender_revision_pk, delivery_status, attempt_count, max_attempts, next_retry_at, error_message
FROM delivery_logs
WHERE delivery_status = 'failed'
ORDER BY next_retry_at NULLS FIRST, attempted_at DESC
LIMIT 100;
```

### Delivery status transitions
```sql
SELECT id, event_key, delivery_status, attempt_count, payload->'status_history' AS status_history
FROM delivery_logs
ORDER BY created_at DESC
LIMIT 100;
```

---

## 3) Backfill strategy

### A) Backfill index from existing successful revisions
1. Confirm `tender_revisions.revision_status='SUCCESS'` exists.
2. Run:
   ```bash
   python backend/scripts/reindex_tenders.py
   ```
3. Validate row counts and uniqueness:
   ```sql
   SELECT COUNT(*) FROM tender_index_documents;
   SELECT COUNT(*) FROM tender_index_chunks;
   ```

### B) Backfill match/notify for existing revisions
1. Query target revisions:
   ```sql
   SELECT id FROM tender_revisions WHERE revision_status='SUCCESS' ORDER BY created_at DESC;
   ```
2. Replay per revision:
   ```bash
   python backend/scripts/run_match_notify.py <revision_id>
   ```
3. Validate dedupe:
   - no duplicate `(subscription_pk, channel, event_key)` rows in `delivery_logs`

---

## 4) Incident quick actions

### High normalize failure rate
- Check parse errors in logs where `metric=normalize_failures` and `value=1`.
- Verify incoming payload shape changed (connector-level contract).
- Re-run normalization after parser updates.

### High notify failure rate
- Check `delivery_logs.error_message`, `attempt_count`, `next_retry_at`.
- Verify provider credentials/network.
- Re-run revision once provider recovers (no duplicate spam due to event-key dedupe).

### Slow indexing
- Track `pipeline_metric` where `metric=indexing_latency_ms`.
- Inspect oversized attachments/chunks.
- Re-run by source to reduce load (`--source <name>`).

---

## 5) Smoke checklist (post-deploy)
- [ ] Run unit test suite in CI.
- [ ] Trigger `reindex` for sample source and verify non-zero indexed docs/chunks.
- [ ] Execute `/api/v2/tenders/search` with keyword+facet filters and validate deterministic results.
- [ ] Run match+notify on one revision and verify:
  - `match_results` contains explanation fields,
  - `delivery_logs` has status transitions and retry metadata,
  - re-running same revision does not duplicate delivered notifications.

