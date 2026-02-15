'use client'

import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

// 싱글톤 클라이언트 인스턴스
let supabaseBrowserClientInstance: SupabaseClient<Database> | null = null

// 브라우저용 싱글톤 클라이언트 (지연 초기화)
// ✅ 'use client' 필수: SSR 환경에서 localStorage 접근 방지
// ✅ 모듈 레벨에서 즉시 실행하지 않고, 함수로 만들어서 필요할 때만 호출
function getSupabaseBrowserClient(): SupabaseClient<Database> {
  // 이미 생성된 인스턴스가 있으면 재사용
  if (supabaseBrowserClientInstance) {
    return supabaseBrowserClientInstance
  }
  
  // ✅ 브라우저 환경에서만 클라이언트 생성
  if (typeof window === 'undefined') {
    throw new Error('supabaseBrowserClient는 브라우저 환경에서만 사용할 수 있습니다. 서버 컴포넌트에서는 createServerSideClient를 사용하세요.')
  }
  
  // ✅ @supabase/ssr의 createBrowserClient는 브라우저에서 쿠키를 자동으로 처리합니다
  // 기본 옵션 사용 (쿠키 기반 스토리지)
  supabaseBrowserClientInstance = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  return supabaseBrowserClientInstance
}

// getter를 통한 접근 (지연 초기화)
export const supabaseBrowserClient = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getSupabaseBrowserClient()
    const value = (client as any)[prop]
    return typeof value === 'function' ? value.bind(client) : value
  }
})

// 레거시 호환성을 위한 함수 (내부적으로 싱글톤 사용)
export const createSupabaseBrowserClient = (): SupabaseClient<Database> => {
  // ✅ 브라우저 환경 체크
  if (typeof window === 'undefined') {
    throw new Error('createSupabaseBrowserClient는 브라우저 환경에서만 사용할 수 있습니다.')
  }
  return getSupabaseBrowserClient()
}
