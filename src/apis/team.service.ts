import { createSupabaseBrowserClient } from '@/supabase/supabase-client'

export const fetchTeamProfileByTeamManager = async () => {
  const supabase = createSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('로그인 하는 곳으로 리다이렉트')
  }

  // 현재 사용자의 FREELANCER 프로필 조회
  const { data: currentProfile, error: profileError } = await supabase
    .from('accounts')
    .select('profile_id')
    .eq('user_id', user.id)
    .eq('profile_type', 'FREELANCER')
    .maybeSingle()

  if (profileError || !currentProfile) {
    return { data: null, error: profileError || new Error('프리랜서 프로필을 찾을 수 없습니다.') }
  }

  // manager_profile_id를 사용하여 팀 조회 (FK 자동 조인)
  const { data, error } = await supabase
    .from('teams')
    .select(`
      *,
      manager:manager_profile_id (
        profile_id,
        user_id,
        username,
        role,
        bio,
        profile_image_url
      ),
      team_members:team_members (
        *,
        account:profile_id (
          profile_id,
          user_id,
          username,
          role,
          bio,
          profile_image_url
        )
      )
    `)
    .eq('manager_profile_id', currentProfile.profile_id)
    .single()

  if (error) {
    return { data: null, error }
  }

  // team_members는 이미 profile_id로 조인되어 있음
  // 필터링은 불필요 (FK로 자동 연결됨)

  return {
    data: {
      ...data,
      manager: data.manager || null,
      team_members: (data.team_members || []).map((member: any) => ({
        ...member,
        account: member.account || null,
      })),
    },
    error: null,
  }
}

export const fetchTeamProfile = async (teamId: string) => {
  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('teams')
    .select(`*, team_members:team_members(*)`)
    .eq('id', teamId)
    .single()

  return { data, error }
}

/**
 * 사용자가 속한 모든 팀 목록 조회 (매니저인 팀 + 팀원으로 속한 팀)
 */
export const fetchMyTeams = async () => {
  const supabase = createSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('로그인 하는 곳으로 리다이렉트')
  }

  // 현재 사용자의 FREELANCER 프로필 조회
  const { data: currentProfile, error: profileError } = await supabase
    .from('accounts')
    .select('profile_id')
    .eq('user_id', user.id)
    .eq('profile_type', 'FREELANCER')
    .maybeSingle()

  if (profileError || !currentProfile) {
    return { data: [], error: profileError || new Error('프리랜서 프로필을 찾을 수 없습니다.') }
  }

  // 1. 매니저인 팀 조회
  const { data: managedTeams, error: managedError } = await supabase
    .from('teams')
    .select(`
      *,
      manager:manager_profile_id (
        profile_id,
        user_id,
        username,
        role,
        bio,
        profile_image_url
      ),
      team_members:team_members (
        *,
        account:profile_id (
          profile_id,
          user_id,
          username,
          role,
          bio,
          profile_image_url
        )
      )
    `)
    .eq('manager_profile_id', currentProfile.profile_id)

  if (managedError) {
    return { data: [], error: managedError }
  }

  // 2. 팀원으로 속한 팀 조회
  const { data: memberTeams, error: memberError } = await supabase
    .from('team_members')
    .select(`
      team_id,
      teams:team_id (
        *,
        manager:manager_profile_id (
          profile_id,
          user_id,
          username,
          role,
          bio,
          profile_image_url
        ),
        team_members:team_members (
          *,
          account:profile_id (
            profile_id,
            user_id,
            username,
            role,
            bio,
            profile_image_url
          )
        )
      )
    `)
    .eq('profile_id', currentProfile.profile_id)
    .eq('status', 'active')

  if (memberError) {
    return { data: [], error: memberError }
  }

  // 3. 두 결과를 합치고 중복 제거
  const allTeams: any[] = []
  const teamIds = new Set<number>()

  // 매니저인 팀 추가
  if (managedTeams) {
    managedTeams.forEach((team: any) => {
      if (!teamIds.has(team.id)) {
        teamIds.add(team.id)
        allTeams.push({
          ...team,
          isManager: true,
          manager: team.manager || null,
          team_members: (team.team_members || []).map((member: any) => ({
            ...member,
            account: member.account || null,
          })),
        })
      }
    })
  }

  // 팀원으로 속한 팀 추가
  if (memberTeams) {
    memberTeams.forEach((memberTeam: any) => {
      const team = memberTeam.teams
      if (team && !teamIds.has(team.id)) {
        teamIds.add(team.id)
        allTeams.push({
          ...team,
          isManager: false,
          manager: team.manager || null,
          team_members: (team.team_members || []).map((member: any) => ({
            ...member,
            account: member.account || null,
          })),
        })
      }
    })
  }

  return { data: allTeams, error: null }
}

