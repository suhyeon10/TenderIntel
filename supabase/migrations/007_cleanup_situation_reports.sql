-- situation_reports 테이블 정리 및 삭제
-- 이 마이그레이션은 모든 데이터가 situation_analyses로 마이그레이션된 후 실행하세요.

-- 1. situation_reports를 참조하는 모든 객체 확인
-- (이미 006 마이그레이션에서 처리되었지만 안전을 위해 확인)

-- 2. situation_reports 테이블의 남은 데이터 확인
-- (필요시 백업)
-- CREATE TABLE IF NOT EXISTS public.situation_reports_backup AS 
-- SELECT * FROM public.situation_reports;

-- 3. situation_reports 테이블 삭제
-- 주의: 모든 데이터가 situation_analyses로 마이그레이션되었는지 확인 후 실행
-- DROP TABLE IF EXISTS public.situation_reports CASCADE;

-- 참고: 실제 삭제는 데이터 확인 후 수동으로 실행하세요.
-- 위의 DROP TABLE 명령은 주석 처리되어 있습니다.

