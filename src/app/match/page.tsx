'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Loader2, FileText, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { QueryResponse } from '@/types/rag'

export default function MatchPage() {
  const searchParams = useSearchParams()
  const docId = searchParams.get('docId')

  const [mode, setMode] = useState<'summary' | 'estimate' | 'match'>('summary')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QueryResponse | null>(null)

  const handleQuery = async () => {
    if (!query.trim()) {
      alert('질의를 입력해주세요')
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/rag/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode,
          query,
          topK: 8,
          withTeams: mode === 'match',
          docIds: docId ? [parseInt(docId)] : undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '질의 실패')
      }

      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error('질의 오류:', error)
      alert(error instanceof Error ? error.message : '질의 실패')
    } finally {
      setLoading(false)
    }
  }

  // 모드에 따른 기본 질의 설정
  useEffect(() => {
    if (mode === 'summary') {
      setQuery('이 공고의 핵심 요구사항, 예산 범위, 예상 기간을 요약해주세요.')
    } else if (mode === 'estimate') {
      setQuery('이 공고를 기반으로 견적 초안을 작성해주세요.')
    } else if (mode === 'match') {
      setQuery('이 공고에 적합한 팀을 추천해주세요.')
    }
  }, [mode])

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">RAG 질의 및 매칭</h1>
        <p className="text-gray-600">
          문서를 검색하고 AI가 요약, 견적, 매칭을 생성합니다.
        </p>
      </div>

      {/* 모드 선택 */}
      <div className="mb-6 flex gap-2">
        <Button
          variant={mode === 'summary' ? 'default' : 'outline'}
          onClick={() => setMode('summary')}
        >
          요약
        </Button>
        <Button
          variant={mode === 'estimate' ? 'default' : 'outline'}
          onClick={() => setMode('estimate')}
        >
          견적 초안
        </Button>
        <Button
          variant={mode === 'match' ? 'default' : 'outline'}
          onClick={() => setMode('match')}
        >
          팀 매칭
        </Button>
      </div>

      {/* 질의 입력 */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">질의</label>
        <div className="flex gap-2">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 p-3 border rounded-lg"
            rows={3}
            placeholder="질의를 입력하세요..."
          />
          <Button
            onClick={handleQuery}
            disabled={loading || !query.trim()}
            size="lg"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>

      {/* 결과 표시 */}
      {result && (
        <div className="space-y-6">
          {/* AI 답변 */}
          <div className="p-6 bg-white border rounded-lg">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl font-bold">AI 답변</h2>
            </div>
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap text-sm">{result.answer}</pre>
            </div>
          </div>

          {/* 사용된 청크 */}
          {result.usedChunks.length > 0 && (
            <div className="p-6 bg-gray-50 border rounded-lg">
              <h3 className="font-semibold mb-3">사용된 청크 ({result.usedChunks.length}개)</h3>
              <div className="space-y-2">
                {result.usedChunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="p-2 bg-white rounded text-sm flex justify-between"
                  >
                    <span>
                      [id:{chunk.id}] 문서 {chunk.doc_id}
                    </span>
                    <span className="text-gray-500">
                      유사도: {(chunk.score * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 매칭된 팀 */}
          {result.teams && result.teams.length > 0 && (
            <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold">매칭된 팀 ({result.teams.length}개)</h3>
              </div>
              <div className="space-y-3">
                {result.teams.map((team, index) => (
                  <div
                    key={team.team_id}
                    className="p-4 bg-white rounded-lg border"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-semibold">#{index + 1} 팀 ID: {team.team_id}</span>
                        {team.reason && (
                          <p className="text-sm text-gray-600 mt-1">{team.reason}</p>
                        )}
                      </div>
                      <span className="text-lg font-bold text-blue-600">
                        {(team.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${team.score * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

