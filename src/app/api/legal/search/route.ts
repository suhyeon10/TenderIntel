/**
 * 법률 RAG 검색 API
 * 백엔드 Python API로 프록시
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '5')
    const docType = searchParams.get('doc_type')

    if (!query) {
      return NextResponse.json(
        { error: '검색 쿼리(q)가 필요합니다' },
        { status: 400 }
      )
    }

    // 백엔드 API URL
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000'

    // 백엔드 API로 프록시
    try {
      const searchUrl = new URL(`${backendUrl}/api/v2/legal/search`)
      searchUrl.searchParams.set('q', query)
      searchUrl.searchParams.set('limit', String(limit))
      if (docType) {
        searchUrl.searchParams.set('doc_type', docType)
      }

      const backendResponse = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
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
    console.error('법률 검색 오류:', error)
    return NextResponse.json(
      {
        error: '검색 실패',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

