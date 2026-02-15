# TenderIntel v2 Execution Plan

## Scope and objective
TenderIntel v2 should evolve the existing MVP into a production-minded pipeline:

**Ingest → Normalize (+change detection) → Store → Index → Match/Score → Notify**

This plan is intentionally incremental and reuses existing backend/frontend/Supabase components to minimize disruption.

---

## 1) Repo map (current state audit)

### Main modules
- `src/` (Next.js frontend): user-facing flows (`/legal`, `/upload`, `/match`, `/admin`) and API route handlers under `src/app/api/*`.
- `backend/` (FastAPI backend): ingestion, RAG orchestration, legal analysis, Supabase integration.
- `backend/core/`: processing primitives (`document_processor_v2.py`, `generator_v2.py`, `supabase_vector_store.py`, `orchestrator_v2.py`, logging/error modules).
- `backend/api/`: HTTP routes (`routes_v2.py`, `routes_legal.py`, `routes_legal_v2.py`, `routes_legal_agent.py`).
- `supabase/migrations/`: SQL migrations for current legal-domain schema.
- `backend/scripts/`: ingestion/indexing/maintenance scripts (including legacy announcement/team scripts).

### Entrypoints
- Frontend app entry: `src/app/page.tsx` (currently redirects to `/legal`).
- Frontend server entry (dev/build/start): `package.json` scripts.
- Backend app entry: `backend/main.py` (registers routers + logging + health endpoints).
- Background/manual ingestion entrypoints: `backend/scripts/*.py` (e.g., `batch_ingest.py`, `ingest_legal.py`, `index_contracts_from_data.py`).

### Existing commands (dev/test)
Inferred from `package.json`, `README.md`, `SETUP.md`, and backend docs:

