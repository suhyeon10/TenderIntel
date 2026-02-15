/**
 * 견적서 열람 관련 API 서비스
 * V2: 건별 열람권(2,000원) + 구독제(9,900원/월) + 최초 3회 무료
 */

import { createSupabaseBrowserClient } from '@/supabase/supabase-client'

export interface EstimateViewRecord {
  id: number
  created_at: string
  user_id?: string
  client_id?: string // 레거시 호환성
  estimate_id: number
  view_type: 'free' | 'paid' | 'subscription'
  amount_paid: number
  payment_id: number | null
  subscription_id: number | null
}

export interface EstimateViewAccess {
  canView: boolean
  viewType: 'free' | 'paid' | 'subscription' | null
  freeViewsRemaining: number
  hasActiveSubscription: boolean
  hasViewed: boolean
  ppvPrice: number // 건별 결제 가격 (2,000원)
  subscriptionPrice: number // 구독 가격 (9,900원)
  price: number // 레거시 호환성 (ppvPrice와 동일)
}

/**
 * 견적서 열람 권한 확인 (새 모델 V2)
 */
export const checkEstimateViewAccess = async (estimateId: number): Promise<EstimateViewAccess> => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // 가격표 조회
  const { data: pricing } = await supabase
    .from('pricing' as any)
    .select('*')
    .eq('is_active', true)

  const ppvPrice = pricing?.find(p => p.plan === 'ppv')?.amount_krw || 2000
  const subscriptionPrice = pricing?.find(p => p.plan === 'subscription')?.amount_krw || 9900

  // RPC 함수로 권한 확인
  const { data: canView, error: canViewError } = await (supabase.rpc as any)(
    'can_view_estimate',
    { p_user: user.id, p_estimate: estimateId }
  )

  if (canViewError) {
    console.error('can_view_estimate error:', canViewError)
    throw new Error('열람 권한 확인에 실패했습니다.')
  }

  // 이미 권리가 있는 경우
  if (canView) {
    // 열람 기록 확인
    const { data: existingView } = await supabase
      .from('estimate_views' as any)
      .select('view_type')
      .eq('user_id', user.id)
      .eq('estimate_id', estimateId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // 무료 열람 횟수 조회
    const { data: freeQuota } = await (supabase.rpc as any)('get_free_quota', {
      p_user: user.id
    })

    // 활성 구독 확인
    const { data: subscription } = await supabase
      .from('subscriptions' as any)
      .select('id, status, current_period_start, current_period_end')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()

    const hasActiveSubscription = subscription !== null && 
      (subscription.current_period_start === null || new Date(subscription.current_period_start) <= new Date()) &&
      (subscription.current_period_end === null || new Date(subscription.current_period_end) > new Date())

    return {
      canView: true,
      viewType: existingView?.view_type || 'subscription',
      freeViewsRemaining: freeQuota?.[0]?.remaining || 0,
      hasActiveSubscription: hasActiveSubscription,
      hasViewed: existingView !== null,
      ppvPrice,
      subscriptionPrice,
      price: ppvPrice // 레거시 호환성
    }
  }

  // 권리가 없는 경우 - 무료 열람 가능 여부 확인
  const { data: freeQuota } = await (supabase.rpc as any)('get_free_quota', {
    p_user: user.id
  })

  const freeViewsRemaining = freeQuota?.[0]?.remaining || 0

  // 무료 열람 횟수가 있어도 실제 열람 기록이 없으면 canView는 false
  // (열람 버튼을 눌러야 실제로 열람 권한이 부여됨)
  if (freeViewsRemaining > 0) {
    return {
      canView: false, // 무료 열람 가능하지만 아직 열람하지 않음
      viewType: 'free',
      freeViewsRemaining,
      hasActiveSubscription: false,
      hasViewed: false,
      ppvPrice,
      subscriptionPrice,
      price: ppvPrice
    }
  }

  // 활성 구독 확인
  const { data: subscription } = await supabase
    .from('subscriptions' as any)
    .select('id, status, current_period_start, current_period_end')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  const hasActiveSubscription = subscription !== null && 
    (subscription.current_period_start === null || new Date(subscription.current_period_start) <= new Date()) &&
    (subscription.current_period_end === null || new Date(subscription.current_period_end) > new Date())

  // 활성 구독이 있어도 실제 열람 기록이 없으면 canView는 false
  // (첫 열람 시 열람 기록을 생성해야 함)
  if (hasActiveSubscription) {
    return {
      canView: false, // 구독 중이지만 아직 이 견적서를 열람하지 않음
      viewType: 'subscription',
      freeViewsRemaining: 0,
      hasActiveSubscription: true,
      hasViewed: false,
      ppvPrice,
      subscriptionPrice,
      price: ppvPrice
    }
  }

  // 결제 필요 (건별 또는 구독)
  return {
    canView: false,
    viewType: 'paid',
    freeViewsRemaining: 0,
    hasActiveSubscription: false,
    hasViewed: false,
    ppvPrice,
    subscriptionPrice,
    price: ppvPrice
  }
}

/**
 * 견적서 열람 기록 생성 (무료/구독) - 새 모델 V2
 */
