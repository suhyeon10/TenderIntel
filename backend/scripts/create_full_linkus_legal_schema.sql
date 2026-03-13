-- =============================================================================
-- linkus_legal_* 전체 스키마 (한 번에 실행)
-- 적용 순서 1. 이 파일 실행 후 → 2. 코드 배포 → 3. 업로드/분석/채팅/RAG 확인
-- =============================================================================
-- 사전 요건: linkus_legal_legal_chunks 테이블이 있어야 합니다.
--   (기존 legal_chunks 테이블이 있다면 update_legal_chunks_to_1024.sql 로
--    테이블명 변경 후 1024차원 적용, 또는 별도 마이그레이션으로 생성)
-- =============================================================================

-- ----- 1. 계약서 분석 / 이슈 / 상황 분석 테이블 -----
-- (create_contract_analysis_tables.sql)

CREATE TABLE IF NOT EXISTS public.linkus_legal_contract_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id TEXT UNIQUE NOT NULL,
    title TEXT,
    original_filename TEXT,
    doc_type TEXT,
    risk_score NUMERIC,
    risk_level TEXT,
    sections JSONB,
    summary TEXT,
    retrieved_contexts JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linkus_legal_contract_analyses_doc_id 
    ON public.linkus_legal_contract_analyses(doc_id);

CREATE INDEX IF NOT EXISTS idx_linkus_legal_contract_analyses_created_at 
    ON public.linkus_legal_contract_analyses(created_at DESC);

CREATE TABLE IF NOT EXISTS public.linkus_legal_contract_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_analysis_id UUID REFERENCES public.linkus_legal_contract_analyses(id) ON DELETE CASCADE,
    issue_id TEXT,
    category TEXT,
    severity TEXT,
    summary TEXT,
    original_text TEXT,
    legal_basis TEXT[],
    explanation TEXT,
    suggested_revision TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linkus_legal_contract_issues_analysis_id 
    ON public.linkus_legal_contract_issues(contract_analysis_id);

CREATE INDEX IF NOT EXISTS idx_linkus_legal_contract_issues_category 
    ON public.linkus_legal_contract_issues(category);

CREATE TABLE IF NOT EXISTS public.linkus_legal_situation_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    situation TEXT,
    category TEXT,
    employment_type TEXT,
    company_size TEXT,
    work_period TEXT,
    has_written_contract BOOLEAN,
    social_insurance TEXT[],
    risk_score NUMERIC,
    risk_level TEXT,
    analysis JSONB,
    checklist JSONB,
    related_cases JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linkus_legal_situation_analyses_category 
    ON public.linkus_legal_situation_analyses(category);

CREATE INDEX IF NOT EXISTS idx_linkus_legal_situation_analyses_created_at 
    ON public.linkus_legal_situation_analyses(created_at DESC);


-- ----- 2. 계약서 청크 테이블 + RPC -----
-- (create_contract_chunks_table.sql)

CREATE TABLE IF NOT EXISTS public.linkus_legal_contract_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id TEXT NOT NULL,
    article_number INTEGER,
    paragraph_index INTEGER,
    content TEXT NOT NULL,
    chunk_index INTEGER,
    chunk_type TEXT,
    embedding vector(1024),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linkus_legal_contract_chunks_contract_id 
    ON public.linkus_legal_contract_chunks(contract_id);

CREATE INDEX IF NOT EXISTS idx_linkus_legal_contract_chunks_article_number 
    ON public.linkus_legal_contract_chunks(contract_id, article_number);

CREATE INDEX IF NOT EXISTS idx_linkus_legal_contract_chunks_embedding 
    ON public.linkus_legal_contract_chunks 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_linkus_legal_contract_chunks_metadata 
    ON public.linkus_legal_contract_chunks 
    USING gin (metadata);

CREATE OR REPLACE FUNCTION linkus_legal_match_contract_chunks(
    contract_id_param TEXT,
    query_embedding vector(1024),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 5,
    article_number_filter INTEGER DEFAULT NULL,
    boost_article INTEGER DEFAULT NULL,
    boost_factor float DEFAULT 1.5
)
RETURNS TABLE (
    id uuid,
    contract_id text,
    article_number integer,
    paragraph_index integer,
    content text,
    chunk_index integer,
    chunk_type text,
    similarity float,
    metadata jsonb
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
        END as similarity,
        cc.metadata
    FROM linkus_legal_contract_chunks cc
    WHERE cc.contract_id = contract_id_param
        AND 1 - (cc.embedding <=> query_embedding) > match_threshold
        AND (article_number_filter IS NULL OR cc.article_number = article_number_filter)
    ORDER BY 
        CASE 
            WHEN boost_article IS NOT NULL AND cc.article_number = boost_article THEN
                (1 - (cc.embedding <=> query_embedding)) * boost_factor
            ELSE
                1 - (cc.embedding <=> query_embedding)
        END DESC
    LIMIT match_count;
END;
$$;


-- ----- 3. 법령 청크 RPC + 인덱스 (linkus_legal_legal_chunks 테이블 전제) -----
-- (create_match_legal_chunks_rpc.sql)

DROP FUNCTION IF EXISTS linkus_legal_match_legal_chunks(vector, float, int, text);

CREATE OR REPLACE FUNCTION linkus_legal_match_legal_chunks(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 8,
  category text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  external_id text,
  source_type text,
  title text,
  content text,
  chunk_index integer,
  file_path text,
  metadata jsonb,
  score float
)
LANGUAGE sql STABLE AS $$
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
  FROM linkus_legal_legal_chunks AS lc
  WHERE
    (category IS NULL OR 
     (lc.metadata->>'topic_main' = category) OR
     (lc.metadata->>'category' = category))
    AND (lc.is_boilerplate IS NULL OR lc.is_boilerplate = false)
    AND 1 - (lc.embedding <=> query_embedding) >= match_threshold
  ORDER BY
    lc.embedding <=> query_embedding
  LIMIT match_count;
$$;

COMMENT ON FUNCTION linkus_legal_match_legal_chunks IS 
'linkus_legal_legal_chunks 벡터 검색 함수 (1024차원, category 필터 지원)';

CREATE INDEX IF NOT EXISTS linkus_legal_legal_chunks_embedding_idx
ON linkus_legal_legal_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);


-- ----- 완료 -----
DO $$
BEGIN
    RAISE NOTICE 'linkus_legal 스키마 적용 완료.';
    RAISE NOTICE '- linkus_legal_contract_analyses, linkus_legal_contract_issues, linkus_legal_situation_analyses';
    RAISE NOTICE '- linkus_legal_contract_chunks, linkus_legal_match_contract_chunks';
    RAISE NOTICE '- linkus_legal_match_legal_chunks (linkus_legal_legal_chunks 테이블 필요)';
END $$;
