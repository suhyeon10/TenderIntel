/**
 * 포트원 V2 Webhook 처리
 * 정기 결제 결과 수신 및 다음 달 결제 예약
 * 
 * 웹훅 버전: 2024-01-01
 * Standard Webhooks 기반 검증 사용 (2024-01-01 및 2024-04-25 버전 모두 지원)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSideClient } from '@/supabase/supabase-server'
import {
  getPayment,
  scheduleMonthlyPayment,
  getNextBillingDateISO,
} from '@/apis/subscription-v2.service'
import { verifyWebhook } from '@/apis/subscription-v2.service'

export async function POST(request: NextRequest) {
  try {
    // Webhook 검증
    const webhookSecret = process.env.PORTONE_V2_WEBHOOK_SECRET || ''
    
    if (!webhookSecret) {
      console.error('PORTONE_V2_WEBHOOK_SECRET이 설정되지 않았습니다')
      return NextResponse.json({ error: 'Webhook Secret이 설정되지 않았습니다' }, { status: 500 })
    }

    const rawBody = await request.text()
    const headers = Object.fromEntries(request.headers.entries())

    console.log('웹훅 수신:', {
      method: request.method,
      url: request.url,
      headers: {
        'content-type': headers['content-type'],
        'webhook-id': headers['webhook-id'],
        'webhook-signature': headers['webhook-signature'] ? '***' : undefined,
      },
      bodyLength: rawBody.length,
    })

    let webhook
    try {
      webhook = await verifyWebhook(webhookSecret, rawBody, headers)
      console.log('웹훅 검증 성공:', {
        type: webhook.type,
        dataKeys: (webhook as any).data ? Object.keys((webhook as any).data) : [],
      })
    } catch (error: any) {
      console.error('Webhook 검증 실패:', {
        error: error.message,
        errorType: error.constructor.name,
        headers: {
          'webhook-id': headers['webhook-id'],
          'webhook-signature': headers['webhook-signature'] ? '***' : undefined,
        },
      })
      return NextResponse.json({ error: 'Webhook 검증 실패' }, { status: 401 })
    }

    // 공식 문서에 따르면 알지 못하는 type은 무시하고 성공 응답
    // paymentId가 있는 경우에만 결제 관련 처리
    const webhookData = (webhook as any).data || {}
    
    if ('paymentId' in webhookData) {
      // 결제 관련 이벤트 처리 (Transaction.Paid, Transaction.Failed 등)
      const { paymentId } = webhookData
      
      // Transaction.Paid 이벤트만 처리 (다른 이벤트는 로그만 남기고 성공 응답)
      if (webhook.type !== 'Transaction.Paid') {
        console.log('결제 관련 이벤트이지만 Transaction.Paid가 아닙니다:', {
          type: webhook.type,
          paymentId,
        })
        return NextResponse.json({ success: true }, { status: 200 })
      }

      console.log('Transaction.Paid 이벤트 처리 시작:', { paymentId })

      // 공식 문서 권장: 웹훅 메시지를 신뢰하지 않고 포트원 API로 결제 정보 조회하여 검증
      const paymentInfo = await getPayment(paymentId)

      if (paymentInfo === null) {
        // 웹훅 정보와 일치하는 결제건이 실제로는 존재하지 않는 경우
        console.warn('결제 정보를 찾을 수 없습니다:', { paymentId })
        return NextResponse.json({ success: true }, { status: 200 })
      }

      console.log('결제 정보 조회 완료:', {
        paymentId,
        status: paymentInfo.status,
        amount: (paymentInfo as any).amount?.total,
      })

      // 공식 문서 권장: 결제 상태가 PAID가 아닌 경우 처리하지 않음
      if (paymentInfo.status !== 'PAID') {
        console.warn('결제 상태가 PAID가 아닙니다:', {
          paymentId,
          status: paymentInfo.status,
        })
        return NextResponse.json({ success: true }, { status: 200 })
      }

      const supabase = await createServerSideClient()

      // 구독 정보 조회 (paymentId로 찾기)
      const { data: subscription } = await supabase
        .from('subscriptions' as any)
        .select('*')
        .eq('portone_merchant_uid', paymentId)
        .single()

      if (!subscription) {
        console.error('구독 정보를 찾을 수 없습니다:', {
          paymentId,
          searchField: 'portone_merchant_uid',
        })
        return NextResponse.json({ error: '구독 정보를 찾을 수 없습니다' }, { status: 200 })
      }

      console.log('구독 정보 조회 완료:', {
        subscriptionId: subscription.id,
        userId: subscription.user_id,
        status: subscription.status,
        isFirstMonthFree: subscription.is_first_month_free,
        firstMonthUsed: subscription.first_month_used,
      })

      // 첫 달 무료 여부 확인
      const isFirstMonth = subscription.is_first_month_free && !subscription.first_month_used

      // 결제 내역 저장
      const { error: paymentError } = await supabase.from('payments' as any).insert({
        user_id: subscription.user_id,
        subscription_id: subscription.id,
        amount: (paymentInfo as any).amount?.total || 0,
        currency: 'KRW',
        payment_method: 'card',
        payment_status: 'completed',
        pg_provider: 'portone',
        pg_transaction_id: paymentId,
        portone_imp_uid: paymentId,
        portone_merchant_uid: paymentId,
        is_first_month: isFirstMonth,
        paid_at: (paymentInfo as any)?.paidAt || new Date().toISOString(),
      })

      if (paymentError) {
        console.error('결제 내역 저장 실패:', {
          error: paymentError,
          paymentId,
          subscriptionId: subscription.id,
        })
      } else {
        console.log('결제 내역 저장 완료:', {
          paymentId,
          amount: (paymentInfo as any).amount?.total || 0,
          isFirstMonth,
        })
      }

      // 첫 달 무료 처리
      if (isFirstMonth) {
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
            // 기업(COMPANY) 프로필만 구독 결제 가능
            const { data: userData } = await supabase.auth.admin.getUserById(subscription.user_id)
            const { data: accountData } = await supabase
              .from('accounts')
              .select('username, contact_phone, contact_email')
              .eq('user_id', subscription.user_id)
              .eq('profile_type', 'COMPANY')
              .eq('is_active', true)
              .is('deleted_at', null)
              .maybeSingle() as any

      // 다음 달 결제 예약 (현재 결제일 기준으로 다음 달)
      const currentDate = new Date()
      const nextBillingDate = new Date(currentDate)
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)

      const nextPaymentId = `linkers_sub_${subscription.user_id}_${Date.now()}`
      const scheduledAt = getNextBillingDateISO(nextBillingDate, false)

      // 전화번호 설정 (필수 필드)
      const phoneNumber = accountData?.contact_phone || '010-0000-0000'

            try {
              const scheduledPayment = await scheduleMonthlyPayment(
                subscription.customer_uid!,
                nextPaymentId,
                scheduledAt,
                2000,
                '링커스 월 구독료',
                {
                  name: accountData?.username || userData?.user?.email?.split('@')[0] || '사용자',
                  email: userData?.user?.email || accountData?.contact_email || '',
                  phoneNumber: phoneNumber,
                }
              )

              // 결제 예약 성공 시 scheduleId를 DB에 저장
              const scheduleId = (scheduledPayment as any)?.scheduleId || (scheduledPayment as any)?.id

              // 구독 정보 업데이트
              await supabase
                .from('subscriptions' as any)
                .update({
                  next_billing_date: nextBillingDate.toISOString(),
                  portone_merchant_uid: nextPaymentId,
                  portone_schedule_id: scheduleId || null,
                })
                .eq('id', subscription.id)
      } catch (scheduleError: any) {
        console.error('다음 달 결제 예약 실패:', {
          error: scheduleError.message,
          errorType: scheduleError.data?.type,
          subscriptionId: subscription.id,
          nextPaymentId,
        })
        // 예약 실패해도 현재 결제는 완료되었으므로 계속 진행
      }
    } else {
      // 공식 문서 권장: 알지 못하는 type을 가진 메시지는 에러를 발생시키지 말고 무시
      // BillingKey 관련 이벤트 등은 로그만 남기고 성공 응답
      console.log('처리하지 않는 웹훅 이벤트 (무시):', {
        type: webhook.type,
        hasData: !!(webhook as any).data,
      })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error: any) {
    console.error('Webhook 처리 오류:', error)
    return NextResponse.json(
      { error: 'Webhook 처리 실패' },
      { status: 500 }
    )
  }
}

