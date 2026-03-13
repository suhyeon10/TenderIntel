-- Full legal product schema bootstrap
-- Recreates the core tables used by the current codebase after a clean DB reset.
-- Target: Supabase Postgres + pgvector

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Contract analyses
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contract_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id TEXT UNIQUE NOT NULL,
    title TEXT,
    file_name TEXT NOT NULL DEFAULT 'unknown.pdf',
    file_url TEXT NOT NULL DEFAULT '',
    original_filename TEXT,
    doc_type TEXT,
    user_id UUID,
    risk_score NUMERIC,
    risk_level TEXT,
    sections JSONB DEFAULT '{}'::jsonb,
    summary TEXT,
    retrieved_contexts JSONB DEFAULT '[]'::jsonb,
    contract_text TEXT DEFAULT '',
    clauses JSONB DEFAULT '[]'::jsonb,
    highlighted_texts JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    analysis_result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_analyses_doc_id
ON public.contract_analyses(doc_id);

CREATE INDEX IF NOT EXISTS idx_contract_analyses_created_at
ON public.contract_analyses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contract_analyses_user_id
ON public.contract_analyses(user_id);

CREATE INDEX IF NOT EXISTS idx_contract_analyses_user_created
ON public.contract_analyses(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contract_analyses_clauses
ON public.contract_analyses USING GIN (clauses);

CREATE INDEX IF NOT EXISTS idx_contract_analyses_highlighted_texts
ON public.contract_analyses USING GIN (highlighted_texts);

CREATE INDEX IF NOT EXISTS idx_contract_analyses_metadata
ON public.contract_analyses USING GIN (metadata);

-- ---------------------------------------------------------------------------
-- Contract issues
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contract_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_analysis_id UUID REFERENCES public.contract_analyses(id) ON DELETE CASCADE,
    issue_id TEXT,
    category TEXT,
    severity TEXT DEFAULT 'medium',
    summary TEXT,
    original_text TEXT,
    legal_basis JSONB DEFAULT '[]'::jsonb,
    explanation TEXT,
    suggested_revision TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_issues_analysis_id
ON public.contract_issues(contract_analysis_id);

CREATE INDEX IF NOT EXISTS idx_contract_issues_category
ON public.contract_issues(category);

CREATE INDEX IF NOT EXISTS idx_contract_issues_severity
ON public.contract_issues(severity);

-- ---------------------------------------------------------------------------
-- Situation analyses
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.situation_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    situation TEXT,
    category TEXT,
    employment_type TEXT,
    company_size TEXT,
    work_period TEXT,
    has_written_contract BOOLEAN,
    social_insurance TEXT[] DEFAULT ARRAY[]::TEXT[],
    risk_score NUMERIC,
    risk_level TEXT,
    analysis JSONB DEFAULT '{}'::jsonb,
    checklist JSONB DEFAULT '[]'::jsonb,
    related_cases JSONB DEFAULT '[]'::jsonb,
    question TEXT,
    answer TEXT,
    details TEXT,
    category_hint TEXT,
    classified_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_situation_analyses_category
ON public.situation_analyses(category);

CREATE INDEX IF NOT EXISTS idx_situation_analyses_created_at
ON public.situation_analyses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_situation_analyses_user_id
ON public.situation_analyses(user_id);

CREATE INDEX IF NOT EXISTS idx_situation_analyses_user_created
ON public.situation_analyses(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Legal chat sessions / messages
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.legal_chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    initial_context_type TEXT NOT NULL DEFAULT 'none',
    initial_context_id TEXT,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT legal_chat_sessions_context_type_check
        CHECK (initial_context_type IN ('none', 'situation', 'contract'))
);

CREATE INDEX IF NOT EXISTS idx_legal_chat_sessions_user_id
ON public.legal_chat_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_legal_chat_sessions_user_updated
ON public.legal_chat_sessions(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.legal_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.legal_chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    message TEXT NOT NULL,
    sender_type TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    context_type TEXT NOT NULL DEFAULT 'none',
    context_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT legal_chat_messages_sender_type_check
        CHECK (sender_type IN ('user', 'assistant', 'system')),
    CONSTRAINT legal_chat_messages_context_type_check
        CHECK (context_type IN ('none', 'situation', 'contract'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_chat_messages_session_sequence
ON public.legal_chat_messages(session_id, sequence_number);

CREATE INDEX IF NOT EXISTS idx_legal_chat_messages_session_id
ON public.legal_chat_messages(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_legal_chat_messages_user_id
ON public.legal_chat_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_legal_chat_messages_metadata
ON public.legal_chat_messages USING GIN (metadata);

-- Keep updated_at fresh when new messages are inserted.
CREATE OR REPLACE FUNCTION public.touch_legal_chat_session_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.legal_chat_sessions
    SET updated_at = now()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_legal_chat_session_updated_at
ON public.legal_chat_messages;

CREATE TRIGGER trg_touch_legal_chat_session_updated_at
AFTER INSERT ON public.legal_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.touch_legal_chat_session_updated_at();

-- ---------------------------------------------------------------------------
-- Research / agent traces
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

CREATE INDEX IF NOT EXISTS idx_legal_agent_traces_session_id
ON public.legal_agent_traces(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_legal_agent_traces_message_id
ON public.legal_agent_traces(message_id);

CREATE INDEX IF NOT EXISTS idx_legal_agent_traces_contract_analysis_id
ON public.legal_agent_traces(contract_analysis_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_legal_agent_traces_verification_status
ON public.legal_agent_traces(verification_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_legal_agent_traces_trace_metadata
ON public.legal_agent_traces USING GIN (trace_metadata);

-- ---------------------------------------------------------------------------
-- Contract chunks for contract-side retrieval
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.contract_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id TEXT NOT NULL,
    article_number INTEGER,
    paragraph_index INTEGER,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    chunk_type TEXT DEFAULT 'article',
    embedding vector(1024),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_chunks_contract_id
ON public.contract_chunks(contract_id);

CREATE INDEX IF NOT EXISTS idx_contract_chunks_article_number
ON public.contract_chunks(contract_id, article_number);

CREATE INDEX IF NOT EXISTS idx_contract_chunks_metadata
ON public.contract_chunks USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_contract_chunks_embedding
ON public.contract_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE OR REPLACE FUNCTION public.match_contract_chunks(
    contract_id_param TEXT,
    query_embedding vector(1024),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 5,
    article_number_filter INTEGER DEFAULT NULL,
    boost_article INTEGER DEFAULT NULL,
    boost_factor FLOAT DEFAULT 1.5
)
RETURNS TABLE (
    id UUID,
    contract_id TEXT,
    article_number INTEGER,
    paragraph_index INTEGER,
    content TEXT,
    chunk_index INTEGER,
    chunk_type TEXT,
    similarity FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cc.id,
        cc.contract_id,
        cc.article_number,
        cc.paragraph_index,
        cc.content,
        cc.chunk_index,
        cc.chunk_type,
        CASE
            WHEN boost_article IS NOT NULL AND cc.article_number = boost_article THEN
                (1 - (cc.embedding <=> query_embedding)) * boost_factor
            ELSE
                1 - (cc.embedding <=> query_embedding)
        END AS similarity,
        cc.metadata
    FROM public.contract_chunks AS cc
    WHERE cc.contract_id = contract_id_param
      AND (cc.embedding IS NOT NULL)
      AND 1 - (cc.embedding <=> query_embedding) > match_threshold
      AND (article_number_filter IS NULL OR cc.article_number = article_number_filter)
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- Legal chunks for law / case / guide retrieval
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.legal_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'law',
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    file_path TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(1024),
    is_boilerplate BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_chunks_external_id
ON public.legal_chunks(external_id);

CREATE INDEX IF NOT EXISTS idx_legal_chunks_source_type
ON public.legal_chunks(source_type);

CREATE INDEX IF NOT EXISTS idx_legal_chunks_title
ON public.legal_chunks(title);

CREATE INDEX IF NOT EXISTS idx_legal_chunks_metadata
ON public.legal_chunks USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_legal_chunks_embedding
ON public.legal_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE OR REPLACE FUNCTION public.match_legal_chunks(
    query_embedding vector(1024),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 8,
    category TEXT DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    external_id TEXT,
    source_type TEXT,
    title TEXT,
    content TEXT,
    chunk_index INTEGER,
    file_path TEXT,
    metadata JSONB,
    score FLOAT
)
LANGUAGE sql
STABLE
AS $$
    SELECT
        lc.id,
        lc.external_id,
        lc.source_type,
        lc.title,
        lc.content,
        lc.chunk_index,
        lc.file_path,
        lc.metadata,
        1 - (lc.embedding <=> query_embedding) AS score
    FROM public.legal_chunks AS lc
    WHERE lc.embedding IS NOT NULL
      AND (lc.is_boilerplate IS NULL OR lc.is_boilerplate = FALSE)
      AND (
            category IS NULL OR
            (lc.metadata->>'topic_main' = category) OR
            (lc.metadata->>'category' = category)
          )
      AND 1 - (lc.embedding <=> query_embedding) >= match_threshold
    ORDER BY lc.embedding <=> query_embedding
    LIMIT match_count;
$$;

COMMIT;
