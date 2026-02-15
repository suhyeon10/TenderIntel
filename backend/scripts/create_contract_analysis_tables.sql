-- 계약서 분석 결과 저장용 테이블 (가이드 스펙 준수)

-- 1. 계약서 분석 결과 헤더
CREATE TABLE IF NOT EXISTS public.contract_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id TEXT UNIQUE NOT NULL,
    title TEXT,
    original_filename TEXT,
    doc_type TEXT,            -- 'employment', 'freelance' 등
    risk_score NUMERIC,
    risk_level TEXT,          -- 'low', 'medium', 'high'
    sections JSONB,           -- {working_hours: 80, wage: 60 ...}
    summary TEXT,
    retrieved_contexts JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_analyses_doc_id 
    ON public.contract_analyses(doc_id);

CREATE INDEX IF NOT EXISTS idx_contract_analyses_created_at 
    ON public.contract_analyses(created_at DESC);

-- 2. 계약서 이슈(독소조항) 상세
CREATE TABLE IF NOT EXISTS public.contract_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_analysis_id UUID REFERENCES public.contract_analyses(id) ON DELETE CASCADE,
    issue_id TEXT,            -- 'issue-1', 'issue-2' 등
    category TEXT,            -- 'working_hours' 등
    severity TEXT,            -- 'low','medium','high'
    summary TEXT,
    original_text TEXT,
    legal_basis TEXT[],       -- ['근로기준법 제50조', ...]
    explanation TEXT,
    suggested_revision TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_issues_analysis_id 
    ON public.contract_issues(contract_analysis_id);

CREATE INDEX IF NOT EXISTS idx_contract_issues_category 
    ON public.contract_issues(category);

-- 3. 상황 분석 기록 (옵션)
CREATE TABLE IF NOT EXISTS public.situation_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    situation TEXT,
    category TEXT,
    employment_type TEXT,
    company_size TEXT,
    work_period TEXT,
    has_written_contract BOOLEAN,
    social_insurance TEXT[],
    risk_score NUMERIC,
    risk_level TEXT,
    analysis JSONB,
    checklist JSONB,
    related_cases JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_situation_analyses_category 
    ON public.situation_analyses(category);

CREATE INDEX IF NOT EXISTS idx_situation_analyses_created_at 
    ON public.situation_analyses(created_at DESC);

