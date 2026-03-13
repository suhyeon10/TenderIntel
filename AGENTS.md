# AGENTS.md (v1) — Project: TenderIntel (procurement tender intelligence)

You are Codex working in this repository.

## Goal
Build an ingestion-to-notification pipeline:
Ingest → Normalize (+change detection) → Store → Index → Match/Score → Notify

## Workflow (must follow)
1) Inspect relevant files before editing
2) Propose a short plan and list files to touch
3) Implement minimal changes
4) Add/Update tests
5) Run the repo’s checks
6) Summarize changes + how to verify

## Guardrails
- Do not refactor unrelated code.
- Do not change DB schema without migrations.
- All ingestion and notifications must be idempotent.
- Keep historical revisions (never overwrite).

## Commands (Codex must discover & keep updated)
- Setup: [fill after inspecting repo]
- Dev:   [fill after inspecting repo]
- Test:  [fill after inspecting repo]

Rule: If commands are missing, create a minimal, working setup (docker-compose or venv) and document it.

## Architecture invariants
Idempotency keys:
- ingestion: source:tender_id:revision_hash
- notification: channel:user_id:tender_id:revision_hash:event_type

Change detection:
- Store raw payload/blobs and compute content_hash.
- If content_hash changes, create a new revision record.

Partial availability:
- If attachment parsing fails, mark FAILED and continue tender-level pipeline.
- Do not block notifications for unrelated tenders.

Observability:
- Log fields: job_name, tender_id, revision_id, status, duration_ms


## Definition of done for each task
- Tests pass
- A short manual verification checklist is provided
- Logs/metrics added for the new pipeline step (at least structured logs)
