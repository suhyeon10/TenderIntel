import { createSupabaseBrowserClient } from '@/supabase/supabase-client'

export interface TeamEstimate {
  estimate_id: number
  team_id: number
  manager_id: string
  counsel_id: number
  client_id: string | null
  estimate_status: string
  estimate_start_date: string | null
  estimate_due_date: string | null
  estimate_version?: {
    estimate_version_id: number
    estimate_id: number
    total_amount: number | null
    detail: string | null
    start_date: string | null
    end_date: string | null
    version_date: string
  }
  milestones?: Array<{
    milestone_id: number
    estimate_id: number
    estimate_version_id: number
    title: string
    detail: string | null
    payment_amount: number | null
    milestone_start_date: string | null
    milestone_due_date: string | null
    progress: string | null
  }>
}

export interface TeamEstimateFormData {
  totalAmount: number
  startDate: string
  endDate: string
  detail: string
  teamCapability?: string // 팀이 수행할 수 있는 범위
  additionalSuggestions?: string // 추가 제안
  milestones?: Array<{
    title: string
    detail: string
    paymentAmount: number
    startDate: string
    endDate: string
  }>
}

/**
 * 팀 견적서 제출 (매니저용)
 */
export const submitTeamEstimate = async (
  counselId: number,
  companyProfileId: string,
  formData: TeamEstimateFormData,
  teamId?: number // 팀 ID를 선택적으로 받음
) => {
  const supabase = createSupabaseBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // 현재 사용자의 FREELANCER 프로필 조회
  const { data: managerProfile, error: profileError } = await supabase
    .from('accounts')
    .select('profile_id')
    .eq('user_id', user.id)
    .eq('profile_type', 'FREELANCER')
    .maybeSingle()

  if (profileError || !managerProfile) {
    throw new Error('프리랜서 프로필을 찾을 수 없습니다.')
  }

  // 팀 ID가 제공되지 않은 경우, 사용자의 팀 조회
  let finalTeamId: number
  if (teamId) {
    // 제공된 팀 ID가 사용자의 팀인지 확인
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .eq('manager_profile_id', managerProfile.profile_id)
      .maybeSingle()

    if (teamError || !teamData) {
      throw new Error('유효하지 않은 팀입니다.')
    }
    finalTeamId = teamData.id
  } else {
    // 팀 정보 가져오기 (manager_profile_id로 조회)
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('manager_profile_id', managerProfile.profile_id)
      .maybeSingle()

    if (teamError || !teamData) {
      throw new Error('팀 정보를 찾을 수 없습니다. 먼저 팀을 생성해주세요.')
    }
    finalTeamId = teamData.id
  }

  // counsel에서 company_profile_id 확인
  const { data: counselData, error: counselError } = await supabase
    .from('counsel')
    .select('company_profile_id')
    .eq('counsel_id', counselId)
    .maybeSingle()

  if (counselError || !counselData || !(counselData as any).company_profile_id) {
    throw new Error('프로젝트 정보를 찾을 수 없습니다.')
  }

  // 기존 견적서 확인
  const { data: existingEstimate } = await supabase
    .from('estimate')
    .select('estimate_id')
    .eq('counsel_id', counselId)
    .eq('team_id', finalTeamId)
    .maybeSingle()

  let estimateId: number

  if (existingEstimate) {
    // 기존 견적서 업데이트
    const { error: updateError } = await supabase
      .from('estimate')
      .update({
        estimate_status: 'pending',
        estimate_start_date: formData.startDate || null,
        estimate_due_date: formData.endDate || null,
      })
      .eq('estimate_id', existingEstimate.estimate_id)

    if (updateError) {
      throw new Error(`견적서 업데이트 실패: ${updateError.message}`)
    }

    estimateId = existingEstimate.estimate_id
  } else {
    // 새로운 견적서 생성
    const { data: newEstimate, error: insertError } = await supabase
      .from('estimate')
      .insert({
        team_id: finalTeamId,
        manager_profile_id: managerProfile.profile_id,
        company_profile_id: companyProfileId || (counselData as any).company_profile_id,
        counsel_id: counselId,
        estimate_status: 'pending',
        estimate_start_date: formData.startDate || null,
        estimate_due_date: formData.endDate || null,
        estimate_date: new Date().toISOString().split('T')[0],
      })
      .select('estimate_id')
      .single()

    if (insertError || !newEstimate) {
      throw new Error(`견적서 생성 실패: ${insertError?.message || '알 수 없는 오류'}`)
    }

    estimateId = newEstimate.estimate_id
  }

  // 견적서 버전 생성 (상세 정보 포함)
  const detailText = [
    formData.teamCapability && `## 팀 수행 가능 범위\n${formData.teamCapability}`,
    formData.additionalSuggestions && `## 추가 제안\n${formData.additionalSuggestions}`,
    formData.detail && `## 상세 설명\n${formData.detail}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const { data: estimateVersion, error: versionError } = await supabase
    .from('estimate_version')
    .insert({
      estimate_id: estimateId,
      total_amount: formData.totalAmount,
      start_date: formData.startDate || null,
      end_date: formData.endDate || null,
      detail: detailText || null,
      version_date: new Date().toISOString(),
    })
    .select('estimate_version_id')
    .single()

  if (versionError || !estimateVersion) {
    throw new Error(`견적서 버전 생성 실패: ${versionError?.message || '알 수 없는 오류'}`)
  }

  // 마일스톤 추가 (있는 경우)
  if (formData.milestones && formData.milestones.length > 0) {
    const milestoneData = formData.milestones.map((milestone) => ({
      estimate_id: estimateId,
      estimate_version_id: estimateVersion.estimate_version_id,
      title: milestone.title,
      detail: milestone.detail || null,
      payment_amount: milestone.paymentAmount,
      milestone_start_date: milestone.startDate || null,
      milestone_due_date: milestone.endDate || null,
      progress: 0,
    }))

    const { error: milestoneError } = await supabase
      .from('milestone')
      .insert(milestoneData)

    if (milestoneError) {
      console.warn('마일스톤 생성 실패:', milestoneError)
      // 마일스톤 오류는 치명적이지 않으므로 계속 진행
    }
  }

  return {
    estimate_id: estimateId,
    estimate_version_id: estimateVersion.estimate_version_id,
  }
}

/**
 * 팀 견적서 조회 (매니저용)
 */
export const getTeamEstimate = async (counselId: number, teamId?: number): Promise<TeamEstimate | null> => {
  const supabase = createSupabaseBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // 현재 사용자의 FREELANCER 프로필 조회
  const { data: managerProfile } = await supabase
    .from('accounts')
    .select('profile_id')
    .eq('user_id', user.id)
    .eq('profile_type', 'FREELANCER')
    .maybeSingle()

  if (!managerProfile) {
    return null
  }

  // 팀 ID가 제공되지 않은 경우, 사용자의 팀 조회
  let finalTeamId: number
  if (teamId) {
    // 제공된 팀 ID가 사용자의 팀인지 확인
    const { data: teamData } = await supabase
      .from('teams')
      .select('id')
      .eq('id', teamId)
      .eq('manager_profile_id', managerProfile.profile_id)
      .maybeSingle()

    if (!teamData) {
      return null
    }
    finalTeamId = teamData.id
  } else {
    // 팀 정보 가져오기 (manager_profile_id로 조회)
    const { data: teamData } = await supabase
      .from('teams')
      .select('id')
      .eq('manager_profile_id', managerProfile.profile_id)
      .maybeSingle()

    if (!teamData) {
      return null
    }
    finalTeamId = teamData.id
  }

  // 견적서 조회
  const { data: estimate, error: estimateError } = await supabase
    .from('estimate')
    .select('*')
    .eq('counsel_id', counselId)
    .eq('team_id', finalTeamId)
    .maybeSingle()

  if (estimateError || !estimate) {
    return null
  }

  // 최신 견적서 버전 조회
  const { data: estimateVersion } = await supabase
    .from('estimate_version')
    .select('*')
    .eq('estimate_id', estimate.estimate_id)
    .order('version_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 마일스톤 조회
  const { data: milestones } = await supabase
    .from('milestone')
    .select('*')
    .eq('estimate_id', estimate.estimate_id)
    .order('milestone_start_date', { ascending: true })

  return {
    ...estimate,
    estimate_version: estimateVersion && (estimateVersion as any).estimate_id !== null ? estimateVersion as any : undefined,
    milestones: milestones ? (milestones as any) : undefined,
  } as any
}

