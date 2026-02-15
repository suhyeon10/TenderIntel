// TODO: Admin auth guard 추가
import { createServerSideClientRSC } from '@/supabase/supabase-server'
import LegalListClient from './legal-list-client'

interface SearchParams {
  q?: string
  source_type?: string
  external_id?: string
}

interface PageProps {
  searchParams: Promise<SearchParams>
}

// legal_chunks 데이터 타입
interface LegalChunk {
  id: string
  external_id: string
  source_type: string
  title: string
  content: string
  chunk_index: number | null
  file_path: string | null
  metadata: any
  created_at: string
}

export default async function AdminLegalPage({ searchParams }: PageProps) {
  const params = await searchParams
  const searchQuery = params.q || ''
  const sourceType = params.source_type || ''
  const externalId = params.external_id || ''

  const supabase = await createServerSideClientRSC()

  // legal_chunks 테이블에서 데이터 조회
  let query = supabase
    .from('legal_chunks')
    .select('id, external_id, source_type, title, content, chunk_index, file_path, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(200) // 더 많은 데이터 표시

  // 제목/내용 검색 필터
  if (searchQuery) {
    query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`)
  }

  // source_type 필터
  if (sourceType && sourceType !== 'all') {
    query = query.eq('source_type', sourceType)
  }

  // external_id 필터
  if (externalId && externalId !== 'all') {
    query = query.eq('external_id', externalId)
  }

  const { data, error } = await query

  if (error) {
    console.error('legal_chunks 목록 조회 오류:', error)
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">법령 청크 목록 (Admin)</h1>
        <div className="text-red-600">데이터를 불러오는 중 오류가 발생했습니다: {error.message}</div>
      </div>
    )
  }

  // 고유한 external_id 목록 가져오기 (드롭다운용)
  const { data: allExternalIds } = await supabase
    .from('legal_chunks')
    .select('external_id')
    .order('external_id', { ascending: true })

  const uniqueExternalIds = Array.from(
    new Set((allExternalIds || []).map((item: any) => item.external_id).filter(Boolean))
  ).sort()

  // 고유한 source_type 목록 가져오기
  const { data: allSourceTypes } = await supabase
    .from('legal_chunks')
    .select('source_type')
    .order('source_type', { ascending: true })

  const uniqueSourceTypes = Array.from(
    new Set((allSourceTypes || []).map((item: any) => item.source_type).filter(Boolean))
  ).sort()

  const chunks: LegalChunk[] = (data || []).map((item: any) => ({
    id: item.id,
    external_id: item.external_id || '',
    source_type: item.source_type || '',
    title: item.title || '',
    content: item.content || '',
    chunk_index: item.chunk_index,
    file_path: item.file_path,
    metadata: item.metadata,
    created_at: item.created_at,
  }))

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">법령 청크 목록 (Admin)</h1>
      <LegalListClient 
        initialChunks={chunks} 
        initialSearch={searchQuery}
        initialSourceType={sourceType}
        initialExternalId={externalId}
        sourceTypes={uniqueSourceTypes}
        externalIds={uniqueExternalIds}
      />
    </div>
  )
}

