-- Supabase 벡터 컬럼을 384차원으로 변경
-- Supabase SQL Editor에서 실행하세요

-- 기존 데이터 삭제 (선택사항 - 기존 데이터를 유지하려면 이 부분을 주석 처리하세요)
DELETE FROM announcement_chunks;
DELETE FROM announcements;

-- 벡터 컬럼 재생성 (384차원)
ALTER TABLE announcement_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE announcement_chunks ADD COLUMN embedding vector(384);

-- 인덱스 재생성 (선택사항 - 성능 향상)
CREATE INDEX IF NOT EXISTS announcement_chunks_embedding_idx 
ON announcement_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

