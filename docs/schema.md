# TenderIntel v2 Canonical Schema

This document describes the new additive schema introduced for TenderIntel v2. It is designed to preserve history, support idempotent ingestion/notification, and avoid breaking existing MVP flows.

## Design principles
- **Never overwrite revisions**: all meaningful tender changes append a new row in `tender_revisions`.
- **Hash-based change detection**: compare source and normalized hashes to decide whether to create a revision.
- **Idempotent notifications**: delivery deduplication through stable event keys.
- **Additive rollout**: legacy tables remain intact; new tables are added alongside current MVP schema.

---

## Table overview

## 1) `tenders`
Canonical identity table for a tender record from a source system.

**Purpose**
- Stores stable identity and latest-known pointers.
- Enforces one canonical row per `(source, tender_id)`.

**Key fields**
- `id` (UUID PK)
- `source` (TEXT, not null)
- `tender_id` (TEXT, not null)
- `current_revision_id` (FK to `tender_revisions.id`, nullable)
- `latest_revision_hash`
- `latest_raw_content_hash`
- `latest_normalized_content_hash`
- `first_seen_at`, `last_seen_at`, `created_at`, `updated_at`

**Uniqueness**
- `UNIQUE (source, tender_id)`

---

## 2) `tender_revisions`
Immutable revision ledger for each tender.

**Purpose**
- Stores source payload and normalized payload snapshots.
- Captures revision hashes and changed fields for auditability.

**Key fields**
- `id` (UUID PK)
- `tender_pk` (FK to `tenders.id`)
- `revision_number` (int, monotonic per tender)
- `revision_hash` (text)
- `raw_content_hash` (text)
- `normalized_content_hash` (text)
- `source_payload` (JSONB)
- `normalized_payload` (JSONB)
- `changed_fields` (JSONB array)
- `change_reason`, `observed_at`, `effective_at`, `created_at`

**Uniqueness**
- `UNIQUE (tender_pk, revision_hash)`
- `UNIQUE (tender_pk, revision_number)`

---

## 3) `attachments`
Files related to a tender and optionally pinned to a specific revision.

**Purpose**
- Tracks tender artifacts (docs, zip, specs) with content hashes.
- Supports detecting duplicate file ingestion.

**Key fields**
- `id` (UUID PK)
- `tender_pk` (FK to `tenders.id`)
- `tender_revision_pk` (FK to `tender_revisions.id`, nullable)
- `filename`, `storage_path`, `mime_type`, `byte_size`
- `content_hash`
- `metadata` (JSONB), `created_at`

**Uniqueness**
- `UNIQUE (tender_revision_pk, filename, content_hash)`

---

## 4) `extraction_results`
Structured extraction output per revision and extractor version.

**Purpose**
- Stores normalized extraction outputs and metrics/errors.
- Enables deterministic reruns and versioned extractor behavior.

**Key fields**
- `id` (UUID PK)
- `tender_revision_pk` (FK to `tender_revisions.id`)
- `extractor_name`, `extractor_version`
- `status`, `extraction_hash`
- `extracted_payload`, `errors`, `metrics` (JSONB)
- `created_at`

**Uniqueness**
- `UNIQUE (tender_revision_pk, extractor_name, extractor_version)`

---

## 5) `subscriptions`
User subscription definitions for notification rules.

**Purpose**
- Captures who should be notified, over which channel, for what target.
- Supports active/inactive lifecycle.

**Key fields**
- `id` (UUID PK)
- `user_id` (UUID, nullable for system-level rules)
- `channel` (e.g. `email`, `webhook`, `in_app`)
- `target_type`, `target_key`
- `criteria` (JSONB)
- `is_active`, `last_notified_at`, `created_at`, `updated_at`

**Uniqueness**
- `UNIQUE (user_id, channel, target_type, target_key)`

---

## 6) `delivery_logs`
Delivery audit trail and dedupe ledger for notifications.

