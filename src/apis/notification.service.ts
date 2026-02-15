import { createSupabaseBrowserClient } from '@/supabase/supabase-client'

export type NotificationType = 
  | 'TEAM_TO_CLIENT_ESTIMATE_REQUEST'
  | 'CLIENT_TO_TEAM_ESTIMATE_REQUEST'

export type NotificationStatus = 
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'CANCELED'

export interface Notification {
  id: number
  created_at: string
  type: NotificationType
  sender_type: 'TEAM' | 'CLIENT'
  sender_team_id: number | null
  sender_client_id: string | null  // UUID
  target_team_id: number | null
  target_client_id: string | null  // UUID
  counsel_id: number | null
  payload: any
  status: NotificationStatus
}

/**
 * 팀이 기업에게 견적 요청 알림 생성
 */
export const createTeamToClientEstimateRequest = async (
  teamId: number,
  targetClientId: string,
  payload: {
    note?: string
    skills?: string[]
    durationWeeks?: number
  }
) => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  const { data, error } = await supabase
    .from('notifications' as any)
    .insert({
      type: 'TEAM_TO_CLIENT_ESTIMATE_REQUEST',
      sender_type: 'TEAM',
      sender_team_id: teamId,
      target_client_id: targetClientId,
      payload: payload,
      status: 'PENDING'
    })
    .select()
    .single()

  if (error) {
    throw new Error(`알림 생성 실패: ${error.message}`)
  }

  return data
}

/**
 * 기업이 특정 팀에게 견적 요청 알림 생성
 */
export const createClientToTeamEstimateRequest = async (
  clientId: string,
  teamId: number,
  counselId: number,
  payload?: {
    message?: string
  }
) => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  const { data, error } = await supabase
    .from('notifications' as any)
    .insert({
      type: 'CLIENT_TO_TEAM_ESTIMATE_REQUEST',
      sender_type: 'CLIENT',
      sender_client_id: clientId,
      target_team_id: teamId,
      counsel_id: counselId,
      payload: payload || {},
      status: 'PENDING'
    })
    .select()
    .single()

  if (error) {
    throw new Error(`알림 생성 실패: ${error.message}`)
  }

  return data
}

/**
 * 기업이 받은 알림 조회
 */
export const getClientNotifications = async (clientId: string) => {
  const supabase = createSupabaseBrowserClient()
  
  const { data, error } = await supabase
    .from('notifications' as any)
    .select('*')
    .eq('target_client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`알림 조회 실패: ${error.message}`)
  }

  return data || []
}

/**
 * 팀이 받은 알림 조회
 */
export const getTeamNotifications = async (teamId: number) => {
  const supabase = createSupabaseBrowserClient()
  
  const { data, error } = await supabase
    .from('notifications' as any)
    .select('*')
    .eq('target_team_id', teamId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`알림 조회 실패: ${error.message}`)
  }

  return data || []
}

/**
 * 알림 상태 업데이트
 */
export const updateNotificationStatus = async (
  notificationId: number,
  status: NotificationStatus,
  counselId?: number
) => {
  const supabase = createSupabaseBrowserClient()
  
  const updateData: any = { status }
  if (counselId) {
    updateData.counsel_id = counselId
  }

  const { data, error } = await supabase
    .from('notifications' as any)
    .update(updateData)
    .eq('id', notificationId)
    .select()
    .single()

  if (error) {
    throw new Error(`알림 상태 업데이트 실패: ${error.message}`)
  }

  return data
}

