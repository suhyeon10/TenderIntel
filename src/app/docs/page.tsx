'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Loader2, FileText, Calendar, Building2, Search, Download, CheckCircle2, X, BarChart3, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Money } from '@/components/common/Money'
import type { QueryResponse } from '@/types/rag'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface Document {
  id: string  // UUID
  title?: string
  source?: string
  agency?: string
  external_id?: string
  budget_min?: number
  budget_max?: number
  duration_months?: number
  start_date?: string
  end_date?: string
  status?: string
  created_at?: string
  updated_at?: string
}

export default function DocsPage() {
  const router = useRouter()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showCompare, setShowCompare] = useState(false)
  const [analysisResults, setAnalysisResults] = useState<Record<string, QueryResponse | null>>({})
  const [analyzingDocs, setAnalyzingDocs] = useState<Set<string>>(new Set())
  const [extractedMetadata, setExtractedMetadata] = useState<Record<string, {
    organization?: string
    budgetMin?: number
    budgetMax?: number
    durationMonths?: number
    startDate?: string
    endDate?: string
  }>>({})

  useEffect(() => {
    fetchDocuments()
  }, [])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/rag/docs?limit=100')
      
      if (!response.ok) {
        throw new Error('문서 목록을 불러오는데 실패했습니다')
      }
      
      const data = await response.json()
      setDocuments(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '문서 목록을 불러오는데 실패했습니다')
      console.error('문서 목록 조회 오류:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDocumentClick = (doc: Document) => {
    const docId = doc.id
    router.push(`/legal/contract/${docId}`)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '날짜 없음'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  const getDocumentTitle = (doc: Document) => {
    return doc.title || `문서 #${doc.id.substring(0, 8)}`
  }

  const getOrganization = (doc: Document) => {
    return doc.agency || '기관 정보 없음'
  }

  const filteredDocuments = documents.filter((doc) => {
    if (!searchTerm) return true
    const title = getDocumentTitle(doc).toLowerCase()
    const org = getOrganization(doc).toLowerCase()
    const search = searchTerm.toLowerCase()
    return title.includes(search) || org.includes(search)
  })

  const selectedDocuments = documents.filter((doc) => selectedIds.includes(doc.id))

  const toggleSelection = (docId: string) => {
    setSelectedIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    )
  }

  const handleCompare = async () => {
    if (selectedIds.length >= 2) {
      setShowCompare(true)
      // 각 문서에 대해 RAG 분석 수행
      await analyzeSelectedDocuments()
    }
  }

  const analyzeSelectedDocuments = async () => {
    const analyzingSet = new Set<string>()
    const results: Record<string, QueryResponse | null> = {}
    const metadataResults: Record<string, any> = {}

    // 모든 선택된 문서를 분석 중 상태로 설정
    selectedIds.forEach((id) => {
      analyzingSet.add(id)
      results[id] = null
      metadataResults[id] = null
    })
    setAnalyzingDocs(new Set(analyzingSet))
    setAnalysisResults(results)

    // 각 문서에 대해 병렬로 두 가지 분석 수행
    const analysisPromises = selectedIds.map(async (docId) => {
      try {
        // 1. 메타데이터 추출용 분석 (JSON 형식 요청)
        const metadataQuery = `다음 공고문에서 다음 정보를 JSON 형식으로만 추출해주세요. 값이 없으면 null로 표시하세요.

{
  "organization": "발주기관명 또는 기관명",
  "budgetMin": 최소예산숫자(원 단위),
  "budgetMax": 최대예산숫자(원 단위),
  "durationMonths": 기간개월수,
  "startDate": "시작일 (YYYY-MM-DD 형식)",
  "endDate": "종료일 (YYYY-MM-DD 형식)"
}

JSON 형식으로만 응답하고 다른 설명은 포함하지 마세요.`

        // 2. 상세 분석용 프롬프트
        const detailQuery = '이 공고의 핵심 요구사항, 예산 범위, 예상 기간, 필요 기술 스택을 마크다운 형식으로 구조화하여 요약해주세요.'

        // 백엔드 API URL
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000'
        
        // 백엔드 API 직접 호출 (특정 문서 ID로 필터링)
        const [metadataResponse, detailResponse] = await Promise.all([
          fetch(`${backendUrl}/api/v2/announcements/search?query=${encodeURIComponent(metadataQuery)}&limit=8&announcement_id=${docId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
          fetch(`${backendUrl}/api/v2/announcements/search?query=${encodeURIComponent(detailQuery)}&limit=8&announcement_id=${docId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }),
        ])

        if (!metadataResponse.ok || !detailResponse.ok) {
          const errorText = await metadataResponse.text().catch(() => '') || await detailResponse.text().catch(() => '')
          throw new Error(`백엔드 API 오류: ${errorText || '분석 실패'}`)
        }

        const metadataData = await metadataResponse.json()
        const detailData = await detailResponse.json()
        
        // 백엔드 응답 형식 변환
        const formatBackendResponse = (backendData: any) => ({
          answer: backendData.answer || backendData.markdown || '관련 정보를 찾을 수 없습니다.',
          markdown: backendData.markdown || backendData.answer || '',
          usedChunks: (backendData.results || []).map((r: any, idx: number) => ({
            id: idx,
            doc_id: r.announcement_id || docId,
            score: r.score || 0,
            content: r.content?.substring(0, 200) || '',
          })),
          query: backendData.query || '',
        })
        
        const formattedMetadataData = formatBackendResponse(metadataData)
        const formattedDetailData = formatBackendResponse(detailData)

        // 메타데이터 파싱 시도
        let parsedMetadata: any = {}
        try {
          // JSON 형식으로 응답이 왔는지 확인
          const metadataText = formattedMetadataData.answer || formattedMetadataData.markdown || ''
          
          // JSON 블록 추출 시도
          const jsonMatch = metadataText.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            parsedMetadata = JSON.parse(jsonMatch[0])
          } else {
            // JSON이 아닌 경우 텍스트에서 추출 시도
            parsedMetadata = parseMetadataFromText(metadataText)
          }
        } catch (parseError) {
          console.warn(`메타데이터 파싱 실패 (${docId}):`, parseError)
          // 텍스트에서 직접 추출 시도
          const metadataText = formattedMetadataData.answer || formattedMetadataData.markdown || ''
          parsedMetadata = parseMetadataFromText(metadataText)
        }

        return {
          docId,
          metadata: parsedMetadata,
          analysis: formattedDetailData,
        }
      } catch (error) {
        console.error(`문서 ${docId} 분석 실패:`, error)
        return { docId, metadata: {}, analysis: null }
      }
    })

    // 모든 분석이 완료될 때까지 대기
    const allResults = await Promise.all(analysisPromises)
    
    // 결과 업데이트
    const newResults: Record<string, QueryResponse | null> = {}
    const newMetadata: Record<string, any> = {}
    
    allResults.forEach(({ docId, metadata, analysis }) => {
      newResults[docId] = analysis
      newMetadata[docId] = metadata
      analyzingSet.delete(docId)
    })

    setAnalysisResults((prev) => ({ ...prev, ...newResults }))
    setExtractedMetadata((prev) => ({ ...prev, ...newMetadata }))
    setAnalyzingDocs(new Set(analyzingSet))
  }

  // 텍스트에서 메타데이터 추출 (JSON 파싱 실패 시 사용)
  const parseMetadataFromText = (text: string) => {
    const metadata: any = {}

    // 기관명 추출
    const orgPatterns = [
      /발주기관[:\s]*([^\n]+)/i,
      /기관명[:\s]*([^\n]+)/i,
      /수요기관[:\s]*([^\n]+)/i,
      /([가-힣]+(?:청|부|원|실|국|과|팀|센터|기관|공단|공사|공단|재단))[^\n]*/,
    ]
    for (const pattern of orgPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        metadata.organization = match[1].trim().split(/[,\n]/)[0]
        break
      }
    }

    // 예산 추출
    const budgetPatterns = [
      /예산[:\s]*([\d,]+)\s*만?원?\s*[~-]\s*([\d,]+)\s*만?원?/i,
      /총\s*예산[:\s]*([\d,]+)\s*만?원?/i,
      /([\d,]+)\s*만?원?\s*[~-]\s*([\d,]+)\s*만?원?/i,
    ]
    for (const pattern of budgetPatterns) {
      const match = text.match(pattern)
      if (match) {
        const parseAmount = (str: string) => {
          const num = parseInt(str.replace(/,/g, ''))
          return str.includes('만') ? num * 10000 : num
        }
        if (match[2]) {
          metadata.budgetMin = parseAmount(match[1])
          metadata.budgetMax = parseAmount(match[2])
        } else {
          const amount = parseAmount(match[1])
          metadata.budgetMin = amount
          metadata.budgetMax = amount
        }
        break
      }
    }

    // 기간 추출
    const periodPatterns = [
      /기간[:\s]*(\d+)\s*개월\s*[~-]\s*(\d+)\s*개월/i,
      /(\d+)\s*개월\s*[~-]\s*(\d+)\s*개월/i,
      /기간[:\s]*(\d+)\s*개월/i,
      /(\d+)\s*개월/i,
    ]
    for (const pattern of periodPatterns) {
      const match = text.match(pattern)
      if (match) {
        metadata.durationMonths = match[2] ? parseInt(match[2]) : parseInt(match[1])
        break
      }
    }

    // 날짜 추출
    const datePattern = /(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/g
    const dates: string[] = []
    let match
    while ((match = datePattern.exec(text)) !== null) {
      const year = match[1]
      const month = match[2].padStart(2, '0')
      const day = match[3].padStart(2, '0')
      dates.push(`${year}-${month}-${day}`)
    }
    if (dates.length >= 2) {
      metadata.startDate = dates[0]
      metadata.endDate = dates[dates.length - 1]
    } else if (dates.length === 1) {
      metadata.startDate = dates[0]
    }

    return metadata
  }

  const handleClearSelection = () => {
    setSelectedIds([])
    setShowCompare(false)
    setAnalysisResults({})
    setAnalyzingDocs(new Set())
    setExtractedMetadata({})
  }

  // 메타데이터가 있는 문서 정보 가져오기 (RAG 분석 결과 포함)
  const getDocumentMetadata = (doc: Document) => {
    const extracted = extractedMetadata[doc.id] || {}
    return {
      organization: doc.agency || extracted.organization || '기관 정보 없음',
      budgetMin: doc.budget_min || extracted.budgetMin,
      budgetMax: doc.budget_max || extracted.budgetMax,
      durationMonths: doc.duration_months || extracted.durationMonths,
      startDate: doc.start_date || extracted.startDate,
      endDate: doc.end_date || extracted.endDate,
    }
  }

  // 비교 차트 데이터
  const chartData = selectedDocuments.map((doc) => {
    const meta = getDocumentMetadata(doc)
    return {
      name: getDocumentTitle(doc).substring(0, 20) || `문서 ${doc.id.substring(0, 8)}`,
      예산: meta.budgetMin ? meta.budgetMin / 1000000 : 0, // 만원 단위
      기간: meta.durationMonths || (meta.startDate && meta.endDate
        ? Math.ceil(
            (new Date(meta.endDate).getTime() - new Date(meta.startDate).getTime()) /
              (1000 * 60 * 60 * 24 * 30)
          )
        : 0),
    }
  })

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-6 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">업로드된 문서 목록</h1>
          <p className="text-slate-600">
            업로드된 모든 문서를 확인하고 관리할 수 있습니다.
          </p>
        </div>

        {/* 선택 및 비교 컨트롤 */}
        {!showCompare && (
          <div className="mb-6 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              {selectedIds.length > 0 && `${selectedIds.length}개 선택됨`}
            </div>
            <div className="flex gap-2">
              {selectedIds.length > 0 && (
                <Button variant="outline" onClick={handleClearSelection}>
                  선택 해제
                </Button>
              )}
              <Button
                onClick={handleCompare}
                disabled={selectedIds.length < 2}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                비교하기 ({selectedIds.length})
              </Button>
            </div>
          </div>
        )}

        {/* 검색 바 */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="문서 제목이나 기관명으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-slate-600">문서 목록을 불러오는 중...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchDocuments} variant="outline">
              다시 시도
            </Button>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-200">
            <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-slate-600 text-lg mb-2">
              {searchTerm ? '검색 결과가 없습니다' : '업로드된 문서가 없습니다'}
            </p>
            {!searchTerm && (
              <Button
                onClick={() => router.push('/legal/contract')}
                className="mt-4"
              >
                문서 업로드하기
              </Button>
            )}
          </div>
        ) : showCompare ? (
          // 비교 모드
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold mb-2">문서 비교</h2>
                <p className="text-slate-600">
                  {selectedDocuments.length}개의 문서를 비교합니다.
                </p>
              </div>
              <Button variant="outline" onClick={handleClearSelection}>
                <X className="w-4 h-4 mr-2" />
                비교 종료
              </Button>
            </div>

            {/* 분석 중 표시 */}
            {analyzingDocs.size > 0 && (
              <div className="rounded-2xl border border-blue-200 p-6 bg-blue-50 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <div>
                    <h3 className="text-lg font-semibold text-blue-900">RAG 분석 진행 중</h3>
                    <p className="text-sm text-blue-700">
                      {analyzingDocs.size}개의 문서를 분석하고 있습니다. 잠시만 기다려주세요...
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {Array.from(analyzingDocs).map((docId) => {
                    const doc = documents.find((d) => d.id === docId)
                    return doc ? (
                      <div key={docId} className="flex items-center gap-2 text-sm text-blue-700">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{getDocumentTitle(doc)}</span>
                      </div>
                    ) : null
                  })}
                </div>
              </div>
            )}

            {/* 비교 그래프 */}
            {selectedDocuments.length >= 2 && analyzingDocs.size === 0 && (
              <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
                <h3 className="text-lg font-semibold mb-4">예산 및 기간 비교</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="예산" fill="#3B82F6" name="예산 (만원)" />
                    <Bar yAxisId="right" dataKey="기간" fill="#10B981" name="기간 (개월)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 상세 비교 테이블 */}
            <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
              <h3 className="text-lg font-semibold mb-4">상세 비교</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left p-3 font-semibold">항목</th>
                      {selectedDocuments.map((doc) => (
                        <th key={doc.id} className="text-left p-3 font-semibold">
                          {getDocumentTitle(doc).substring(0, 30)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="p-3 font-medium">기관명</td>
                      {selectedDocuments.map((doc) => {
                        const meta = getDocumentMetadata(doc)
                        const isExtracted = extractedMetadata[doc.id]?.organization && !doc.agency
                        return (
                          <td key={doc.id} className="p-3">
                            <div className="flex items-center gap-2">
                              <span>{meta.organization}</span>
                              {isExtracted && (
                                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                  RAG 추출
                                </span>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="p-3 font-medium">예산</td>
                      {selectedDocuments.map((doc) => {
                        const meta = getDocumentMetadata(doc)
                        const isExtracted = extractedMetadata[doc.id]?.budgetMin && !doc.budget_min
                        return (
                          <td key={doc.id} className="p-3">
                            {meta.budgetMin ? (
                              <div className="flex items-center gap-2">
                                <span>
                                  <Money amount={meta.budgetMin} />
                                  {meta.budgetMax && (
                                    <> ~ <Money amount={meta.budgetMax} /></>
                                  )}
                                </span>
                                {isExtracted && (
                                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                    RAG 추출
                                  </span>
                                )}
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                        )
                      })}
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="p-3 font-medium">기간</td>
                      {selectedDocuments.map((doc) => {
                        const meta = getDocumentMetadata(doc)
                        const isExtracted = extractedMetadata[doc.id]?.durationMonths && !doc.duration_months
                        return (
                          <td key={doc.id} className="p-3">
                            {meta.durationMonths ? (
                              <div className="flex items-center gap-2">
                                <span>{meta.durationMonths}개월</span>
                                {isExtracted && (
                                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                    RAG 추출
                                  </span>
                                )}
                              </div>
                            ) : meta.startDate && meta.endDate ? (
                              <div className="flex items-center gap-2">
                                <span>{formatDate(meta.startDate)} ~ {formatDate(meta.endDate)}</span>
                                {isExtracted && (
                                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                    RAG 추출
                                  </span>
                                )}
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                        )
                      })}
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="p-3 font-medium">출처</td>
                      {selectedDocuments.map((doc) => (
                        <td key={doc.id} className="p-3">
                          {doc.source || '-'}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="p-3 font-medium">상태</td>
                      {selectedDocuments.map((doc) => (
                        <td key={doc.id} className="p-3">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              doc.status === 'active'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {doc.status === 'active' ? '활성' : doc.status || '알 수 없음'}
                          </span>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="p-3 font-medium">생성일</td>
                      {selectedDocuments.map((doc) => (
                        <td key={doc.id} className="p-3">
                          {formatDate(doc.created_at)}
                        </td>
                      ))}
                    </tr>
                    {/* RAG 분석 결과 */}
                    <tr className="border-b border-slate-100">
                      <td className="p-3 font-medium">RAG 분석 결과</td>
                      {selectedDocuments.map((doc) => {
                        const analysis = analysisResults[doc.id]
                        const isAnalyzing = analyzingDocs.has(doc.id)
                        return (
                          <td key={doc.id} className="p-3">
                            {isAnalyzing ? (
                              <div className="flex items-center gap-2 text-sm text-blue-600">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>분석 중...</span>
                              </div>
                            ) : analysis ? (
                              <div className="space-y-2">
                                <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 max-h-32 overflow-y-auto">
                                  <div className="whitespace-pre-wrap line-clamp-4">
                                    {analysis.answer || analysis.markdown || '분석 결과 없음'}
                                  </div>
                                </div>
                                {analysis.usedChunks && analysis.usedChunks.length > 0 && (
                                  <div className="text-xs text-slate-500">
                                    {analysis.usedChunks.length}개의 근거 청크 사용
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">분석 실패</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* RAG 분석 결과 상세 보기 */}
            {analyzingDocs.size === 0 && Object.keys(analysisResults).length > 0 && (
              <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">RAG 분석 결과 상세</h3>
                    <p className="text-sm text-slate-500">각 문서에 대한 AI 분석 결과입니다</p>
                  </div>
                </div>
                <div className="space-y-6">
                  {selectedDocuments.map((doc) => {
                    const analysis = analysisResults[doc.id]
                    if (!analysis) return null

                    return (
                      <div key={doc.id} className="border border-slate-200 rounded-lg p-4">
                        <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          {getDocumentTitle(doc)}
                        </h4>
                        <div className="prose prose-sm max-w-none">
                          <div className="text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded border border-slate-200">
                            {analysis.answer || analysis.markdown || '분석 결과 없음'}
                          </div>
                        </div>
                        {analysis.usedChunks && analysis.usedChunks.length > 0 && (
                          <div className="mt-3 text-xs text-slate-500">
                            💡 {analysis.usedChunks.length}개의 문서 청크를 참조하여 분석했습니다
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 개별 문서 상세 보기 링크 */}
            <div className="flex gap-4 justify-end flex-wrap">
              {selectedDocuments.map((doc) => (
                <Button
                  key={doc.id}
                  variant="outline"
                  onClick={() => handleDocumentClick(doc)}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {getDocumentTitle(doc).substring(0, 20)} 상세보기
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDocuments.map((doc) => {
              const isSelected = selectedIds.includes(doc.id)
              return (
                <div
                  key={doc.id}
                  className={`bg-white rounded-xl shadow-sm border-2 p-6 hover:shadow-md transition-all group ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3 flex-1">
                      {/* 체크박스 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSelection(doc.id)
                        }}
                        className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300 hover:border-blue-500'
                        }`}
                      >
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        )}
                      </button>
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => handleDocumentClick(doc)}
                      >
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                          <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2 group-hover:text-blue-600 transition-colors">
                            {getDocumentTitle(doc)}
                          </h3>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        window.open(`/api/rag/docs/${doc.id}/download?format=txt`, '_blank')
                      }}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="문서 다운로드"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Building2 className="w-4 h-4" />
                    <span className="truncate">{getOrganization(doc)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                  {doc.budget_min && doc.budget_max && (
                    <div className="text-sm text-gray-600">
                      예산: {doc.budget_min.toLocaleString()}원 ~ {doc.budget_max.toLocaleString()}원
                    </div>
                  )}
                </div>

                  {doc.source && (
                    <div className="pt-4 border-t border-gray-100">
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                        {doc.source}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 통계 정보 */}
        {!loading && !error && documents.length > 0 && (
          <div className="mt-8 text-center text-sm text-gray-500">
            총 {documents.length}개의 문서가 있습니다
            {searchTerm && filteredDocuments.length !== documents.length && (
              <span className="ml-2">
                (검색 결과: {filteredDocuments.length}개)
              </span>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}

