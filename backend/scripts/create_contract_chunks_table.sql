-- 계약서 청크 테이블 생성 스크립트
-- 조항 단위 청킹을 위한 벡터 저장소
-- Supabase SQL Editor에서 실행하세요

-- 1. contract_chunks 테이블 (계약서 조항/문단 청크 및 임베딩)
CREATE TABLE IF NOT EXISTS public.contract_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id TEXT NOT NULL,  -- doc_id (계약서 ID)
    article_number INTEGER,     -- 조항 번호 (제n조)
    paragraph_index INTEGER,   -- 문단 인덱스 (조항 내부 문단 분할 시)
    content TEXT NOT NULL,      -- 청크 텍스트
    chunk_index INTEGER,        -- 전체 청크 순서
    chunk_type TEXT,            -- 'article' 또는 'paragraph'
    embedding vector(1024),    -- 임베딩 벡터 (BAAI/bge-m3 사용 시 1024차원)
    metadata JSONB DEFAULT '{}'::jsonb,  -- 추가 메타데이터
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 인덱스 생성
-- contract_id 인덱스 (계약서별 조회)
CREATE INDEX IF NOT EXISTS idx_contract_chunks_contract_id 
    ON public.contract_chunks(contract_id);

-- article_number 인덱스 (조항별 조회)
CREATE INDEX IF NOT EXISTS idx_contract_chunks_article_number 
    ON public.contract_chunks(contract_id, article_number);

-- 벡터 인덱스 (IVFFlat - 코사인 유사도 검색)
CREATE INDEX IF NOT EXISTS idx_contract_chunks_embedding 
    ON public.contract_chunks 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 메타데이터 인덱스 (GIN - JSONB 검색)
CREATE INDEX IF NOT EXISTS idx_contract_chunks_metadata 
    ON public.contract_chunks 
    USING gin (metadata);

-- 3. 벡터 검색용 RPC 함수 (성능 향상)
CREATE OR REPLACE FUNCTION match_contract_chunks(
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
    FROM contract_chunks cc
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

-- 4. 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '계약서 청크 테이블 생성 완료!';
    RAISE NOTICE '- contract_chunks: 조항 단위 청크 및 임베딩';
    RAISE NOTICE '- 인덱스: contract_id, article_number, embedding, metadata';
    RAISE NOTICE '- match_contract_chunks: 벡터 검색 함수 (issue boosting 지원)';
END $$;

