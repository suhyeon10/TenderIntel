/**
 * 구독 해지 API
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSideClient } from '@/supabase/supabase-server'
import { unschedulePayment } from '@/apis/subscription.service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSideClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    // 구독 정보 조회
    const { data: subscription, error: fetchError } = await supabase
      .from('subscriptions' as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (fetchError || !subscription) {
      return NextResponse.json(
        { error: '활성 구독을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 예약된 결제 취소
    if (subscription.portone_merchant_uid) {
      try {
        await unschedulePayment(subscription.portone_merchant_uid)
      } catch (error: any) {
        console.error('결제 예약 취소 실패:', error)
        // 예약 취소 실패해도 구독 해지는 진행
      }
    }

    // 구독 상태 업데이트
    const { error: updateError } = await supabase
      .from('subscriptions' as any)
      .update({
        status: 'cancelled',
        auto_renew: false,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', subscription.id)

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      message: '구독이 해지되었습니다. 현재 결제 기간까지는 서비스를 이용할 수 있습니다.',
    })
  } catch (error: any) {
    console.error('구독 해지 오류:', error)
    return NextResponse.json(
      { error: '구독 해지에 실패했습니다' },
      { status: 500 }
    )
  }
}

