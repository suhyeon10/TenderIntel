import { createSupabaseBrowserClient } from '@/supabase/supabase-client'

export const updateAvailabilityStatus = async (status: 'available' | 'busy') => {
  const supabase = createSupabaseBrowserClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    throw new Error('로그인이 필요합니다.')
  }

  const { data, error } = await supabase
    .from('accounts')
    .update({ availability_status: status })
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    throw new Error(`연락 가능 여부 업데이트 실패: ${error.message}`)
  }

  return data
}

export const getAvailabilityStatus = async (userId?: string) => {
  const supabase = createSupabaseBrowserClient()
  
  let targetUserId = userId
  if (!targetUserId) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('로그인이 필요합니다.')
    }
    targetUserId = user.id
  }

  const { data, error } = await supabase
    .from('accounts')
    .select('availability_status')
    .eq('user_id', targetUserId)
    .single()

  if (error) {
    throw new Error(`연락 가능 여부 조회 실패: ${error.message}`)
  }

  return data?.availability_status || 'available'
}
