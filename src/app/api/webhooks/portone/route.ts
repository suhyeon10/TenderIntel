/**
 * PortOne Webhook: 건별 결제(PPV) 처리
 * POST /api/webhooks/portone
 * 
 * 멱등성: pg_provider, pg_tid 유니크로 보장
 * 상태 = paid → payments 업데이트 → grant_ppv_after_payment(id)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSideClient } from '@/supabase/supabase-server'
import { verifyWebhook } from '@/apis/subscription-v2.service'

export async function POST(req: NextRequest) {
  try {
    // Webhook 검증
    const webhookSecret = process.env.PORTONE_V2_WEBHOOK_SECRET || ''
    
    if (!webhookSecret) {
      console.error('PORTONE_V2_WEBHOOK_SECRET이 설정되지 않았습니다')
      return NextResponse.json(
        { error: 'Webhook Secret이 설정되지 않았습니다' },
        { status: 500 }
      )
    }

    const rawBody = await req.text()
    const headers = Object.fromEntries(req.headers.entries())

    let webhook
    try {
      webhook = await verifyWebhook(webhookSecret, rawBody, headers)
    } catch (error: any) {
      console.error('Webhook 검증 실패:', error.message)
      return NextResponse.json(
        { error: 'Webhook verification failed' },
        { status: 401 }
      )
    }

    const supabase = await createServerSideClient()

    // 결제 완료 이벤트 처리
    if ((webhook as any).type === 'payment.succeeded' || (webhook as any).type === 'payment.paid') {
      const paymentData = (webhook as any).data
      const merchantUid: string = paymentData.merchantUid || paymentData.merchant_uid
      const pgTid: string = paymentData.paymentId || paymentData.imp_uid || paymentData.pg_tid

      if (!merchantUid) {
        return NextResponse.json(
          { error: 'merchant_uid is required' },
          { status: 400 }
        )
      }

      // merchant_uid에서 payment_id 추출 (ppv_123 형식)
      if (merchantUid.startsWith('ppv_')) {
        const paymentId = Number(merchantUid.replace('ppv_', ''))
        
        if (!paymentId || isNaN(paymentId)) {
          return NextResponse.json(
            { error: 'Invalid payment ID' },
            { status: 400 }
          )
        }

        // payments 업데이트
        const { data: payment, error: updateError } = await supabase
          .from('payments' as any)
          .update({
            payment_status: 'completed',
            pg_tid: pgTid,
            pg_provider: 'portone',
            portone_imp_uid: pgTid,
            portone_merchant_uid: merchantUid,
            paid_at: new Date().toISOString(),
            meta: paymentData
          })
          .eq('id', paymentId)
          .select('*')
          .single()

        if (updateError) {
          console.error('Payment update error:', updateError)
          return NextResponse.json(
            { error: updateError.message },
            { status: 500 }
          )
        }

        if (!payment) {
          return NextResponse.json(
            { error: 'Payment not found' },
            { status: 404 }
          )
        }

        // 권리 부여(멱등: 내부 on conflict)
        const { error: grantError } = await (supabase.rpc as any)('grant_ppv_after_payment', {
          p_payment_id: paymentId
        })

        if (grantError) {
          console.error('grant_ppv_after_payment error:', grantError)
          // 이미 권리가 부여된 경우는 무시 (멱등성)
          if (!grantError.message.includes('already')) {
            return NextResponse.json(
              { error: grantError.message },
              { status: 500 }
            )
          }
        }

        return NextResponse.json({ ok: true, payment_id: paymentId })
      }
    }

    // 다른 이벤트 타입은 무시
    return NextResponse.json({ ok: true, message: 'Event ignored' })
  } catch (error: any) {
    console.error('PortOne webhook error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

