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

-- 3. legal_document_bodies 테이블 (원본 본문, 선택사항)
CREATE TABLE IF NOT EXISTS legal_document_bodies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_document_id UUID REFERENCES legal_documents(id) ON DELETE CASCADE,
    text TEXT,
    mime TEXT DEFAULT 'text/plain',
    language TEXT DEFAULT 'ko',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_legal_documents_source ON legal_documents(source);
CREATE INDEX IF NOT EXISTS idx_legal_documents_doc_type ON legal_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_legal_documents_created_at ON legal_documents(created_at);

CREATE INDEX IF NOT EXISTS idx_legal_chunks_document_id ON legal_chunks(legal_document_id);
CREATE INDEX IF NOT EXISTS idx_legal_chunks_embedding ON legal_chunks USING ivfflat (embedding vector_cosine_ops);

-- 5. 벡터 컬럼 설정 (이미 있으면 무시됨)
DO $$ 
BEGIN
    -- embedding 컬럼이 없으면 추가
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'legal_chunks' AND column_name = 'embedding'
    ) THEN
        ALTER TABLE legal_chunks ADD COLUMN embedding vector(384);
    END IF;
END $$;

-- 완료 메시지
SELECT 'Legal RAG 테이블 생성 완료!' AS message;

