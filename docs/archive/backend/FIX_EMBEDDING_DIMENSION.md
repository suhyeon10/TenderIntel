# 🔧 임베딩 차원 불일치 해결

## 문제

```
expected 1536 dimensions, not 384
```

Supabase의 벡터 컬럼이 1536차원(OpenAI)으로 설정되어 있는데, 현재 로컬 임베딩 모델(bge-small-en-v1.5)은 384차원입니다.

## 해결 방법

### 방법 1: Supabase 벡터 컬럼 차원 변경 (권장)

Supabase SQL Editor에서 실행:

```sql
-- 기존 컬럼 삭제
ALTER TABLE announcement_chunks DROP COLUMN IF EXISTS embedding;

-- 384차원으로 재생성
ALTER TABLE announcement_chunks 
ADD COLUMN embedding vector(384);
```

### 방법 2: 더 큰 임베딩 모델 사용

`config.py` 또는 `.env`에서:

```env
LOCAL_EMBEDDING_MODEL=BAAI/bge-large-en-v1.5  # 1024차원
# 또는
LOCAL_EMBEDDING_MODEL=BAAI/bge-m3  # 1024차원 (다국어)
```

그리고 Supabase에서:

```sql
ALTER TABLE announcement_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE announcement_chunks ADD COLUMN embedding vector(1024);
```

### 방법 3: 기존 데이터 삭제 후 재인덱싱

```sql
-- 기존 데이터 삭제
DELETE FROM announcement_chunks;
DELETE FROM announcements;

-- 벡터 컬럼 재생성 (384차원)
ALTER TABLE announcement_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE announcement_chunks ADD COLUMN embedding vector(384);
```

## 현재 모델별 차원

| 모델 | 차원 |
|------|------|
| `BAAI/bge-small-en-v1.5` | 384 |
| `BAAI/bge-base-en-v1.5` | 768 |
| `BAAI/bge-large-en-v1.5` | 1024 |
| `BAAI/bge-m3` | 1024 |
| `text-embedding-3-small` (OpenAI) | 1536 |

## 추천

해커톤용으로는 **384차원(bge-small)**이 가장 빠르고 효율적입니다.

1. Supabase에서 벡터 컬럼을 384차원으로 변경
2. 기존 데이터 삭제
3. 재인덱싱

