'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function UploadPage() {
  const router = useRouter()

  useEffect(() => {
    // Legal 서비스의 계약서 분석 페이지로 리다이렉트
    router.replace('/legal/contract')
  }, [router])

  return null
}
