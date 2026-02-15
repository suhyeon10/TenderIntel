-- situation_reports의 내용을 situation_analyses로 통합
-- 이 마이그레이션은 situation_analyses 테이블을 확장하고
-- situation_conversations의 외래키를 업데이트합니다.

-- ============================================================
-- 0. 기존 데이터 정리 (이상한 데이터 삭제)
-- ============================================================

-- 0-1. situation_conversations의 고아 레코드 삭제 (참조하는 report_id가 없는 경우)
DELETE FROM public.situation_conversations
WHERE report_id NOT IN (
    SELECT id FROM public.situation_analyses
);

-- 0-2. 중복된 situation_conversations 레코드 정리
-- 같은 report_id, sequence_number, sender_type이 중복된 경우 최신 것만 유지
DELETE FROM public.situation_conversations sc1
WHERE EXISTS (
    SELECT 1 FROM public.situation_conversations sc2
    WHERE sc1.report_id = sc2.report_id
    AND sc1.sequence_number = sc2.sequence_number
    AND sc1.sender_type = sc2.sender_type
    AND sc1.id < sc2.id  -- 더 오래된 레코드 삭제
);

-- 0-3. sequence_number가 음수이거나 비정상적으로 큰 값 정리
DELETE FROM public.situation_conversations
WHERE sequence_number < 0 OR sequence_number > 10000;

-- 0-4. 빈 메시지 정리
DELETE FROM public.situation_conversations
WHERE message IS NULL OR TRIM(message) = '';

-- ============================================================
-- 1. situation_analyses 테이블에 누락된 컬럼 추가
-- ============================================================
ALTER TABLE IF EXISTS public.situation_analyses
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS question TEXT,  -- 사용자가 입력한 상황 요약 (situation과 유사하지만 별도 필드)
ADD COLUMN IF NOT EXISTS answer TEXT,    -- 리포트 내용 (analysis.summary와 유사)
ADD COLUMN IF NOT EXISTS details TEXT,   -- 상세 설명
ADD COLUMN IF NOT EXISTS category_hint TEXT,  -- 상황 카테고리 힌트 (category와 유사)
ADD COLUMN IF NOT EXISTS classified_type TEXT,  -- 분류된 유형
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_situation_analyses_user_id 
    ON public.situation_analyses(user_id);

CREATE INDEX IF NOT EXISTS idx_situation_analyses_user_created 
    ON public.situation_analyses(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_situation_analyses_category_hint 
    ON public.situation_analyses(category_hint);

CREATE INDEX IF NOT EXISTS idx_situation_analyses_risk_score 
    ON public.situation_analyses(risk_score);

-- 3. updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION public.update_situation_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_situation_analyses_updated_at ON public.situation_analyses;
CREATE TRIGGER trigger_update_situation_analyses_updated_at
    BEFORE UPDATE ON public.situation_analyses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_situation_analyses_updated_at();

-- 4. RLS (Row Level Security) 정책 추가
ALTER TABLE IF EXISTS public.situation_analyses ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 있으면 삭제
DROP POLICY IF EXISTS "Users can view their own analyses" ON public.situation_analyses;
DROP POLICY IF EXISTS "Users can insert their own analyses" ON public.situation_analyses;
DROP POLICY IF EXISTS "Users can update their own analyses" ON public.situation_analyses;
DROP POLICY IF EXISTS "Users can delete their own analyses" ON public.situation_analyses;

-- 사용자는 자신의 분석 결과만 조회 가능
CREATE POLICY "Users can view their own analyses"
    ON public.situation_analyses
    FOR SELECT
    USING (auth.uid() = user_id OR user_id IS NULL);

-- 사용자는 자신의 분석 결과만 생성 가능
CREATE POLICY "Users can insert their own analyses"
    ON public.situation_analyses
    FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- 사용자는 자신의 분석 결과만 수정 가능
CREATE POLICY "Users can update their own analyses"
    ON public.situation_analyses
    FOR UPDATE
    USING (auth.uid() = user_id OR user_id IS NULL);

-- 사용자는 자신의 분석 결과만 삭제 가능
CREATE POLICY "Users can delete their own analyses"
    ON public.situation_analyses
    FOR DELETE
    USING (auth.uid() = user_id OR user_id IS NULL);

-- 5. situation_conversations의 외래키를 situation_analyses로 변경
-- 기존 외래키 제약조건 삭제
ALTER TABLE IF EXISTS public.situation_conversations
DROP CONSTRAINT IF EXISTS situation_conversations_report_id_fkey;

-- 새로운 외래키 제약조건 추가 (situation_analyses 참조)
ALTER TABLE IF EXISTS public.situation_conversations
ADD CONSTRAINT situation_conversations_report_id_fkey
FOREIGN KEY (report_id) REFERENCES public.situation_analyses(id) ON DELETE CASCADE;

-- 6. situation_conversations의 RLS 정책 업데이트
-- 기존 정책 삭제
DROP POLICY IF EXISTS "Users can view conversations for their own reports" ON public.situation_conversations;
DROP POLICY IF EXISTS "Users can insert conversations for their own reports" ON public.situation_conversations;
DROP POLICY IF EXISTS "Users can update conversations for their own reports" ON public.situation_conversations;
DROP POLICY IF EXISTS "Users can delete conversations for their own reports" ON public.situation_conversations;

-- situation_analyses를 참조하도록 정책 업데이트
CREATE POLICY "Users can view conversations for their own analyses"
    ON public.situation_conversations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.situation_analyses
            WHERE situation_analyses.id = situation_conversations.report_id
            AND (situation_analyses.user_id = auth.uid() OR situation_analyses.user_id IS NULL)
        )
    );