export const createEstimateView = async (
  estimateId: number,
  viewType: 'free' | 'subscription'
): Promise<EstimateViewRecord> => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // 이미 권리가 있는지 확인
  const { data: canView } = await (supabase.rpc as any)('can_view_estimate', {
    p_user: user.id,
    p_estimate: estimateId
  })

  if (canView) {
    // 이미 열람 기록이 있는지 확인
    const { data: existingView } = await supabase
      .from('estimate_views' as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('estimate_id', estimateId)
      .maybeSingle()

    if (existingView) {
      return existingView as EstimateViewRecord
    }

    // 열람 기록만 추가 (권리는 이미 있음)
    // client_id도 함께 설정 (레거시 호환성)
    const { data, error } = await supabase
      .from('estimate_views' as any)
      .insert({
        user_id: user.id,
        client_id: user.id, // 레거시 호환성
        estimate_id: estimateId,
        view_type: viewType,
        amount_paid: 0
      })
      .select()
      .single()

    if (error) {
      throw new Error(`견적서 열람 기록 생성 실패: ${error.message}`)
    }

    return data as EstimateViewRecord
  }

  // 무료 열람인 경우 RPC 함수 사용
  if (viewType === 'free') {
    const { data: granted, error: grantError } = await (supabase.rpc as any)(
      'grant_free_view',
      { p_user: user.id, p_estimate: estimateId }
    )

    if (grantError) {
      throw new Error(`무료 열람 실패: ${grantError.message}`)
    }

    if (!granted) {
      throw new Error('무료 열람 횟수가 없습니다.')
    }

    // 열람 기록 조회
    const { data: viewRecord } = await supabase
      .from('estimate_views' as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('estimate_id', estimateId)
      .eq('view_type', 'free')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (viewRecord) {
      return viewRecord as EstimateViewRecord
    }
  }

  // 구독 열람인 경우
  if (viewType === 'subscription') {
    // 구독 ID 조회
    const { data: subscription } = await supabase
      .from('subscriptions' as any)
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    
    if (!subscription) {
      throw new Error('활성 구독이 없습니다.')
    }

    // 권리 부여 (estimate_access)
    await (supabase
      .from('estimate_access' as any)
      .insert({
        user_id: user.id,
        estimate_id: estimateId,
        source: 'subscription'
      }) as any)
      .onConflict('user_id,estimate_id')
      .ignore()

    // 열람 기록 생성 (client_id도 함께 설정)
    const { data, error } = await supabase
      .from('estimate_views' as any)
      .insert({
        user_id: user.id,
        client_id: user.id, // 레거시 호환성
        estimate_id: estimateId,
        view_type: 'subscription',
        amount_paid: 0,
        subscription_id: subscription.id
      })
      .select()
      .single()

    if (error) {
      throw new Error(`견적서 열람 기록 생성 실패: ${error.message}`)
    }

    return data as EstimateViewRecord
  }

  throw new Error('지원하지 않는 열람 타입입니다.')
}

/**
 * 건별 결제 후 열람 기록 생성 (웹훅에서 자동 처리됨)
 * @deprecated 웹훅에서 grant_ppv_after_payment RPC 함수가 자동으로 처리합니다.
 * 이 함수는 레거시 호환성을 위해 유지됩니다.
 */
export const createPaidEstimateView = async (
  estimateId: number,
  paymentId: number
): Promise<EstimateViewRecord> => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // 결제 정보 확인
  const { data: payment } = await supabase
    .from('payments' as any)
    .select('id, amount_krw, amount, payment_status')
    .eq('id', paymentId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!payment) {
    throw new Error('결제 정보를 찾을 수 없습니다.')
  }

  if (payment.payment_status !== 'completed') {
    throw new Error('결제가 완료되지 않았습니다.')
  }

  // 이미 열람한 경우 확인
  const { data: existingView } = await supabase
    .from('estimate_views' as any)
    .select('*')
    .eq('user_id', user.id)
    .eq('estimate_id', estimateId)
    .maybeSingle()

  if (existingView) {
    return existingView as EstimateViewRecord
  }

  // RPC 함수로 권리 부여 (멱등성 보장)
  const { error: grantError } = await (supabase.rpc as any)('grant_ppv_after_payment', {
    p_payment_id: paymentId
  })

  if (grantError) {
    // 이미 권리가 부여된 경우는 무시
    if (!grantError.message.includes('already') && !grantError.message.includes('conflict')) {
      throw new Error(`권리 부여 실패: ${grantError.message}`)
    }
  }

  // 열람 기록 조회
  const { data: viewRecord } = await supabase
    .from('estimate_views' as any)
    .select('*')
    .eq('user_id', user.id)
    .eq('estimate_id', estimateId)
    .eq('view_type', 'paid')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (viewRecord) {
    return viewRecord as EstimateViewRecord
  }

  throw new Error('열람 기록을 찾을 수 없습니다.')
}

/**
 * 견적서 열람 기록 조회 (새 모델 V2)
 */
export const getEstimateViewHistory = async (): Promise<EstimateViewRecord[]> => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // user_id 기반으로 조회 (client_id는 레거시 호환성)
  const { data, error } = await supabase
    .from('estimate_views' as any)
    .select('*')
    .or(`user_id.eq.${user.id},client_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`견적서 열람 기록 조회 실패: ${error.message}`)
  }

  return (data || []) as EstimateViewRecord[]
}

/**
 * 무료 열람 횟수 조회
 */
export const getFreeQuota = async (): Promise<{ granted: number; used: number; remaining: number } | null> => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  const { data, error } = await (supabase.rpc as any)('get_free_quota', {
    p_user: user.id
  })

  if (error) {
    throw new Error(`무료 열람 횟수 조회 실패: ${error.message}`)
  }

  return data?.[0] || null
}

