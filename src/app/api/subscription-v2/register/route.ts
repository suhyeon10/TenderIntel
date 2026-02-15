/**
 * 구독 등록 API (V2)
 * 빌링키 발급 후 첫 달 무료 처리 및 다음 달 결제 예약
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSideClient } from '@/supabase/supabase-server'
import {
  scheduleMonthlyPayment,
  getNextBillingDateISO,
} from '@/apis/subscription-v2.service'
import { generateBillingKeyId } from '@/utils/billing-key'

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
    const { billingKey, buyer_info } = body

    if (!billingKey) {
      return NextResponse.json({ error: 'billingKey가 필요합니다' }, { status: 400 })
    }

    // 활성 구독 확인 (취소된 구독은 재구독 가능)
    const { data: activeSubscription } = await supabase
      .from('subscriptions' as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    if (activeSubscription) {
      return NextResponse.json(
        { error: '이미 구독 중입니다' },
        { status: 400 }
      )
    }

    // 이전 구독 확인 (재구독 시 첫 달 무료 여부 결정)
    const { data: previousSubscription } = await supabase
      .from('subscriptions' as any)
      .select('first_month_used')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // 이전에 첫 달 무료를 사용했다면 재구독 시 첫 달 무료 없음
    const isFirstMonthFree = !previousSubscription?.first_month_used

    // 사용자 계정 정보 조회 (전화번호 포함)
    // 기업(COMPANY) 프로필만 구독 결제 가능
    const { data: accountData } = await supabase
      .from('accounts')
      .select('username, contact_phone, contact_email')
      .eq('user_id', user.id)
      .eq('profile_type', 'COMPANY')
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle() as any

    // 구독 정보 생성
    const subscriptionDate = new Date()
    const nextBillingDate = new Date(subscriptionDate)
    
    // 첫 달 무료인 경우 30일 후, 아닌 경우 즉시 결제 예약
    if (isFirstMonthFree) {
      nextBillingDate.setDate(nextBillingDate.getDate() + 30) // 첫 달 무료 기간 30일
    } else {
      nextBillingDate.setDate(nextBillingDate.getDate() + 1) // 재구독 시 다음날 결제
    }

    // 첫 달 무료 여부에 따라 결제 예약 날짜 결정
    const scheduledAt = getNextBillingDateISO(subscriptionDate, isFirstMonthFree)
    const paymentId = `linkers_sub_${user.id}_${Date.now()}`

    // 전화번호 설정 (필수 필드)
    // 빌링키 발급 시 사용자가 입력한 전화번호를 우선 사용
    const phoneNumber = 
      buyer_info?.tel || 
      buyer_info?.phoneNumber ||
      accountData?.contact_phone || 
      '010-0000-0000' // 기본값 (빌링키 발급 시 전화번호가 필수이므로 이 값은 사용되지 않아야 함)

    // 구독 정보 DB 저장 (빌링키 발급만 완료하고 즉시 응답)
    const { data: subscription, error: insertError } = await supabase
      .from('subscriptions' as any)
      .insert({
        user_id: user.id,
        plan: 'basic',
        price: 2000,
        status: 'active',
        auto_renew: true,
        customer_uid: billingKey, // V2에서는 billingKey를 customer_uid에 저장
        is_first_month_free: isFirstMonthFree,
        first_month_used: false,
        next_billing_date: nextBillingDate.toISOString(),
        portone_merchant_uid: paymentId,
      })
      .select()
      .single()

    if (insertError) {
      console.error('구독 정보 저장 실패:', insertError)
      return NextResponse.json(
        { error: '구독 정보 저장에 실패했습니다' },
        { status: 500 }
      )
    }

    // 첫 달 무료인 경우에만 결제 내역 생성 (카드 등록 직후 결제 내역에 표시)
    if (isFirstMonthFree) {
      const firstMonthPaymentId = `linkers_sub_${user.id}_first_month_${Date.now()}`
      const { error: paymentError } = await supabase.from('payments' as any).insert({
        user_id: user.id,
        subscription_id: subscription.id,
        amount: 0, // 첫 달은 무료
        currency: 'KRW',
        payment_method: 'card',
        payment_status: 'completed',
        pg_provider: 'portone',
        pg_transaction_id: firstMonthPaymentId,
        portone_merchant_uid: firstMonthPaymentId,
        is_first_month: true,
        paid_at: new Date().toISOString(),
      })

      if (paymentError) {
        console.error('첫 달 무료 결제 내역 저장 실패:', paymentError)
        // 결제 내역 저장 실패해도 구독 등록은 성공으로 처리
      } else {
        console.log('첫 달 무료 결제 내역 저장 완료')
      }
    }

    // 결제 예약은 비동기로 처리 (사용자 응답을 기다리지 않음)
    // 빌링키 발급 직후 포트원 서버에 반영 시간이 필요하므로 약간의 지연 후 처리
    scheduleMonthlyPayment(
      billingKey,
      paymentId,
      scheduledAt,
      2000, // 월 구독료 2000원
      '링커스 월 구독료',
      {
        name: buyer_info?.name || accountData?.username || user.email?.split('@')[0] || '사용자',
        email: buyer_info?.email || accountData?.contact_email || user.email || '',
        phoneNumber: phoneNumber,
      }
    ).then((scheduledPayment: any) => {
      // 결제 예약 성공 시 scheduleId를 DB에 저장
      const scheduleId = scheduledPayment?.scheduleId || scheduledPayment?.id
      if (scheduleId) {
        supabase
          .from('subscriptions' as any)
          .update({ portone_schedule_id: scheduleId })
          .eq('id', subscription.id)
          .then(({ error }) => {
            if (error) {
              console.error('scheduleId 저장 실패:', error)
            } else {
              console.log('scheduleId 저장 완료:', scheduleId)
            }
          })
      }
    }).catch(async (error: any) => {
      // 비동기 작업이므로 에러는 로그만 남기고 사용자에게는 영향 없음
      console.error('결제 예약 실패 (비동기):', error)
      
      // 재시도 큐에 저장
      try {
        const errorData = error.data || error.response?.data
        const nextRetryAt = new Date()
        nextRetryAt.setMinutes(nextRetryAt.getMinutes() + 5) // 5분 후 재시도
        
        await supabase
          .from('payment_retry_queue' as any)
          .insert({
            subscription_id: subscription.id,
            billing_key: billingKey,
            payment_id: paymentId,
            scheduled_at: scheduledAt,
            amount: 2000,
            order_name: '링커스 월 구독료',
            customer_name: buyer_info?.name || accountData?.username || user.email?.split('@')[0] || '사용자',
            customer_email: buyer_info?.email || accountData?.contact_email || user.email || '',
            customer_phone_number: phoneNumber,
            status: 'pending',
            error_message: error.message || '알 수 없는 오류',
            last_error_type: errorData?.type || 'UNKNOWN_ERROR',
            last_error_message: errorData?.message || error.message || '알 수 없는 오류',
            next_retry_at: nextRetryAt.toISOString(),
          })
        
        console.log('결제 예약 실패 - 재시도 큐에 저장됨:', {
          subscription_id: subscription.id,
          payment_id: paymentId,
          next_retry_at: nextRetryAt.toISOString(),
        })
      } catch (queueError: any) {
        // 재시도 큐 저장 실패는 로그만 남김 (사용자에게는 영향 없음)
        console.error('재시도 큐 저장 실패:', queueError)
      }
    })

    // 즉시 성공 응답 반환 (빌링키 발급 완료)
    return NextResponse.json({
      success: true,
      subscription,
      message: isFirstMonthFree 
        ? '구독이 등록되었습니다. 첫 달은 무료입니다.'
        : '구독이 등록되었습니다.',
    })
  } catch (error: any) {
    console.error('구독 등록 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

