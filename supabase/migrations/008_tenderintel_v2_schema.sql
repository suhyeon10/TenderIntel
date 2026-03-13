-- migrations/008_tenderintel_v2_schema.sql
-- TenderIntel v2 canonical schema
-- Goal: append-only tender revisions with hash-based change detection

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) tenders: canonical tender identity per source
CREATE TABLE IF NOT EXISTS public.tenders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    tender_id TEXT NOT NULL,
    title TEXT,
    agency TEXT,
    status TEXT,
    current_revision_id UUID,
    latest_revision_hash TEXT,
    latest_raw_content_hash TEXT,
    latest_normalized_content_hash TEXT,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_tenders_source_tender_id UNIQUE (source, tender_id)
);

CREATE INDEX IF NOT EXISTS idx_tenders_source ON public.tenders(source);
CREATE INDEX IF NOT EXISTS idx_tenders_tender_id ON public.tenders(tender_id);
CREATE INDEX IF NOT EXISTS idx_tenders_last_seen_at ON public.tenders(last_seen_at DESC);

-- 2) tender_revisions: immutable revisions (never overwrite)
CREATE TABLE IF NOT EXISTS public.tender_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_pk UUID NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    revision_hash TEXT NOT NULL,
    raw_content_hash TEXT NOT NULL,
    normalized_content_hash TEXT NOT NULL,
    source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    normalized_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    changed_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    change_reason TEXT,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    effective_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_tender_revisions_tender_pk_revision_hash UNIQUE (tender_pk, revision_hash),
    CONSTRAINT uq_tender_revisions_tender_pk_revision_number UNIQUE (tender_pk, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_tender_revisions_tender_pk ON public.tender_revisions(tender_pk);
CREATE INDEX IF NOT EXISTS idx_tender_revisions_observed_at ON public.tender_revisions(observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_tender_revisions_raw_hash ON public.tender_revisions(raw_content_hash);
CREATE INDEX IF NOT EXISTS idx_tender_revisions_normalized_hash ON public.tender_revisions(normalized_content_hash);

-- Add forward reference after tender_revisions exists
ALTER TABLE public.tenders
    DROP CONSTRAINT IF EXISTS fk_tenders_current_revision;

ALTER TABLE public.tenders
    ADD CONSTRAINT fk_tenders_current_revision
    FOREIGN KEY (current_revision_id)
    REFERENCES public.tender_revisions(id)
    ON DELETE SET NULL;

-- 3) attachments: files associated to a tender revision
CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_pk UUID NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
    tender_revision_pk UUID REFERENCES public.tender_revisions(id) ON DELETE SET NULL,
    attachment_type TEXT NOT NULL DEFAULT 'document',
    filename TEXT NOT NULL,
    storage_path TEXT,
    mime_type TEXT,
    byte_size BIGINT,
    content_hash TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_attachments_revision_filename_hash UNIQUE (tender_revision_pk, filename, content_hash)
);

CREATE INDEX IF NOT EXISTS idx_attachments_tender_pk ON public.attachments(tender_pk);
CREATE INDEX IF NOT EXISTS idx_attachments_revision_pk ON public.attachments(tender_revision_pk);
CREATE INDEX IF NOT EXISTS idx_attachments_content_hash ON public.attachments(content_hash);

-- 4) extraction_results: normalized extraction outcomes by engine/version
CREATE TABLE IF NOT EXISTS public.extraction_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_revision_pk UUID NOT NULL REFERENCES public.tender_revisions(id) ON DELETE CASCADE,
    extractor_name TEXT NOT NULL,
    extractor_version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'success',
    extracted_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    extraction_hash TEXT NOT NULL,
    errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_extraction_results_revision_extractor UNIQUE (tender_revision_pk, extractor_name, extractor_version)
);

CREATE INDEX IF NOT EXISTS idx_extraction_results_revision_pk ON public.extraction_results(tender_revision_pk);
CREATE INDEX IF NOT EXISTS idx_extraction_results_status ON public.extraction_results(status);
CREATE INDEX IF NOT EXISTS idx_extraction_results_hash ON public.extraction_results(extraction_hash);

-- 5) subscriptions: user notification subscriptions for tenders/rules
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    channel TEXT NOT NULL DEFAULT 'email',
    target_type TEXT NOT NULL DEFAULT 'tender',
    target_key TEXT NOT NULL,
    criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_subscriptions_user_channel_target UNIQUE (user_id, channel, target_type, target_key)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_target ON public.subscriptions(target_type, target_key);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON public.subscriptions(is_active);

-- 6) delivery_logs: idempotent notification delivery records
CREATE TABLE IF NOT EXISTS public.delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_pk UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    tender_revision_pk UUID REFERENCES public.tender_revisions(id) ON DELETE SET NULL,
    channel TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_key TEXT NOT NULL,
    delivery_status TEXT NOT NULL DEFAULT 'queued',
    provider_message_id TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    attempted_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_delivery_logs_subscription_event UNIQUE (subscription_pk, channel, event_key)
);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_subscription_pk ON public.delivery_logs(subscription_pk);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_revision_pk ON public.delivery_logs(tender_revision_pk);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_status ON public.delivery_logs(delivery_status);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_event_type ON public.delivery_logs(event_type);

-- Optional helper trigger for updated_at columns
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenders_set_updated_at ON public.tenders;
CREATE TRIGGER trg_tenders_set_updated_at
BEFORE UPDATE ON public.tenders
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_subscriptions_set_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_set_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
