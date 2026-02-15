import { createSupabaseBrowserClient } from '@/supabase/supabase-client'
import { Database } from '@/types/supabase'

type VerificationStatus = Database['public']['Enums']['verification_status']

/**
 * 경력 인증 요청 제출
 */
export const submitCareerVerification = async (data: {
  profile_id: string
  file_url: string
  badge_type: string
  description?: string
}) => {
  const supabase = createSupabaseBrowserClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not authenticated')

  // 활성 프로필 가져오기
  const { data: profile } = await supabase
    .from('accounts')
    .select('profile_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single()

  if (!profile || profile.profile_id !== data.profile_id) {
    throw new Error('권한이 없습니다.')
  }

  const { data: verification, error } = await supabase
    .from('career_verification_requests')
    .insert({
      profile_id: data.profile_id,
      file_url: data.file_url,
      badge_type: data.badge_type,
      description: data.description || null,
      status: 'PENDING',
    })
    .select()
    .single()

  if (error) throw error
  return verification
}

/**
 * 본인의 경력 인증 요청 목록 조회
 */
export const getMyCareerVerifications = async (profileId: string) => {
  const supabase = createSupabaseBrowserClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not authenticated')

  // 본인의 프로필인지 확인
  if (profileId !== user.id) {
    throw new Error('권한이 없습니다.')
  }

  const { data, error } = await supabase
    .from('career_verification_requests')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

/**
 * 경력 인증 요청 상태 조회 (단일)
 */
export const getCareerVerification = async (verificationId: number) => {
  const supabase = createSupabaseBrowserClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('career_verification_requests')
    .select('*')
    .eq('id', verificationId)
    .eq('profile_id', user.id) // 본인의 요청만 조회 가능
    .single()

  if (error) throw error
  return data
}

/**
 * 경력 인증 요청 취소 (PENDING 상태일 때만)
 */
export const cancelCareerVerification = async (verificationId: number) => {
  const supabase = createSupabaseBrowserClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not authenticated')

  // PENDING 상태인 본인의 요청인지 확인
  const { data: verification } = await supabase
    .from('career_verification_requests')
    .select('*')
    .eq('id', verificationId)
    .eq('profile_id', user.id)
    .eq('status', 'PENDING')
    .single()

  if (!verification) {
    throw new Error('취소할 수 없는 요청입니다.')
  }

  // 삭제 대신 REJECTED로 변경 (이력 유지)
  const { data: updated, error } = await supabase
    .from('career_verification_requests')
    .update({
      status: 'REJECTED',
      rejection_reason: '사용자 취소',
      updated_at: new Date().toISOString(),
    })
    .eq('id', verificationId)
    .select()
    .single()

  if (error) throw error
  return updated
}

/**
 * 관리자용: 경력 인증 요청 승인/거절
 */
export const reviewCareerVerification = async (
  verificationId: number,
  data: {
    status: 'APPROVED' | 'REJECTED'
    rejection_reason?: string
  }
) => {
  const supabase = createSupabaseBrowserClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not authenticated')

  // 관리자 권한 확인 (추가 권한 체크 로직 필요)
  // 여기서는 기본적으로 인증된 사용자만 허용
  // 실제로는 관리자 테이블이나 role 체크가 필요

  const updateData: any = {
    status: data.status,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  if (data.rejection_reason) {
    updateData.rejection_reason = data.rejection_reason
  }

  const { data: updated, error } = await supabase
    .from('career_verification_requests')
    .update(updateData)
    .eq('id', verificationId)
    .select()
    .single()

  if (error) throw error
  return updated
}

