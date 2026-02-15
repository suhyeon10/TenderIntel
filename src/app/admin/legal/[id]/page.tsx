// TODO: Admin auth guard 추가
import { createServerSideClientRSC } from '@/supabase/supabase-server'
import { notFound } from 'next/navigation'
import LegalDetailClient from './legal-detail-client'

interface PageProps {
  params: Promise<{ id: string }>
}

// legal_chunks 상세 데이터 타입
interface LegalChunkDetail {
  id: string
  external_id: string
  source_type: string
  title: string
  content: string
  chunk_index: number | null
  file_path: string | null
  metadata: any
  embedding: any
  created_at: string
}

export default async function AdminLegalDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createServerSideClientRSC()

  // legal_chunks에서 단일 row 조회
  const { data: chunk, error: chunkError } = await supabase
    .from('legal_chunks')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (chunkError || !chunk) {
    console.error('legal_chunks 조회 오류:', chunkError)
    notFound()
  }

  const chunkDetail: LegalChunkDetail = {
    id: chunk.id,
    external_id: chunk.external_id || '',
    source_type: chunk.source_type || '',
    title: chunk.title || '',
    content: chunk.content || '',
    chunk_index: chunk.chunk_index,
    file_path: chunk.file_path,
    metadata: chunk.metadata,
    embedding: chunk.embedding, // 벡터는 읽기 전용으로 표시
    created_at: chunk.created_at,
  }

  return (
    <div className="container mx-auto p-6">
      <LegalDetailClient chunk={chunkDetail} />
    </div>
  )
}

