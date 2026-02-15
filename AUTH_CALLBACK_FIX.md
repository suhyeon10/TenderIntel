# 인증 콜백 오류 해결 가이드

## 🔴 문제: 로그인 후 `/auth/auth-code-error`로 리다이렉트

로그인 후 인증 오류 페이지로 이동하는 문제는 주로 **쿠키 파싱 오류** 또는 **Redirect URL 설정 문제**로 발생합니다.

---

## ✅ 해결 방법

### 1️⃣ Route Handler에서 올바른 Supabase 클라이언트 사용

**✅ 올바른 방법 (`@supabase/ssr` 사용):**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (key: string) => cookieStore.get(key)?.value,
        set: (key: string, value: string, options: any) => {
          cookieStore.set(key, value, options)
        },
        remove: (key: string, options: any) => {
          cookieStore.set(key, '', { ...options, maxAge: 0 })
        },
      },
    }
  )

  const { data: session, error } = await supabase.auth.exchangeCodeForSession(code)
  // ...
}
```

**❌ 잘못된 방법:**

```typescript
// ❌ 래퍼 함수를 통한 간접 사용 (쿠키가 제대로 설정되지 않을 수 있음)
import { createServerSideClient } from '@/supabase/supabase-server'
const supabase = await createServerSideClient()
```

---

### 2️⃣ Supabase Dashboard에서 Redirect URLs 확인

**반드시 확인해야 할 설정:**

1. Supabase Dashboard → **Authentication** → **URL Configuration** 이동

2. 다음 URL들을 **모두** 추가:

   ```
   http://localhost:3000
   http://localhost:3000/auth/callback
   https://your-domain.com
   https://your-domain.com/auth/callback
   ```

3. 확인 항목:
   - ✅ **Site URL**: `http://localhost:3000` (개발) 또는 프로덕션 URL
   - ✅ **Redirect URLs**: 위의 모든 URL 포함
   - ✅ **Allowed Callback URLs**: 위의 모든 URL 포함
   - ✅ **Allowed Sign-out URLs**: 위의 모든 URL 포함

**⚠️ 중요:** URL 끝에 슬래시(`/`)가 있으면 안 됩니다. 정확히 일치해야 합니다.

---

### 3️⃣ 브라우저 쿠키 확인

**개발자 도구에서 확인:**

1. F12 → **Application** 탭 → **Cookies**
2. 다음 쿠키가 있는지 확인:
   - `sb-<project-ref>-auth-token`
   - `sb-<project-ref>-auth-token.0` (큰 토큰의 경우 분할됨)

3. 쿠키가 없거나 손상된 경우:
   ```javascript
   // 브라우저 콘솔에서 실행
   localStorage.clear()
   sessionStorage.clear()
   document.cookie.split(";").forEach(function(c) { 
     document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
   })
   window.location.href = '/auth'
   ```

---

### 4️⃣ 환경 변수 확인

**.env.local 파일 확인:**

```env
# ✅ 올바른 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ❌ 절대 이렇게 하지 마세요
SUPABASE_SERVICE_ROLE_KEY=...  # 클라이언트에 노출되면 안 됨
```

---

### 5️⃣ 서버 로그 확인

**개발 환경에서 서버 콘솔 확인:**

로그인 시도 시 다음 로그가 나타나야 합니다:

```
[Auth Callback] Processing authorization code...
[Auth Callback] Session exchange successful: { userId: '...', email: '...' }
```

**에러가 발생하는 경우:**

```
[Auth Callback] Session exchange error: {
  message: '...',
  status: 403,
  ...
}
```

에러 메시지를 확인하여 원인을 파악하세요.

---

## 🔍 디버깅 체크리스트

- [ ] Route Handler에서 `createServerClient`를 직접 사용하는가?
- [ ] `cookies()`를 올바르게 전달하는가?
- [ ] Supabase Dashboard의 Redirect URLs에 모든 필요한 URL이 추가되어 있는가?
- [ ] 환경 변수가 올바르게 설정되어 있는가?
- [ ] 브라우저 쿠키가 정상적으로 설정되는가?
- [ ] 서버 로그에 에러 메시지가 있는가?

---

## 📝 수정된 파일

- ✅ `src/app/auth/callback/route.ts` - `@supabase/ssr`의 올바른 사용법으로 수정
- ✅ `src/app/auth/auth-code-error/page.tsx` - 개발 환경에서 상세 에러 정보 표시

---

## 🚀 추가 참고 자료

- [Supabase SSR 문서](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Supabase Auth 오류 코드](https://supabase.com/docs/guides/auth/debugging/error-codes)

