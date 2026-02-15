# legal_chunks 테이블 embedding 차원 변경 가이드

## 문제
`legal_chunks` 테이블의 `embedding` 컬럼이 384차원으로 정의되어 있는데, `BAAI/bge-m3` 모델은 1024차원을 생성합니다.

**에러 메시지:**
```
'expected 384 dimensions, not 1024'
```

## 해결 방법

### 1단계: Supabase SQL Editor에서 실행

Supabase 대시보드 → **SQL Editor**에서 다음 SQL을 실행하세요:

```sql
-- legal_chunks 테이블의 embedding 컬럼을 384차원에서 1024차원으로 변경

-- 1. 기존 인덱스 삭제
DROP INDEX IF EXISTS idx_legal_chunks_embedding;

-- 2. 기존 embedding 컬럼 삭제
ALTER TABLE public.legal_chunks DROP COLUMN IF EXISTS embedding;

-- 3. 새로운 1024차원 embedding 컬럼 추가
ALTER TABLE public.legal_chunks ADD COLUMN embedding vector(1024);

-- 4. 벡터 인덱스 재생성 (1024차원)
CREATE INDEX IF NOT EXISTS idx_legal_chunks_embedding 
    ON public.legal_chunks 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
```

### 2단계: 스크립트 재실행

SQL 실행이 완료되면, 인덱싱 스크립트를 다시 실행하세요:

```bash
cd backend
python scripts/index_contracts_from_data.py
```

## 주의사항

⚠️ **기존 데이터 삭제됨**
- 384차원 → 1024차원으로 변환할 수 없으므로 기존 데이터는 삭제됩니다
- SQL 실행 후 스크립트를 다시 실행하여 데이터를 재인덱싱해야 합니다

## 백업이 필요한 경우

기존 데이터를 백업하려면 SQL 실행 전에:

```sql
-- 백업 테이블 생성
CREATE TABLE legal_chunks_backup_384 AS 
SELECT * FROM public.legal_chunks;
```

## 확인 방법

SQL 실행 후 다음 쿼리로 확인:

```sql
-- embedding 컬럼 차원 확인
SELECT 
    column_name, 
    data_type,
    udt_name
FROM information_schema.columns 
WHERE table_name = 'legal_chunks' 
  AND column_name = 'embedding';
```

결과: `vector(1024)` 이어야 합니다.

