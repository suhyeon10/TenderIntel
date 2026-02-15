/**
 * 영수증 조회 API
 * PortOne V2 결제 정보를 조회하여 영수증 정보 반환
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSideClient } from '@/supabase/supabase-server'
import { getPayment } from '@/apis/subscription-v2.service'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSideClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const paymentId = searchParams.get('paymentId')

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId가 필요합니다' }, { status: 400 })
    }

    // 결제 내역이 사용자의 것인지 확인
    const { data: payment } = await supabase
      .from('payments' as any)
      .select('portone_imp_uid, portone_merchant_uid, user_id')
      .or(`portone_imp_uid.eq.${paymentId},portone_merchant_uid.eq.${paymentId}`)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!payment) {
      return NextResponse.json(
        { error: '결제 내역을 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // PortOne V2 API로 결제 정보 조회
    const paymentInfo = await getPayment(payment.portone_imp_uid || paymentId)

    if (!paymentInfo) {
      return NextResponse.json(
        { error: '결제 정보를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    // 영수증 정보 반환
    const paymentData = paymentInfo as any
    return NextResponse.json({
      success: true,
      payment: {
        id: paymentData.id || paymentId,
        amount: paymentData.amount?.total || 0,
        currency: paymentData.amount?.currency || 'KRW',
        status: paymentData.status,
        paidAt: paymentData.paidAt || paymentData.paid_at,
        orderName: paymentData.orderName || paymentData.order_name,
        // PortOne 관리자 콘솔 링크
        receiptUrl: `https://admin.portone.io/payments/${paymentData.id || paymentId}`,
      },
    })
  } catch (error: any) {
    console.error('영수증 조회 오류:', error)
    return NextResponse.json(
      { error: '영수증 조회에 실패했습니다' },
      { status: 500 }
    )
  }
}

