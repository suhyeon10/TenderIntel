-- migrations/010_tender_revisions_status.sql
-- Add normalization status tracking for append-only revisions

ALTER TABLE public.tender_revisions
    ADD COLUMN IF NOT EXISTS revision_status TEXT NOT NULL DEFAULT 'SUCCESS';

ALTER TABLE public.tender_revisions
    ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE public.tender_revisions
    DROP CONSTRAINT IF EXISTS chk_tender_revisions_status;

ALTER TABLE public.tender_revisions
    ADD CONSTRAINT chk_tender_revisions_status
    CHECK (revision_status IN ('SUCCESS', 'FAILED'));

CREATE INDEX IF NOT EXISTS idx_tender_revisions_status
    ON public.tender_revisions(revision_status);
