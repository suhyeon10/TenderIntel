-- migrations/009_ingestion_raw_payloads_and_jobs.sql
-- Ingestion stage persistence: raw payload blobs + normalize queue + failed jobs (DLQ-lite)

CREATE TABLE IF NOT EXISTS public.raw_payloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_revision_pk UUID NOT NULL REFERENCES public.tender_revisions(id) ON DELETE CASCADE,
    payload_type TEXT NOT NULL DEFAULT 'json',
    content_hash TEXT NOT NULL,
    content_json JSONB,
    content_text TEXT,
    source_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_raw_payloads_revision_content_hash UNIQUE (tender_revision_pk, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_raw_payloads_revision_pk ON public.raw_payloads(tender_revision_pk);
CREATE INDEX IF NOT EXISTS idx_raw_payloads_content_hash ON public.raw_payloads(content_hash);

CREATE TABLE IF NOT EXISTS public.ingestion_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    last_error TEXT,
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_ingestion_jobs_job_name_idempotency UNIQUE (job_name, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status_available_at ON public.ingestion_jobs(status, available_at);

CREATE TABLE IF NOT EXISTS public.failed_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'failed',
    failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_failed_jobs_job_name_idempotency UNIQUE (job_name, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_failed_jobs_job_name ON public.failed_jobs(job_name);
CREATE INDEX IF NOT EXISTS idx_failed_jobs_failed_at ON public.failed_jobs(failed_at DESC);

DROP TRIGGER IF EXISTS trg_ingestion_jobs_set_updated_at ON public.ingestion_jobs;
CREATE TRIGGER trg_ingestion_jobs_set_updated_at
BEFORE UPDATE ON public.ingestion_jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