**Frontend (repo root)**
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`

**Backend (`backend/`)**
- `python main.py`
- `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`
- `pip install -r requirements.txt`

**Script-driven operations (`backend/`)**
- `python scripts/batch_ingest.py <path> --mode legal`
- `python scripts/sync_team_embeddings.py` (legacy/team mode)

### Current data model (high-level)
Current schema is mixed: legal-focused active model + legacy tender/team artifacts.

**Active legal-domain tables (migrations)**
- `legal_documents`: document metadata + hash/source/type.
- `legal_document_bodies`: raw body text.
- `legal_chunks`: chunked text + metadata + pgvector embedding.

**Additional analysis/history tables (script-defined/operational)**
- `contract_analyses`, `contract_issues`, `situation_analyses` (analysis outputs and history).

**Legacy tender/team traces (docs/scripts/code references)**
- Announcement/team concepts still exist in orchestrator/schema/docs, but are marked legacy in backend README.

---

## 2) Proposed v2 architecture (minimal-change, maximum reuse)

### Reuse-first approach
1. **Keep FastAPI + Next.js + Supabase pgvector stack.**
2. **Repurpose existing orchestrator pattern** (`orchestrator_v2.py`) into a domain-agnostic pipeline coordinator.
3. **Retain existing vector store abstraction** (`supabase_vector_store.py`) and add typed adapters per entity (`tender`, `profile`, `legal` if still needed).
4. **Use existing logging/error modules** to enforce observability for each pipeline stage.
5. **Introduce new tables via migrations only** for tender-specific revision tracking and notifications.

### Target v2 data flow
- **Ingest**: source adapters (Nara/local/manual/API) fetch raw tender payloads.
- **Normalize + change detection**: canonical field mapping + content hash diff against latest revision.
- **Store**: append-only revision rows (never overwrite), latest pointer/materialized view for read efficiency.
- **Index**: deterministic chunking/embedding with idempotent upsert keys (`tender_revision_id + chunk_index + embed_model_version`).
- **Match/Score**: query-time retrieval + deterministic scoring policy + explanation artifacts.
- **Notify**: event/outbox-driven notification workers with dedupe keys and delivery state.

### Invariants to enforce
- **Idempotent ingest/index/notify** using stable idempotency keys.
- **Revision preservation**: every source change creates a new revision row; no destructive overwrite.
- **Partial availability**: if one stage fails, prior successful stages remain queryable and retryable.
- **Traceability**: every score/notification must reference revision + model/prompt version.

---

## 3) Milestones and acceptance criteria

### M0 — Baseline and compatibility freeze
**Goal**: Safely prepare for v2 without breaking current API.

**Tasks**
- Inventory active vs legacy endpoints and scripts.
- Define v2 naming and ownership boundaries (`tender_*` pipeline modules).
- Add stage-level structured logging keys (`pipeline_stage`, `source`, `entity_id`, `revision_id`).

**Acceptance criteria**
- Clear endpoint/module inventory documented.
- Logging fields standardized and used in all stage entrypoints.
- No existing frontend route regressions.

---

### M1 — Ingest + normalize + change detection
**Goal**: Deterministic source ingestion with revision creation.

**Tasks**
- Add source adapters with canonical DTO mapping.
- Add content hashing strategy for raw + normalized payloads.
- Implement `upsert-if-new-revision` logic (idempotent per source item + hash).

**Acceptance criteria**
- Re-running same ingest payload creates no duplicate revisions.
- Modified source payload creates exactly one new revision.
- Structured logs emitted for ingest/normalize decisions.

---

### M2 — Store (append-only revision model)
**Goal**: Persist tender history as immutable revisions.

**Tasks**
- Add migration(s) for `tenders`, `tender_revisions`, and optional latest-view table/materialized view.
- Introduce repository methods for latest + historical retrieval.
- Backfill MVP data where feasible.

**Acceptance criteria**
- Historical revisions queryable by tender ID.
- Latest snapshot retrieval is performant and deterministic.
- No overwrite of prior revisions.

---

### M3 — Index (chunk + embedding + searchable retrieval)
**Goal**: Reliable indexing bound to revision identity.

**Tasks**
- Build revision-scoped chunk generation.
- Store embeddings with model/version metadata.
- Add retry-safe index job semantics and status tracking.

**Acceptance criteria**
- Index job is idempotent for same revision/model.
- Search returns chunks linked to exact source revision.
- Failed chunk/index jobs can retry without data corruption.

---

### M4 — Match/Score
**Goal**: Production-ready matching and explainable scoring.

**Tasks**
- Implement deterministic baseline scorer (weighted rubric).
- Add optional LLM augmentation gated by retrieval evidence.
- Persist score explanations and factors for auditability.

**Acceptance criteria**
- Same inputs produce same deterministic baseline score.
- Score output includes explanation + evidence references.
- Evaluation dataset and threshold checks documented.

---

### M5 — Notify
**Goal**: Deliver actionable alerts with dedupe/retry.

**Tasks**
- Add outbox table and worker for email/webhook/in-app notifications.
- Define notification triggers (new match, score threshold, revision delta).
- Implement dedupe key and delivery status transitions.

**Acceptance criteria**
- Duplicate triggers do not send duplicate notifications.
- Failed sends are retryable with backoff.
- Delivery history is queryable per user and event.

---

### M6 — Production hardening
**Goal**: Operable system with SLO-oriented observability.

**Tasks**
- Add stage metrics dashboards (latency, throughput, error rate, retry queue depth).
- Add runbooks for ingest/index/notify failures.
- Add smoke/integration tests for end-to-end pipeline path.

**Acceptance criteria**
- Core SLOs defined and measurable.
- On-call runbook covers common failure scenarios.
- End-to-end verification checklist passes in staging.

---

## 4) Manual verification checklist (for each milestone)
- [ ] Idempotency: replay same input/event and verify no duplicate state change.
- [ ] Revision integrity: update input and verify a new revision is appended.
- [ ] Traceability: logs include `pipeline_stage`, `entity_id`, `revision_id`.
- [ ] Partial availability: simulate downstream failure and confirm upstream data remains usable.
- [ ] Recovery: retry failed jobs and verify successful completion without manual DB fixes.

