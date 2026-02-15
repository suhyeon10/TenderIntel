'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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

interface LegalDetailClientProps {
  chunk: LegalChunkDetail
}

export default function LegalDetailClient({ chunk: initialChunk }: LegalDetailClientProps) {
  const router = useRouter()
  const [chunk, setChunk] = useState(initialChunk)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

  // source_type 뱃지 스타일
  const getSourceTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      law: 'border-blue-500 text-blue-600 bg-blue-50',
      manual: 'border-green-500 text-green-600 bg-green-50',
      case: 'border-purple-500 text-purple-600 bg-purple-50',
      standard_contract: 'border-orange-500 text-orange-600 bg-orange-50',
    }
    
    const style = styles[type] || 'border-gray-500 text-gray-600 bg-gray-50'
    
    return (
      <span className={`px-2 py-1 text-xs font-medium border rounded ${style}`}>
        {type}
      </span>
    )
  }

  // 저장 핸들러
  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/legal/${chunk.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          external_id: chunk.external_id,
          source_type: chunk.source_type,
          title: chunk.title,
          content: chunk.content,
          chunk_index: chunk.chunk_index,
          file_path: chunk.file_path,
          metadata: chunk.metadata,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '저장 실패')
      }

      const updatedChunk = await response.json()
      setChunk(updatedChunk)
      setIsEditing(false)
      alert('저장되었습니다.')
    } catch (err: any) {
      setError(err.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  // 삭제 핸들러
  const handleDelete = async () => {
    if (!confirm('정말 이 청크를 삭제하시겠습니까?')) {
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/legal/${chunk.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '삭제 실패')
      }

      alert('삭제되었습니다.')
      router.push('/admin/legal')
    } catch (err: any) {
      setError(err.message || '삭제 중 오류가 발생했습니다.')
      setIsDeleting(false)
    }
  }

  return (
    <div>
      {/* 뒤로가기 버튼 */}
      <Link
        href="/admin/legal"
        className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
      >
        ← 목록으로
      </Link>

      {/* 에러 메시지 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* 상단 요약 카드 */}
      <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-2xl font-bold">법령 청크 상세</h1>
          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  수정
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeleting ? '삭제 중...' : '삭제'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {isSaving ? '저장 중...' : '저장'}
                </button>
                <button
                  onClick={() => {
                    setChunk(initialChunk)
                    setIsEditing(false)
                    setError(null)
                  }}
                  disabled={isSaving}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
                >
                  취소
                </button>
              </>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-500 mb-1">External ID</div>
            {isEditing ? (
              <input
                type="text"
                value={chunk.external_id}
                onChange={(e) => setChunk({ ...chunk, external_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            ) : (
              <div className="font-mono text-sm">{chunk.external_id}</div>
            )}
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Source Type</div>
            {isEditing ? (
              <select
                value={chunk.source_type}
                onChange={(e) => setChunk({ ...chunk, source_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="law">law</option>
                <option value="manual">manual</option>
                <option value="case">case</option>
                <option value="standard_contract">standard_contract</option>
              </select>
            ) : (
              <div>{getSourceTypeBadge(chunk.source_type)}</div>
            )}
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Chunk Index</div>
            {isEditing ? (
              <input
                type="number"
                value={chunk.chunk_index ?? ''}
                onChange={(e) => setChunk({ ...chunk, chunk_index: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            ) : (
              <div className="font-medium">{chunk.chunk_index !== null ? chunk.chunk_index : '-'}</div>
            )}
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">생성일시</div>
            <div className="font-medium">{formatDate(chunk.created_at)}</div>
          </div>
        </div>
      </div>

      {/* 본문 영역 */}
      <div className="space-y-4">
        {/* Title */}
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
          {isEditing ? (
            <input
              type="text"
              value={chunk.title}
              onChange={(e) => setChunk({ ...chunk, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          ) : (
            <div className="text-lg font-medium">{chunk.title}</div>
          )}
        </div>

        {/* Content */}
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
          {isEditing ? (
            <textarea
              value={chunk.content}
              onChange={(e) => setChunk({ ...chunk, content: e.target.value })}
              rows={15}
              className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
            />
          ) : (
            <div className="p-3 bg-gray-50 rounded border whitespace-pre-wrap font-mono text-sm max-h-96 overflow-y-auto">
              {chunk.content}
            </div>
          )}
        </div>

        {/* File Path */}
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">File Path</label>
          {isEditing ? (
            <input
              type="text"
              value={chunk.file_path || ''}
              onChange={(e) => setChunk({ ...chunk, file_path: e.target.value || null })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
            />
          ) : (
            <div className="font-mono text-sm text-gray-600">{chunk.file_path || '-'}</div>
          )}
        </div>

        {/* Metadata */}
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Metadata (JSON)</label>
          {isEditing ? (
            <textarea
              value={JSON.stringify(chunk.metadata || {}, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value)
                  setChunk({ ...chunk, metadata: parsed })
                } catch {
                  // JSON 파싱 실패 시 무시
                }
              }}
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-xs"
            />
          ) : (
            <pre className="p-3 bg-gray-50 rounded border text-xs overflow-x-auto max-h-96 overflow-y-auto">
              {JSON.stringify(chunk.metadata || {}, null, 2)}
            </pre>
          )}
        </div>

        {/* Embedding (읽기 전용) */}
        <div className="bg-white border border-gray-300 rounded-lg p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Embedding (읽기 전용)</label>
          <div className="text-xs text-gray-500">
            {chunk.embedding ? `벡터 차원: ${Array.isArray(chunk.embedding) ? chunk.embedding.length : 'N/A'}` : '없음'}
          </div>
        </div>
      </div>
    </div>
  )
}

