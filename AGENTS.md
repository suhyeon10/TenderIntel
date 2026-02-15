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

## Definition of done for each task
- Tests pass
- A short manual verification checklist is provided
- Logs/metrics added for the new pipeline step (at least structured logs)
