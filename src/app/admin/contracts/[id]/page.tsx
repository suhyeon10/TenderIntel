// TODO: Admin auth guard 추가
import { createServerSideClientRSC } from '@/supabase/supabase-server'
import { notFound } from 'next/navigation'
import ContractDetailClient from './contract-detail-client'

interface PageProps {
  params: Promise<{ id: string }>
}

// 계약서 분석 상세 데이터 타입
interface ContractAnalysisDetail {
  id: string
  doc_id: string
  file_name: string
  original_filename: string | null
  doc_type: string | null
  risk_score: number | null
  risk_level: string | null
  created_at: string
  contract_text: string | null
  clauses: any
  highlighted_texts: any
  retrieved_contexts: any
  analysis_result: any
}

// 이슈 데이터 타입
interface ContractIssue {
  id: string
  contract_analysis_id: string
  issue_id: string | null
  category: string | null
  severity: string | null
  summary: string | null
  original_text: string | null
  legal_basis: string[] | null
  explanation: string | null
  suggested_revision: string | null
  created_at: string
}

export default async function AdminContractDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createServerSideClientRSC()

  // contract_analyses에서 단일 row 조회
  const { data: analysis, error: analysisError } = await supabase
    .from('contract_analyses')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (analysisError || !analysis) {
    console.error('계약서 분석 조회 오류:', analysisError)
    notFound()
  }

  // contract_issues에서 이슈들 조회
  const { data: issues, error: issuesError } = await supabase
    .from('contract_issues')
    .select('*')
    .eq('contract_analysis_id', id)
    .order('created_at', { ascending: true })

  if (issuesError) {
    console.error('이슈 조회 오류:', issuesError)
  }

  // contract_chunks에서 청크들 조회 (선택적, doc_id 기반)
  const { data: chunks, error: chunksError } = await supabase
    .from('contract_chunks')
    .select('*')
    .eq('contract_id', analysis.doc_id || '')
    .order('chunk_index', { ascending: true })
    .limit(50)

  if (chunksError) {
    console.error('청크 조회 오류:', chunksError)
  }

  const analysisDetail: ContractAnalysisDetail = {
    id: analysis.id,
    doc_id: analysis.doc_id || '',
    file_name: analysis.file_name || '이름 없음',
    original_filename: analysis.original_filename,
    doc_type: analysis.doc_type,
    risk_score: analysis.risk_score,
    risk_level: analysis.risk_level,
    created_at: analysis.created_at,
    contract_text: analysis.contract_text,
    clauses: analysis.clauses,
    highlighted_texts: analysis.highlighted_texts,
    retrieved_contexts: analysis.retrieved_contexts,
    analysis_result: analysis.analysis_result,
  }

  const issuesList: ContractIssue[] = (issues || []).map((item: any) => ({
    id: item.id,
    contract_analysis_id: item.contract_analysis_id,
    issue_id: item.issue_id,
    category: item.category,
    severity: item.severity,
    summary: item.summary,
    original_text: item.original_text,
    legal_basis: item.legal_basis,
    explanation: item.explanation,
    suggested_revision: item.suggested_revision,
    created_at: item.created_at,
  }))

  return (
    <div className="container mx-auto p-6">
      <ContractDetailClient 
        analysis={analysisDetail} 
        issues={issuesList}
        chunks={chunks || []}
      />
    </div>
  )
}

