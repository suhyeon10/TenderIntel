/**
 * 포트원 Webhook 처리
 * 정기 결제 결과 수신 및 다음 달 결제 예약
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSideClient } from '@/supabase/supabase-server'
import {
  getPayment,
  scheduleMonthlyPayment,
  getNextBillingTimestamp,
} from '@/apis/subscription.service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imp_uid, merchant_uid, status } = body

    if (!imp_uid || !merchant_uid) {
      return NextResponse.json({ error: '필수 파라미터가 없습니다' }, { status: 400 })
    }

    const supabase = await createServerSideClient()

    // 결제 정보 조회
    const paymentInfo = await getPayment(imp_uid)

    if (paymentInfo.status !== 'paid') {
      console.log('결제 실패:', paymentInfo)
      return NextResponse.json({ success: false, message: '결제 실패' })
    }

    // 구독 정보 조회
    const { data: subscription } = await supabase
      .from('subscriptions' as any)
      .select('*')
      .eq('portone_merchant_uid', merchant_uid)
      .single()

    if (!subscription) {
      console.error('구독 정보를 찾을 수 없습니다:', merchant_uid)
      return NextResponse.json({ error: '구독 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    // 첫 달 무료 여부 확인
    const isFirstMonth = subscription.is_first_month_free && !subscription.first_month_used

    // 결제 내역 저장
    const { error: paymentError } = await supabase.from('payments' as any).insert({
      user_id: subscription.user_id,
      subscription_id: subscription.id,
      amount: paymentInfo.amount,
      currency: 'KRW',
      payment_method: 'card',
      payment_status: 'completed',
      pg_provider: 'portone',
      pg_transaction_id: imp_uid,
      portone_imp_uid: imp_uid,
      portone_merchant_uid: merchant_uid,
      is_first_month: isFirstMonth,
      paid_at: new Date(paymentInfo.paid_at * 1000).toISOString(),
    })

    if (paymentError) {
      console.error('결제 내역 저장 실패:', paymentError)
    }

    // 첫 달 무료 처리
    if (isFirstMonth) {
      // 첫 달은 무료이므로 first_month_used만 업데이트
      const { error: updateError } = await supabase
        .from('subscriptions' as any)
        .update({
          first_month_used: true,
        })
        .eq('id', subscription.id)

      if (updateError) {
        console.error('구독 정보 업데이트 실패:', updateError)
      }
    }

    // 사용자 정보 조회
    const { data: userData } = await supabase.auth.admin.getUserById(subscription.user_id)
    const { data: accountData } = await supabase
      .from('accounts')
      .select('username')
      .eq('user_id', subscription.user_id)
      .single() as any

    // 다음 달 결제 예약 (현재 결제일 기준으로 다음 달)
    const currentDate = new Date()
    const nextBillingDate = new Date(currentDate)
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)

    const nextMerchantUid = `linkers_sub_${subscription.user_id}_${Date.now()}`
    const scheduleAt = getNextBillingTimestamp(nextBillingDate, false)

    try {
      await scheduleMonthlyPayment(
        subscription.customer_uid!,
        nextMerchantUid,
        scheduleAt,
        2000,
        '링커스 월 구독료',
        {
          name: accountData?.username || userData?.user?.email?.split('@')[0] || '사용자',
            email: userData?.user?.email || '',
          tel: '',
        }
      )

      // 구독 정보 업데이트
      await supabase
        .from('subscriptions' as any)
        .update({
          next_billing_date: nextBillingDate.toISOString(),
          portone_merchant_uid: nextMerchantUid,
        })
        .eq('id', subscription.id)
    } catch (scheduleError: any) {
      console.error('다음 달 결제 예약 실패:', scheduleError)
      // 예약 실패해도 현재 결제는 완료되었으므로 계속 진행
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Webhook 처리 오류:', error)
    return NextResponse.json(
      { error: 'Webhook 처리 실패' },
      { status: 500 }
    )
  }
}

