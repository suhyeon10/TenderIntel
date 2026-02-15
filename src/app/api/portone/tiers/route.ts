/**
 * 포트원 하위 상점(Tier) 조회 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { getTier } from '@/apis/subscription.service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tierCode = searchParams.get('tier_code')

    if (!tierCode) {
      return NextResponse.json(
        { error: 'tier_code 파라미터가 필요합니다' },
        { status: 400 }
      )
    }

    // 하위 상점 정보 조회
    const tierInfo = await getTier(tierCode)

    return NextResponse.json({
      success: true,
      tier: tierInfo,
    })
  } catch (error: any) {
    console.error('하위 상점 조회 오류:', error)
    return NextResponse.json(
      { error: error.message || '하위 상점 조회에 실패했습니다' },
      { status: 500 }
    )
  }
}

