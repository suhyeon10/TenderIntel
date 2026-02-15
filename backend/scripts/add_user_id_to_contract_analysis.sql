-- 사용자별 저장을 위한 user_id 컬럼 추가 마이그레이션

-- 1. contract_analyses 테이블에 user_id 추가
ALTER TABLE IF EXISTS public.contract_analyses
ADD COLUMN IF NOT EXISTS user_id UUID;

-- user_id 인덱스 추가 (사용자별 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_contract_analyses_user_id 
    ON public.contract_analyses(user_id);

-- user_id와 created_at 복합 인덱스 (사용자별 최신순 조회)
CREATE INDEX IF NOT EXISTS idx_contract_analyses_user_created 
    ON public.contract_analyses(user_id, created_at DESC);

-- 2. situation_analyses 테이블에 user_id 추가
ALTER TABLE IF EXISTS public.situation_analyses
ADD COLUMN IF NOT EXISTS user_id UUID;

-- user_id 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_situation_analyses_user_id 
    ON public.situation_analyses(user_id);

-- user_id와 created_at 복합 인덱스
CREATE INDEX IF NOT EXISTS idx_situation_analyses_user_created 
    ON public.situation_analyses(user_id, created_at DESC);

