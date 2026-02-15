import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 현재 환경이 프로덕션인지 확인
 * Vercel에서는 VERCEL_ENV 환경 변수를 제공합니다:
 * - production: 프로덕션 배포
 * - preview: 프리뷰 배포 (PR 등)
 * - development: 로컬 개발
 */
export function isProduction(): boolean {
  // Vercel 환경 변수 확인 (서버 사이드)
  const vercelEnv = typeof process !== 'undefined' ? process.env.VERCEL_ENV : null
  const nodeEnv = typeof process !== 'undefined' ? process.env.NODE_ENV : null
  
  // 디버깅용 로그 (개발 환경에서만)
  if (typeof window !== 'undefined' && nodeEnv !== 'production') {
    console.log('🔍 환경 확인:', {
      VERCEL_ENV: vercelEnv,
      NODE_ENV: nodeEnv,
      hostname: window.location.hostname,
      origin: window.location.origin,
    })
  }
  
  if (vercelEnv === 'production') {
    return true
  }
  
  // NODE_ENV 확인 (일반적인 방법)
  if (nodeEnv === 'production') {
    return true
  }
  
  // 클라이언트 사이드에서는 hostname으로 확인
  if (typeof window !== 'undefined') {
    return window.location.hostname === 'linkforus.com' ||
           window.location.hostname === 'makers-b2b.vercel.app' ||
           (!window.location.hostname.includes('localhost') && 
            !window.location.hostname.includes('127.0.0.1'))
  }
  
  return false
}

/**
 * 환경에 따른 site URL 반환
 */
export function getSiteUrl(): string {
  // 환경 변수가 명시적으로 설정되어 있으면 사용
  const explicitUrl = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SITE_URL : null
  if (explicitUrl) {
    if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
      console.log('명시적 SITE_URL 사용:', explicitUrl)
    }
    return explicitUrl
  }
  
  // 프로덕션 환경이면 프로덕션 URL 반환
  const isProd = isProduction()
  if (isProd) {
    const prodUrl = 'https://linkforus.com'
    if (typeof window !== 'undefined') {
      console.log('프로덕션 환경 감지, URL:', prodUrl)
    }
    return prodUrl
  }
  
  // 클라이언트 사이드에서는 현재 origin 사용
  if (typeof window !== 'undefined') {
    const devUrl = window.location.origin
    console.log('🛠️ 개발 환경, URL:', devUrl)
    return devUrl
  }
  
  // 기본값 (서버 사이드)
  return 'http://localhost:3000'
}
