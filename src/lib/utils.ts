import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isProduction(): boolean {
  const vercelEnv = typeof process !== "undefined" ? process.env.VERCEL_ENV : null
  const nodeEnv = typeof process !== "undefined" ? process.env.NODE_ENV : null

  if (typeof window !== "undefined" && nodeEnv !== "production") {
    console.log("환경 확인:", {
      VERCEL_ENV: vercelEnv,
      NODE_ENV: nodeEnv,
      hostname: window.location.hostname,
      origin: window.location.origin,
    })
  }

  if (vercelEnv === "production" || nodeEnv === "production") {
    return true
  }

  if (typeof window !== "undefined") {
    return (
      !window.location.hostname.includes("localhost") &&
      !window.location.hostname.includes("127.0.0.1")
    )
  }

  return false
}

export function getSiteUrl(): string {
  // OAuth redirect는 사용자가 실제로 접속한 도메인을 우선 사용해야
  // 예전 프로덕션 도메인으로 잘못 튀는 문제를 막을 수 있습니다.
  if (typeof window !== "undefined") {
    const currentOrigin = window.location.origin
    if (process.env.NODE_ENV !== "production") {
      console.log("현재 origin 사용:", currentOrigin)
    }
    return currentOrigin
  }

  const explicitUrl =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SITE_URL : null
  if (explicitUrl) {
    return explicitUrl
  }

  return "http://localhost:3000"
}
