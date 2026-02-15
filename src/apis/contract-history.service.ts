/**
 * 계약서 분석 히스토리 서비스
 * Supabase Storage 및 DB와 통신
 */

import { createSupabaseBrowserClient } from '@/supabase/supabase-client'
import type { LegalAnalysisResult } from './legal.service'

// 클라이언트를 지연 초기화하는 헬퍼 함수
const getSupabase = () => {
  // 브라우저 환경에서만 클라이언트 생성
  if (typeof window === 'undefined') {
    throw new Error('contract-history.service는 브라우저 환경에서만 사용할 수 있습니다.')
  }
  return createSupabaseBrowserClient()
}

const handleError = (message: string, error?: any) => {
  console.error(message, error)
  throw new Error(message)
}

const checkSession = async (): Promise<string | null> => {
  try {
    const supabase = getSupabase()
    const { data: sessionData, error } = await supabase.auth.getSession()
    if (error || !sessionData || !sessionData.session) {
      // 로그인하지 않은 경우 null 반환 (에러 발생하지 않음)
      return null
    }
    return sessionData.session.user.id
  } catch (error) {
    // 에러 발생 시에도 null 반환 (로그인 없이 사용 가능)
    return null
  }
}

/**
 * 계약서 파일을 Supabase Storage에 업로드 (로그인 없이도 가능)
 * 버킷이 없으면 null 반환 (분석은 계속 진행)
 */
export const uploadContractFile = async (file: File): Promise<string | null> => {
  try {
    const supabase = getSupabase()
    const userId = await checkSession()

    // 파일 확장자 추출
    const fileExt = file.name.split('.').pop() || 'pdf'
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(7)
    // 로그인하지 않은 경우 anonymous 폴더 사용
    const folder = userId ? `contracts/${userId}` : 'contracts/anonymous'
    const fileName = `${folder}/${timestamp}_${randomStr}.${fileExt}`
    
    // 사용 가능한 버킷 목록 시도 (우선순위: attach_file > announcements)
    // attach_file 버킷이 생성되었고 RLS 정책이 설정되어 있으므로 우선 시도
    const bucketNames = ['attach_file', 'announcements']
    let uploadData: any = null
    let uploadError: any = null
    let usedBucket: string | null = null

    for (const bucketName of bucketNames) {
      try {
        const { data, error } = await supabase.storage
          .from(bucketName)
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (!error && data) {
          uploadData = data
          usedBucket = bucketName
          break
        } else if (error?.message?.includes('Bucket not found') || error?.message?.includes('404')) {
          // 이 버킷이 없으면 다음 버킷 시도
          continue
        } else {
          // 다른 에러면 기록하고 다음 버킷 시도
          console.warn(`[${bucketName}] 버킷 업로드 실패:`, error)
          continue
        }
      } catch (err) {
        console.warn(`[${bucketName}] 버킷 접근 실패:`, err)
        continue
      }
    }

    // 모든 버킷 시도 실패 시 null 반환 (분석은 계속 진행)
    if (!uploadData || !usedBucket) {
      console.warn('모든 Storage 버킷 접근 실패. 파일 업로드를 건너뜁니다. 분석은 계속 진행됩니다.')
      return null
    }

    // Public URL 가져오기
    const { data: { publicUrl } } = supabase.storage
      .from(usedBucket)
      .getPublicUrl(fileName)

    return publicUrl
  } catch (error) {
    // 에러 발생 시에도 null 반환 (분석은 계속 진행)
    console.warn('계약서 파일 업로드 중 오류 발생, 분석은 계속 진행:', error)
    return null
  }
}

/**
 * 계약서 분석 결과를 DB에 저장 (로그인 없이도 가능)
 */
