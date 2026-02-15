import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const analysisId = params.id

    // 환경 변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase 환경 변수가 설정되지 않았습니다')
      return NextResponse.json(
        { error: '서버 설정 오류' },
        { status: 500 }
      )
    }

    // SERVICE_ROLE_KEY를 사용하면 RLS를 우회할 수 있음
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 분석 결과 조회 (결과가 없을 수도 있으므로 maybeSingle 사용)
    const { data, error } = await supabase
      .from('contract_analyses')
      .select('*')
      .eq('id', analysisId)
      .maybeSingle()

    // 에러 처리 (PGRST116은 "결과 없음"을 의미하는 정상적인 에러)
    if (error) {
      if (error.code === 'PGRST116') {
        // 결과가 없는 경우 - 정상적인 상황 (로컬 스토리지에서 조회 가능)
        console.log(`[API] 분석 결과를 DB에서 찾을 수 없음: ${analysisId} (로컬 스토리지에서 조회 가능)`)
        return NextResponse.json(
          { error: '분석 결과를 찾을 수 없습니다.' },
          { status: 404 }
        )
      } else {
        // 다른 에러인 경우
        console.error('[API] 분석 결과 조회 실패:', {
          id: analysisId,
          code: error.code,
          message: error.message,
          details: error.details,
        })
        return NextResponse.json(
          { error: '분석 결과 조회 중 오류가 발생했습니다.' },
          { status: 500 }
        )
      }
    }

    // 데이터가 없으면 404 반환 (정상적인 경우 - 로컬 스토리지에서 조회 가능)
    if (!data) {
      console.log(`[API] 분석 결과 데이터 없음: ${analysisId} (로컬 스토리지에서 조회 가능)`)
      return NextResponse.json(
        { error: '분석 결과를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 데이터 반환
    console.log(`[API] 분석 결과 조회 성공: ${analysisId}`)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[API] 예상치 못한 오류:', {
      message: error.message,
      stack: error.stack,
    })
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

