'use client'

import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function AuthCodeError() {
  const searchParams = useSearchParams()
  const [errorDetails, setErrorDetails] = useState<{
    error?: string | null
    description?: string | null
    devError?: string | null
    devStatus?: string | null
  }>({})

  useEffect(() => {
    setErrorDetails({
      error: searchParams.get('error'),
      description: searchParams.get('description'),
      devError: searchParams.get('dev_error'),
      devStatus: searchParams.get('dev_status'),
    })
  }, [searchParams])

  const isDevelopment = process.env.NODE_ENV === 'development'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
      <div className="text-center max-w-md mx-auto px-6">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          인증 오류가 발생했습니다
        </h1>
        <p className="text-gray-600 mb-6">
          로그인 과정에서 문제가 발생했습니다. 다시 시도해주세요.
        </p>

        {/* 개발 환경에서만 에러 상세 정보 표시 */}
        {isDevelopment && (errorDetails.devError || errorDetails.error) && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
            <h3 className="font-semibold text-yellow-800 mb-2">개발 환경 디버깅 정보:</h3>
            {errorDetails.devError && (
              <p className="text-sm text-yellow-700 mb-1">
                <strong>에러 메시지:</strong> {errorDetails.devError}
              </p>
            )}
            {errorDetails.devStatus && (
              <p className="text-sm text-yellow-700 mb-1">
                <strong>상태 코드:</strong> {errorDetails.devStatus}
              </p>
            )}
            {errorDetails.error && (
              <p className="text-sm text-yellow-700 mb-1">
                <strong>OAuth 에러:</strong> {errorDetails.error}
              </p>
            )}
            {errorDetails.description && (
              <p className="text-sm text-yellow-700">
                <strong>설명:</strong> {errorDetails.description}
              </p>
            )}
            <div className="mt-3 pt-3 border-t border-yellow-300">
              <p className="text-xs text-yellow-600">
                💡 <strong>해결 방법:</strong>
                <br />1. Supabase Dashboard → Authentication → URL settings 확인
                <br />2. Redirect URLs에 <code className="bg-yellow-100 px-1 rounded">http://localhost:3000/auth/callback</code> 추가
                <br />3. 브라우저 콘솔과 서버 로그 확인
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => window.location.href = '/auth'}
            className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            로그인 페이지로 돌아가기
          </button>
          <button
            onClick={() => {
              // 세션 정리 후 재시도
              if (typeof window !== 'undefined') {
                localStorage.clear()
                sessionStorage.clear()
                // 쿠키 삭제
                document.cookie.split(";").forEach(function(c) { 
                  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
                })
                window.location.href = '/auth'
              }
            }}
            className="w-full px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            세션 정리 후 재시도
          </button>
        </div>
      </div>
    </div>
  )
}
