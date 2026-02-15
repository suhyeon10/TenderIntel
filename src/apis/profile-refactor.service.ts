import { createSupabaseBrowserClient } from '@/supabase/supabase-client'
import { Database } from '@/types/supabase'

type ProfileType = Database['public']['Enums']['profile_type']

/**
 * 사용자의 모든 프로필 조회
 */
export const getUserProfiles = async () => {
  const supabase = createSupabaseBrowserClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', user.id)
    .not('profile_type', 'is', null)
    .is('deleted_at', null)
    .order('profile_created_at', { ascending: true })

  if (error) throw error
  return data
}

/**
 * 특정 타입의 프로필 조회
 */
export const getProfileByType = async (profileType: ProfileType) => {
  const supabase = createSupabaseBrowserClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', user.id)
    .eq('profile_type', profileType)
    .is('deleted_at', null)
    .single()

  if (error) throw error
  return data
}

/**
 * 프로필 생성 (프리랜서 또는 기업)
 */
export const createProfile = async (data: {
  profile_type: ProfileType
  username: string
  bio: string
  main_job?: string[]
  expertise?: string[]
}) => {
  const supabase = createSupabaseBrowserClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not authenticated')

  // 같은 타입의 프로필이 이미 있는지 확인
  const { data: existingProfile } = await supabase
    .from('accounts')
    .select('user_id, profile_type')
    .eq('user_id', user.id)
    .eq('profile_type', data.profile_type)
    .is('deleted_at', null)
    .maybeSingle()

  if (existingProfile) {
    throw new Error(`${data.profile_type === 'FREELANCER' ? '프리랜서' : '기업'} 프로필이 이미 존재합니다.`)
  }

  const { data: profile, error } = await supabase
    .from('accounts')
    .insert({
      user_id: user.id,
      profile_type: data.profile_type,
      username: data.username,
      bio: data.bio,
      main_job: data.main_job || [],
      expertise: data.expertise || [],
      role: data.profile_type === 'FREELANCER' ? 'MAKER' : 'MANAGER',
      badges: [],
      is_active: true,
      profile_created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return profile
}

/**
 * 프로필 업데이트
 */
export const updateProfile = async (
  profileId: string,
  data: {
    bio?: string
    username?: string
    main_job?: string[]
    expertise?: string[]
    availability_status?: 'available' | 'busy'
  }
) => {
  const supabase = createSupabaseBrowserClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not authenticated')

  // 본인의 프로필인지 확인
  const { data: profile } = await supabase
    .from('accounts')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('user_id', profileId) // profileId는 user_id와 동일해야 함
    .single()

  if (!profile) {
    throw new Error('권한이 없습니다.')
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
  }

  if (data.bio !== undefined) updateData.bio = data.bio
  if (data.username !== undefined) updateData.username = data.username
  if (data.main_job !== undefined) updateData.main_job = data.main_job
  if (data.expertise !== undefined) updateData.expertise = data.expertise
  if (data.availability_status !== undefined)
    updateData.availability_status = data.availability_status

  const { data: updatedProfile, error } = await supabase
    .from('accounts')
    .update(updateData)
    .eq('user_id', profileId)
    .select()
    .single()

  if (error) throw error
  return updatedProfile
}

/**
 * 활성 프로필 전환
 * profileId는 profile_id 또는 profile_type을 받을 수 있음
 */
export const switchActiveProfile = async (profileIdOrType: string) => {
  const supabase = createSupabaseBrowserClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not authenticated')

  // profileIdOrType이 profile_type인지 profile_id인지 확인
  // FREELANCER 또는 COMPANY면 profile_type으로 처리
  const isProfileType = profileIdOrType === 'FREELANCER' || profileIdOrType === 'COMPANY'

  if (isProfileType) {
    // 프로필 타입으로 전환: 해당 타입의 프로필을 찾아서 활성화
    // 먼저 모든 프로필을 비활성화
    const { error: deactivateError } = await supabase
      .from('accounts')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .is('deleted_at', null)

    if (deactivateError) throw deactivateError

    // 해당 타입의 프로필을 활성화하고 결과를 바로 반환
    const { data: updatedProfile, error: activateError } = await supabase
      .from('accounts')
      .update({ 
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('profile_type', profileIdOrType as ProfileType)
      .is('deleted_at', null)
      .select('*')
      .maybeSingle()

    if (activateError) {
      console.error('프로필 활성화 실패:', activateError)
      throw activateError
    }

    // 프로필이 없으면 생성하라는 오류 반환
    if (!updatedProfile) {
      throw new Error(`${profileIdOrType === 'FREELANCER' ? '프리랜서' : '기업'} 프로필이 없습니다. 먼저 프로필을 생성해주세요.`)
    }

    // 업데이트가 실제로 반영되었는지 확인
    if (!updatedProfile.is_active) {
      throw new Error(`${profileIdOrType === 'FREELANCER' ? '프리랜서' : '기업'} 프로필 활성화에 실패했습니다.`)
    }

    return updatedProfile
  } else {
    // profile_id로 전환: 특정 프로필을 활성화
    // 먼저 선택한 profile_id가 실제로 존재하는지 확인
    const { data: targetProfile, error: checkError } = await supabase
      .from('accounts')
      .select('profile_id, user_id, profile_type, is_active, deleted_at')
      .eq('profile_id', profileIdOrType)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()

    if (checkError) {
      console.error('프로필 확인 실패:', checkError)
      throw new Error(`프로필 확인에 실패했습니다: ${checkError.message}`)
    }

    if (!targetProfile) {
      throw new Error('프로필을 찾을 수 없습니다. 유효한 프로필 ID를 사용해주세요.')
    }

    console.log('전환 대상 프로필:', targetProfile)

    // 모든 프로필을 비활성화 (본인의 프로필만)
    const { data: deactivatedProfiles, error: deactivateError } = await supabase
      .from('accounts')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .select('profile_id')

    if (deactivateError) {
      console.error('프로필 비활성화 실패:', deactivateError)
      throw new Error(`프로필 비활성화에 실패했습니다: ${deactivateError.message}`)
    }

    console.log('비활성화된 프로필:', deactivatedProfiles)

    // 선택한 프로필만 활성화하고 결과를 바로 반환
    // .maybeSingle() 대신 결과 배열을 받아서 확인
    const { data: updatedProfiles, error: activateError } = await supabase
      .from('accounts')
      .update({ 
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('profile_id', profileIdOrType)
      .eq('user_id', user.id) // 보안: 사용자 본인의 프로필만 전환 가능
      .is('deleted_at', null)
      .select('*')

    if (activateError) {
      console.error('프로필 활성화 실패:', activateError)
      throw new Error(`프로필 활성화에 실패했습니다: ${activateError.message}`)
    }

    if (!updatedProfiles || updatedProfiles.length === 0) {
      console.error('업데이트된 프로필이 없습니다. 조건:', {
        profile_id: profileIdOrType,
        user_id: user.id
      })
      throw new Error('프로필을 찾을 수 없거나 업데이트할 수 없습니다. 프로필 ID와 사용자 ID를 확인해주세요.')
    }

    const updatedProfile = updatedProfiles[0]

    // 업데이트가 실제로 반영되었는지 확인
    if (!updatedProfile.is_active) {
      throw new Error('프로필 활성화에 실패했습니다.')
    }

    console.log('프로필 전환 성공:', updatedProfile)
    return updatedProfile
  }
}

