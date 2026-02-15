-- 특정 계약서의 청크만 삭제하는 스크립트
-- 특정 doc_id의 청크만 삭제하고 싶을 때 사용
-- Supabase SQL Editor에서 실행하세요

-- 사용법: 아래 doc_id를 실제 계약서 ID로 변경하세요
-- 예시: '550e8400-e29b-41d4-a716-446655440000'

-- 특정 계약서 청크 삭제
DELETE FROM public.contract_chunks
WHERE contract_id = 'YOUR_DOC_ID_HERE';  -- 여기를 실제 doc_id로 변경

-- 삭제 확인
SELECT 
    contract_id,
    COUNT(*) as chunk_count
FROM public.contract_chunks
GROUP BY contract_id
ORDER BY chunk_count DESC;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '특정 계약서의 청크 삭제 완료!';
    RAISE NOTICE '해당 계약서를 다시 분석하면 새로운 형식으로 청크가 저장됩니다.';
END $$;

