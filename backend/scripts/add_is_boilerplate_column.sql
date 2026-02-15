-- legal_chunks 테이블에 is_boilerplate 컬럼 추가
-- 머리말/기타/boilerplate 청크를 필터링하기 위해 사용

-- 1. 컬럼 추가
ALTER TABLE legal_chunks 
ADD COLUMN IF NOT EXISTS is_boilerplate boolean DEFAULT false;

-- 2. 인덱스 추가 (필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_legal_chunks_is_boilerplate 
ON legal_chunks(is_boilerplate) 
WHERE is_boilerplate = false;

-- 3. 기존 데이터 업데이트 (선택사항)
-- 제목/목차/서문/"기타" 전체 부분을 boilerplate로 표시
-- 실제 조항/조문/예시는 false로 유지

-- 예시: title이나 content에 특정 키워드가 있으면 boilerplate로 표시
-- UPDATE legal_chunks 
-- SET is_boilerplate = true
-- WHERE 
--   title ILIKE '%목적%' OR
--   title ILIKE '%기타%' OR
--   title ILIKE '%부칙%' OR
--   content ILIKE '%계약에 정함이 없는 사항%' OR
--   content ILIKE '%근로기준법령에 의함%';

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE 'is_boilerplate 컬럼이 추가되었습니다!';
    RAISE NOTICE '기존 데이터는 is_boilerplate = false로 설정됩니다.';
    RAISE NOTICE '필요시 수동으로 boilerplate 청크를 업데이트하세요.';
END $$;

