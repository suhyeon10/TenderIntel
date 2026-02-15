/**
 * 견적 열람 시도 API
 * POST /api/estimates/:id/view
 * 
 * 로직:
 * 1. 이미 can_view_estimate = true → view 로그만 추가 후 200
 * 2. 무료 남음 → grant_free_view() 시도
 * 3. 둘 다 아니면 402(Payment Required)와 결제옵션 반환
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSideClient } from '@/supabase/supabase-server'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSideClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const estimateId = Number(params.id)
    if (!estimateId || isNaN(estimateId)) {
      return NextResponse.json({ error: 'Invalid estimate ID' }, { status: 400 })
    }

    // 이미 권리 있는지 확인
    const { data: canView, error: canViewError } = await (supabase.rpc as any)(
      'can_view_estimate',
      { p_user: user.id, p_estimate: estimateId }
    )

    if (canViewError) {
      console.error('can_view_estimate error:', canViewError)
      return NextResponse.json(
        { error: 'Failed to check access' },
        { status: 500 }
      )
    }

    if (canView) {
      // 열람 기록만 추가
      await supabase.from('estimate_views' as any).insert({
        user_id: user.id,
        estimate_id: estimateId,
        view_type: 'subscription',
        amount_paid: 0
      })

      return NextResponse.json({ ok: true, access: 'granted' })
    }

    // 무료 열람 시도
    const { data: granted, error: grantError } = await (supabase.rpc as any)(
      'grant_free_view',
      { p_user: user.id, p_estimate: estimateId }
    )

    if (grantError) {
      console.error('grant_free_view error:', grantError)
      return NextResponse.json(
        { error: grantError.message },
        { status: 500 }
      )
    }

    if (granted) {
      // 무료 열람 횟수 조회
      const { data: freeQuota } = await (supabase.rpc as any)('get_free_quota', {
        p_user: user.id
      })

      return NextResponse.json({
        ok: true,
        access: 'granted_free',
        free_quota: freeQuota?.[0] || null
      })
    }

    // 결제 필요 - 가격표 조회
    const { data: pricing } = await supabase
      .from('pricing' as any)
      .select('*')
      .eq('is_active', true)
      .order('plan')

    const options = pricing?.map((p) => ({
      type: p.plan,
      price: p.amount_krw,
      label: p.label
    })) || [
      { type: 'ppv', price: 2000, label: '건별 열람권' },
      { type: 'subscription', price: 9900, label: '월 구독' }
    ]

    return NextResponse.json(
      {
        ok: false,
        reason: 'payment_required',
        options
      },
      { status: 402 }
    )
  } catch (error: any) {
    console.error('Estimate view API error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