**Purpose**
- Ensures notification sends are idempotent by event key.
- Captures provider IDs, statuses, retries, and errors.

**Key fields**
- `id` (UUID PK)
- `subscription_pk` (FK to `subscriptions.id`)
- `tender_revision_pk` (FK to `tender_revisions.id`, nullable)
- `channel`, `event_type`, `event_key`
- `delivery_status`, `provider_message_id`
- `payload`, `error_message`
- `attempted_at`, `delivered_at`, `created_at`

**Uniqueness**
- `UNIQUE (subscription_pk, channel, event_key)`

---


## 7) `raw_payloads`
Raw source blobs captured during ingest and linked to a specific `tender_revisions` row.

**Purpose**
- Persists raw JSON/HTML/text payloads for replay/audit.
- Prevents duplicate raw object persistence per revision using content hash.

**Key fields**
- `id` (UUID PK)
- `tender_revision_pk` (FK to `tender_revisions.id`)
- `payload_type` (`json` | `html` | `pdf_meta` ...)
- `content_hash`
- `content_json`, `content_text`, `source_url`, `metadata`
- `created_at`

**Uniqueness**
- `UNIQUE (tender_revision_pk, content_hash)`

---

## 8) `ingestion_jobs`
Queue table for follow-up jobs from ingest stage (e.g. `normalize_tender`).

**Purpose**
- Enqueues downstream jobs with idempotency key.
- Supports retries through `attempts`, `max_attempts`, and `status`.

**Key fields**
- `id` (UUID PK)
- `job_name`
- `idempotency_key`
- `status` (`queued`, `processing`, `done`, `failed`)
- `payload` (JSONB)
- `attempts`, `max_attempts`, `last_error`
- `available_at`, `created_at`, `updated_at`

**Uniqueness**
- `UNIQUE (job_name, idempotency_key)`

---

## 9) `failed_jobs`
Dead-letter/failed job ledger for ingestion and normalization failures.

**Purpose**
- Persists terminal failures for observability and operator replay.
- Guarantees idempotent failure recording for same job/idempotency key.

**Key fields**
- `id` (UUID PK)
- `job_name`
- `idempotency_key`
- `payload`
- `error_message`
- `status`, `failed_at`

**Uniqueness**
- `UNIQUE (job_name, idempotency_key)`

---

## Migration files
- `supabase/migrations/008_tenderintel_v2_schema.sql`
- `supabase/migrations/009_ingestion_raw_payloads_and_jobs.sql`
- `supabase/migrations/010_tender_revisions_status.sql`
- `supabase/migrations/011_tender_indexes.sql`
- `supabase/migrations/012_matcher_notifications.sql`

These migrations are additive and intended to apply cleanly on a fresh database without removing legacy MVP tables.


## 10) `tender_index_documents`
Tender-level search index (revision-scoped).

**Purpose**
- Supports keyword + facet search for tenders.
- Keeps index rows tied to exact `tender_revision_pk`.

**Uniqueness**
- `UNIQUE (tender_revision_pk)`

---

## 11) `tender_index_chunks`
Chunk-level index for attachment-derived snippets and future RAG/vector retrieval.

**Purpose**
- Stores chunk text + metadata + vector stub by revision.
- Prevents duplicate chunks for the same revision.

**Uniqueness**
- `UNIQUE (tender_revision_pk, chunk_hash)`


## 12) `match_results`
Subscription-to-revision match ledger with fit score and explanation.

**Purpose**
- Persists matcher outputs for audit and explainability.
- Keeps one logical match row per `(subscription, revision)` idempotently.

**Uniqueness**
- `UNIQUE (subscription_pk, tender_revision_pk)`

---

## Delivery retry fields (`delivery_logs`)
- `attempt_count`: incremented per send attempt.
- `max_attempts`: upper bound for retries.
- `next_retry_at`: scheduled retry timestamp after failure.
