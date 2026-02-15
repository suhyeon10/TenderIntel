-- contract_chunks 테이블 데이터 삭제 스크립트
-- 기존 청크 데이터를 모두 삭제하고 싶을 때 사용
-- Supabase SQL Editor에서 실행하세요

-- ⚠️ 주의: 이 스크립트는 모든 contract_chunks 데이터를 삭제합니다!
-- 계약서를 다시 분석하면 자동으로 새 청크가 저장됩니다.

-- 전체 삭제
DELETE FROM public.contract_chunks;

-- 삭제 확인
SELECT COUNT(*) as remaining_chunks FROM public.contract_chunks;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE 'contract_chunks 테이블 데이터 삭제 완료!';
    RAISE NOTICE '계약서를 다시 분석하면 새로운 형식으로 청크가 저장됩니다.';
END $$;

