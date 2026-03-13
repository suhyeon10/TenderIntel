# TenderIntel v2 Architecture (Reuse-first)

This architecture keeps the existing **Next.js + FastAPI + Supabase(pgvector)** stack and evolves it into a resilient pipeline:

**Ingest → Normalize(+change detection) → Store → Index → Match/Score → Notify**

## One-page pipeline diagram

```mermaid
flowchart LR
    subgraph Sources[External/Internal Sources]
      S1[Nara/G2B APIs]
      S2[Agency pages / files]
      S3[Manual upload]
    end

    subgraph Ingest[1) Ingest]
      I1[Source Adapters]
      I2[Raw Payload Capture]
      I3[Idempotency Key\n(source + external_id + observed_at)]
    end

    subgraph Normalize[2) Normalize + Change Detection]
      N1[Canonical Tender DTO]
      N2[Normalization Rules\n(dates, budget, region, tags)]
      N3[Hash & Diff\n(raw_hash, normalized_hash)]
      N4{Changed vs Latest Revision?}
    end

    subgraph Store[3) Store (Append-only)]
      T1[(tenders)]
      T2[(tender_revisions)]
      T3[(ingest_events / job_runs)]
      T4[(latest view/materialized view)]
    end

    subgraph Index[4) Index]
      X1[Revision Text Builder]
      X2[Chunker]
      X3[Embedding Generator]
      X4[(tender_index_documents)]
      X4b[(tender_index_chunks + vector_stub)]
      X5[Index Job Status]
    end

    subgraph MatchScore[5) Match / Score]
      M1[Candidate Retriever]
      M2[Rule-based Baseline Scorer]
      M3[Optional LLM Rationale\n(evidence-gated)]
      M4[(match_results + score_factors)]
    end

    subgraph Notify[6) Notify]
      O1[(notification_outbox)]
      O2[Delivery Worker\n(email/webhook/in-app)]
      O3[(delivery_history)]
    end

    subgraph Ops[Observability & Reliability]
      P1[Structured Logs\n(stage, entity_id, revision_id)]
      P2[Metrics\n(latency, error rate, retries)]
      P3[Retry/Backoff + DLQ]
    end

    S1 --> I1
    S2 --> I1
    S3 --> I1

    I1 --> I2 --> I3 --> N1 --> N2 --> N3 --> N4
    N4 -- No --> T3
    N4 -- Yes --> T1 --> T2 --> T3 --> T4

    T2 --> X1 --> X2 --> X3 --> X4 --> X4b --> X5
    X5 --> M1 --> M2 --> M3 --> M4 --> O1 --> O2 --> O3

    I1 -. logs/metrics .-> P1
    N2 -. logs/metrics .-> P1
    X3 -. logs/metrics .-> P1
    M2 -. logs/metrics .-> P1
    O2 -. logs/metrics .-> P1
    P1 --> P2 --> P3
```

## Key invariants

1. **Idempotency is mandatory at every stage**
   - Ingest dedupe by stable source key + hash.
   - Index dedupe by `(revision_id, chunk_index, embedding_model_version)`.
   - Notify dedupe by event key `(user_id, trigger_type, revision_id)`.

2. **Revisions are append-only (never overwrite history)**
   - Any meaningful tender content change creates a new `tender_revisions` row.
   - Latest views are derived representations, not source of truth.

3. **Partial availability over full-stop failure**
   - If indexing or notification fails, stored revisions remain queryable.
   - Failed jobs are retried asynchronously; users still see latest successful state.

4. **Traceable decisions**
   - Match scores and notifications must reference revision IDs and scoring/model versions.
   - Every stage emits structured logs with correlation IDs.

## Hashing location in pipeline
- **Ingest stage** computes `raw_content_hash` from captured raw payloads and stores immutable raw objects.
- **Normalize stage** computes canonical payload hash (`normalized_content_hash`) from normalized fields (`title`, `agency`, `deadline`, `budget`, `region`, `category`, `urls`) and then derives `revision_hash`.
- **Change detection** compares normalized/revision hashes against the latest revision for the tender: same hash => no-op, changed hash => append new revision (never overwrite).

## Minimal-change implementation notes
- Reuse `backend/core/orchestrator_v2.py` pattern as v2 stage coordinator.
- Reuse `backend/core/supabase_vector_store.py` as storage/index adapter with tender-specific methods.
- Reuse existing FastAPI route organization and logging setup.
- Introduce new schema only through Supabase migrations; keep legacy endpoints while rolling out v2.


## Indexing outputs
- **Tender-level index** (`tender_index_documents`): keyword/facet search by `region`, `category`, `deadline`, and revision-scoped document metadata.
- **Chunk-level index** (`tender_index_chunks`): attachment-derived chunks for citations/RAG, always keyed by `tender_revision_pk` so old/new revisions never mix.
- **Reindex job**: available via API (`POST /api/v2/tenders/reindex`) and script (`backend/scripts/reindex_tenders.py`).


## Match/notify explanation and dedupe
- Matcher evaluates subscriptions using saved filters (`criteria`) and profile fields (`profile_fields`) and stores `fit_score` + `why matched` explanation (`hard_filters`, `top_signals`, `risk_flags`).
- Notifier uses deterministic event key per `(subscription_pk, tender_revision_pk)` to deduplicate deliveries.
- Failed deliveries are retried by updating the same `delivery_logs` row (`attempt_count`, `next_retry_at`) instead of inserting duplicate notifications.
