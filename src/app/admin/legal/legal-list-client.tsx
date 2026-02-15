'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

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

interface LegalListClientProps {
  initialChunks: LegalChunk[]
  initialSearch: string
  initialSourceType: string
  initialExternalId: string
  sourceTypes: string[]
  externalIds: string[]
}

export default function LegalListClient({ 
  initialChunks, 
  initialSearch, 
  initialSourceType,
  initialExternalId,
  sourceTypes,
  externalIds
}: LegalListClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [sourceType, setSourceType] = useState(initialSourceType || 'all')
  const [externalId, setExternalId] = useState(initialExternalId || 'all')
  const [chunks, setChunks] = useState(initialChunks)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingChunk, setEditingChunk] = useState<LegalChunk | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // searchParams가 변경되면 chunks 업데이트
  useEffect(() => {
    setChunks(initialChunks)
    setSearchQuery(initialSearch)
    setSourceType(initialSourceType || 'all')
    setExternalId(initialExternalId || 'all')
  }, [initialChunks, initialSearch, initialSourceType, initialExternalId])

  // 필터 적용
  const applyFilters = () => {
    const params = new URLSearchParams()
    if (searchQuery) {
      params.set('q', searchQuery)
    }
    if (sourceType && sourceType !== 'all') {
      params.set('source_type', sourceType)
    }
    if (externalId && externalId !== 'all') {
      params.set('external_id', externalId)
    }
    router.push(`/admin/legal?${params.toString()}`)
  }

  // 필터 변경 시 자동 적용 (debounce) - 검색어는 제외 (Enter 키로만 적용)
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((sourceType !== initialSourceType || externalId !== initialExternalId) && 
          (sourceType !== 'all' || externalId !== 'all')) {
        applyFilters()
      }
    }, 500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType, externalId])

  // 토스트 메시지 자동 닫기
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])

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

  // 텍스트 스니펫 생성
  const getSnippet = (text: string, maxLength: number = 100) => {
    if (!text) return '-'
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  // 편집 시작
  const handleEdit = (chunk: LegalChunk) => {
    setEditingId(chunk.id)
    setEditingChunk({ ...chunk })
  }

  // 편집 취소
  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingChunk(null)
  }

  // 저장
  const handleSave = async (chunkId: string) => {
    if (!editingChunk) return

    setSavingId(chunkId)
    try {
      const response = await fetch(`/api/admin/legal/${chunkId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          external_id: editingChunk.external_id,
          source_type: editingChunk.source_type,
          title: editingChunk.title,
          content: editingChunk.content,
          chunk_index: editingChunk.chunk_index,
          file_path: editingChunk.file_path,
          metadata: editingChunk.metadata,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '저장 실패')
      }

      const updatedChunk = await response.json()
      setChunks(chunks.map(c => c.id === chunkId ? { ...c, ...updatedChunk } : c))
      setEditingId(null)
      setEditingChunk(null)
      setToast({ message: '저장되었습니다.', type: 'success' })
    } catch (err: any) {
      setToast({ message: err.message || '저장 중 오류가 발생했습니다.', type: 'error' })
    } finally {
      setSavingId(null)
    }
  }

  // 삭제
  const handleDelete = async (chunkId: string, chunkTitle: string) => {
    if (!confirm(`"${chunkTitle || chunkId}" 청크를 삭제하시겠습니까?`)) {
      return
    }

    setDeletingId(chunkId)
    try {
      const response = await fetch(`/api/admin/legal/${chunkId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '삭제 실패')
      }

      setChunks(chunks.filter(c => c.id !== chunkId))
      setToast({ message: '삭제되었습니다.', type: 'success' })
    } catch (err: any) {
      setToast({ message: err.message || '삭제 중 오류가 발생했습니다.', type: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  // 키보드 단축키 (ESC로 취소, Ctrl+S로 저장)
  useEffect(() => {
    if (!editingId) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleCancelEdit()
      } else if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        if (editingChunk) {
          handleSave(editingId)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editingId, editingChunk])

  return (
    <div>
      {/* 토스트 메시지 */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-md shadow-lg ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* 통계 정보 */}
      <div className="mb-4 text-sm text-gray-600">
        총 {chunks.length}개의 청크
      </div>

      {/* 필터 영역 */}
      <div className="mb-6 flex gap-4 items-end">
        <div className="flex-1">
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            제목/내용 검색
          </label>
          <input
            id="search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                applyFilters()
              }
            }}
            autoFocus
            placeholder="제목 또는 내용을 입력하세요..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="w-48">
          <label htmlFor="source-type" className="block text-sm font-medium text-gray-700 mb-1">
            Source Type
          </label>
          <select
            id="source-type"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체</option>
            {sourceTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div className="w-48">
          <label htmlFor="external-id" className="block text-sm font-medium text-gray-700 mb-1">
            External ID
          </label>
          <select
            id="external-id"
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체</option>
            {externalIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={applyFilters}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          검색
        </button>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                External ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Source Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Title
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Content
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Chunk Index
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                생성일시
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {chunks.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  조회된 청크가 없습니다.
                </td>
              </tr>
            ) : (
              chunks.map((chunk) => {
                const isEditing = editingId === chunk.id
                const isSaving = savingId === chunk.id
                const displayChunk = isEditing && editingChunk ? editingChunk : chunk

                return (
                  <tr key={chunk.id} className={`hover:bg-gray-50 ${isEditing ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-3 text-sm text-gray-900 font-mono text-xs">
                      {isEditing ? (
                        <input
                          type="text"
                          value={displayChunk.external_id}
                          onChange={(e) => setEditingChunk({ ...displayChunk, external_id: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      ) : (
                        displayChunk.external_id
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {isEditing ? (
                        <select
                          value={displayChunk.source_type}
                          onChange={(e) => setEditingChunk({ ...displayChunk, source_type: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        >
                          <option value="law">law</option>
                          <option value="manual">manual</option>
                          <option value="case">case</option>
                          <option value="standard_contract">standard_contract</option>
                        </select>
                      ) : (
                        getSourceTypeBadge(displayChunk.source_type)
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {isEditing ? (
                        <input
                          type="text"
                          value={displayChunk.title}
                          onChange={(e) => setEditingChunk({ ...displayChunk, title: e.target.value })}
                          className="w-full px-2 py-1 border border-gray-300 rounded"
                        />
                      ) : (
                        displayChunk.title || '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-md">
                      {isEditing ? (
                        <textarea
                          value={displayChunk.content}
                          onChange={(e) => setEditingChunk({ ...displayChunk, content: e.target.value })}
                          rows={3}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      ) : (
                        getSnippet(displayChunk.content, 80)
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {isEditing ? (
                        <input
                          type="number"
                          value={displayChunk.chunk_index ?? ''}
                          onChange={(e) => setEditingChunk({ ...displayChunk, chunk_index: e.target.value ? parseInt(e.target.value) : null })}
                          className="w-20 px-2 py-1 border border-gray-300 rounded"
                        />
                      ) : (
                        displayChunk.chunk_index !== null ? displayChunk.chunk_index : '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDate(displayChunk.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-2 items-center">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSave(chunk.id)}
                              disabled={isSaving}
                              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              {isSaving ? '저장 중...' : '저장'}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={isSaving}
                              className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                            >
                              취소
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleEdit(chunk)}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDelete(chunk.id, chunk.title)}
                              disabled={deletingId === chunk.id}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                            >
                              {deletingId === chunk.id ? '삭제 중...' : '삭제'}
                            </button>
                            <Link
                              href={`/admin/legal/${chunk.id}`}
                              className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                            >
                              상세
                            </Link>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

