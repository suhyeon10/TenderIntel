/**
 * 건별 결제 생성 API
 * POST /api/checkout/ppv
 * 
 * PortOne로 결제창 호출 → 성공 콜백(webhook)에서 payments 업데이트 후 grant_ppv_after_payment 실행
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSideClient } from '@/supabase/supabase-server'
import { getPortOneClients } from '@/apis/subscription-v2.service'

const PPV_PRICE = 2000 // 건별 열람권 가격

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSideClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { estimateId } = body

    if (!estimateId) {
      return NextResponse.json(
        { error: 'estimateId is required' },
        { status: 400 }
      )
    }

    // 이미 권리 있으면 차단
    const { data: canView } = await (supabase.rpc as any)('can_view_estimate', {
      p_user: user.id,
      p_estimate: estimateId
    })

    if (canView) {
      return NextResponse.json({
        ok: true,
        message: 'already_have_access'
      })
    }

    // 결제 프리레코드(대기)
    const { data: payment, error: paymentError } = await supabase
      .from('payments' as any)
      .insert({
        user_id: user.id,
        purpose: 'ppv',
        estimate_id: estimateId,
        amount_krw: PPV_PRICE,
        amount: PPV_PRICE,
        payment_status: 'pending',
        pg_provider: 'portone'
      })
      .select('*')
      .single()

    if (paymentError) {
      console.error('Payment creation error:', paymentError)
      return NextResponse.json(
        { error: paymentError.message },
        { status: 500 }
      )
    }

    // PortOne 결제 요청 생성
    const { paymentClient } = getPortOneClients()
    const merchantUid = `ppv_${payment.id}`

    const paymentResponse = await (paymentClient as any).post('/payments', {
      amount: {
        total: PPV_PRICE,
        currency: 'KRW'
      },
      channelKey: process.env.PORTONE_V2_CHANNEL_KEY,
      paymentId: merchantUid,
      orderName: `견적서 열람 - ${estimateId}`,
      customer: {
        fullName: user.email?.split('@')[0] || '사용자',
        email: user.email || '',
        phoneNumber: ''
      },
      customData: {
        type: 'estimate_view_ppv',
        estimate_id: estimateId,
        user_id: user.id,
        payment_id: payment.id
      }
    } as any)

    if (!paymentResponse.data || paymentResponse.data.status !== 'READY') {
      return NextResponse.json(
        { error: 'Failed to create payment request' },
        { status: 500 }
      )
    }

    // 프론트에서 @portone/browser-sdk 호출할 파라미터 반환
    return NextResponse.json({
      ok: true,
      payment_id: payment.id,
      portone: {
        paymentId: paymentResponse.data.paymentId,
        amount: PPV_PRICE,
        merchant_uid: merchantUid,
        orderName: `견적서 열람 - ${estimateId}`
      }
    })
  } catch (error: any) {
    console.error('PPV checkout error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

