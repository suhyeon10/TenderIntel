/**
 * 결제 실패 재시도 API
 * 결제 실패한 구독에 대해 재시도
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSideClient } from '@/supabase/supabase-server'
import { requestPaymentWithBillingKey } from '@/apis/subscription.service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSideClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { subscription_id, payment_id } = body

    if (!subscription_id) {
      return NextResponse.json({ error: 'subscription_id가 필요합니다' }, { status: 400 })
    }

    // 구독 정보 조회
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions' as any)
      .select('*')
      .eq('id', subscription_id)
      .eq('user_id', user.id)
      .single()

    if (subError || !subscription) {
      return NextResponse.json(
        { error: '구독 정보를 찾을 수 없습니다' },
        { status: 404 }
      )
    }

    if (!subscription.customer_uid) {
      return NextResponse.json(
        { error: '빌링키가 없습니다' },
        { status: 400 }
      )
    }

    // 사용자 정보 조회
    const { data: accountData } = await supabase
      .from('accounts')
      .select('username')
      .eq('user_id', user.id)
      .single() as any

    const merchantUid = `linkers_sub_${user.id}_${Date.now()}`

    try {
      // 결제 재시도
      const paymentResult = await requestPaymentWithBillingKey(
        subscription.customer_uid,
        merchantUid,
        subscription.price,
        '링커스 월 구독료',
        {
          name: accountData?.username || user.email?.split('@')[0] || '사용자',
          email: user.email || '',
          tel: '',
        }
      )

      // 결제 내역 저장
      await supabase.from('payments' as any).insert({
        user_id: user.id,
        subscription_id: subscription.id,
        amount: subscription.price,
        currency: 'KRW',
        payment_method: 'card',
        payment_status: 'completed',
        pg_provider: 'portone',
        pg_transaction_id: paymentResult.imp_uid,
        portone_imp_uid: paymentResult.imp_uid,
        portone_merchant_uid: merchantUid,
        paid_at: new Date(paymentResult.paid_at * 1000).toISOString(),
      })

      // 다음 달 결제 예약
      const nextBillingDate = new Date()
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)
      const nextMerchantUid = `linkers_sub_${user.id}_${Date.now() + 1}`

      await supabase
        .from('subscriptions' as any)
        .update({
          next_billing_date: nextBillingDate.toISOString(),
          portone_merchant_uid: nextMerchantUid,
        })
        .eq('id', subscription.id)

      return NextResponse.json({
        success: true,
        payment: paymentResult,
        message: '결제가 성공적으로 처리되었습니다',
      })
    } catch (error: any) {
      console.error('결제 재시도 실패:', error)

      // 실패 내역 저장
      await supabase.from('payments' as any).insert({
        user_id: user.id,
        subscription_id: subscription.id,
        amount: subscription.price,
        currency: 'KRW',
        payment_method: 'card',
        payment_status: 'failed',
        pg_provider: 'portone',
        portone_merchant_uid: merchantUid,
      })

      return NextResponse.json(
        { error: error.message || '결제 재시도에 실패했습니다' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('결제 재시도 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

