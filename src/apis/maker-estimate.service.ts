import { createSupabaseBrowserClient } from '@/supabase/supabase-client'

export interface MakerEstimate {
  id: number
  counsel_id: number
  maker_id: string
  estimate_amount: number
  estimate_period: string
  estimate_details: string
  estimate_status: 'pending' | 'accepted' | 'rejected'
  created_at: string
  updated_at: string
}

export const submitMakerEstimate = async (estimateData: {
  counselId: number
  estimateAmount: number
  estimatePeriod: string
  estimateDetails: string
}) => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // 기존 견적이 있는지 확인 (테이블이 없을 수 있으므로 에러 무시)
  const { data: existingEstimate, error: checkError } = await supabase
    .from('maker_estimates' as any)
    .select('*')
    .eq('counsel_id', estimateData.counselId)
    .eq('maker_id', user.id)
    .maybeSingle()

  // 테이블이 없거나 RLS 정책에 의해 접근이 거부된 경우 에러 처리
  if (checkError && (
    checkError.code === '42P01' || 
    checkError.code === 'PGRST301' ||
    checkError.message?.includes('406') ||
    checkError.message?.includes('Not Acceptable') ||
    checkError.message?.includes('Could not find the table') || 
    checkError.message?.includes('relation') || 
    checkError.message?.includes('does not exist') ||
    checkError.message?.includes('permission denied') ||
    checkError.message?.includes('row-level security')
  )) {
    // 406 에러나 RLS 정책 문제는 테이블이 없거나 접근 권한이 없는 것으로 간주
    if (checkError.code === 'PGRST301' || checkError.message?.includes('406') || checkError.message?.includes('Not Acceptable')) {
      // RLS 정책 문제인 경우 조용히 처리 (테이블이 있지만 접근 권한이 없음)
      // 이는 정상적인 상황일 수 있으므로 에러를 던지지 않음
    } else {
      throw new Error('maker_estimates 테이블이 없습니다. 메이커 견적 기능을 사용할 수 없습니다.')
    }
  }

  if (existingEstimate) {
    // 기존 견적 업데이트
    const { data, error } = await supabase
      .from('maker_estimates' as any)
      .update({
        estimate_amount: estimateData.estimateAmount,
        estimate_period: estimateData.estimatePeriod,
        estimate_details: estimateData.estimateDetails,
        estimate_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', existingEstimate.id)
      .select()
      .single()

    if (error) {
      throw new Error(`견적 업데이트 실패: ${error.message}`)
    }

    return data
  } else {
    // 새로운 견적 생성
    const { data, error } = await supabase
      .from('maker_estimates' as any)
      .insert({
        counsel_id: estimateData.counselId,
        maker_id: user.id,
        estimate_amount: estimateData.estimateAmount,
        estimate_period: estimateData.estimatePeriod,
        estimate_details: estimateData.estimateDetails,
        estimate_status: 'pending'
      })
      .select()
      .single()

    if (error) {
      throw new Error(`견적 제출 실패: ${error.message}`)
    }

    return data
  }
}

export const getMakerEstimate = async (counselId: number) => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('maker_estimates' as any)
    .select('*')
    .eq('counsel_id', counselId)
    .eq('maker_id', user.id)
    .maybeSingle()

  // 테이블이 없거나 행이 없거나 RLS 정책에 의해 접근이 거부된 경우 null 반환 (에러 무시)
  if (error) {
    // PGRST116: "no rows returned" 에러 (행이 없는 경우)
    // 42P01: 테이블이 없는 경우
    // 406: Not Acceptable (RLS 정책에 의해 접근 거부)
    // PGRST301: RLS 정책 위반
    if (
      error.code === 'PGRST116' || 
      error.code === '42P01' || 
      error.code === 'PGRST301' ||
      error.message?.includes('406') ||
      error.message?.includes('Not Acceptable') ||
      error.message?.includes('Could not find the table') || 
      error.message?.includes('relation') || 
      error.message?.includes('does not exist') ||
      error.message?.includes('permission denied') ||
      error.message?.includes('row-level security')
    ) {
      return null
    }
    // 기타 에러는 throw
    throw new Error(`견적 조회 실패: ${error.message}`)
  }

  return data
}

export const getMakerEstimates = async (makerId?: string) => {
  const supabase = createSupabaseBrowserClient()
  
  let targetMakerId = makerId
  if (!targetMakerId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('로그인이 필요합니다.')
    }
    targetMakerId = user.id
  }

  const { data, error } = await supabase
    .from('maker_estimates' as any)
    .select(`
      *,
      counsel:counsel_id (
        counsel_id,
        title,
        outline,
        period,
        cost,
        feild,
        skill,
        output,
        counsel_status
      )
    `)
    .eq('maker_id', targetMakerId)
    .order('created_at', { ascending: false })

  // 테이블이 없는 경우 빈 배열 반환
  if (error) {
    if (error.code === '42P01' || error.message?.includes('Could not find the table') || error.message?.includes('relation') || error.message?.includes('does not exist')) {
      return []
    }
    throw new Error(`메이커 견적 목록 조회 실패: ${error.message}`)
  }

  return data || []
}

export const getProjectMakerEstimates = async (counselId: number) => {
  const supabase = createSupabaseBrowserClient()

  const { data, error } = await supabase
    .from('maker_estimates' as any)
    .select(`
      *,
      maker:maker_id (
        username,
        main_job,
        expertise,
        availability_status
      )
    `)
    .eq('counsel_id', counselId)

  // 테이블이 없는 경우 빈 배열 반환
  if (error) {
    if (error.code === '42P01' || error.message?.includes('Could not find the table') || error.message?.includes('relation') || error.message?.includes('does not exist')) {
      return []
    }
    throw new Error(`프로젝트 메이커 견적 목록 조회 실패: ${error.message}`)
  }

  return data || []
}
