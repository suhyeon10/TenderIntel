-- migrations/012_matcher_notifications.sql
-- Subscription-based matching + notification retry metadata

ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS profile_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.match_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_pk UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    tender_revision_pk UUID NOT NULL REFERENCES public.tender_revisions(id) ON DELETE CASCADE,
    fit_score NUMERIC NOT NULL,
    is_match BOOLEAN NOT NULL DEFAULT false,
    explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_match_results_subscription_revision UNIQUE (subscription_pk, tender_revision_pk)
);

CREATE INDEX IF NOT EXISTS idx_match_results_revision_pk ON public.match_results(tender_revision_pk);
CREATE INDEX IF NOT EXISTS idx_match_results_is_match ON public.match_results(is_match);

ALTER TABLE public.delivery_logs
    ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.delivery_logs
    ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3;

ALTER TABLE public.delivery_logs
    ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

DROP CONSTRAINT IF EXISTS chk_delivery_logs_status ON public.delivery_logs;
ALTER TABLE public.delivery_logs
    ADD CONSTRAINT chk_delivery_logs_status
    CHECK (delivery_status IN ('queued', 'processing', 'delivered', 'failed'));

CREATE INDEX IF NOT EXISTS idx_delivery_logs_next_retry_at ON public.delivery_logs(next_retry_at);

DROP TRIGGER IF EXISTS trg_match_results_set_updated_at ON public.match_results;
CREATE TRIGGER trg_match_results_set_updated_at
BEFORE UPDATE ON public.match_results
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
