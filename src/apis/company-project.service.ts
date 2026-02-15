import { createSupabaseBrowserClient } from '@/supabase/supabase-client'

// 상담(counsel) 조회
export const getCompanyCounsels = async () => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // client 테이블에서 user_id 조회 (기업이 직접 등록한 프로젝트 확인용)
  const { data: client } = await supabase
    .from('client')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!client) {
    return []
  }

  // 기업이 직접 등록한 프로젝트만 조회
  // client_id만으로 필터링 (company_profile_id 의존 제거)
  // deleted_at이 NULL인 것만 조회 (삭제되지 않은 프로젝트)
  const { data, error } = await supabase
    .from('counsel')
    .select('*')
    .eq('client_id', client.user_id)
    .is('deleted_at', null)
    .order('counsel_id', { ascending: false })

  if (error) {
    throw new Error(`상담 목록 조회 실패: ${error.message}`)
  }

  // 잘못 생성된 counsel 필터링
  // 팀이 기업에게 견적 요청할 때 생성된 잘못된 counsel 제외
  const validCounsels = (data || []).filter((counsel: any) => {
    // 제목에 "팀 견적 요청" 패턴이 있는 경우 제외
    if (counsel.title && (
      counsel.title.includes('팀 견적 요청') || 
      counsel.title.includes('팀 팀 견적 요청')
    )) {
      return false
    }
    
    // outline에 "팀 견적을 요청" 패턴이 있는 경우 제외
    if (counsel.outline && (
      counsel.outline.includes('팀 견적을 요청') ||
      counsel.outline.includes('팀 견적 요청') ||
      counsel.outline.includes('프젝에 참여')
    )) {
      return false
    }

    return true
  })

  return validCounsels
}

// 견적(estimate) 조회 - 상태별 필터링
export const getCompanyEstimates = async (statuses?: string[]) => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // 활성 기업 프로필 확인
  const { data: profile } = await supabase
    .from('accounts')
    .select('profile_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .eq('profile_type', 'COMPANY')
    .is('deleted_at', null)
    .maybeSingle()

  if (!profile) {
    throw new Error('기업 프로필을 찾을 수 없습니다.')
  }

  // client 테이블에서 user_id 조회
  const { data: client } = await supabase
    .from('client')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!client) {
    return []
  }

  let query = supabase
    .from('estimate')
    .select(`
      *,
      teams:teams!team_id (
        id,
        name,
        manager_id
      ),
      estimate_version:estimate_version (
        estimate_version_id,
        total_amount,
        detail,
        start_date,
        end_date,
        version_date
      )
    `)
    .eq('client_id', client.user_id)
    .order('estimate_id', { ascending: false })

  if (statuses && statuses.length > 0) {
    query = query.in('estimate_status', statuses)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`견적 목록 조회 실패: ${error.message}`)
  }

  return data || []
}

// 견적 상세 조회 (estimate + estimate_version + milestone + payment)
export const getEstimateDetail = async (estimateId: number) => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  const { data, error } = await supabase
    .from('estimate')
    .select(`
      *,
      team:teams!team_id (
        id,
        name,
        manager_id,
        manager_profile_id
      ),
      counsel:counsel_id (
        counsel_id,
        title,
        outline,
        counsel_status,
        start_date,
        due_date,
        cost,
        period,
        feild
      ),
      estimate_version:estimate_version (
        estimate_version_id,
        total_amount,
        detail,
        start_date,
        end_date,
        version_date
      ),
      milestone:milestone (
        milestone_id,
        estimate_id,
        estimate_version_id,
        title,
        detail,
        payment_amount,
        milestone_start_date,
        milestone_due_date,
        milestone_status,
        progress,
        payment:payment (
          payment_id,
          payment_amount,
          payment_date,
          payment_method,
          payment_status
        )
      )
    `)
    .eq('estimate_id', estimateId)
    .maybeSingle()

  if (data && data.team) {
    // 팀 정보가 배열인 경우 첫 번째 요소 사용
    const team = Array.isArray(data.team) ? data.team[0] : data.team
    
    // 매니저의 연락처 정보 조회 (FREELANCER 프로필)
    if (team.manager_id) {
      const { data: managerAccount } = await supabase
        .from('accounts')
        .select('contact_phone, contact_email, contact_website')
        .eq('user_id', team.manager_id)
        .eq('profile_type', 'FREELANCER')
        .maybeSingle()
      
      if (managerAccount) {
        // 팀 객체에 연락처 정보 추가
        const contactInfo = {
          contact_phone: (managerAccount as any).contact_phone,
          contact_email: (managerAccount as any).contact_email,
          contact_website: (managerAccount as any).contact_website,
        }
        if (Array.isArray(data.team)) {
          Object.assign(data.team[0], contactInfo)
        } else {
          Object.assign(data.team, contactInfo)
        }
      }
    }
  }

  if (error) {
    throw new Error(`견적 상세 조회 실패: ${error.message}`)
  }

  return data
}

