'use client'

import { useEffect } from 'react'

import { useAccountStore } from '@/stores/useAccoutStore'
import { createSupabaseBrowserClient } from '@/supabase/supabase-client'

export default function AccountProvider() {
  const setAccount = useAccountStore((state) => state.setAccount)
  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const supabase = createSupabaseBrowserClient()
        
        // 인증 상태 확인
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
          // 토큰 손상 오류 발생 시 세션 정리
          const isTokenCorrupted = authError?.message?.includes('missing sub claim') || 
                                   authError?.message?.includes('invalid claim') ||
                                   authError?.message?.includes('JWT') ||
                                   authError?.status === 403
          
          if (isTokenCorrupted && authError) {
            console.warn('토큰 손상 감지, 세션 정리 중:', authError.message)
            try {
              // 손상된 세션 정리
              await supabase.auth.signOut({ scope: 'local' })
              // 로컬 스토리지의 세션 정보도 정리
              if (typeof window !== 'undefined') {
                const keys = Object.keys(localStorage)
                keys.forEach(key => {
                  if (key.includes('supabase') || key.includes('auth')) {
                    localStorage.removeItem(key)
                  }
                })
              }
            } catch (signOutError) {
              console.error('로그아웃 처리 실패:', signOutError)
            }
          } else if (authError?.status === 403 || authError?.message?.includes('403')) {
            console.warn('인증 오류로 인해 계정 정보를 불러올 수 없습니다:', authError.message)
          }
          setAccount(null)
          return
        }

        // 계정 정보 조회
        const { data: account, error: accountError } = await supabase
          .from('accounts')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .is('deleted_at', null)
          .maybeSingle()

        if (accountError) {
          console.error('계정 정보 조회 실패:', accountError)
          setAccount(null)
          return
        }

        setAccount(account)
      } catch (error) {
        console.error('계정 정보 로드 중 오류 발생:', error)
        setAccount(null)
      }
    }

    fetchAccount()
  }, [])

  return null
}