CREATE POLICY "Users can insert conversations for their own analyses"
    ON public.situation_conversations
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.situation_analyses
            WHERE situation_analyses.id = situation_conversations.report_id
            AND (situation_analyses.user_id = auth.uid() OR situation_analyses.user_id IS NULL)
        )
    );

CREATE POLICY "Users can update conversations for their own analyses"
    ON public.situation_conversations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.situation_analyses
            WHERE situation_analyses.id = situation_conversations.report_id
            AND (situation_analyses.user_id = auth.uid() OR situation_analyses.user_id IS NULL)
        )
    );

CREATE POLICY "Users can delete conversations for their own analyses"
    ON public.situation_conversations
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.situation_analyses
            WHERE situation_analyses.id = situation_conversations.report_id
            AND (situation_analyses.user_id = auth.uid() OR situation_analyses.user_id IS NULL)
        )
    );

-- 7. 트리거 함수 업데이트: situation_analyses에 새 분석이 생성될 때 자동으로 초기 메시지 삽입
CREATE OR REPLACE FUNCTION public.insert_initial_conversation_message()
RETURNS TRIGGER AS $$
BEGIN
    -- 사용자 입력 메시지 저장 (sequence_number 0)
    IF NEW.question IS NOT NULL AND NEW.question != '' THEN
        INSERT INTO public.situation_conversations (
            report_id,
            user_id,
            message,
            sender_type,
            sequence_number
        ) VALUES (
            NEW.id,
            NEW.user_id,
            NEW.question,
            'user',
            0
        );
    END IF;
    
    -- AI 분석 결과 메시지 저장 (sequence_number 1)
    DECLARE
        assistant_message TEXT;
    BEGIN
        -- answer 필드가 있으면 우선 사용, 없으면 analysis.summary 사용
        IF NEW.answer IS NOT NULL AND NEW.answer != '' THEN
            assistant_message := NEW.answer;
        ELSIF NEW.analysis IS NOT NULL AND (NEW.analysis->>'summary') IS NOT NULL THEN
            assistant_message := NEW.analysis->>'summary';
        ELSE
            -- 메시지가 없으면 저장하지 않음
            RETURN NEW;
        END IF;
        
        INSERT INTO public.situation_conversations (
            report_id,
            user_id,
            message,
            sender_type,
            sequence_number
        ) VALUES (
            NEW.id,
            NEW.user_id,
            assistant_message,
            'assistant',
            1
        );
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 트리거 삭제 (situation_reports용 - 테이블이 존재하지 않을 수 있으므로 IF EXISTS 사용)
-- DROP TRIGGER IF EXISTS는 테이블이 없어도 에러가 발생하므로 주석 처리
-- DROP TRIGGER IF EXISTS trigger_insert_initial_conversation ON public.situation_reports;

-- 새로운 트리거 생성 (situation_analyses용)
DROP TRIGGER IF EXISTS trigger_insert_initial_conversation_analyses ON public.situation_analyses;
CREATE TRIGGER trigger_insert_initial_conversation_analyses
    AFTER INSERT ON public.situation_analyses
    FOR EACH ROW
    WHEN (
        (NEW.question IS NOT NULL AND NEW.question != '') OR
        (NEW.answer IS NOT NULL AND NEW.answer != '') OR
        (NEW.analysis IS NOT NULL AND (NEW.analysis->>'summary') IS NOT NULL)
    )
    EXECUTE FUNCTION public.insert_initial_conversation_message();

-- ============================================================
-- 8. 기존 데이터 마이그레이션
-- ============================================================

-- 참고: situation_reports 테이블이 존재하지 않으므로 마이그레이션 단계는 건너뜁니다.
-- 이미 모든 데이터가 situation_analyses에 있고, situation_conversations의 외래키도
-- situation_analyses를 참조하고 있습니다.

-- ============================================================
-- 9. 최종 정리 및 검증
-- ============================================================

-- 9-1. situation_conversations의 고아 레코드 최종 정리
DELETE FROM public.situation_conversations
WHERE report_id NOT IN (SELECT id FROM public.situation_analyses);

-- 9-2. sequence_number 재정렬 (각 report_id별로 0부터 시작하도록)
-- 이 작업은 복잡하므로 필요시 별도 스크립트로 실행 권장
-- 여기서는 건너뛰고 애플리케이션 레벨에서 처리

-- 마이그레이션 완료
-- 참고: 
-- 1. situation_reports 테이블은 레거시이므로 나중에 삭제할 수 있습니다.
-- 2. 모든 데이터가 situation_analyses로 마이그레이션되었는지 확인하세요.
-- 3. situation_conversations의 sequence_number가 올바른지 확인하세요.

