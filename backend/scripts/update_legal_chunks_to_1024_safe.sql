-- legal_chunks 테이블의 embedding 컬럼을 384차원에서 1024차원으로 변경 (안전 버전)
-- 기존 데이터를 백업하고 안전하게 변경합니다.

-- 1. 기존 인덱스 삭제
DROP INDEX IF EXISTS idx_legal_chunks_embedding;

-- 2. 기존 데이터 백업 테이블 생성
CREATE TABLE IF NOT EXISTS legal_chunks_backup_384 AS 
SELECT * FROM public.legal_chunks;

-- 3. 기존 embedding 컬럼 삭제
ALTER TABLE public.legal_chunks DROP COLUMN IF EXISTS embedding;

-- 4. 새로운 1024차원 embedding 컬럼 추가
ALTER TABLE public.legal_chunks ADD COLUMN embedding vector(1024);

-- 5. 벡터 인덱스 재생성 (1024차원)
CREATE INDEX IF NOT EXISTS idx_legal_chunks_embedding 
    ON public.legal_chunks 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE 'legal_chunks 테이블의 embedding 컬럼이 1024차원으로 변경되었습니다!';
    RAISE NOTICE '기존 데이터는 legal_chunks_backup_384 테이블에 백업되었습니다.';
    RAISE NOTICE '스크립트를 다시 실행하여 데이터를 재인덱싱하세요.';
END $$;

