# RLS 무한 재귀 오류 수정 가이드

## 문제
`public_announcements` 테이블에서 RLS 정책의 무한 재귀 오류가 발생합니다:
```
infinite recursion detected in policy for relation "public_announcements"
```

## 해결 방법

### 방법 1: Supabase 대시보드에서 SQL 실행 (권장)

1. Supabase 대시보드 접속
2. SQL Editor 열기
3. 다음 SQL 실행:

```sql
-- 모든 기존 정책 삭제
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'public_announcements') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public_announcements';
    END LOOP;
END $$;

-- RLS 일시 비활성화
ALTER TABLE public_announcements DISABLE ROW LEVEL SECURITY;

-- RLS 재활성화
ALTER TABLE public_announcements ENABLE ROW LEVEL SECURITY;

-- 새로운 정책 생성 (재귀 없음)
CREATE POLICY "Allow authenticated users to read public_announcements"
ON public_announcements
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow anonymous users to read public_announcements"
ON public_announcements
FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow authenticated users to insert public_announcements"
ON public_announcements
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow users to update own public_announcements"
ON public_announcements
FOR UPDATE
TO authenticated
USING (auth.uid()::text = created_by::text)
WITH CHECK (auth.uid()::text = created_by::text);

CREATE POLICY "Allow users to delete own public_announcements"
ON public_announcements
FOR DELETE
TO authenticated
USING (auth.uid()::text = created_by::text);
```

### 방법 2: 개발 환경에서 RLS 완전 비활성화 (임시 해결책)

개발 환경에서만 사용하세요:

```sql
-- 모든 정책 삭제
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'public_announcements') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public_announcements';
    END LOOP;
END $$;

-- RLS 완전 비활성화 (개발 환경만)
ALTER TABLE public_announcements DISABLE ROW LEVEL SECURITY;
```

### 방법 3: Supabase CLI 사용

```bash
# 마이그레이션 실행
supabase db push

# 또는 특정 마이그레이션만 실행
supabase migration up
```

## 확인

수정 후 다음 쿼리로 정책이 올바르게 설정되었는지 확인:

```sql
SELECT * FROM pg_policies WHERE tablename = 'public_announcements';
```

## 주의사항

- 프로덕션 환경에서는 RLS를 완전히 비활성화하지 마세요
- 방법 1의 정책을 사용하면 인증된 사용자는 모든 공고를 읽을 수 있습니다
- 필요에 따라 정책을 더 엄격하게 수정하세요

