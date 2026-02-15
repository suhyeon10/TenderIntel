-- situation_conversations 테이블이 삭제되었으므로 관련 트리거도 삭제
-- 이 마이그레이션은 situation_analyses 테이블의 트리거를 제거합니다.

-- 트리거 삭제
DROP TRIGGER IF EXISTS trigger_insert_initial_conversation_analyses ON public.situation_analyses;

-- 트리거 함수 삭제 (다른 곳에서 사용하지 않는 경우)
DROP FUNCTION IF EXISTS insert_initial_conversation_analyses() CASCADE;

-- 참고: situation_conversations 테이블이 삭제되었으므로,
-- 이제 legal_chat_sessions와 legal_chat_messages 테이블을 사용합니다.

