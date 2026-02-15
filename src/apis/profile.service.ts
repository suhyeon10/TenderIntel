import { createSupabaseBrowserClient } from '@/supabase/supabase-client'

export const updateCareer = async (id: number, data: any) => {
  const supabase = createSupabaseBrowserClient()

  console.log('Update data:', data)

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession()
  if (!sessionData.session) {
    throw new Error('인증되지 않은 사용자입니다.')
  }

  const { data: career, error } = await supabase
    .from('account_work_experiences')
    .update(data)
    .eq('id', id)
    .select('*')
  if (error) {
    console.error('Update error:', error)
  }

  return { career, error }
}
export const createCareer = async (data: any) => {
  const supabase = createSupabaseBrowserClient()

  console.log('Create data:', data)

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession()
  if (!sessionData.session) {
    throw new Error('인증되지 않은 사용자입니다.')
  }

  // 활성 프로필의 profile_id 가져오기
  const { data: profile, error: profileError } = await supabase
    .from('accounts')
    .select('profile_id')
    .eq('user_id', sessionData.session.user.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .single()

  if (profileError || !profile) {
    throw new Error('활성 프로필을 찾을 수 없습니다.')
  }

  // profile_id를 포함하여 insert
  const { data: career, error } = await supabase
    .from('account_work_experiences')
    .insert({
      ...data,
      profile_id: profile.profile_id,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Create error:', error)
  }

  return { data: career, error }
}
export const deleteCareer = async (id: string) => {}

export const updateEducation = async (id: number, data: any) => {
  const supabase = createSupabaseBrowserClient()

  console.log('Update education data:', data)

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession()
  if (!sessionData.session) {
    throw new Error('인증되지 않은 사용자입니다.')
  }

  const { data: education, error } = await supabase
    .from('account_educations')
    .update(data)
    .eq('id', id)
    .select('*')
  if (error) {
    console.error('Update error:', error)
  }

  return { education, error }
}
export const createEducation = async (data: any) => {
  const supabase = createSupabaseBrowserClient()

  console.log('Create education data:', data)

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession()
  if (!sessionData.session) {
    throw new Error('인증되지 않은 사용자입니다.')
  }

  const { data: profile, error: profileError } = await supabase
    .from('accounts')
    .select('user_id')
    .eq('profile_id', data.profile_id)
    .is('deleted_at', null)
    .eq('is_active', true)
    .maybeSingle()

  if (profileError || !profile) {
    throw new Error('프로필을 찾을 수 없습니다.')
  }

  if (profile.user_id !== sessionData.session.user.id) {
    throw new Error('본인 프로필에만 학력 추가가 가능합니다.')
  }

  // profile_id를 포함하여 insert 및 소유자 검증
  const { error } = await supabase
    .from('account_educations')
    .insert({
      ...data,
    })

  if (error) {
    console.error('Create error:', error)
  }

  return { data: null, error }
}
export const deleteEducation = async (id: string) => {}

export const updateLicense = async (id: number, data: any) => {
  const supabase = createSupabaseBrowserClient()

  console.log('Update license data:', data)

  const {
    data: sessionData,
    error: sessionError,
  } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionData.session) {
    throw new Error('인증되지 않은 사용자입니다.')
  }

  const { data: licenseOwner, error: licenseOwnerError } = await supabase
    .from('account_license')
    .select('profile_id')
    .eq('id', id)
    .maybeSingle()

  if (licenseOwnerError) throw licenseOwnerError
  if (!licenseOwner) {
    throw new Error('자격증을 찾을 수 없습니다.')
  }

  const { data: accountOwner, error: accountError } = await supabase
    .from('accounts')
    .select('user_id')
    .eq('profile_id', licenseOwner.profile_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (accountError) throw accountError

  if (accountOwner?.user_id !== sessionData.session.user.id) {
    throw new Error('본인 자격증만 수정할 수 있습니다.')
  }

  const { data: license, error } = await supabase
    .from('account_license')
    .update(data)
    .eq('id', id)
    .eq('profile_id', licenseOwner.profile_id)
    .select('*')
    .single()

  if (error) {
    console.error('Update error:', error)
  }

  return { data: license, error }
}

export const createLicense = async (data: any) => {
  const supabase = createSupabaseBrowserClient()

  console.log('Create license data:', data)

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession()
  if (!sessionData.session) {
    throw new Error('인증되지 않은 사용자입니다.')
  }

  const { data: profile, error: profileError } = await supabase
    .from('accounts')
    .select('user_id')
    .eq('profile_id', data.profile_id)
    .is('deleted_at', null)
    .eq('is_active', true)
    .maybeSingle()

  if (profileError || !profile) {
    throw new Error('프로필을 찾을 수 없습니다.')
  }

  if (profile.user_id !== sessionData.session.user.id) {
    throw new Error('본인 프로필에만 자격증을 추가할 수 있습니다.')
  }

  // profile_id를 포함하여 insert
  const { data: license, error } = await supabase
    .from('account_license')
    .insert({
      ...data,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Create error:', error)
  }

  return { data: license, error }
}
export const deleteLicense = async (id: number) => {
  const supabase = createSupabaseBrowserClient()

  const {
    data: sessionData,
    error: sessionError,
  } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionData.session) {
    throw new Error('인증되지 않은 사용자입니다.')
  }

  const { data: licenseOwner, error: licenseOwnerError } = await supabase
    .from('account_license')
    .select('profile_id')
    .eq('id', id)
    .maybeSingle()

  if (licenseOwnerError) throw licenseOwnerError
  if (!licenseOwner) {
    throw new Error('자격증을 찾을 수 없습니다.')
  }

  const { data: accountOwner, error: accountError } = await supabase
    .from('accounts')
    .select('user_id')
    .eq('profile_id', licenseOwner.profile_id)
    .is('deleted_at', null)
    .maybeSingle()

  if (accountError) throw accountError

  if (accountOwner?.user_id !== sessionData.session.user.id) {
    throw new Error('본인 자격증만 삭제할 수 있습니다.')
  }

  const { error } = await supabase
    .from('account_license')
    .delete()
    .eq('id', id)
    .eq('profile_id', licenseOwner.profile_id)

  if (error) {
    console.error('Delete error:', error)
  }

  return { error }
}

export const updateProfile = async (data: {
  bio?: string
  username?: string
  main_job?: string[]
  expertise?: string[]
  contact_phone?: string | null
  contact_website?: string | null
  profile_image_url?: string | null
  skills?: string[]
}) => {
  const supabase = createSupabaseBrowserClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not authenticated')

  // 먼저 활성 프로필 찾기
  const { data: activeProfile, error: profileError } = await supabase
    .from('accounts')
    .select('profile_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (profileError) {
    console.error('활성 프로필 조회 실패:', profileError)
    throw new Error(`활성 프로필을 찾을 수 없습니다: ${profileError.message}`)
  }

  // 활성 프로필이 없으면 첫 번째 프로필 사용
  let targetProfileId: string | null = null
  if (activeProfile) {
    targetProfileId = activeProfile.profile_id
  } else {
    const { data: firstProfile, error: firstProfileError } = await supabase
      .from('accounts')
      .select('profile_id')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .not('profile_type', 'is', null)
      .limit(1)
      .maybeSingle()

    if (firstProfileError) {
      console.error('프로필 조회 실패:', firstProfileError)
      throw new Error(`프로필을 찾을 수 없습니다: ${firstProfileError.message}`)
    }

    if (!firstProfile) {
      throw new Error('프로필이 없습니다. 먼저 프로필을 생성해주세요.')
    }

    targetProfileId = firstProfile.profile_id
  }

  if (!targetProfileId) {
    throw new Error('프로필을 찾을 수 없습니다.')
  }

  const updateData: any = {
    updated_at: new Date().toISOString(),
  }

  if (data.bio !== undefined) updateData.bio = data.bio
  if (data.username !== undefined) updateData.username = data.username
  if (data.main_job !== undefined) updateData.main_job = data.main_job
  if (data.expertise !== undefined) updateData.expertise = data.expertise
  if (data.contact_phone !== undefined) updateData.contact_phone = data.contact_phone
  if (data.contact_website !== undefined) updateData.contact_website = data.contact_website
  if (data.profile_image_url !== undefined) updateData.profile_image_url = data.profile_image_url
  if (data.skills !== undefined) updateData.skills = data.skills

  // profile_id로 업데이트 (배열 결과 사용)
  const { data: updatedProfiles, error } = await supabase
    .from('accounts')
    .update(updateData)
    .eq('profile_id', targetProfileId)
    .eq('user_id', user.id) // 보안: 본인의 프로필만 업데이트 가능
    .is('deleted_at', null)
    .select()

  if (error) {
    console.error('Update profile error:', error)
    throw error
  }

  if (!updatedProfiles || updatedProfiles.length === 0) {
    throw new Error('프로필 업데이트에 실패했습니다. 프로필을 찾을 수 없습니다.')
  }

  return updatedProfiles[0]
}
export const updateProfileImage = async (data: any) => {}

export const fetchMyProfile = async () => {
  const supabase = createSupabaseBrowserClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Not authenticated')

  // 활성 프로필을 우선 조회, 없으면 첫 번째 프로필 조회
  let { data, error } = await supabase
    .from('accounts')
    .select(
      `
      *,
      account_work_experiences (*),
      account_educations (*),
      account_license (*)
    `,
    )
    .eq('user_id', user.id)
    .eq('is_active', true)
    .not('profile_type', 'is', null)
    .is('deleted_at', null)
    .single()

  // 활성 프로필이 없으면 첫 번째 프로필 조회
  if (error && error.code === 'PGRST116') {
    const { data: profiles, error: profilesError } = await supabase
      .from('accounts')
      .select(
        `
        *,
        account_work_experiences (*),
        account_educations (*),
        account_license (*)
      `,
      )
      .eq('user_id', user.id)
      .not('profile_type', 'is', null)
      .is('deleted_at', null)
      .limit(1)
      .single()

    if (profilesError) throw profilesError
    return profiles
  }

  if (error) throw error
  return data
}

export const fetchUserProfile = async (username: string) => {
  const supabase = createSupabaseBrowserClient()

  const { data, error } = await supabase
    .from('accounts')
    .select(
      `
      *,
      account_work_experiences (*),
      account_educations (*),
      account_license (*)
    `,
    )
    .eq('username', username)
    .single()

  if (error) {
    console.error('Error fetching profile:', error)
    throw error
  }

  return data
}
