-- 상황 분석 리포트 저장용 테이블
CREATE TABLE IF NOT EXISTS public.situation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 리포트 기본 정보
    question TEXT NOT NULL,  -- 사용자가 입력한 상황 요약
    answer TEXT NOT NULL,    -- 리포트 내용 (summary 필드)
    
    -- 분석 결과 데이터
    summary TEXT,            -- 상황 분석의 결과
    details TEXT,            -- 상세 설명
    category_hint TEXT,       -- 상황 카테고리
    employment_type TEXT,    -- 고용 형태
    work_period TEXT,        -- 근무 기간
    social_insurance TEXT,   -- 4대보험
    
    -- 분석 결과 메타데이터
    risk_score INTEGER,      -- 위험도 점수 (0-100)
    classified_type TEXT,    -- 분류된 유형
    legal_basis TEXT[],      -- 법적 근거 배열
    recommendations TEXT[],  -- 권장사항 배열
    tags TEXT[],             -- 태그 배열
    
    -- 리포트 전체 데이터 (JSONB)
    analysis_result JSONB,   -- 전체 분석 결과 (criteria, actionPlan, scripts 등)
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_situation_reports_user_id 
    ON public.situation_reports(user_id);

CREATE INDEX IF NOT EXISTS idx_situation_reports_created_at 
    ON public.situation_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_situation_reports_category 
    ON public.situation_reports(category_hint);

CREATE INDEX IF NOT EXISTS idx_situation_reports_risk_score 
    ON public.situation_reports(risk_score);

-- RLS (Row Level Security) 정책
ALTER TABLE public.situation_reports ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 리포트만 조회 가능
CREATE POLICY "Users can view their own reports"
    ON public.situation_reports
    FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

-- 사용자는 자신의 리포트만 생성 가능
CREATE POLICY "Users can insert their own reports"
    ON public.situation_reports
    FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 사용자는 자신의 리포트만 수정 가능
CREATE POLICY "Users can update their own reports"
    ON public.situation_reports
    FOR UPDATE
    USING (auth.uid() = user_id OR user_id IS NULL);

-- 사용자는 자신의 리포트만 삭제 가능
CREATE POLICY "Users can delete their own reports"
    ON public.situation_reports
    FOR DELETE
    USING (auth.uid() = user_id OR user_id IS NULL);

