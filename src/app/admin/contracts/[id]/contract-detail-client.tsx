'use client'

import { useState } from 'react'
import Link from 'next/link'

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

interface ContractChunk {
  id: string
  contract_id: string
  article_number: number | null
  paragraph_index: number | null
  content: string
  chunk_index: number | null
  chunk_type: string | null
  metadata: any
}

interface ContractDetailClientProps {
  analysis: ContractAnalysisDetail
  issues: ContractIssue[]
  chunks: ContractChunk[]
}

type TabType = 'clauses' | 'issues' | 'rag'

export default function ContractDetailClient({ analysis, issues, chunks }: ContractDetailClientProps) {
  const [activeTab, setActiveTab] = useState<TabType>('clauses')
  const [selectedIssue, setSelectedIssue] = useState<ContractIssue | null>(null)
  const [selectedClause, setSelectedClause] = useState<any | null>(null)

  // 위험 레벨 뱃지 스타일
  const getRiskLevelBadge = (level: string | null) => {
    if (!level) return <span className="text-gray-500">-</span>
    
    const styles = {
      high: 'border-red-500 text-red-600 bg-red-50',
      medium: 'border-orange-500 text-orange-600 bg-orange-50',
      low: 'border-green-500 text-green-600 bg-green-50',
    }
    
    const style = styles[level as keyof typeof styles] || 'border-gray-500 text-gray-600 bg-gray-50'
    
    return (
      <span className={`px-2 py-1 text-xs font-medium border rounded ${style}`}>
        {level.toUpperCase()}
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
  const getSnippet = (text: string | null, maxLength: number = 120) => {
    if (!text) return '-'
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  // 하이라이트 텍스트 렌더링
  const renderHighlightedTexts = () => {
    if (!analysis.highlighted_texts || !Array.isArray(analysis.highlighted_texts)) {
      return <div className="text-gray-500">하이라이트 정보가 없습니다.</div>
    }

    return (
      <div className="space-y-2">
        <h4 className="font-medium text-sm mb-2">하이라이트 목록:</h4>
        <div className="space-y-1">
          {analysis.highlighted_texts.map((highlight: any, index: number) => (
            <div
              key={index}
              className="p-2 border border-gray-200 rounded text-sm hover:bg-gray-50 cursor-pointer"
              onClick={() => {
                // 원문에서 해당 부분으로 스크롤 (간단한 구현)
                const element = document.getElementById('contract-text')
                if (element && highlight.startIndex !== undefined) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }}
            >
              <div className="flex gap-2 items-start">
                <span className="text-gray-500 text-xs">#{index + 1}</span>
                <div className="flex-1">
                  <div className="font-medium">{highlight.text || '-'}</div>
                  {highlight.severity && (
                    <span className="text-xs text-gray-500">Severity: {highlight.severity}</span>
                  )}
                  {highlight.issueId && (
                    <span className="text-xs text-gray-500 ml-2">Issue ID: {highlight.issueId}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* 뒤로가기 버튼 */}
      <Link
        href="/admin/contracts"
        className="inline-flex items-center text-blue-600 hover:text-blue-800 mb-4"
      >
        ← 목록으로
      </Link>

      {/* 상단 요약 카드 */}
      <div className="bg-white border border-gray-300 rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4">{analysis.file_name}</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-sm text-gray-500 mb-1">문서 타입</div>
            <div className="font-medium">{analysis.doc_type || '-'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">위험 점수</div>
            <div className="font-medium">{analysis.risk_score !== null ? analysis.risk_score : '-'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">위험 레벨</div>
            <div>{getRiskLevelBadge(analysis.risk_level)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">이슈 개수</div>
            <div className="font-medium">{issues.length}개</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">생성일시</div>
            <div className="font-medium">{formatDate(analysis.created_at)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Doc ID</div>
            <div className="font-mono text-xs">{analysis.doc_id}</div>
          </div>
        </div>
      </div>

      {/* 본문 영역: 좌우 2열 구조 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 좌측: 원문 + 하이라이트 */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-300 rounded-lg p-4">
            <h2 className="text-lg font-bold mb-3">원문 텍스트</h2>
            <div
              id="contract-text"
              className="max-h-96 overflow-y-auto p-3 bg-gray-50 rounded border text-sm whitespace-pre-wrap"
            >
              {analysis.contract_text || '원문 텍스트가 없습니다.'}
            </div>
          </div>
          <div className="bg-white border border-gray-300 rounded-lg p-4">
            <h2 className="text-lg font-bold mb-3">하이라이트 정보</h2>
            {renderHighlightedTexts()}
          </div>
        </div>

        {/* 우측: 탭 뷰 */}
        <div className="bg-white border border-gray-300 rounded-lg">
          {/* 탭 헤더 */}
          <div className="flex border-b border-gray-300">
            <button
              onClick={() => setActiveTab('clauses')}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === 'clauses'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Clauses
            </button>
            <button
              onClick={() => setActiveTab('issues')}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === 'issues'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Issues ({issues.length})
            </button>
            <button
              onClick={() => setActiveTab('rag')}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === 'rag'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              RAG Context
            </button>
          </div>

          {/* 탭 컨텐츠 */}
          <div className="p-4 max-h-[600px] overflow-y-auto">
            {activeTab === 'clauses' && (
              <div>
                <h3 className="font-bold mb-3">Clauses</h3>
                {!analysis.clauses || !Array.isArray(analysis.clauses) || analysis.clauses.length === 0 ? (
                  <div className="text-gray-500">Clauses 데이터가 없습니다.</div>
                ) : (
                  <div className="space-y-2">
                    <table className="min-w-full border border-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">ID</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">Title</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">Content</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {analysis.clauses.map((clause: any, index: number) => (
                          <tr
                            key={index}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => setSelectedClause(clause)}
                          >
                            <td className="px-3 py-2 text-sm">{clause.id || `clause-${index + 1}`}</td>
                            <td className="px-3 py-2 text-sm">{clause.title || '-'}</td>
                            <td className="px-3 py-2 text-sm text-gray-600">
                              {getSnippet(clause.content || clause.text, 120)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'issues' && (
              <div>
                <h3 className="font-bold mb-3">Issues</h3>
                {issues.length === 0 ? (
                  <div className="text-gray-500">이슈가 없습니다.</div>
                ) : (
                  <div className="space-y-2">
                    <table className="min-w-full border border-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">Severity</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">Category</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">Summary</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 border-b">Original Text</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {issues.map((issue) => (
                          <tr
                            key={issue.id}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => setSelectedIssue(issue)}
                          >
                            <td className="px-3 py-2 text-sm">{getRiskLevelBadge(issue.severity)}</td>
                            <td className="px-3 py-2 text-sm">{issue.category || '-'}</td>
                            <td className="px-3 py-2 text-sm">{issue.summary || '-'}</td>
                            <td className="px-3 py-2 text-sm text-gray-600">
                              {getSnippet(issue.original_text, 120)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'rag' && (
              <div>
                <h3 className="font-bold mb-3">이 분석에서 RAG로 사용된 컨텍스트</h3>
                {!analysis.retrieved_contexts ? (
                  <div className="text-gray-500">RAG 컨텍스트 데이터가 없습니다.</div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-2">Retrieved Contexts (JSON):</h4>
                      <pre className="p-3 bg-gray-50 rounded border text-xs overflow-x-auto max-h-96 overflow-y-auto">
                        {JSON.stringify(analysis.retrieved_contexts, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 이슈 상세 모달 */}
      {selectedIssue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">이슈 상세</h2>
              <button
                onClick={() => setSelectedIssue(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-500 mb-1">Severity</div>
                <div>{getRiskLevelBadge(selectedIssue.severity)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Category</div>
                <div className="font-medium">{selectedIssue.category || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Summary</div>
                <div>{selectedIssue.summary || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Original Text</div>
                <div className="p-3 bg-gray-50 rounded border whitespace-pre-wrap">
                  {selectedIssue.original_text || '-'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Explanation</div>
                <div className="p-3 bg-gray-50 rounded border whitespace-pre-wrap">
                  {selectedIssue.explanation || '-'}
                </div>
              </div>
              {selectedIssue.legal_basis && selectedIssue.legal_basis.length > 0 && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">Legal Basis</div>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedIssue.legal_basis.map((basis, index) => (
                      <li key={index}>{basis}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <div className="text-sm text-gray-500 mb-1">Suggested Revision</div>
                <div className="p-3 bg-gray-50 rounded border whitespace-pre-wrap">
                  {selectedIssue.suggested_revision || '-'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clause 상세 모달 */}
      {selectedClause && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Clause 상세</h2>
              <button
                onClick={() => setSelectedClause(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-500 mb-1">ID</div>
                <div className="font-medium">{selectedClause.id || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Title</div>
                <div className="font-medium">{selectedClause.title || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Content</div>
                <div className="p-3 bg-gray-50 rounded border whitespace-pre-wrap">
                  {selectedClause.content || selectedClause.text || '-'}
                </div>
              </div>
              {selectedClause.severity && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">Severity</div>
                  <div>{getRiskLevelBadge(selectedClause.severity)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Raw analysis_result 섹션 */}
      <div className="mt-6 bg-white border border-gray-300 rounded-lg p-4">
        <h2 className="text-lg font-bold mb-3">Raw analysis_result</h2>
        <pre className="p-3 bg-gray-50 rounded border text-xs overflow-x-auto max-h-96 overflow-y-auto">
          {JSON.stringify(analysis.analysis_result, null, 2)}
        </pre>
      </div>
    </div>
  )
}