// 받은 견적서 목록 조회 (팀/매니저가 보낸 견적서)
export const getReceivedEstimates = async () => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // 활성 기업 프로필 확인
  const { data: profile } = await supabase
    .from('accounts')
    .select('profile_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .eq('profile_type', 'COMPANY')
    .is('deleted_at', null)
    .maybeSingle()

  if (!profile) {
    throw new Error('기업 프로필을 찾을 수 없습니다.')
  }

  // client 테이블에서 user_id 조회
  const { data: client } = await supabase
    .from('client')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!client) {
    return []
  }

  const { data, error } = await supabase
    .from('estimate')
    .select(`
      estimate_id,
      team_id,
      counsel_id,
      client_id,
      estimate_status,
      estimate_start_date,
      estimate_due_date,
      estimate_date,
      team:teams!team_id (
        id,
        name,
        manager_id,
        manager_profile_id
      ),
      counsel:counsel_id (
        counsel_id,
        title,
        outline,
        counsel_status,
        start_date,
        due_date,
        cost,
        period,
        feild
      ),
      estimate_version:estimate_version (
        estimate_version_id,
        total_amount,
        detail,
        start_date,
        end_date,
        version_date
      )
    `)
    .eq('client_id', client.user_id)
    .order('estimate_id', { ascending: false })

  if (error) {
    throw new Error(`받은 견적서 목록 조회 실패: ${error.message}`)
  }

  // 각 견적서의 팀 연락처 정보 조회
  if (data) {
    for (const estimate of data) {
      if (estimate.team) {
        const team = Array.isArray(estimate.team) ? estimate.team[0] : estimate.team
        
        if (team.manager_id) {
          const { data: managerAccount } = await supabase
            .from('accounts')
            .select('contact_phone, contact_email, contact_website')
            .eq('user_id', team.manager_id)
            .eq('profile_type', 'FREELANCER')
            .maybeSingle()
          
          if (managerAccount) {
            const contactInfo = {
              contact_phone: (managerAccount as any).contact_phone,
              contact_email: (managerAccount as any).contact_email,
              contact_website: (managerAccount as any).contact_website,
            }
            if (Array.isArray(estimate.team)) {
              Object.assign(estimate.team[0], contactInfo)
            } else {
              Object.assign(estimate.team, contactInfo)
            }
          }
        }
      }
    }
  }

  return data || []
}

// 견적 상태 업데이트 (수락/보류/계약 진행)
export const updateEstimateStatus = async (estimateId: number, status: "pending" | "accept" | "in_progress") => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  const { data, error } = await supabase
    .from('estimate')
    .update({ 
      estimate_status: status
    })
    .eq('estimate_id', estimateId)
    .select()
    .single()

  if (error) {
    throw new Error(`견적 상태 업데이트 실패: ${error.message}`)
  }

  return data
}

// 견적 요청 (기존 프로젝트에 특정 팀 지정)
export const requestEstimateToTeam = async (
  counselId: number,
  teamId: number,
  message?: string
) => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // client 테이블에서 user_id 조회
  const { data: client } = await supabase
    .from('client')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!client) {
    throw new Error('클라이언트 정보를 찾을 수 없습니다.')
  }

  // 기존 counsel이 본인의 것인지 확인
  const { data: existingCounsel, error: checkError } = await supabase
    .from('counsel')
    .select('counsel_id, client_id')
    .eq('counsel_id', counselId)
    .eq('client_id', client.user_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (checkError || !existingCounsel) {
    throw new Error('프로젝트를 찾을 수 없거나 권한이 없습니다.')
  }

  // 기존 counsel 업데이트 (requested_team_id 설정)
  const { data: updatedCounsel, error: updateError } = await supabase
    .from('counsel')
    .update({
      requested_team_id: teamId,
      counsel_status: 'recruiting'
    })
    .eq('counsel_id', counselId)
    .select()
    .single()

  if (updateError) {
    throw new Error(`프로젝트 업데이트 실패: ${updateError.message}`)
  }

  // 알림 생성
  const { createClientToTeamEstimateRequest } = await import('./notification.service')
  await createClientToTeamEstimateRequest(
    client.user_id,
    teamId,
    counselId,
    { message }
  )

  return updatedCounsel
}

// 새 프로젝트 생성 및 특정 팀에게 견적 요청
export const createProjectAndRequestEstimate = async (
  teamId: number,
  projectInfo: {
    title: string
    outline: string
    start_date: string
    due_date: string
  }
) => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // client 테이블에서 user_id 조회
  const { data: client } = await supabase
    .from('client')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!client) {
    throw new Error('클라이언트 정보를 찾을 수 없습니다.')
  }

  // 새 counsel 생성
  const { data: counselData, error: counselError } = await supabase
    .from('counsel')
    .insert({
      client_id: client.user_id,
      title: projectInfo.title,
      outline: projectInfo.outline,
      counsel_status: 'recruiting',
      start_date: projectInfo.start_date,
      due_date: projectInfo.due_date,
      requested_team_id: teamId,
    })
    .select()
    .single()

  if (counselError) {
    throw new Error(`프로젝트 생성 실패: ${counselError.message}`)
  }

  // 알림 생성
  const { createClientToTeamEstimateRequest } = await import('./notification.service')
  await createClientToTeamEstimateRequest(
    client.user_id,
    teamId,
    counselData.counsel_id
  )

  return counselData
}

// 마일스톤 승인
export const approveMilestone = async (milestoneId: number) => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  const { data, error } = await supabase
    .from('milestone')
    .update({ 
      milestone_status: 'task_completed'
    })
    .eq('milestone_id', milestoneId)
    .select()
    .single()

  if (error) {
    throw new Error(`마일스톤 승인 실패: ${error.message}`)
  }

  return data
}

