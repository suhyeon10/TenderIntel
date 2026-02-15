/**
 * 결제 실패 재시도 API (V2)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSideClient } from '@/supabase/supabase-server'
import { requestPaymentWithBillingKey, scheduleMonthlyPayment, getNextBillingDateISO } from '@/apis/subscription-v2.service'

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
    const { subscription_id } = body

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
    // 기업(COMPANY) 프로필만 구독 결제 가능
    const { data: accountData } = await supabase
      .from('accounts')
      .select('username, contact_phone, contact_email')
      .eq('user_id', user.id)
      .eq('profile_type', 'COMPANY')
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle() as any

    const paymentId = `linkers_sub_${user.id}_${Date.now()}`

    // 전화번호 설정 (필수 필드)
    const phoneNumber = accountData?.contact_phone || '010-0000-0000'

    try {
      // 결제 재시도
      const paymentResult = await requestPaymentWithBillingKey(
        subscription.customer_uid,
        paymentId,
        subscription.price,
        '링커스 월 구독료',
        {
          name: accountData?.username || user.email?.split('@')[0] || '사용자',
          email: user.email || accountData?.contact_email || '',
          phoneNumber: phoneNumber,
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
        pg_transaction_id: paymentId,
        portone_imp_uid: paymentId,
        portone_merchant_uid: paymentId,
        paid_at: (paymentResult.payment as any)?.paidAt || new Date().toISOString(),
      })

      // 다음 달 결제 예약
      const nextBillingDate = new Date()
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)
      const nextPaymentId = `linkers_sub_${user.id}_${Date.now() + 1}`
      const scheduledAt = getNextBillingDateISO(nextBillingDate, false)

      await scheduleMonthlyPayment(
        subscription.customer_uid,
        nextPaymentId,
        scheduledAt,
        subscription.price,
        '링커스 월 구독료',
        {
          name: accountData?.username || user.email?.split('@')[0] || '사용자',
          email: user.email || accountData?.contact_email || '',
          phoneNumber: phoneNumber,
        }
      )

      await supabase
        .from('subscriptions' as any)
        .update({
          next_billing_date: nextBillingDate.toISOString(),
          portone_merchant_uid: nextPaymentId,
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
        portone_merchant_uid: paymentId,
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

