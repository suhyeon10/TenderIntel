/**
 * 결제 예약 재시도 처리 API
 * 재시도 큐에 있는 실패한 결제 예약을 재시도
 * Vercel Cron Jobs 또는 외부 스케줄러에서 호출
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSideClient } from '@/supabase/supabase-server'
import { scheduleMonthlyPayment } from '@/apis/subscription-v2.service'

export async function POST(request: NextRequest) {
  try {
    // 인증 키 확인 (스케줄러 보안)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServerSideClient()

    // 재시도 대기 중인 항목 조회 (next_retry_at이 지난 항목)
    const now = new Date()
    const { data: retryItems, error: fetchError } = await supabase
      .from('payment_retry_queue' as any)
      .select('*')
      .eq('status', 'pending')
      .lte('next_retry_at', now.toISOString())
      .order('created_at', { ascending: true })
      .limit(10) // 한 번에 최대 10개 처리

    if (fetchError) {
      console.error('재시도 큐 조회 실패:', fetchError)
      throw fetchError
    }

    if (!retryItems || retryItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: '재시도할 항목이 없습니다',
        processed: 0,
      })
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    }

    // 각 항목에 대해 재시도
    for (const item of retryItems) {
      try {
        // 상태를 processing으로 변경
        await supabase
          .from('payment_retry_queue' as any)
          .update({ status: 'processing' })
          .eq('id', item.id)

        // 결제 예약 재시도
        const scheduledPayment = await scheduleMonthlyPayment(
          item.billing_key,
          item.payment_id,
          item.scheduled_at,
          item.amount,
          item.order_name,
          {
            name: item.customer_name || undefined,
            email: item.customer_email || undefined,
            phoneNumber: item.customer_phone_number || undefined,
          },
          3, // 재시도 횟수 감소 (이미 한 번 실패했으므로)
          2000 // 재시도 간격 2초
        )

        // 성공 시 scheduleId를 구독 정보에 저장
        const scheduleId = (scheduledPayment as any)?.scheduleId || (scheduledPayment as any)?.id
        if (scheduleId) {
          await supabase
            .from('subscriptions' as any)
            .update({ portone_schedule_id: scheduleId })
            .eq('id', item.subscription_id)
        }

        // 재시도 큐에서 완료 처리
        await supabase
          .from('payment_retry_queue' as any)
          .update({
            status: 'completed',
            retry_count: item.retry_count + 1,
          })
          .eq('id', item.id)

        results.success++
        console.log('결제 예약 재시도 성공:', {
          queue_id: item.id,
          subscription_id: item.subscription_id,
          payment_id: item.payment_id,
        })
      } catch (error: any) {
        const errorData = error.data || error.response?.data
        const retryCount = item.retry_count + 1
        const maxRetries = item.max_retries || 5

        // 최대 재시도 횟수 초과 시 실패 처리
        if (retryCount >= maxRetries) {
          await supabase
            .from('payment_retry_queue' as any)
            .update({
              status: 'failed',
              retry_count: retryCount,
              error_message: error.message || '알 수 없는 오류',
              last_error_type: errorData?.type || 'UNKNOWN_ERROR',
              last_error_message: errorData?.message || error.message || '알 수 없는 오류',
            })
            .eq('id', item.id)

          results.failed++
          results.errors.push(
            `구독 ${item.subscription_id}: 최대 재시도 횟수 초과 (${retryCount}/${maxRetries})`
          )
          console.error('결제 예약 재시도 최종 실패:', {
            queue_id: item.id,
            subscription_id: item.subscription_id,
            error: error.message,
          })
        } else {
          // 재시도 가능하면 다음 재시도 시각 계산 (지수 백오프)
          const nextRetryAt = new Date()
          const backoffMinutes = Math.min(Math.pow(2, retryCount) * 5, 60) // 최대 60분
          nextRetryAt.setMinutes(nextRetryAt.getMinutes() + backoffMinutes)

          await supabase
            .from('payment_retry_queue' as any)
            .update({
              status: 'pending',
              retry_count: retryCount,
              error_message: error.message || '알 수 없는 오류',
              last_error_type: errorData?.type || 'UNKNOWN_ERROR',
              last_error_message: errorData?.message || error.message || '알 수 없는 오류',
              next_retry_at: nextRetryAt.toISOString(),
            })
            .eq('id', item.id)

          console.log('결제 예약 재시도 실패 - 다음 재시도 예약:', {
            queue_id: item.id,
            subscription_id: item.subscription_id,
            retry_count: retryCount,
            next_retry_at: nextRetryAt.toISOString(),
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: retryItems.length,
      results,
    })
  } catch (error: any) {
    console.error('결제 예약 재시도 처리 오류:', error)
    return NextResponse.json(
      {
        error: '서버 오류가 발생했습니다',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