export const saveContractAnalysis = async (
  file: File,
  fileUrl: string | null,
  analysisResult: LegalAnalysisResult & { contract_text?: string }
): Promise<string> => {
  try {
    const supabase = getSupabase()
    const userId = await checkSession()

    // 분석 결과 저장 (user_id는 nullable이므로 null 허용)
    // fileUrl이 null이면 빈 문자열로 저장 (DB 저장은 계속 진행)
    // 타입 단언 사용: contract_analyses 테이블이 Supabase 타입 정의에 없을 수 있음
    const { data, error } = await (supabase
      .from('contract_analyses' as any)
      .insert({
        user_id: userId || undefined, // null 대신 undefined 사용 (타입 호환성)
        file_name: file.name,
        file_url: fileUrl || '', // null이면 빈 문자열
        file_size: file.size,
        file_type: file.type || file.name.split('.').pop() || 'unknown',
        risk_score: analysisResult.risk_score,
        risk_level: analysisResult.risk_level,
        summary: analysisResult.summary,
        contract_text: analysisResult.contract_text,
        analysis_result: {
          issues: analysisResult.issues || [],
          recommendations: analysisResult.recommendations || [],
          grounding: analysisResult.grounding || [],
        },
      })
      .select('id')
      .single() as any)

    if (error) {
      handleError('분석 결과 저장 실패', error)
    }

    if (!data || !data.id) {
      handleError('분석 결과 저장 실패: 데이터가 반환되지 않았습니다')
    }

    return data.id
  } catch (error) {
    handleError('분석 결과 저장 중 오류 발생', error)
    throw error
  }
}

/**
 * 사용자의 계약서 분석 히스토리 조회 (로그인 없이도 가능 - 로컬 스토리지만)
 */
export const getContractAnalysisHistory = async (limit: number = 20) => {
  try {
    const supabase = getSupabase()
    const userId = await checkSession()

    // 로그인한 경우에만 DB에서 조회
    if (userId) {
      const { data, error } = await (supabase
        .from('contract_analyses' as any)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit) as any)

      if (error) {
        console.warn('히스토리 조회 실패, 로컬 스토리지 확인:', error)
      } else {
        return data || []
      }
    }

    // 로그인하지 않은 경우 로컬 스토리지에서 조회
    const localHistory: any[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('contract_analysis_')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}')
          localHistory.push({
            id: key.replace('contract_analysis_', ''),
            ...data,
            created_at: data.createdAt,
          })
        } catch (e) {
          // 무시
        }
      }
    }
    return localHistory.sort((a, b) => 
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    ).slice(0, limit)
  } catch (error) {
    console.warn('히스토리 조회 중 오류 발생:', error)
    return []
  }
}

/**
 * 특정 분석 결과 조회 (로그인 없이도 가능)
 */
export const getContractAnalysis = async (analysisId: string) => {
  try {
    const supabase = getSupabase()
    const userId = await checkSession()

    // 로그인한 경우 DB에서 조회
    if (userId) {
      const { data, error } = await (supabase
        .from('contract_analyses' as any)
        .select('*')
        .eq('id', analysisId)
        .eq('user_id', userId)
        .maybeSingle() as any) // single() 대신 maybeSingle() 사용

      if (!error && data) {
        return data
      }
    } else {
      // 로그인하지 않은 경우에도 DB에서 조회 시도 (user_id가 null인 경우)
      const { data, error } = await (supabase
        .from('contract_analyses' as any)
        .select('*')
        .eq('id', analysisId)
        .is('user_id', null)
        .maybeSingle() as any)

      if (!error && data) {
        return data
      }
    }

    // 로컬 스토리지에서 조회 (fallback)
    const localData = localStorage.getItem(`contract_analysis_${analysisId}`)
    if (localData) {
      const data = JSON.parse(localData)
      return {
        id: analysisId,
        ...data,
        created_at: data.createdAt,
        contract_text: data.contractText || data.contract_text,
        analysis_result: {
          issues: data.issues || [],
          recommendations: data.recommendations || [],
        },
      }
    }

    return null
  } catch (error) {
    console.warn('분석 결과 조회 중 오류 발생:', error)
    return null
  }
}

/**
 * 분석 결과 삭제
 */
export const deleteContractAnalysis = async (analysisId: string) => {
  try {
    const supabase = getSupabase()
    const userId = await checkSession()

    if (!userId) {
      // 로그인하지 않은 경우 삭제 불가
      throw new Error('로그인이 필요합니다.')
    }

    const { error } = await (supabase
      .from('contract_analyses' as any)
      .delete()
      .eq('id', analysisId)
      .eq('user_id', userId) as any)

    if (error) {
      handleError('분석 결과 삭제 실패', error)
    }
  } catch (error) {
    handleError('분석 결과 삭제 중 오류 발생', error)
    throw error
  }
}

