import { createServerSideClient } from '@/supabase/supabase-server'

export const fetchLoginUserInfo = async () => {
  const supabase = await createServerSideClient()
  const { data, error } = await supabase.from('accounts').select('*').single()
  if (error) {
    console.error(error)
    return null
  }
  return data
}
