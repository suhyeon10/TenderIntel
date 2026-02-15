# RLS 정책 문제 해결

현재 `announcements` 테이블에 RLS 정책이 설정되어 있어서 service_role_key로도 삽입이 실패하고 있습니다.

## 해결 방법

### 방법 1: Supabase 대시보드에서 RLS 정책 수정 (권장)

1. Supabase 대시보드 → Authentication → Policies
2. `announcements` 테이블의 INSERT 정책 수정
3. `with_check` 조건을 `true`로 변경하거나 service_role 추가

### 방법 2: SQL로 직접 수정

```sql
-- 기존 정책 삭제
DROP POLICY IF EXISTS "Authenticated users can insert announcements" ON public.announcements;
DROP POLICY IF EXISTS "Authenticated users can insert announcement_bodies" ON public.announcement_bodies;
DROP POLICY IF EXISTS "Authenticated users can insert announcement_chunks" ON public.announcement_chunks;
DROP POLICY IF EXISTS "Authenticated users can insert announcement_analysis" ON public.announcement_analysis;

-- 모든 역할이 INSERT할 수 있도록 정책 생성 (개발 환경용)
CREATE POLICY "Allow all inserts to announcements"
ON public.announcements
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow all inserts to announcement_bodies"
ON public.announcement_bodies
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow all inserts to announcement_chunks"
ON public.announcement_chunks
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow all inserts to announcement_analysis"
ON public.announcement_analysis
FOR INSERT
TO public
WITH CHECK (true);
```

### 방법 3: RLS 비활성화 (개발 환경만)

```sql
ALTER TABLE public.announcements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_bodies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_chunks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_analysis DISABLE ROW LEVEL SECURITY;
```

**주의**: 프로덕션 환경에서는 RLS를 비활성화하지 마세요!

