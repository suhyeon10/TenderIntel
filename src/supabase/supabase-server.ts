import { Database } from '@/types/supabase'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { getCookie, setCookie } from 'cookies-next'

// 서버 전용 (ServerActions, RouterHandler)
export const createServerSideClient = async (serverComponent = false) => {
  const cookieStore = cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (key) => cookieStore.get(key)?.value,
        set: (key, value, options) => {
          if (serverComponent) return
          cookieStore.set(key, value, options)
        },
        remove: (key, options) => {
          if (serverComponent) return
          cookieStore.set(key, '', options)
        },
      },
    },
  )
}

// 서버 컴포넌트 전용
export const createServerSideClientRSC = async () => {
  return createServerSideClient(true)
}

// 미들웨어 전용
export const createServerSideMiddleware = async (
  req: NextRequest,
  res: NextResponse,
) => {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Next.js 미들웨어에서는 NextRequest.cookies를 직접 사용
        get: (key) => {
          return req.cookies.get(key)?.value
        },
        set: (key, value, options) => {
          // NextResponse의 cookies를 사용하여 쿠키 설정
          res.cookies.set({
            name: key,
            value,
            ...options,
            // SameSite와 Secure 옵션은 프로덕션에서 중요
            sameSite: options?.sameSite || 'lax',
            httpOnly: options?.httpOnly !== false, // 기본값 true
          })
        },
        remove: (key, options) => {
          // 쿠키 삭제는 만료 시간을 과거로 설정
          res.cookies.set({
            name: key,
            value: '',
            expires: new Date(0),
            ...options,
          })
        },
      },
    },
  )
}
