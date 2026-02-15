# Supabase 403 에러 해결 가이드

## 🔴 403 에러란?

Supabase Auth에서 인증 토큰(또는 세션 쿠키)이 유효하지 않음을 의미합니다. 브라우저가 `/auth/v1/user` 요청을 보낼 때 `access_token`이 없거나, 만료되었거나, 쿠키 파싱이 깨졌거나, 환경 변수 설정이 잘못된 경우 발생합니다.

---

## ✅ 해결 방법 (가장 흔한 원인 순서)

### 1️⃣ 쿠키 파싱 오류 (가장 흔한 원인)

최근 Supabase는 보안 강화를 위해 cookie-based auth 정책을 강화했는데, 아래 문제들이 403을 유발합니다.

#### 🔥 쿠키 파싱 에러 (Unexpected token 'b', base64…)

이 에러는 보통 미들웨어 / API Route에서 `supabase.auth.getUser()` 실행 시 Authorization 헤더 대신 쿠키 파싱이 꼬였을 때 발생합니다.

#### ✔ 해결 방법

**Route Handler에서 올바른 사용:**

```typescript
// ✅ 올바른 방법
import { createServerSideClient } from '@/supabase/supabase-server';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  const supabase = await createServerSideClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  return Response.json({ user });
}
```

**❌ 잘못된 방법 (쿠키 파싱 없음):**

```typescript
// ❌ 잘못된 방법 - 쿠키 파싱이 안 됨
import { createClient } from '@supabase/supabase-js';

export async function GET(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  // 이렇게 하면 쿠키가 파싱되지 않아 403 발생 가능
}
```

---

### 2️⃣ access_token 만료 또는 세션 손실

브라우저에서 자동으로 `/auth/v1/user`를 호출하는데 `access_token` 쿠키가 없으면 403 → Forbidden 바로 발생합니다.

#### ✔ 해결 방법

**브라우저에서 강제 재로그인:**

1. 브라우저 개발자 도구 열기 (F12)
2. Console 탭에서 다음 실행:

```javascript
// 모든 스토리지 정리
localStorage.clear();
sessionStorage.clear();

// 쿠키 삭제 (특히: supabase-auth-token)
document.cookie.split(";").forEach(function(c) { 
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
});

// 페이지 새로고침
window.location.reload();
```

또는 수동으로:
- Application 탭 → Cookies → 모든 Supabase 관련 쿠키 삭제
- Application 탭 → Local Storage → 모든 항목 삭제
- Application 탭 → Session Storage → 모든 항목 삭제

---

### 3️⃣ Redirect URL Mismatch

로그인 후 리다이렉트 설정이 잘못되면 세션 저장 전에 redirect 되어 쿠키가 저장되지 않아 403 발생 가능합니다.

#### 확인할 부분

Supabase Dashboard → Authentication → URL settings

다음 항목들을 확인하세요:

- **Site URL**
- **Redirect URLs**
- **Allowed Callback URLs**
- **Allowed Sign-out URLs**

#### ✔ Next.js 설정 예시

다음 URL들을 모두 추가해야 합니다:

```
http://localhost:3000
http://localhost:3000/auth/callback
https://your-domain.com
https://your-domain.com/auth/callback
```

**프로덕션 환경:**
```
https://your-production-domain.com
https://your-production-domain.com/auth/callback
```

---

### 4️⃣ Service Key 실수 사용

Service Key는 backend-only인데 클라이언트에서 호출하면 Supabase에서 바로 403 반환합니다.

#### 확인 사항

`.env.local` 파일에 `SUPABASE_ANON_KEY`만 들어가야 합니다:

```env
# ✅ 올바른 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ❌ 절대 이렇게 하지 마세요 (Service Key 노출)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**⚠️ 주의:**
- `SUPABASE_SERVICE_ROLE_KEY`는 **절대** 클라이언트 코드나 브라우저에 노출되면 안 됩니다
- Service Key는 서버 사이드에서만 사용해야 합니다
- Service Key를 사용하면 RLS(Row Level Security)를 우회할 수 있으므로 주의가 필요합니다

---

## 🔍 디버깅 방법

### 1. 브라우저 개발자 도구 확인

**Network 탭:**
- `/auth/v1/user` 요청을 확인
- Status Code가 403인지 확인
- Request Headers에 `Cookie` 헤더가 있는지 확인

**Console 탭:**
- 에러 메시지 확인
- "Unexpected token" 또는 "base64" 관련 에러 확인

### 2. 서버 로그 확인

```typescript
// Route Handler에서 디버깅
export async function GET(req: Request) {
  const supabase = await createServerSideClient();
  
  // 쿠키 확인
  const cookieStore = cookies();
  console.log('Cookies:', cookieStore.getAll());
  
  // 사용자 확인
  const { data: { user }, error } = await supabase.auth.getUser();
  console.log('User:', user);
  console.log('Error:', error);
  
  return Response.json({ user, error });
}
```

### 3. 환경 변수 확인

```bash
# .env.local 파일 확인
cat .env.local

# 또는 PowerShell에서
Get-Content .env.local
```

---

## 📝 프로젝트에서 수정된 파일

다음 파일들이 올바른 쿠키 파싱을 사용하도록 수정되었습니다:

- ✅ `src/app/api/test-supabase/route.ts` - `createServerSideClient` 사용
- ✅ `src/app/auth/callback/route.ts` - 이미 올바르게 구현됨

**참고:** 일부 Route Handler는 의도적으로 `SUPABASE_SERVICE_ROLE_KEY`를 사용합니다 (RLS 우회가 필요한 경우). 이 경우는 정상입니다.

---

## 🚀 예방 방법

1. **항상 `createServerSideClient` 사용**
   - Route Handler에서는 항상 `@/supabase/supabase-server`의 `createServerSideClient`를 사용하세요

2. **환경 변수 관리**
   - `.env.local`에 `NEXT_PUBLIC_SUPABASE_ANON_KEY`만 포함
   - Service Key는 절대 클라이언트에 노출하지 않기

3. **리다이렉트 URL 설정**
   - Supabase Dashboard에서 모든 필요한 URL을 미리 설정

4. **에러 처리**
   - 403 에러 발생 시 자동으로 세션 정리 및 재로그인 유도

---

## 📚 참고 자료

- [Supabase Auth Helpers for Next.js](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [Supabase Cookie-based Auth](https://supabase.com/docs/guides/auth/auth-helpers/nextjs#cookie-based-auth)
- [Next.js Middleware with Supabase](https://supabase.com/docs/guides/auth/auth-helpers/nextjs#middleware)

---

## 💡 추가 도움말

문제가 계속되면:

1. Supabase Dashboard → Logs에서 에러 로그 확인
2. 브라우저 콘솔의 전체 에러 메시지 확인
3. Network 탭에서 실패한 요청의 상세 정보 확인

