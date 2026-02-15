import { createSupabaseBrowserClient } from '@/supabase/supabase-client'
import { calculateTotalExperience } from '@/lib/transformExperienceDate'

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
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // manager_bookmarks에서 현재 사용자의 북마크 목록 가져오기
  const { data: bookmarks, error: bookmarksError } = await supabase
    .from('manager_bookmarks')
    .select('*')
    .eq('manager_id', user.id)
    .eq('proposal_status', isProposed)

  if (bookmarksError) {
    return { data: null, error: bookmarksError }
  }

  if (!bookmarks || bookmarks.length === 0) {
    return { data: [], error: null }
  }

  // 각 북마크의 maker_id로 accounts 정보 가져오기
  const makerIds = bookmarks.map(b => b.maker_id)
  const { data: makers, error: makersError } = await supabase
    .from('accounts')
    .select(`
      *,
      account_work_experiences(*),
      account_license(*)
    `)
    .in('user_id', makerIds)
    .eq('profile_type', 'FREELANCER')
    .is('deleted_at', null)

  if (makersError) {
    return { data: null, error: makersError }
  }

  // 북마크와 메이커 정보 결합
  const result = bookmarks.map(bookmark => {
    const maker = makers?.find(m => m.user_id === bookmark.maker_id)
    return {
      ...bookmark,
      maker: maker || null
    }
  }).filter(item => item.maker !== null) // 메이커 정보가 없는 북마크 제외

  // 필터 적용
  let filteredResult = result

  // 경력 필터
  if (experience && experience.length === 2) {
    const [minYears, maxYears] = experience
    filteredResult = filteredResult.filter(item => {
      if (!item.maker?.account_work_experiences || item.maker.account_work_experiences.length === 0) {
        return minYears === 0 // 신입만
      }
      
      // 타입 변환: null → undefined
      const experiences = item.maker.account_work_experiences.map(exp => ({
        start_date: exp.start_date,
        end_date: exp.end_date ?? undefined
      }))
      
      const totalExp = calculateTotalExperience(experiences)
      const totalYears = totalExp.years + totalExp.months / 12
      
      return totalYears >= minYears && (maxYears === null || totalYears <= maxYears)
    })
  }

  // 주직무 필터
  if (job && job.length > 0) {
    filteredResult = filteredResult.filter(item => {
      if (!item.maker?.main_job) return false
      return job.some(j => item.maker?.main_job?.includes(j))
    })
  }

  // 전문분야 필터
  if (specialization && specialization.length > 0) {
    filteredResult = filteredResult.filter(item => {
      if (!item.maker?.expertise) return false
      return specialization.some(s => item.maker?.expertise?.includes(s))
    })
  }

  return { data: filteredResult, error: null }
}
/**
 * 메이커 북마크 추가
 */
export const bookmark = async (makerId: string) => {
  const supabase = createSupabaseBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // manager_bookmarks에 북마크 추가
  const { data, error } = await supabase
    .from('manager_bookmarks')
    .insert({
      maker_id: makerId,
      manager_id: user.id,
      proposal_status: false,
    })
    .select()
    .single()

  if (error) {
    // 이미 북마크된 경우 (UNIQUE 제약조건 위반)
    if (error.code === '23505' || error.message?.includes('duplicate')) {
      throw new Error('이미 북마크된 메이커입니다.')
    }
    throw error
  }

  return data
}

/**
 * 메이커 북마크 제거
 */
export const unbookmark = async (makerId: string) => {
  const supabase = createSupabaseBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  const { data, error } = await supabase
    .from('manager_bookmarks')
    .delete()
    .eq('maker_id', makerId)
    .eq('manager_id', user.id)

  if (error) {
    console.error('Delete error:', error)
    throw error
  }
  return { data, error }
}

/**
 * 메이커 북마크 상태 확인
 */
export const checkBookmarked = async (makerId: string): Promise<boolean> => {
  const supabase = createSupabaseBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return false
  }

  // 북마크 확인
  const { data, error } = await supabase
    .from('manager_bookmarks')
    .select('id')
    .eq('maker_id', makerId)
    .eq('manager_id', user.id)
    .maybeSingle()

  if (error || !data) {
    return false
  }

  return true
}

export const propose = async () => {}

// 프로젝트 북마크 관련 함수들
export const bookmarkProject = async (counselId: number) => {
  const supabase = createSupabaseBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // 활성 프로필 확인
  const { data: profile } = await supabase
    .from('accounts')
    .select('profile_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (!profile) {
    throw new Error('프로필을 찾을 수 없습니다.')
  }

  // 북마크 추가
  const { data, error } = await supabase
    .from('project_bookmarks' as any)
    .insert({
      profile_id: profile.profile_id,
      counsel_id: counselId,
    })
    .select()
    .single()

  if (error) {
    // 이미 북마크된 경우 (UNIQUE 제약조건 위반)
    if (error.code === '23505' || error.message?.includes('duplicate')) {
      throw new Error('이미 북마크된 프로젝트입니다.')
    }
    throw error
  }

  return data
}

export const unbookmarkProject = async (counselId: number) => {
  const supabase = createSupabaseBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  // 활성 프로필 확인
  const { data: profile } = await supabase
    .from('accounts')
    .select('profile_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (!profile) {
    throw new Error('프로필을 찾을 수 없습니다.')
  }

  // 북마크 삭제
  const { error } = await supabase
    .from('project_bookmarks' as any)
    .delete()
    .eq('profile_id', profile.profile_id)
    .eq('counsel_id', counselId)

  if (error) throw error
  return { success: true }
}

export const checkProjectBookmarked = async (counselId: number): Promise<boolean> => {
  const supabase = createSupabaseBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return false
  }

  // 활성 프로필 확인
  const { data: profile } = await supabase
    .from('accounts')
    .select('profile_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (!profile) {
    return false
  }

  // 북마크 확인
  const { data, error } = await supabase
    .from('project_bookmarks' as any)
    .select('id')
    .eq('profile_id', profile.profile_id)
    .eq('counsel_id', counselId)
    .maybeSingle()

  if (error || !data) {
    return false
  }

  return true
}