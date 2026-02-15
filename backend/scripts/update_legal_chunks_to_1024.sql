-- legal_chunks 테이블의 embedding 컬럼을 384차원에서 1024차원으로 변경
-- BAAI/bge-m3 모델 (1024차원) 사용을 위해 필요

-- 1. 기존 인덱스 삭제 (컬럼 변경 전 필수)
DROP INDEX IF EXISTS idx_legal_chunks_embedding;

-- 2. 기존 데이터 백업 (선택사항)
-- CREATE TABLE legal_chunks_backup AS SELECT * FROM legal_chunks;

-- 3. 기존 데이터 삭제 (차원 변경을 위해 필요)
-- 주의: 이 명령은 모든 legal_chunks 데이터를 삭제합니다!
-- DELETE FROM public.legal_chunks;

-- 4. embedding 컬럼 타입 변경 (384 → 1024)
-- 방법 1: 컬럼 삭제 후 재생성 (데이터 손실)
ALTER TABLE public.legal_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.legal_chunks ADD COLUMN embedding vector(1024);

-- 방법 2: 기존 데이터가 있고 보존해야 하는 경우 (복잡함)
-- ALTER TABLE public.legal_chunks ALTER COLUMN embedding TYPE vector(1024) USING embedding::text::vector(1024);
-- 주의: 이 방법은 기존 384차원 벡터를 1024차원으로 변환할 수 없으므로 데이터 손실 발생

-- 5. 벡터 인덱스 재생성 (1024차원)
CREATE INDEX IF NOT EXISTS idx_legal_chunks_embedding 
    ON public.legal_chunks 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE 'legal_chunks 테이블의 embedding 컬럼이 1024차원으로 변경되었습니다!';
    RAISE NOTICE '주의: 기존 데이터는 삭제되었습니다. 스크립트를 다시 실행하여 데이터를 재인덱싱하세요.';
END $$;

