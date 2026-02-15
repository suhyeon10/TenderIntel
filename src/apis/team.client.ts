'use client'

import { createSupabaseBrowserClient } from '@/supabase/supabase-client'

export const fetchManagerTeam = async (managerId?: string) => {
  const supabase = createSupabaseBrowserClient()

  let targetManagerId = managerId
  if (!targetManagerId) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    targetManagerId = session?.user?.id
  }
  if (!targetManagerId) {
    return null
  }

  const { data, error } = await supabase
    .from('teams')
    .select(
      `
            *,
            team_members!team_id(*)`,
    )
    .eq('manager_id', targetManagerId)
    .single()

  if (error) {
    console.error(error)
    return null
  }
  return data
}

export const fetchMyTeamList = async () => {
  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase.from('teams').select('*')
}

export const fetchTeam = async (teamId: number) => {
  const supabase = createSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('teams')
    .select(
      `
            *,
            team_members!team_id(*)`,
    )
    .single()
}
