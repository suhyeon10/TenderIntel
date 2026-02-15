-- 불필요한 레거시 테이블 정리 마이그레이션
-- README에 명시되지 않은 테이블 중 사용되지 않는 테이블 삭제
-- 
-- 정리 대상:
-- 1. docs, doc_chunks, doc_owners - 레거시 테이블 (announcements로 대체됨, 데이터 없음)
-- 2. announcement_metadata - 레거시 테이블 (announcements로 대체됨, 데이터 없음)
-- 3. bidding_history - 레거시 테이블 (announcement_metadata 참조, 데이터 없음)
--
-- 유지할 테이블:
-- - payment (단수형): 마일스톤 지급 내역 (milestone 참조, 다른 용도)
-- - payments (복수형): 구독 결제 내역 (subscription 참조, 다른 용도)

-- 1. 외래키 제약조건 제거 (역순으로)
-- bidding_history는 announcement_metadata를 참조
DROP TABLE IF EXISTS public.bidding_history CASCADE;

-- announcement_metadata는 docs를 참조
DROP TABLE IF EXISTS public.announcement_metadata CASCADE;

-- doc_chunks와 doc_owners는 docs를 참조
DROP TABLE IF EXISTS public.doc_chunks CASCADE;
DROP TABLE IF EXISTS public.doc_owners CASCADE;

-- docs 테이블 (레거시, announcements로 대체됨)
DROP TABLE IF EXISTS public.docs CASCADE;

