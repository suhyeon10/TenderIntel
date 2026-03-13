-- legal_chunks (linkus_legal_legal_chunks) upsert용 유니크 제약 추가
-- (external_id, chunk_index) 기준으로 ON CONFLICT DO UPDATE 가능하게 함
-- 실행 순서: 기존 인덱싱 스크립트보다 먼저 또는 재구축 전에 1회 실행

-- 1. 유니크 제약 추가 (이미 있으면 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_linkus_legal_legal_chunks_external_id_chunk_index'
  ) THEN
    ALTER TABLE public.linkus_legal_legal_chunks
    ADD CONSTRAINT uq_linkus_legal_legal_chunks_external_id_chunk_index
    UNIQUE (external_id, chunk_index);
    RAISE NOTICE '유니크 제약 uq_linkus_legal_legal_chunks_external_id_chunk_index 추가됨';
  ELSE
    RAISE NOTICE '유니크 제약이 이미 존재합니다.';
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE '테이블 linkus_legal_legal_chunks가 없습니다. 테이블 생성 후 다시 실행하세요.';
END $$;
