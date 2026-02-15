// TODO: Admin auth guard 추가
import { createServerSideClientRSC } from '@/supabase/supabase-server'
import ContractListClient from './contract-list-client'

interface SearchParams {
  q?: string
  level?: string
}

interface PageProps {
  searchParams: Promise<SearchParams>
}

// 계약서 분석 데이터 타입
interface ContractAnalysis {
  id: string
  doc_id: string
  file_name: string
  doc_type: string | null
  risk_score: number | null
  risk_level: string | null
  created_at: string
}

export default async function AdminContractsPage({ searchParams }: PageProps) {
  const params = await searchParams
  const searchQuery = params.q || ''
  const riskLevel = params.level || ''

  const supabase = await createServerSideClientRSC()

  // 모든 파일명 목록 가져오기 (드롭다운용)
  const { data: allFiles } = await supabase
    .from('contract_analyses')
    .select('file_name')
    .order('file_name', { ascending: true })

  const uniqueFileNames = Array.from(
    new Set((allFiles || []).map((item: any) => item.file_name).filter(Boolean))
  ).sort()

  // contract_analyses 테이블에서 데이터 조회
  let query = supabase
    .from('contract_analyses')
    .select('id, doc_id, file_name, doc_type, risk_score, risk_level, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  // 파일명 필터 (정확히 일치)
  if (searchQuery && searchQuery !== 'all') {
    query = query.eq('file_name', searchQuery)
  }

  // 위험 레벨 필터
  if (riskLevel && riskLevel !== 'all') {
    query = query.eq('risk_level', riskLevel)
  }

  const { data, error } = await query

  if (error) {
    console.error('계약서 목록 조회 오류:', error)
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">계약서 분석 목록 (Admin)</h1>
        <div className="text-red-600">데이터를 불러오는 중 오류가 발생했습니다: {error.message}</div>
      </div>
    )
  }

  const contracts: ContractAnalysis[] = (data || []).map((item: any) => ({
    id: item.id,
    doc_id: item.doc_id || '',
    file_name: item.file_name || '이름 없음',
    doc_type: item.doc_type,
    risk_score: item.risk_score,
    risk_level: item.risk_level,
    created_at: item.created_at,
  }))

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">계약서 분석 목록 (Admin)</h1>
      <ContractListClient 
        initialContracts={contracts} 
        initialSearch={searchQuery} 
        initialLevel={riskLevel}
        fileNames={uniqueFileNames}
      />
    </div>
  )
}

