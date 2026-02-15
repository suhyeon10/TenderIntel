import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const errorParam = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')
    
    // OAuth 에러가 URL 파라미터로 전달된 경우
    if (errorParam) {
      console.error('[Auth Callback] OAuth error from provider:', {
        error: errorParam,
        description: errorDescription,
        url: request.url,
      })
      const errorUrl = new URL('/auth/auth-code-error', origin)
      errorUrl.searchParams.set('error', errorParam)
      if (errorDescription) {
        errorUrl.searchParams.set('description', errorDescription)
      }
      return NextResponse.redirect(errorUrl)
    }
    
    // OAuth 콜백의 next 파라미터 정규화 (오픈 리다이렉트 방지)
    const nextParam = searchParams.get('next') ?? '/'
    const safeNext = nextParam.startsWith('/') ? nextParam : '/'

    if (!code) {
      console.error('[Auth Callback] No authorization code provided:', {
        url: request.url,
        searchParams: Object.fromEntries(searchParams),
      })
      return NextResponse.redirect(new URL('/auth/auth-code-error', origin))
    }

    console.log('[Auth Callback] Processing authorization code...')
    
    // ✅ @supabase/ssr의 올바른 사용법: cookies()를 직접 전달
    const cookieStore = cookies()
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (key: string) => {
            return cookieStore.get(key)?.value
          },
          set: (key: string, value: string, options: any) => {
            try {
              cookieStore.set(key, value, options)
            } catch (error) {
              // 쿠키 설정 실패는 무시 (이미 설정된 경우 등)
              console.warn('[Auth Callback] Cookie set warning:', error)
            }
          },
          remove: (key: string, options: any) => {
            try {
              cookieStore.set(key, '', { ...options, maxAge: 0 })
            } catch (error) {
              console.warn('[Auth Callback] Cookie remove warning:', error)
            }
          },
        },
      }
    )

    const { data: session, error: sessionError } =
      await supabase.auth.exchangeCodeForSession(code)
    
    if (sessionError) {
      console.error('[Auth Callback] Session exchange error:', {
        message: sessionError.message,
        status: sessionError.status,
        name: sessionError.name,
        code: (sessionError as any).code,
        fullError: JSON.stringify(sessionError, null, 2),
      })
      
      // 개발 환경에서는 더 자세한 에러 정보를 URL에 포함
      const errorUrl = new URL('/auth/auth-code-error', origin)
      if (process.env.NODE_ENV === 'development') {
        errorUrl.searchParams.set('dev_error', sessionError.message || 'Unknown error')
        errorUrl.searchParams.set('dev_status', String(sessionError.status || 'unknown'))
      }
      return NextResponse.redirect(errorUrl)
    }

    if (!session) {
      console.error('[Auth Callback] Session is null after exchange')
      return NextResponse.redirect(new URL('/auth/auth-code-error', origin))
    }

    console.log('[Auth Callback] Session exchange successful:', {
      userId: session.user?.id,
      email: session.user?.email,
    })

    // 사용자 프로필 생성 또는 업데이트 (Legal 서비스용)
    if (session.user) {
      const userId = session.user.id
      const userEmail = session.user.email || ''
      const userName = session.user.user_metadata?.name || 
                      session.user.email?.split('@')[0] || 
                      `user_${userId.slice(0, 8)}`

      // user_profiles 테이블에 사용자 정보 저장 (없으면 생성, 있으면 업데이트)
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: userId,
          username: userName,
          email: userEmail,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })

      if (profileError) {
        console.error('[Auth Callback] Failed to upsert user profile:', profileError)
        // 프로필 생성 실패해도 로그인은 진행 (auth.users는 이미 생성됨)
      }
    }

    // Legal 서비스로 리다이렉트
    // ✅ 쿠키는 이미 exchangeCodeForSession에서 설정되었으므로 리다이렉트만 하면 됨
    const finalNext = safeNext === '/' ? '/legal' : safeNext
    return NextResponse.redirect(new URL(finalNext, origin))
  } catch (error: any) {
    console.error('[Auth Callback] Unexpected error:', error)
    // 에러 발생 시 에러 페이지로 리다이렉트
    const { origin } = new URL(request.url)
    return NextResponse.redirect(new URL('/auth/auth-code-error', origin))
  }
}
