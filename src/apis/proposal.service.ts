import { createSupabaseBrowserClient } from '@/supabase/supabase-client'

export const fetchBookmarkList = async ({
  isProposed,
  experience,
  job,
  specialization,
}: {
  isProposed: boolean
  experience?: [number, number]
  job?: string[]
  specialization?: string[]
}) => {
  const supabase = createSupabaseBrowserClient()

  let query = supabase
    .from('manager_bookmarks')
    .select(
      `
     *,
     maker:maker_id (
       *,
       account_work_experiences(*),
       account_license(*)
     )
   `,
    )
    .eq('proposal_status', isProposed)

  // if (job.length > 0) {
  //   query = query.contains('maker.main_job', job)
  // }

  // if (specialization.length > 0) {
  //   query = query.contains('maker.expertise', specialization)
  // }
  return await query
}
export const unbookmark = async (makerId: string) => {
  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('manager_bookmarks')
    .delete()
    .eq('maker_id', makerId)

  if (error) console.error('Delete error:', error)
  return { data, error }
}
export const propose = async (
  makerId: string,
  options?: {
    teamId?: number | null
    message?: string | null
  }
) => {
  const supabase = createSupabaseBrowserClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('로그인이 필요합니다')
  }

  const { teamId, message } = options || {}

  // 매니저의 팀 정보 가져오기
  let targetTeamId = teamId
  if (!targetTeamId) {
    const { data: team } = await supabase
      .from('teams')
      .select('id')
      .eq('manager_id', user.id)
      .single()

    if (team) {
      targetTeamId = team.id
    }
  }

  // team_proposals에 제안 추가
  const { data: proposal, error: proposalError } = await supabase
    .from('team_proposals')
    .insert({
      maker_id: makerId,
      manager_id: user.id,
      team_id: targetTeamId,
      message: message || null,
    })
    .select()
    .single()

  if (proposalError) {
    console.error('Proposal error:', proposalError)
    throw proposalError
  }

  // manager_bookmarks의 proposal_status 업데이트
  const { error: bookmarkError } = await supabase
    .from('manager_bookmarks')
    .update({ proposal_status: true })
    .eq('maker_id', makerId)
    .eq('manager_id', user.id)

  if (bookmarkError) {
    console.error('Bookmark update error:', bookmarkError)
    // 제안은 성공했지만 북마크 업데이트 실패는 치명적이지 않음
  }

  return { data: proposal, error: proposalError }
}

/**
 * 팀 제안 수락
 */
export const acceptTeamProposal = async (proposalId: number) => {
  const supabase = createSupabaseBrowserClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('로그인이 필요합니다')
  }

  // 팀 제안 정보 조회
  const { data: proposal, error: proposalError } = await supabase
    .from('team_proposals')
    .select('team_id, maker_id')
    .eq('id', proposalId)
    .eq('maker_id', user.id)
    .single()

  if (proposalError || !proposal) {
    throw new Error('팀 제안을 찾을 수 없습니다.')
  }

  if (!proposal.team_id) {
    throw new Error('팀 정보가 없습니다.')
  }

  // 현재 사용자의 프로필 조회
  const { data: profile, error: profileError } = await supabase
    .from('accounts')
    .select('profile_id')
    .eq('user_id', user.id)
    .eq('profile_type', 'FREELANCER')
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (profileError || !profile) {
    throw new Error('프리랜서 프로필을 찾을 수 없습니다.')
  }

  // 이미 팀원인지 확인
  const { data: existingMember } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', proposal.team_id)
    .eq('profile_id', profile.profile_id)
    .maybeSingle()

  if (existingMember) {
    // 이미 팀원이면 제안만 삭제
    const { error: deleteError } = await supabase
      .from('team_proposals')
      .delete()
      .eq('id', proposalId)

    if (deleteError) {
      throw deleteError
    }
    return { data: { alreadyMember: true }, error: null }
  }

  // team_members에 추가 (제안 수락 시)
  const { data: teamMember, error: memberError } = await supabase
    .from('team_members')
    .insert({
      team_id: proposal.team_id,
      profile_id: profile.profile_id,
      maker_id: user.id,
      status: 'active',
      request_type: 'invite', // 매니저의 제안을 수락한 것이므로 'invite'
    })
    .select()
    .single()

  if (memberError) {
    throw memberError
  }

  // team_proposals 삭제
  const { error: deleteError } = await supabase
    .from('team_proposals')
    .delete()
    .eq('id', proposalId)

  if (deleteError) {
    console.error('제안 삭제 실패:', deleteError)
    // 팀원 추가는 성공했으므로 치명적이지 않음
  }

  return { data: teamMember, error: null }
}

/**
 * 팀 제안 거절
 */
export const declineTeamProposal = async (proposalId: number) => {
  const supabase = createSupabaseBrowserClient()
  
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('로그인이 필요합니다')
  }

  // 팀 제안 삭제
  const { error } = await supabase
    .from('team_proposals')
    .delete()
    .eq('id', proposalId)
    .eq('maker_id', user.id)

  if (error) {
    throw error
  }

  return { data: { success: true }, error: null }
}
