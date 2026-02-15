-- legal_chunks 벡터 검색용 RPC 함수 생성 (1024차원)
-- BAAI/bge-m3 모델 (1024차원) 사용을 위해 필요

-- 1. 기존 함수가 있으면 삭제
DROP FUNCTION IF EXISTS match_legal_chunks(vector, float, int, text);

-- 2. RPC 함수 생성 (1024차원, category 필터 포함)
CREATE OR REPLACE FUNCTION match_legal_chunks(
  query_embedding vector(1024),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 8,
  category text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  external_id text,
  source_type text,
  title text,
  content text,
  chunk_index integer,
  file_path text,
  metadata jsonb,
  score float
)
LANGUAGE sql STABLE AS $$
  SELECT
    lc.id,
    lc.external_id,
    lc.source_type,
    lc.title,
    lc.content,
    lc.chunk_index,
    lc.file_path,
    lc.metadata,
    1 - (lc.embedding <=> query_embedding) AS score
  FROM legal_chunks AS lc
  WHERE
    -- category 필터 (metadata JSONB에서 topic_main 확인)
    (category IS NULL OR 
     (lc.metadata->>'topic_main' = category) OR
     (lc.metadata->>'category' = category))
    -- boilerplate 필터 (머리말/기타 등 제외)
    AND (lc.is_boilerplate IS NULL OR lc.is_boilerplate = false)
    -- 유사도 임계값 필터
    AND 1 - (lc.embedding <=> query_embedding) >= match_threshold
  ORDER BY
    lc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 3. 함수 설명 추가
COMMENT ON FUNCTION match_legal_chunks IS 
'legal_chunks 벡터 검색 함수 (1024차원, category 필터 지원)';

-- 4. ivfflat 인덱스 생성 (이미 있으면 무시)
-- lists 값은 데이터 크기에 맞게 조정 (200개면 10~50, 2000개면 50~100)
CREATE INDEX IF NOT EXISTS legal_chunks_embedding_idx
ON legal_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE 'match_legal_chunks RPC 함수가 생성되었습니다!';
    RAISE NOTICE '임베딩 차원: 1024 (BAAI/bge-m3)';
    RAISE NOTICE 'ivfflat 인덱스가 생성되었습니다.';
END $$;

