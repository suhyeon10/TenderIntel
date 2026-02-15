-- contract_analyses 테이블에 clauses와 highlighted_texts 컬럼 추가
-- 조항 목록과 하이라이트된 텍스트를 JSONB로 저장

-- clauses 컬럼 추가 (조항 목록)
ALTER TABLE public.contract_analyses 
ADD COLUMN IF NOT EXISTS clauses JSONB DEFAULT '[]'::jsonb;

-- highlighted_texts 컬럼 추가 (하이라이트된 텍스트)
ALTER TABLE public.contract_analyses 
ADD COLUMN IF NOT EXISTS highlighted_texts JSONB DEFAULT '[]'::jsonb;

-- 인덱스 추가 (선택사항, JSONB 쿼리 성능 향상)
CREATE INDEX IF NOT EXISTS idx_contract_analyses_clauses 
ON public.contract_analyses USING GIN (clauses);

CREATE INDEX IF NOT EXISTS idx_contract_analyses_highlighted_texts 
ON public.contract_analyses USING GIN (highlighted_texts);