/**
 * 특정 팀의 상세 정보 조회
 */
export const fetchTeamDetail = async (teamId: number) => {
  const supabase = createSupabaseBrowserClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('로그인 하는 곳으로 리다이렉트')
  }

  // 현재 사용자의 FREELANCER 프로필 조회
  const { data: currentProfile, error: profileError } = await supabase
    .from('accounts')
    .select('profile_id')
    .eq('user_id', user.id)
    .eq('profile_type', 'FREELANCER')
    .maybeSingle()

  if (profileError || !currentProfile) {
    return { data: null, error: profileError || new Error('프리랜서 프로필을 찾을 수 없습니다.') }
  }

  // 팀 상세 정보 조회
  const { data, error } = await supabase
    .from('teams')
    .select(`
      *,
      manager:manager_profile_id (
        profile_id,
        user_id,
        username,
        role,
        bio,
        profile_image_url
      ),
      team_members:team_members (
        *,
        account:profile_id (
          profile_id,
          user_id,
          username,
          role,
          bio,
          profile_image_url
        )
      )
    `)
    .eq('id', teamId)
    .single()

  if (error) {
    return { data: null, error }
  }

  // 매니저인지 확인
  const isManager = (data as any).manager_profile_id === currentProfile.profile_id

  return {
    data: {
      ...data,
      isManager,
      manager: data.manager || null,
      team_members: (data.team_members || []).map((member: any) => ({
        ...member,
        account: member.account || null,
      })),
    },
    error: null,
  }
}

/**
 * 팀원 추가
 */
export const addTeamMember = async (teamId: number, profileId: string) => {
  const supabase = createSupabaseBrowserClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not authenticated')

  // 팀의 매니저인지 확인
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('manager_profile_id')
    .eq('id', teamId)
    .single()

  if (teamError) throw teamError

  // 현재 사용자의 FREELANCER 프로필 조회
  const { data: currentProfile, error: profileError } = await supabase
    .from('accounts')
    .select('profile_id')
    .eq('user_id', user.id)
    .eq('profile_type', 'FREELANCER')
    .maybeSingle()

  if (profileError || !currentProfile) {
    throw new Error('프리랜서 프로필을 찾을 수 없습니다.')
  }

  // 매니저인지 확인
  if ((team as any).manager_profile_id !== currentProfile.profile_id) {
    throw new Error('팀 매니저만 팀원을 추가할 수 있습니다.')
  }

  // 이미 팀원인지 확인
  const { data: existingMember } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', teamId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (existingMember) {
    throw new Error('이미 팀원으로 등록되어 있습니다.')
  }

  // 팀원 추가 (매니저가 초대)
  const { data: member, error } = await supabase
    .from('team_members')
    .insert({
      team_id: teamId,
      profile_id: profileId,
      status: 'active',
      request_type: 'invite', // 매니저가 초대
    })
    .select()
    .single()

  if (error) throw error
  return member
}

/**
 * 팀원 제거
 */
export const removeTeamMember = async (teamId: number, memberId: number) => {
  const supabase = createSupabaseBrowserClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not authenticated')

  // 팀의 매니저인지 확인
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('manager_profile_id')
    .eq('id', teamId)
    .single()

  if (teamError) throw teamError

  // 현재 사용자의 FREELANCER 프로필 조회
  const { data: currentProfile, error: profileError } = await supabase
    .from('accounts')
    .select('profile_id')
    .eq('user_id', user.id)
    .eq('profile_type', 'FREELANCER')
    .maybeSingle()

  if (profileError || !currentProfile) {
    throw new Error('프리랜서 프로필을 찾을 수 없습니다.')
  }

  // 매니저인지 확인
  if ((team as any).manager_profile_id !== currentProfile.profile_id) {
    throw new Error('팀 매니저만 팀원을 제거할 수 있습니다.')
  }

  // 팀원 제거
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', memberId)
    .eq('team_id', teamId)

  if (error) throw error
  return { success: true }
}

/**
 * 기본 팀 생성 (매니저용)
 * 사용자가 팀이 없을 때 자동으로 기본 팀을 생성합니다.
 */
