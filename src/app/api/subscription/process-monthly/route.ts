/**
 * 월 정기결제 처리 API
 * 매월 자동으로 실행되어 결제일이 된 구독의 결제를 처리
 * (Vercel Cron Jobs 또는 외부 스케줄러에서 호출)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSideClient } from '@/supabase/supabase-server'
import {
  requestPaymentWithBillingKey,
  scheduleMonthlyPayment,
  getNextBillingTimestamp,
} from '@/apis/subscription.service'

export async function POST(request: NextRequest) {
  try {
    // 인증 키 확인 (스케줄러 보안)
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServerSideClient()

    // 오늘 결제일인 활성 구독 조회
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const { data: subscriptions, error: fetchError } = await supabase
      .from('subscriptions' as any)
      .select('*')
      .eq('status', 'active')
      .eq('auto_renew', true)
      .gte('next_billing_date', today.toISOString())
      .lt('next_billing_date', tomorrow.toISOString())
      .not('customer_uid', 'is', null)

    if (fetchError) {
      throw fetchError
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        message: '오늘 결제일인 구독이 없습니다',
        processed: 0,
      })
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    }

    // 각 구독에 대해 결제 처리
    for (const subscription of subscriptions) {
      try {
        // 사용자 정보 조회
        const { data: userData } = await supabase.auth.admin.getUserById(subscription.user_id)
        const { data: accountData } = await supabase
          .from('accounts')
          .select('username, email')
          .eq('user_id', subscription.user_id)
          .single() as any

        const merchantUid = `linkers_sub_${subscription.user_id}_${Date.now()}`

        // 빌링키로 결제 요청
        const paymentResult = await requestPaymentWithBillingKey(
          subscription.customer_uid!,
          merchantUid,
          subscription.price,
          '링커스 월 구독료',
          {
            name: accountData?.username || userData?.user?.email?.split('@')[0] || '사용자',
            email: userData?.user?.email || accountData?.email || '',
            tel: '',
          }
        )

        // 결제 내역 저장
        const isFirstMonth = subscription.is_first_month_free && !subscription.first_month_used

        await supabase.from('payments' as any).insert({
          user_id: subscription.user_id,
          subscription_id: subscription.id,
          amount: subscription.price,
          currency: 'KRW',
          payment_method: 'card',
          payment_status: 'completed',
          pg_provider: 'portone',
          pg_transaction_id: paymentResult.imp_uid,
          portone_imp_uid: paymentResult.imp_uid,
          portone_merchant_uid: merchantUid,
          is_first_month: isFirstMonth,
          paid_at: new Date(paymentResult.paid_at * 1000).toISOString(),
        })

        // 첫 달 무료 처리
        if (isFirstMonth) {
          await supabase
            .from('subscriptions' as any)
            .update({
              first_month_used: true,
            })
            .eq('id', subscription.id)
        }

        // 다음 달 결제 예약
        const nextBillingDate = new Date()
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)
        const nextMerchantUid = `linkers_sub_${subscription.user_id}_${Date.now() + 1}`
        const scheduleAt = getNextBillingTimestamp(nextBillingDate, false)

        await scheduleMonthlyPayment(
          subscription.customer_uid!,
          nextMerchantUid,
          scheduleAt,
          subscription.price,
          '링커스 월 구독료',
          {
            name: accountData?.username || userData?.user?.email?.split('@')[0] || '사용자',
            email: userData?.user?.email || accountData?.email || '',
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

        results.success++
      } catch (error: any) {
        console.error(`구독 ${subscription.id} 결제 실패:`, error)
        results.failed++
        results.errors.push(`구독 ${subscription.id}: ${error.message}`)

        // 결제 실패 내역 저장
        await supabase.from('payments' as any).insert({
          user_id: subscription.user_id,
          subscription_id: subscription.id,
          amount: subscription.price,
          currency: 'KRW',
          payment_method: 'card',
          payment_status: 'failed',
          pg_provider: 'portone',
          portone_merchant_uid: `linkers_sub_${subscription.user_id}_${Date.now()}`,
          is_first_month: false,
        })
      }
    }

    return NextResponse.json({
      success: true,
      processed: subscriptions.length,
      results,
    })
  } catch (error: any) {
    console.error('월 정기결제 처리 오류:', error)
    return NextResponse.json(
      { error: error.message || '월 정기결제 처리 실패' },
      { status: 500 }
    )
  }
}

