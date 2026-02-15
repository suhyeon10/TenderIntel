import { createSupabaseBrowserClient } from '@/supabase/supabase-client'

export interface ProjectParticipation {
  id: number
  counsel_id: number
  maker_id: string
  participation_status: 'pending' | 'interested' | 'not_interested'
  created_at: string
  updated_at: string
}

export const submitParticipationInterest = async (
  counselId: number, 
  status: 'interested' | 'not_interested'
) => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // 기존 참여 의향이 있는지 확인
  const { data: existingParticipation } = await supabase
    .from('project_participation' as any)
    .select('*')
    .eq('counsel_id', counselId)
    .eq('maker_id', user.id)
    .single()

  if (existingParticipation) {
    // 기존 참여 의향 업데이트
    const { data, error } = await supabase
      .from('project_participation' as any)
      .update({ 
        participation_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingParticipation.id)
      .select()
      .single()

    if (error) {
      throw new Error(`참여 의향 업데이트 실패: ${error.message}`)
    }

    return data
  } else {
    // 새로운 참여 의향 생성
    const { data, error } = await supabase
      .from('project_participation' as any)
      .insert({
        counsel_id: counselId,
        maker_id: user.id,
        participation_status: status
      })
      .select()
      .single()

    if (error) {
      throw new Error(`참여 의향 제출 실패: ${error.message}`)
    }

    return data
  }
}

export const getParticipationStatus = async (counselId: number) => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('project_participation' as any)
    .select('*')
    .eq('counsel_id', counselId)
    .eq('maker_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116은 "no rows returned" 에러
    throw new Error(`참여 의향 조회 실패: ${error.message}`)
  }

  return data
}

export const getProjectParticipations = async (counselId: number) => {
  const supabase = createSupabaseBrowserClient()

  const { data, error } = await supabase
    .from('project_participation' as any)
    .select(`
      *,
      maker:maker_id (
        username,
        main_job,
        expertise
      )
    `)
    .eq('counsel_id', counselId)

  if (error) {
    throw new Error(`프로젝트 참여자 목록 조회 실패: ${error.message}`)
  }

  return data
}