export const createDefaultTeam = async () => {
  const supabase = createSupabaseBrowserClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('로그인이 필요합니다')
  }

  // 현재 사용자의 FREELANCER 프로필 조회
  const { data: currentProfile, error: profileError } = await supabase
    .from('accounts')
    .select('profile_id, username')
    .eq('user_id', user.id)
    .eq('profile_type', 'FREELANCER')
    .maybeSingle()

  if (profileError || !currentProfile) {
    throw new Error('프리랜서 프로필을 찾을 수 없습니다.')
  }

  // 이미 팀이 있는지 확인
  const { data: existingTeam } = await supabase
    .from('teams')
    .select('id')
    .eq('manager_profile_id', currentProfile.profile_id)
    .maybeSingle()

  if (existingTeam) {
    return { data: existingTeam, error: null }
  }

  // 기본 팀 생성
  const teamName = `${currentProfile.username || '나'}의 팀`
  const { data: newTeam, error: teamError } = await supabase
    .from('teams')
    .insert({
      manager_id: user.id,
      manager_profile_id: currentProfile.profile_id,
      name: teamName,
      bio: '기본 팀입니다.',
      specialty: [],
      sub_specialty: [],
      prefered: [],
    })
    .select()
    .single()

  if (teamError) {
    throw teamError
  }

  // 팀 임베딩 자동 생성 (비동기, 실패해도 팀 생성은 성공)
  // TODO: @/lib/rag/team-summary 모듈이 구현되면 활성화
  // if (newTeam) {
  //   try {
  //     const { generateTeamSummarySimple } = await import('@/lib/rag/team-summary')
  //     const summaryData = generateTeamSummarySimple({
  //       name: newTeam.name,
  //       bio: newTeam.bio,
  //       specialty: newTeam.specialty,
  //       sub_specialty: newTeam.sub_specialty,
  //       prefered: newTeam.prefered,
  //     })

  //     // 백엔드 API로 임베딩 저장
  //     const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000'
  //     await fetch(`${backendUrl}/api/v2/teams/embedding`, {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/x-www-form-urlencoded',
  //       },
  //       body: new URLSearchParams({
  //         team_id: String(newTeam.id),
  //         summary: summaryData.summary,
  //         meta: JSON.stringify(summaryData.meta),
  //       }),
  //     }).catch(err => {
  //       console.warn('[팀 임베딩] 자동 생성 실패 (무시됨):', err)
  //     })
  //   } catch (err) {
  //     console.warn('[팀 임베딩] 자동 생성 중 오류 (무시됨):', err)
  //   }
  // }

  return { data: newTeam, error: null }
}

/**
 * 팀 정보 업데이트 (매니저만 가능)
 */
export const updateTeam = async (
  teamId: number,
  data: {
    name?: string
    bio?: string | null
    specialty?: string[]
    sub_specialty?: string[]
    prefered?: string[]
  }
) => {
  const supabase = createSupabaseBrowserClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not authenticated')

  // 팀의 매니저인지 확인
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('manager_profile_id')
    .eq('id', teamId)
    .single()

  if (teamError) throw teamError

  // 현재 사용자의 FREELANCER 프로필 조회
  const { data: currentProfile, error: profileError } = await supabase
    .from('accounts')
    .select('profile_id')
    .eq('user_id', user.id)
    .eq('profile_type', 'FREELANCER')
    .maybeSingle()

  if (profileError || !currentProfile) {
    throw new Error('프리랜서 프로필을 찾을 수 없습니다.')
  }

  // 매니저인지 확인
  if ((team as any).manager_profile_id !== currentProfile.profile_id) {
    throw new Error('팀 매니저만 팀 정보를 수정할 수 있습니다.')
  }

  // 업데이트할 데이터 준비
  const updateData: any = {
    updated_at: new Date().toISOString(),
  }

  if (data.name !== undefined) updateData.name = data.name
  if (data.bio !== undefined) updateData.bio = data.bio
  if (data.specialty !== undefined) updateData.specialty = data.specialty
  if (data.sub_specialty !== undefined) updateData.sub_specialty = data.sub_specialty
  if (data.prefered !== undefined) updateData.prefered = data.prefered

  // 팀 정보 업데이트
  const { data: updatedTeam, error } = await supabase
    .from('teams')
    .update(updateData)
    .eq('id', teamId)
    .select()
    .single()

  if (error) throw error

  // 팀 임베딩 자동 업데이트 (비동기, 실패해도 팀 업데이트는 성공)
  // TODO: @/lib/rag/team-summary 모듈이 구현되면 활성화
  // try {
  //   const { generateTeamSummarySimple } = await import('@/lib/rag/team-summary')
  //   const summaryData = generateTeamSummarySimple({
  //     name: updatedTeam.name,
  //     bio: updatedTeam.bio,
  //     specialty: updatedTeam.specialty,
  //     sub_specialty: updatedTeam.sub_specialty,
  //     prefered: updatedTeam.prefered,
  //   })

  //   // 백엔드 API로 임베딩 저장
  //   const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000'
  //   await fetch(`${backendUrl}/api/v2/teams/embedding`, {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/x-www-form-urlencoded',
  //     },
  //     body: new URLSearchParams({
  //       team_id: String(teamId),
  //       summary: summaryData.summary,
  //       meta: JSON.stringify(summaryData.meta),
  //     }),
  //   }).catch(err => {
  //     console.warn('[팀 임베딩] 자동 업데이트 실패 (무시됨):', err)
  //   })
  // } catch (err) {
  //   console.warn('[팀 임베딩] 자동 업데이트 중 오류 (무시됨):', err)
  // }

  return updatedTeam
}

