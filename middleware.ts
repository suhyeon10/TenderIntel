import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerSideMiddleware } from '@/supabase/supabase-server'

/**
 * Next.js Middleware
 * 
 * ⚠️ 주의: 이 미들웨어는 선택사항입니다.
 * 인증이 필요한 모든 경로를 보호하려면 이 파일을 활성화하세요.
 * 
 * 현재는 쿠키 파싱을 올바르게 처리하는 예시만 제공합니다.
 * 실제 경로 보호가 필요하면 아래 코드를 수정하세요.
 */
export async function middleware(request: NextRequest) {
  // 응답 객체 생성
  const response = NextResponse.next()

  try {
    // Supabase 클라이언트 생성 (쿠키 파싱 지원)
    const supabase = await createServerSideMiddleware(request, response)

    // 사용자 인증 확인
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    // 403 에러가 발생한 경우 (쿠키 파싱 오류 등)
    if (error && error.status === 403) {
      console.warn('[Middleware] 403 에러 감지:', error.message)
      
      // 쿠키 파싱 오류인 경우 세션 정리
      if (error.message?.includes('Unexpected token') || 
          error.message?.includes('base64') ||
          error.message?.includes('JWT')) {
        console.warn('[Middleware] 쿠키 파싱 오류 감지, 세션 정리 필요')
        // 클라이언트에서 세션을 정리하도록 리다이렉트
        // 또는 여기서 쿠키를 직접 삭제할 수도 있습니다
      }
    }

    // 예시: 특정 경로 보호 (필요시 활성화)
    // const protectedPaths = ['/legal', '/analysis', '/contract']
    // const isProtectedPath = protectedPaths.some(path => 
    //   request.nextUrl.pathname.startsWith(path)
    // )
    // 
    // if (isProtectedPath && !user) {
    //   // 로그인 페이지로 리다이렉트
    //   const redirectUrl = new URL('/auth', request.url)
    //   redirectUrl.searchParams.set('next', request.nextUrl.pathname)
    //   return NextResponse.redirect(redirectUrl)
    // }

    return response
  } catch (error) {
    console.error('[Middleware] 오류 발생:', error)
    // 오류 발생 시에도 요청은 계속 진행
    return response
  }
}

/**
 * 미들웨어가 실행될 경로 지정
 * 
 * 현재는 모든 경로에서 실행되지만, 성능을 위해 필요한 경로만 지정할 수 있습니다.
 */
export const config = {
  matcher: [
    /*
     * 다음 경로를 제외한 모든 요청 경로와 일치:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public 폴더의 파일들
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

