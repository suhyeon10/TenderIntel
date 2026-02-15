'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SearchResultCard } from '@/components/legal/SearchResultCard'
import { Search, Loader2, FileText, Scale, BookOpen } from 'lucide-react'
import { searchLegalV2 } from '@/apis/legal.service'
import { cn } from '@/lib/utils'

export default function LegalSearchPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [selectedDocType, setSelectedDocType] = useState<string | undefined>(undefined)
  const [searchResults, setSearchResults] = useState<
    Array<{
      scenario: string
      riskLevel: 'high' | 'medium' | 'low'
      legalBasis: string
      recommendation: string
      relatedLaws?: string[]
      source?: string
      docType?: string
      title?: string
      sectionTitle?: string
      score?: number
    }>
  >([])
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      alert('검색어를 입력해주세요.')
      return
    }

    setIsSearching(true)
    setSearchResults([])
    setError(null)

    try {
      // v2 API로 법령 검색
      const result = await searchLegalV2(searchQuery, 10, selectedDocType)

      // v2 응답을 UI 형식으로 변환
      const results = result.results.map((item) => {
        // doc_type에 따라 riskLevel 추정 (점수 기반)
        let riskLevel: 'high' | 'medium' | 'low' = 'medium'
        if (item.score >= 0.8) {
          riskLevel = 'high'
        } else if (item.score < 0.5) {
          riskLevel = 'low'
        }

        return {
          scenario: item.text,
          riskLevel,
          legalBasis: item.text,
          recommendation: item.section_title || item.title || '',
          relatedLaws: item.source ? [item.source] : [],
          source: item.source,
          docType: item.doc_type,
          title: item.title,
          sectionTitle: item.section_title,
          score: item.score,
        }
      })

      setSearchResults(results)
    } catch (err: any) {
      console.error('검색 오류:', err)
      // 에러 타입별 처리
      if (err.message?.includes('400')) {
        setError('검색어를 올바르게 입력해주세요.')
      } else if (err.message?.includes('422')) {
        setError('검색어 형식이 올바르지 않습니다.')
      } else if (err.message?.includes('500')) {
        setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
      } else {
        setError(err.message || '검색 중 오류가 발생했습니다. 백엔드 서버가 실행 중인지 확인해주세요.')
      }
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className="container mx-auto px-6 py-12 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
          법률 검색
        </h1>
        <p className="text-lg text-slate-600">
          법적 상황을 입력하면 RAG 시스템이 관련 법률 시나리오와 대응 방법을 제공합니다.
        </p>
      </div>

      {/* 검색 입력 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-6 h-6 text-blue-600" />
            법적 상황 검색
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Input
                type="text"
                placeholder="예: 근로계약서에 최저임금 이하의 급여가 명시되어 있습니다..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1 text-lg py-6"
              />
              <Button
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg font-semibold"
                size="lg"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    검색 중...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    검색
                  </>
                )}
              </Button>
            </div>
            
            {/* 문서 타입 필터 */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-slate-700">문서 타입:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedDocType(undefined)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    selectedDocType === undefined
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-white border-2 border-slate-300 text-slate-700 hover:border-blue-400"
                  )}
                >
                  전체
                </button>
                <button
                  onClick={() => setSelectedDocType('law')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                    selectedDocType === 'law'
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-white border-2 border-slate-300 text-slate-700 hover:border-blue-400"
                  )}
                >
                  <Scale className="w-4 h-4" />
                  법령
                </button>
                <button
                  onClick={() => setSelectedDocType('standard_contract')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                    selectedDocType === 'standard_contract'
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-white border-2 border-slate-300 text-slate-700 hover:border-blue-400"
                  )}
                >
                  <FileText className="w-4 h-4" />
                  표준계약
                </button>
                <button
                  onClick={() => setSelectedDocType('case')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                    selectedDocType === 'case'
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-white border-2 border-slate-300 text-slate-700 hover:border-blue-400"
                  )}
                >
                  <BookOpen className="w-4 h-4" />
                  케이스
                </button>
              </div>
            </div>
            
            <p className="text-sm text-slate-500">
              법적 문제나 상황을 자세히 설명하면 더 정확한 검색 결과를 얻을 수 있습니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 에러 메시지 */}
      {error && (
        <Card className="border-red-200 bg-red-50 mb-8">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 검색 결과 */}
      {searchResults.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-slate-900">
              검색 결과 ({searchResults.length}개)
            </h2>
          </div>
          <div className="space-y-4">
            {searchResults.map((result, index) => (
              <SearchResultCard key={index} result={result} />
            ))}
          </div>
        </div>
      )}

      {/* 검색 결과 없음 */}
      {!isSearching && !error && searchResults.length === 0 && searchQuery && (
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-slate-600">검색 결과가 없습니다.</p>
            <p className="text-sm text-slate-500 mt-2">
              다른 키워드로 검색해보시거나 더 자세한 설명을 입력해주세요.
            </p>
          </CardContent>
        </Card>
      )}

      {/* 초기 상태 */}
      {!isSearching && searchResults.length === 0 && !searchQuery && (
        <Card className="text-center py-12">
          <CardContent>
            <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-lg text-slate-600 mb-2">법적 상황을 검색해보세요</p>
            <p className="text-sm text-slate-500">
              위의 검색창에 법적 문제나 상황을 입력하고 검색 버튼을 클릭하세요.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