/**
 * 모든 팀 검색 (필터링 지원)
 */
export const searchTeams = async (filters?: {
  searchTerm?: string
  specialty?: string[]
  subSpecialty?: string[]
}) => {
  const supabase = createSupabaseBrowserClient()

  let query = supabase
    .from('teams')
    .select(`
      *,
      manager:manager_profile_id (
        profile_id,
        user_id,
        username,
        role,
        bio
      ),
      team_members:team_members (
        *,
        account:profile_id (
          profile_id,
          user_id,
          username,
          role,
          bio
        )
      )
    `)

  // 검색어 필터링 (팀 이름, 소개)
  if (filters?.searchTerm) {
    query = query.or(`name.ilike.%${filters.searchTerm}%,bio.ilike.%${filters.searchTerm}%`)
  }

  // 전문분야 필터링
  if (filters?.specialty && filters.specialty.length > 0) {
    const specialtyFilters = filters.specialty.map(s => `specialty.cs.{${s}}`).join(',')
    query = query.or(specialtyFilters)
  }

  // 세부 전문분야 필터링
  if (filters?.subSpecialty && filters.subSpecialty.length > 0) {
    const subSpecialtyFilters = filters.subSpecialty.map(s => `sub_specialty.cs.{${s}}`).join(',')
    query = query.or(subSpecialtyFilters)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error('팀 검색 에러:', error)
    throw error
  }

  return { data: data || [], error: null }
}

/**
 * 메이커가 팀에 합류 신청
 */
export const requestTeamJoin = async (teamId: number, message?: string) => {
  const supabase = createSupabaseBrowserClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('로그인이 필요합니다')
  }

  // 현재 사용자의 FREELANCER 프로필 조회
  const { data: currentProfile, error: profileError } = await supabase
    .from('accounts')
    .select('profile_id')
    .eq('user_id', user.id)
    .eq('profile_type', 'FREELANCER')
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (profileError || !currentProfile) {
    throw new Error('프리랜서 프로필을 찾을 수 없습니다.')
  }

  // 팀 정보 확인
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('id, manager_profile_id')
    .eq('id', teamId)
    .single()

  if (teamError || !team) {
    throw new Error('팀을 찾을 수 없습니다.')
  }

  // 자신의 팀인지 확인
  if (team.manager_profile_id === currentProfile.profile_id) {
    throw new Error('자신이 매니저인 팀에는 신청할 수 없습니다.')
  }

  // 이미 팀원인지 확인
  const { data: existingMember } = await supabase
    .from('team_members')
    .select('id, status')
    .eq('team_id', teamId)
    .eq('profile_id', currentProfile.profile_id)
    .maybeSingle()

  if (existingMember) {
    if (existingMember.status === 'active') {
      throw new Error('이미 팀원으로 등록되어 있습니다.')
    } else if (existingMember.status === 'pending') {
      throw new Error('이미 합류 신청이 진행 중입니다.')
    }
  }

  // 이미 제안을 받았는지 확인
  const { data: existingProposal } = await supabase
    .from('team_proposals')
    .select('id')
    .eq('team_id', teamId)
    .eq('maker_id', user.id)
    .maybeSingle()

  if (existingProposal) {
    throw new Error('이미 해당 팀으로부터 제안을 받았습니다. 쪽지함에서 확인해주세요.')
  }

  // team_members에 pending 상태로 추가 (메이커가 신청)
  const { data: teamMember, error: memberError } = await supabase
    .from('team_members')
    .insert({
      team_id: teamId,
      profile_id: currentProfile.profile_id,
      maker_id: user.id,
      status: 'pending',
      request_type: 'request', // 메이커가 신청
    })
    .select()
    .single()

  if (memberError) {
    throw memberError
  }

  return { data: teamMember, error: null }
}