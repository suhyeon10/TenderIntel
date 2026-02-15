/**
 * 구독 등록 API
 * 빌링키 발급 후 첫 달 무료 처리 및 다음 달 결제 예약
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSideClient } from '@/supabase/supabase-server'
import {
  generateCustomerUid,
  scheduleMonthlyPayment,
  getNextBillingTimestamp,
} from '@/apis/subscription.service'

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
    const { customer_uid, buyer_info } = body

    if (!customer_uid) {
      return NextResponse.json({ error: 'customer_uid가 필요합니다' }, { status: 400 })
    }

    // 기존 구독 확인
    const { data: existingSubscription } = await supabase
      .from('subscriptions' as any)
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (existingSubscription) {
      return NextResponse.json(
        { error: '이미 구독 중입니다' },
        { status: 400 }
      )
    }

    // 구독 정보 생성 (첫 달 무료)
    const subscriptionDate = new Date()
    const nextBillingDate = new Date(subscriptionDate)
    nextBillingDate.setDate(nextBillingDate.getDate() + 30) // 첫 달 무료 기간 30일

    // 첫 달은 무료이므로 30일 후 첫 결제 예약
    const scheduleAt = getNextBillingTimestamp(subscriptionDate, true)
    const merchantUid = `linkers_sub_${user.id}_${Date.now()}`

    try {
      // 첫 달은 무료이므로 30일 후 첫 결제 예약
      await scheduleMonthlyPayment(
        customer_uid,
        merchantUid,
        scheduleAt,
        2000, // 월 구독료 2000원
        '링커스 월 구독료',
        {
          name: buyer_info?.name || user.email?.split('@')[0] || '사용자',
          email: buyer_info?.email || user.email || '',
          tel: buyer_info?.tel || '',
        }
      )

      // 구독 정보 DB 저장
      const { data: subscription, error: insertError } = await supabase
        .from('subscriptions' as any)
        .insert({
          user_id: user.id,
          plan: 'basic',
          price: 2000,
          status: 'active',
          auto_renew: true,
          customer_uid,
          is_first_month_free: true,
          first_month_used: false,
          next_billing_date: nextBillingDate.toISOString(),
          portone_merchant_uid: merchantUid,
        })
        .select()
        .single()

      if (insertError) {
        throw insertError
      }

      return NextResponse.json({
        success: true,
        subscription,
        message: '구독이 등록되었습니다. 첫 달은 무료입니다.',
      })
    } catch (error: any) {
      console.error('구독 등록 실패:', error)
      return NextResponse.json(
        { error: error.message || '구독 등록에 실패했습니다' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('구독 등록 API 오류:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}

