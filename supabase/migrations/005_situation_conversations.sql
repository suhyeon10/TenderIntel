-- 상황 분석 리포트 기반 대화 내역 저장 테이블
CREATE TABLE IF NOT EXISTS public.situation_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.situation_reports(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 메시지 정보
    message TEXT NOT NULL,                    -- 메시지 내용
    sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'assistant')),  -- 발신자 유형
    sequence_number INTEGER NOT NULL,        -- 대화 순서 (0부터 시작, 리포트 answer가 첫 메시지)
    
    -- 메타데이터
    metadata JSONB,                          -- 추가 메타데이터 (에러 정보, 재시도 정보 등)
    
    -- 타임스탬프
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_situation_conversations_report_id 
    ON public.situation_conversations(report_id);

CREATE INDEX IF NOT EXISTS idx_situation_conversations_user_id 
    ON public.situation_conversations(user_id);

CREATE INDEX IF NOT EXISTS idx_situation_conversations_report_sequence 
    ON public.situation_conversations(report_id, sequence_number);

CREATE INDEX IF NOT EXISTS idx_situation_conversations_created_at 
    ON public.situation_conversations(created_at DESC);

-- RLS (Row Level Security) 정책
ALTER TABLE public.situation_conversations ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 리포트에 연결된 대화 내역만 조회 가능
CREATE POLICY "Users can view conversations for their own reports"
    ON public.situation_conversations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.situation_reports
            WHERE situation_reports.id = situation_conversations.report_id
            AND (situation_reports.user_id = auth.uid() OR situation_reports.user_id IS NULL)
        )
    );

-- 사용자는 자신의 리포트에 연결된 대화 내역만 생성 가능
CREATE POLICY "Users can insert conversations for their own reports"
    ON public.situation_conversations
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.situation_reports
            WHERE situation_reports.id = situation_conversations.report_id
            AND (situation_reports.user_id = auth.uid() OR situation_reports.user_id IS NULL)
        )
    );

-- 사용자는 자신의 리포트에 연결된 대화 내역만 수정 가능
CREATE POLICY "Users can update conversations for their own reports"
    ON public.situation_conversations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.situation_reports
            WHERE situation_reports.id = situation_conversations.report_id
            AND (situation_reports.user_id = auth.uid() OR situation_reports.user_id IS NULL)
        )
    );

-- 사용자는 자신의 리포트에 연결된 대화 내역만 삭제 가능
CREATE POLICY "Users can delete conversations for their own reports"
    ON public.situation_conversations
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.situation_reports
            WHERE situation_reports.id = situation_conversations.report_id
            AND (situation_reports.user_id = auth.uid() OR situation_reports.user_id IS NULL)
        )
    );

-- 리포트 생성 시 첫 메시지(assistant)를 자동으로 삽입하는 트리거 함수
CREATE OR REPLACE FUNCTION public.insert_initial_conversation_message()
RETURNS TRIGGER AS $$
BEGIN
    -- 리포트의 answer 필드가 첫 대화 메시지(assistant)로 저장
    INSERT INTO public.situation_conversations (
        report_id,
        user_id,
        message,
        sender_type,
        sequence_number
    ) VALUES (
        NEW.id,
        NEW.user_id,
        NEW.answer,
        'assistant',
        0
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 생성: situation_reports에 새 리포트가 생성될 때 자동으로 첫 메시지 삽입
CREATE TRIGGER trigger_insert_initial_conversation
    AFTER INSERT ON public.situation_reports
    FOR EACH ROW
    WHEN (NEW.answer IS NOT NULL AND NEW.answer != '')
    EXECUTE FUNCTION public.insert_initial_conversation_message();

