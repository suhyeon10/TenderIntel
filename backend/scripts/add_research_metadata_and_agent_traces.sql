-- Research support migration for multimodal contract analysis and legal agent traces.
-- 1. Stores OCR and source metadata on contract analyses.
-- 2. Adds a dedicated trace table for multi-agent / verifier experiments.

BEGIN;

-- ---------------------------------------------------------------------------
-- contract_analyses: OCR / multimodal metadata
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.contract_analyses
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.contract_analyses.metadata IS
'OCR and multimodal metadata. Example: {"ocr_used": true, "source_type": "pdf_ocr", "page_count": 3}';

CREATE INDEX IF NOT EXISTS idx_contract_analyses_metadata
ON public.contract_analyses
USING GIN (metadata);

-- ---------------------------------------------------------------------------
-- legal_agent_traces: per-turn trace for issue/retrieval/verifier experiments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.legal_agent_traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES public.legal_chat_sessions(id) ON DELETE CASCADE,
    message_id UUID REFERENCES public.legal_chat_messages(id) ON DELETE SET NULL,
    user_id UUID,
    mode TEXT NOT NULL DEFAULT 'contract',
    context_type TEXT,
    context_id TEXT,
    contract_analysis_id UUID REFERENCES public.contract_analyses(id) ON DELETE SET NULL,
    selected_issue_id TEXT,
    selected_clause_id TEXT,
    selected_issue_summary TEXT,
    ocr_used BOOLEAN,
    source_type TEXT,
    issue_agent_output JSONB DEFAULT '{}'::jsonb,
    retrieval_agent_output JSONB DEFAULT '{}'::jsonb,
    draft_agent_output JSONB DEFAULT '{}'::jsonb,
    verification_status TEXT,
    verification_result JSONB DEFAULT '{}'::jsonb,
    retrieved_source_count INTEGER NOT NULL DEFAULT 0,
    trace_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT legal_agent_traces_mode_check
        CHECK (mode IN ('plain', 'contract', 'situation')),
    CONSTRAINT legal_agent_traces_verification_status_check
        CHECK (
            verification_status IS NULL OR
            verification_status IN ('supported', 'weak_support', 'unsupported', 'skipped')
        )
);

COMMENT ON TABLE public.legal_agent_traces IS
'Research and debugging traces for legal multi-agent runs.';

COMMENT ON COLUMN public.legal_agent_traces.issue_agent_output IS
'Structured issue agent output such as target_issue, target_clause, user_intent.';

COMMENT ON COLUMN public.legal_agent_traces.retrieval_agent_output IS
'Retrieved source summaries, query variants, and source metadata.';

COMMENT ON COLUMN public.legal_agent_traces.verification_result IS
'Verifier output, including unsupported claims or weak-support reasons.';

CREATE INDEX IF NOT EXISTS idx_legal_agent_traces_session_id
ON public.legal_agent_traces(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_legal_agent_traces_message_id
ON public.legal_agent_traces(message_id);

CREATE INDEX IF NOT EXISTS idx_legal_agent_traces_contract_analysis_id
ON public.legal_agent_traces(contract_analysis_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_legal_agent_traces_verification_status
ON public.legal_agent_traces(verification_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_legal_agent_traces_mode
ON public.legal_agent_traces(mode, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_legal_agent_traces_trace_metadata
ON public.legal_agent_traces
USING GIN (trace_metadata);

CREATE INDEX IF NOT EXISTS idx_legal_agent_traces_issue_output
ON public.legal_agent_traces
USING GIN (issue_agent_output);

CREATE INDEX IF NOT EXISTS idx_legal_agent_traces_retrieval_output
ON public.legal_agent_traces
USING GIN (retrieval_agent_output);

CREATE INDEX IF NOT EXISTS idx_legal_agent_traces_verification_result
ON public.legal_agent_traces
USING GIN (verification_result);

COMMIT;
