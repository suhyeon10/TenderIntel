'use client'

import React, { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/supabase/supabase-client'
import useHydration from '@/hooks/use-hydrate'
import { getSiteUrl } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'

const AuthUI = ({ role }: { role: string }) => {
  const isMounted = useHydration()
  const [user, setUser] = useState<User | null>(null)
  const [checkingProfile, setCheckingProfile] = useState(true)
  const [supabaseClient, setSupabaseClient] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null)

  useEffect(() => {
    // ✅ 브라우저 환경에서만 실행 (SSR 방지)
    if (typeof window === 'undefined') {
      setCheckingProfile(false)
      return
    }

    // ✅ 클라이언트 생성
    let client: ReturnType<typeof createSupabaseBrowserClient>
    try {
      client = createSupabaseBrowserClient()
      setSupabaseClient(client)
    } catch (error) {
      console.error('[AuthUI] Supabase 클라이언트 생성 실패:', error)
      setCheckingProfile(false)
      return
    }

    // ✅ supabaseClient가 없으면 실행하지 않음
    if (!client) {
      setCheckingProfile(false)
      return
    }

    const checkUser = async () => {
      try {
        const { data: { user: currentUser }, error: authError } = await client.auth.getUser()
        
        // 403 에러는 쿠키 파싱 오류 또는 손상된 세션을 의미
        if (authError) {
          if (authError.status === 403) {
            console.warn('[AuthUI] 403 에러 감지, 손상된 세션 정리 중:', authError.message)
            // 손상된 세션 정리
            try {
              await client.auth.signOut({ scope: 'local' })
              // 로컬 스토리지 정리
              if (typeof window !== 'undefined') {
                const keys = Object.keys(localStorage)
                keys.forEach(key => {
                  if (key.includes('supabase') || key.includes('auth') || key.includes('linkus-auth')) {
                    localStorage.removeItem(key)
                  }
                })
                // 쿠키도 정리
                document.cookie.split(";").forEach(function(c) { 
                  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
                })
              }
            } catch (signOutError) {
              console.error('[AuthUI] 세션 정리 실패:', signOutError)
            }
          } else if (authError.status !== 401) {
            // 401은 로그인하지 않은 상태이므로 정상, 다른 에러만 로그
            console.warn('[AuthUI] 인증 확인 중 에러:', authError.message)
          }
          setUser(null)
        } else {
          setUser(currentUser)
        }
      } catch (error) {
        console.error('[AuthUI] 사용자 확인 실패:', error)
        setUser(null)
      } finally {
        setCheckingProfile(false)
      }
    }

    checkUser()
  }, [])

  if (!isMounted || !supabaseClient) return null

  const getUserInfo = async () => {
    if (!supabaseClient) return
    const result = await supabaseClient.auth.getUser()
    // @ts-ignore
    if (result?.data?.user) setUser(result?.data?.user)
  }

  const handleLogout = async () => {
    if (!supabaseClient) return
    // 완전한 로그아웃: 모든 스토리지 정리
    await supabaseClient.auth.signOut({ scope: 'global' })
    
    // localStorage와 sessionStorage 정리
    if (typeof window !== 'undefined') {
      // Supabase 관련 키 정리
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.includes('supabase') || key.includes('auth')) {
          localStorage.removeItem(key)
        }
      })
      
      // sessionStorage도 정리
      const sessionKeys = Object.keys(sessionStorage)
      sessionKeys.forEach(key => {
        if (key.includes('supabase') || key.includes('auth') || key === 'profileType') {
          sessionStorage.removeItem(key)
        }
      })
    }
    
    window.location.reload()
  }

  const signInWithGoogle = async () => {
    if (!supabaseClient) {
      console.error('[AuthUI] Supabase 클라이언트가 초기화되지 않았습니다.')
      return
    }

    // 환경에 따른 site URL 설정
    const siteUrl = getSiteUrl()

    // legal 서비스는 프로필 타입 선택 없이 바로 로그인
    const redirectUrl = `${siteUrl}/auth/callback?next=/legal`

    try {
      await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          // Google OAuth: 항상 계정 선택 화면 표시
          queryParams: { prompt: 'select_account' },
        },
      })
    } catch (error) {
      console.error('[AuthUI] Google 로그인 실패:', error)
    }
  }

  const handleGoogleLogin = async () => {
    await signInWithGoogle()
  }


  return (
    <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-50 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
      <div className="w-full max-w-md mx-auto px-6">
        {/* 헤더 섹션 */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl blur-sm opacity-50"></div>
              <div className="relative p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
            Linkus Legal에 오신 것을 환영합니다
          </h1>
          <p className="text-gray-600 mb-6">
            청년을 위한 AI 기반 법률 리스크 탐지 서비스
          </p>
        </div>

        {/* 로그인 버튼들 */}
        <div className="space-y-3">
          <button
            onClick={handleGoogleLogin}
            disabled={checkingProfile}
            className={`flex items-center justify-center w-full h-14 rounded-xl shadow-md p-4 border-2 transition-all ${
              checkingProfile
                ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-50'
                : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-lg hover:scale-[1.02]'
            }`}
          >
            <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="font-semibold text-gray-900">구글로 시작하기</span>
          </button>
          
          {checkingProfile && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">확인 중...</p>
            </div>
          )}
        </div>

        {/* 하단 안내 */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            로그인 시{' '}
            <a href="/terms" className="text-blue-600 hover:underline">
              이용약관
            </a>
            {' '}및{' '}
            <a href="/privacy" className="text-blue-600 hover:underline">
              개인정보처리방침
            </a>
            에 동의하게 됩니다.
          </p>
        </div>
      </div>
    </section>
  )
}

export default AuthUI
