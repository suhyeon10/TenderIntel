/**
 * 상황 분석 API
 * 백엔드 Legal RAG Service의 analyze_situation을 호출
 */

import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: '상황 설명(text)이 필요합니다' },
        { status: 400 }
      )
    }

    // 백엔드 API URL
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000'

    // 백엔드 API로 프록시
    try {
      const analyzeUrl = `${backendUrl}/api/v1/legal/analyze-situation`

      const backendResponse = await fetch(analyzeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      })

      if (!backendResponse.ok) {
        const errorText = await backendResponse.text()
        throw new Error(`백엔드 API 오류: ${backendResponse.status} - ${errorText}`)
      }

      const backendData = await backendResponse.json()

      return NextResponse.json(backendData)
    } catch (backendError) {
      console.error('백엔드 API 호출 실패:', backendError)
      return NextResponse.json(
        {
          error: '백엔드 API 호출 실패',
          message:
            backendError instanceof Error
              ? backendError.message
              : String(backendError),
          hint: `백엔드 서버(${backendUrl})가 실행 중인지 확인해주세요.`,
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('상황 분석 오류:', error)
    return NextResponse.json(
      {
        error: '분석 실패',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

