import { createSupabaseBrowserClient } from '@/supabase/supabase-client'

export interface ProjectAssignment {
  id: number
  counsel_id: number
  maker_id: string
  assigned_by: string
  assignment_status: 'pending' | 'accepted' | 'declined'
  created_at: string
  updated_at: string
}

export const assignProjectToMaker = async (
  counselId: number,
  makerId: string
) => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // 기존 할당이 있는지 확인
  const { data: existingAssignment } = await supabase
    .from('project_assignments' as any)
    .select('*')
    .eq('counsel_id', counselId)
    .eq('maker_id', makerId)
    .single()

  if (existingAssignment) {
    throw new Error('이미 할당된 프로젝트입니다.')
  }

  const { data, error } = await supabase
    .from('project_assignments' as any)
    .insert({
      counsel_id: counselId,
      maker_id: makerId,
      assigned_by: user.id,
      assignment_status: 'pending'
    })
    .select()
    .single()

  if (error) {
    throw new Error(`프로젝트 할당 실패: ${error.message}`)
  }

  return data
}

export const getAssignedProjects = async (makerId?: string) => {
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
    .from('project_assignments' as any)
    .select('*')
    .eq('maker_id', targetMakerId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`할당된 프로젝트 조회 실패: ${error.message}`)
  }

  return data
}

export const updateAssignmentStatus = async (
  assignmentId: number,
  status: 'accepted' | 'declined'
) => {
  const supabase = createSupabaseBrowserClient()

  const { data, error } = await supabase
    .from('project_assignments' as any)
    .update({ 
      assignment_status: status,
      updated_at: new Date().toISOString()
    })
    .eq('id', assignmentId)
    .select()
    .single()

  if (error) {
    throw new Error(`할당 상태 업데이트 실패: ${error.message}`)
  }

  return data
}

export const getProjectAssignments = async (counselId: number) => {
  const supabase = createSupabaseBrowserClient()

  const { data, error } = await supabase
    .from('project_assignments' as any)
    .select(`
      *,
      maker:maker_id (
        username,
        main_job,
        expertise,
        availability_status
      ),
      assigned_by_user:assigned_by (
        username
      )
    `)
    .eq('counsel_id', counselId)

  if (error) {
    throw new Error(`프로젝트 할당 목록 조회 실패: ${error.message}`)
  }

  return data
}
