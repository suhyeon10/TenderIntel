'use client'

import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface SearchResult {
  estimate_id: number
  estimate_version_id: number
  content_text: string
  content_type: string
  similarity: number
  metadata: {
    total_amount?: number
    start_date?: string
    end_date?: string
    milestone_count?: number
  }
}

interface EstimateRAGSearchProps {
  onResultSelect?: (estimateId: number, estimateVersionId: number) => void
  placeholder?: string
  className?: string
}

export default function EstimateRAGSearch({
  onResultSelect,
  placeholder = '견적서를 검색하세요... (예: "웹사이트 개발", "모바일 앱", "100만원 이하")',
  className = '',
}: EstimateRAGSearchProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('검색어를 입력해주세요.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/rag/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          options: {
            matchThreshold: 0.6, // 유사도 임계값
            matchCount: 10, // 최대 결과 수
          },
        }),
      })

      if (!response.ok) {
        throw new Error('검색에 실패했습니다.')
      }

      const data = await response.json()

      if (data.success) {
        setResults(data.results || [])
        if (data.results.length === 0) {
          setError('검색 결과가 없습니다.')
        }
      } else {
        throw new Error(data.error || '검색에 실패했습니다.')
      }
    } catch (err: any) {
      setError(err.message || '검색 중 오류가 발생했습니다.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading) {
      handleSearch()
    }
  }

  const formatAmount = (amount?: number) => {
    if (!amount) return '미정'
    return `${amount.toLocaleString()}원`
  }

  const formatDate = (date?: string) => {
    if (!date) return '미정'
    return new Date(date).toLocaleDateString('ko-KR')
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 검색 입력 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            className="pl-10"
            disabled={loading}
          />
        </div>
        <Button
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          className="min-w-[100px]"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              검색 중...
            </>
          ) : (
            <>
              <Search className="w-4 h-4 mr-2" />
              검색
            </>
          )}
        </Button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 검색 결과 */}
      {results.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm text-gray-600">
            {results.length}개의 견적서를 찾았습니다.
          </div>
          <div className="space-y-2">
            {results.map((result, index) => (
              <div
                key={`${result.estimate_id}-${result.estimate_version_id}-${index}`}
                className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() =>
                  onResultSelect?.(result.estimate_id, result.estimate_version_id)
                }
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 mb-1">
                      견적서 #{result.estimate_id}
                      {result.estimate_version_id && (
                        <span className="text-sm text-gray-500 ml-2">
                          (버전 {result.estimate_version_id})
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      유사도: {(result.similarity * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* 메타데이터 */}
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-2">
                  <div>
                    <span className="font-medium">총 금액:</span>{' '}
                    {formatAmount(result.metadata.total_amount)}
                  </div>
                  <div>
                    <span className="font-medium">기간:</span>{' '}
                    {result.metadata.start_date && result.metadata.end_date
                      ? `${formatDate(result.metadata.start_date)} ~ ${formatDate(result.metadata.end_date)}`
                      : '미정'}
                  </div>
                  {result.metadata.milestone_count !== undefined && (
                    <div>
                      <span className="font-medium">마일스톤:</span>{' '}
                      {result.metadata.milestone_count}개
                    </div>
                  )}
                </div>

                {/* 내용 미리보기 */}
                <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700 line-clamp-3">
                  {result.content_text.substring(0, 200)}
                  {result.content_text.length > 200 && '...'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

