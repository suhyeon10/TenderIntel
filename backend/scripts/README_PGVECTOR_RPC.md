# pgvector RPC 함수 사용 가이드

## 개요

기존 Python에서 수동으로 코사인 유사도를 계산하던 방식을 **pgvector RPC 함수**로 변경하여 성능을 대폭 개선했습니다.

### 변경 전 (비효율적)
- Supabase에서 legal_chunks 최대 1000개 SELECT
- Python에서 한 줄씩 꺼내서 코사인 유사도 계산
- Python 리스트 정렬 후 top_k 반환
- **문제**: 데이터가 많아지면 (2,000 / 20,000개) 병목 발생

### 변경 후 (효율적)
- 쿼리 임베딩 → `match_legal_chunks` RPC 호출 → 상위 legal chunks만 받기
- **장점**: DB가 바로 유사도 계산 + 정렬 + top_k까지 처리

## 설치 방법

### 1. Supabase SQL Editor에서 RPC 함수 생성

`backend/scripts/create_match_legal_chunks_rpc.sql` 파일을 Supabase SQL Editor에서 실행하세요.

이 스크립트는:
- `match_legal_chunks` RPC 함수 생성 (1024차원)
- `ivfflat` 인덱스 생성 (성능 향상)
- category 필터 지원

### 2. 임베딩 차원 확인

현재 사용 중인 임베딩 모델: **BAAI/bge-m3** (1024차원)

`legal_chunks` 테이블의 `embedding` 컬럼이 1024차원인지 확인:

```sql
-- Supabase SQL Editor에서 실행
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'legal_chunks' 
AND column_name = 'embedding';
```

결과가 `vector(1024)`가 아니면 다음 스크립트 실행:

```sql
-- backend/scripts/update_legal_chunks_to_1024.sql 실행
```

## RPC 함수 사용법

### 함수 시그니처

```sql
match_legal_chunks(
  query_embedding vector(1024),  -- 쿼리 임베딩 벡터
  match_threshold float DEFAULT 0.5,  -- 유사도 임계값 (0.4~0.6 권장)
  match_count int DEFAULT 8,  -- 반환할 최대 개수
  category text DEFAULT NULL  -- 카테고리 필터 (metadata->>'topic_main')
)
```

### Python에서 호출

```python
# backend/core/supabase_vector_store.py에서 자동으로 사용됨
response = self.sb.rpc(
    "match_legal_chunks",
    {
        "query_embedding": query_embedding,  # List[float] (1024차원)
        "match_threshold": 0.5,
        "match_count": 8,
        "category": "wage",  # 선택사항: "wage", "working_hours" 등
    }
).execute()
```

## 성능 최적화 팁

### 1. match_threshold 조정

- **작은 데이터 (200개)**: `0.4 ~ 0.6` 권장
- **큰 데이터 (2000개 이상)**: `0.5 ~ 0.7` 가능
- 너무 높게 잡으면 (0.7~0.8) 결과가 없을 수 있음

### 2. ivfflat 인덱스 lists 값 조정

데이터 크기에 맞게 조정:

```sql
-- 200개: lists = 10~50
-- 2000개: lists = 50~100
-- 20000개: lists = 100~200

CREATE INDEX IF NOT EXISTS legal_chunks_embedding_idx
ON legal_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

### 3. category 필터 활용

이슈별로 관련 법령만 검색하여 성능 + 품질 향상:

```python
# 이슈 카테고리로 필터링
filters = {"topic_main": "wage"}  # 임금 관련 법령만 검색
```

## 문제 해결

### RPC 함수가 없다는 오류

```
[경고] match_legal_chunks RPC 함수가 없습니다.
```

**해결**: `backend/scripts/create_match_legal_chunks_rpc.sql` 파일을 Supabase SQL Editor에서 실행

### 임베딩 차원 불일치 오류

```
expected 384 dimensions, not 1024
```

**해결**: 
1. `legal_chunks` 테이블의 `embedding` 컬럼이 `vector(1024)`인지 확인
2. `backend/scripts/update_legal_chunks_to_1024.sql` 실행

### 결과가 너무 적거나 없음

**원인**: `match_threshold`가 너무 높음

**해결**: `match_threshold`를 낮춤 (0.4~0.5 권장)

## 참고

- **임베딩 모델**: BAAI/bge-m3 (1024차원)
- **벡터 연산**: pgvector `<=>` 연산자 (코사인 거리)
- **인덱스**: ivfflat (근사 최근접 이웃 검색)

