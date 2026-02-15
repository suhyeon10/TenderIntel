-- migrations/002_legal_documents_schema.sql
-- 법률 문서 RAG 스키마 (실제 DB 구조에 맞춤)

-- legal_documents 테이블 (문서 메타데이터)
CREATE TABLE IF NOT EXISTS legal_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    source TEXT,  -- 'moel', 'mss', 'mcst' 등
    file_path TEXT,
    doc_type TEXT,  -- 'law', 'standard_contract', 'manual', 'case'
    content_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_legal_documents_source ON legal_documents(source);
CREATE INDEX IF NOT EXISTS idx_legal_documents_doc_type ON legal_documents(doc_type);
CREATE INDEX IF NOT EXISTS idx_legal_documents_created_at ON legal_documents(created_at);

-- legal_document_bodies 테이블 (원본 본문 저장)
CREATE TABLE IF NOT EXISTS legal_document_bodies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_document_id UUID REFERENCES legal_documents(id) ON DELETE CASCADE,
    text TEXT,
    mime TEXT DEFAULT 'text/plain',
    language TEXT DEFAULT 'ko',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_legal_document_bodies_document_id ON legal_document_bodies(legal_document_id);

-- legal_chunks 테이블 (청크 및 임베딩)
-- 실제 DB 구조: id, external_id, source_type, title, content, chunk_index, file_path, metadata, embedding, created_at
CREATE TABLE IF NOT EXISTS legal_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT NOT NULL,  -- 파일명/케이스 ID
    source_type TEXT NOT NULL CHECK (source_type = ANY (ARRAY['law'::text, 'manual'::text, 'case'::text])),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    file_path TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(384),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_legal_chunks_external_id ON legal_chunks(external_id);
CREATE INDEX IF NOT EXISTS idx_legal_chunks_source_type ON legal_chunks(source_type);
CREATE INDEX IF NOT EXISTS idx_legal_chunks_chunk_index ON legal_chunks(chunk_index);
CREATE INDEX IF NOT EXISTS idx_legal_chunks_embedding ON legal_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_legal_chunks_external_id_chunk_index ON legal_chunks(external_id, chunk_index);

-- RLS 정책 (법률 문서는 누구나 읽을 수 있음)
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_document_bodies ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Legal documents are publicly readable" ON legal_documents;
CREATE POLICY "Legal documents are publicly readable"
    ON legal_documents
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Legal document bodies are publicly readable" ON legal_document_bodies;
CREATE POLICY "Legal document bodies are publicly readable"
    ON legal_document_bodies
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Legal chunks are publicly readable" ON legal_chunks;
CREATE POLICY "Legal chunks are publicly readable"
    ON legal_chunks
    FOR SELECT
    USING (true);

