-- 법률/계약 RAG 모드용 테이블 생성 스크립트
-- Supabase SQL Editor에서 실행하세요

-- 1. legal_documents 테이블 (문서 메타데이터)
CREATE TABLE IF NOT EXISTS legal_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    source TEXT,  -- 'moel', 'mss', 'mcst' 등
    file_path TEXT,
    doc_type TEXT,  -- 'law', 'standard_contract', 'manual', 'case'
    content_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. legal_chunks 테이블 (청크 및 임베딩)
CREATE TABLE IF NOT EXISTS legal_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_document_id UUID REFERENCES legal_documents(id) ON DELETE CASCADE,
    section_title TEXT,  -- '제1조 (목적)' 등
    chunk_index INTEGER,
    text TEXT,
    embedding vector(384),
    meta JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_legal_chunks_document_id ON legal_chunks(legal_document_id);
CREATE INDEX IF NOT EXISTS idx_legal_chunks_embedding ON legal_chunks USING ivfflat (embedding vector_cosine_ops);

-- 4. legal_document_bodies 테이블 (원본 본문 저장 - 선택사항)
CREATE TABLE IF NOT EXISTS legal_document_bodies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_document_id UUID REFERENCES legal_documents(id) ON DELETE CASCADE,
    text TEXT,
    mime TEXT DEFAULT 'text/plain',
    language TEXT DEFAULT 'ko',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. 벡터 검색용 RPC 함수 (선택사항, 성능 향상)
CREATE OR REPLACE FUNCTION match_legal_chunks(
    query_embedding vector(384),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5,
    filters jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    legal_document_id uuid,
    section_title text,
    chunk_index integer,
    text text,
    similarity float,
    meta jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        lc.legal_document_id,
        lc.section_title,
        lc.chunk_index,
        lc.text,
        1 - (lc.embedding <=> query_embedding) as similarity,
        lc.meta
    FROM legal_chunks lc
    JOIN legal_documents ld ON lc.legal_document_id = ld.id
    WHERE 1 - (lc.embedding <=> query_embedding) > match_threshold
        AND (filters = '{}'::jsonb OR 
             (filters ? 'doc_type' AND ld.doc_type = filters->>'doc_type'))
    ORDER BY lc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '법률/계약 RAG 테이블 생성 완료!';
    RAISE NOTICE '- legal_documents: 문서 메타데이터';
    RAISE NOTICE '- legal_chunks: 청크 및 임베딩';
    RAISE NOTICE '- legal_document_bodies: 원본 본문';
    RAISE NOTICE '- match_legal_chunks: 벡터 검색 함수';
END $$;

