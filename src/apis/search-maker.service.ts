import { createSupabaseBrowserClient } from '@/supabase/supabase-client'

export const searchMakers = async ({
  experience,
  job,
  specialization,
}: {
  experience?: [number, number]
  job?: string[]
  specialization?: string[]
}) => {
  const supabase = createSupabaseBrowserClient()

  let query = supabase
    .from('accounts')
    .select(
      `
      *,
      account_work_experiences (*),
      account_educations (*),
      account_license (*)
    `,
    )
    .eq('profile_type', 'FREELANCER') // 새로운 프로필 시스템: 프리랜서 프로필만
    .eq('is_active', true) // 활성 프로필만
    .is('deleted_at', null)

  // 필터 적용
  if (job && job.length > 0) {
    // main_job 배열에 선택된 직무가 포함된 경우 필터링
    // Supabase 배열 필터링: cs 연산자 사용
    const jobFilters = job.map(j => `main_job.cs.{${j}}`).join(',')
    query = query.or(jobFilters)
  }

  if (specialization && specialization.length > 0) {
    // expertise 배열에 선택된 전문분야가 포함된 경우 필터링
    const specFilters = specialization.map(s => `expertise.cs.{${s}}`).join(',')
    query = query.or(specFilters)
  }

  const { data, error } = await query

  if (error) {
    console.error('searchMakers 쿼리 에러:', error)
    throw error
  }

  console.log('searchMakers 조회 결과:', { data, error, count: data?.length })

  // if (job && job.length > 0) {
  //   query = query.contains('main_job', job)
  // }

  // if (specialization && specialization.length > 0) {
  //   query = query.contains('expertise', specialization)
  // }
  
  return { data, error }
}
