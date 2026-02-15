/**
 * 견적서 열람 건별 결제 API (레거시 - 새 API 사용 권장)
 * 가격: 2,000원 (새 모델)
 * 
 * @deprecated 새로운 /api/checkout/ppv API를 사용하세요
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSideClient } from '@/supabase/supabase-server'
import { getPortOneClients } from '@/apis/subscription-v2.service'

const ESTIMATE_VIEW_PRICE = 2000 // 2,000원 (새 모델)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSideClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
    }

    const body = await request.json()
    const { estimateId } = body

    if (!estimateId) {
      return NextResponse.json({ error: '견적서 ID가 필요합니다' }, { status: 400 })
    }

    // client 정보 확인
    const { data: client } = await supabase
      .from('client')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!client) {
      return NextResponse.json({ error: '기업 계정이 아닙니다' }, { status: 403 })
    }

    // 이미 열람한 경우 확인
    const { data: existingView } = await supabase
      .from('estimate_views' as any)
      .select('id')
      .eq('client_id', client.user_id)
      .eq('estimate_id', estimateId)
      .maybeSingle()

    if (existingView) {
      return NextResponse.json({ error: '이미 열람한 견적서입니다' }, { status: 400 })
    }

    // 견적서 존재 확인
    const { data: estimate } = await supabase
      .from('estimate')
      .select('estimate_id, counsel_id')
      .eq('estimate_id', estimateId)
      .maybeSingle()

    if (!estimate) {
      return NextResponse.json({ error: '견적서를 찾을 수 없습니다' }, { status: 404 })
    }

    // PortOne 결제 요청
    const { paymentClient } = getPortOneClients()
    
    const merchantUid = `estimate_view_${user.id}_${estimateId}_${Date.now()}`
    
    // 결제 요청 생성
    const paymentResponse = await (paymentClient as any).post('/payments', {
      amount: {
        total: ESTIMATE_VIEW_PRICE,
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
        type: 'estimate_view',
        estimate_id: estimateId,
        client_id: client.user_id
      }
    })

    if (!paymentResponse.data || paymentResponse.data.status !== 'READY') {
      return NextResponse.json(
        { error: '결제 요청 생성 실패' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      paymentId: paymentResponse.data.paymentId,
      merchantUid,
      amount: ESTIMATE_VIEW_PRICE,
      orderName: `견적서 열람 - ${estimateId}`
    })
  } catch (error: any) {
    console.error('견적서 열람 결제 요청 실패:', error)
    return NextResponse.json(
      { error: error.message || '결제 요청에 실패했습니다' },
      { status: 500 }
    )
  }
}

