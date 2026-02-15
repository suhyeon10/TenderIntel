'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  BookOpen, 
  Search,
  Loader2,
  ArrowRight,
  ArrowLeft,
  FileText,
  Scale,
  CheckCircle2,
  AlertTriangle,
  MessageSquare,
  Sparkles,
  Copy,
  Phone
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { searchLegalCases, analyzeSituationV2, type SituationRequestV2 } from '@/apis/legal.service'
import type { LegalCasePreview } from '@/apis/legal.service'
import type { SituationAnalysisResponse } from '@/types/legal'

// 태그 추천
const RECOMMENDED_TAGS = [
  { tag: '#수습', category: 'probation' },
  { tag: '#근로시간', category: 'overtime' },
  { tag: '#해고', category: 'unfair_dismissal' },
  { tag: '#괴롭힘', category: 'harassment' },
  { tag: '#IP', category: 'other' },
  { tag: '#NDA', category: 'other' },
  { tag: '#임금체불', category: 'unpaid_wage' },
]

export default function CaseBasedAssistPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [situationText, setSituationText] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [cases, setCases] = useState<LegalCasePreview[]>([])
  const [selectedCase, setSelectedCase] = useState<LegalCasePreview | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [comparisonResult, setComparisonResult] = useState<SituationAnalysisResponse | null>(null)

  const handleSearch = async () => {
    if (!situationText.trim()) {
      toast({
        title: '상황을 입력해주세요',
        description: '어떤 상황인지 입력해주세요.',
        variant: 'destructive',
      })
      return
    }

    setIsSearching(true)
    try {
      const results = await searchLegalCases(situationText, 5)
      setCases(results)
      if (results.length > 0) {
        setSelectedCase(results[0])
      }
    } catch (error: any) {
      console.error('케이스 검색 오류:', error)
      toast({
        title: '검색 실패',
        description: error.message || '케이스 검색 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleCompareWithCase = async (caseItem: LegalCasePreview) => {
    if (!situationText.trim()) {
      toast({
        title: '상황을 먼저 입력해주세요',
        variant: 'destructive',
      })
      return
    }

    setIsAnalyzing(true)
    try {
      // v2 API 요청 형식
      const request: SituationRequestV2 = {
        situation: situationText.trim(),
        category: 'unknown',
      }

      const result = await analyzeSituationV2(request)
      
      // v2 응답을 v1 형식으로 변환 (기존 UI 호환성)
      const v1Format: SituationAnalysisResponse = {
        classifiedType: (result.tags[0] || 'unknown') as SituationAnalysisResponse['classifiedType'],
        riskScore: result.riskScore,
        summary: result.analysis.summary,
        criteria: result.analysis.legalBasis.map(basis => ({
          name: basis.title,
          status: 'likely' as const,
          reason: basis.snippet,
        })),
        actionPlan: {
          steps: [
            {
              title: '즉시 조치',
              items: result.checklist.slice(0, 3),
            },
            {
              title: '권고사항',
              items: result.analysis.recommendations,
            },
          ],
        },
        scripts: {
          toCompany: undefined,
          toAdvisor: undefined,
        },
        relatedCases: result.relatedCases.map(c => ({
          id: c.id,
          title: c.title,
          summary: c.summary,
        })),
      }
      
      setComparisonResult(v1Format)
      setSelectedCase(caseItem)
    } catch (error: any) {
      console.error('비교 분석 오류:', error)
      toast({
        title: '분석 실패',
        description: error.message || '비교 분석 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleTagClick = (tag: string) => {
    setSelectedTag(tag)
    setSituationText(prev => prev ? `${prev} ${tag}` : tag)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/legal/assist')}
            className="mb-6 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            상담 허브로 돌아가기
          </Button>
          
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-full mb-4 shadow-lg">
              <BookOpen className="w-5 h-5" />
              <span className="font-semibold">사례 기반 상담</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              어떤 상황이신가요?
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
              입력된 상황과 유사한 판례·상담 사례를 RAG 기반으로 추천하고,
              <br />
              내 상황과의 차이 비교 분석 및 단계별 행동 가이드를 제공합니다.
            </p>
          </div>
        </div>

        {/* 검색 영역 */}
        <Card className="border-2 border-purple-200 shadow-xl bg-white mb-8">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Search className="w-5 h-5 text-purple-600" />
              상황 검색
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Input
                value={situationText}
                onChange={(e) => setSituationText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSearch()
                  }
                }}
                placeholder="예: 수습 중인데 갑자기 해고 통보를 받았어요"
                className="text-base h-12 border-2 border-slate-300 focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              />
            </div>

            {/* 태그 추천 */}
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-2">태그 추천:</p>
              <div className="flex flex-wrap gap-2">
                {RECOMMENDED_TAGS.map((tagItem, index) => (
                  <button
                    key={index}
                    onClick={() => handleTagClick(tagItem.tag)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                      selectedTag === tagItem.tag
                        ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md"
                        : "bg-white border-2 border-slate-300 text-slate-700 hover:border-purple-400 hover:bg-purple-50"
                    )}
                  >
                    {tagItem.tag}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleSearch}
              disabled={isSearching || !situationText.trim()}
              className={cn(
                "w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isSearching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  검색 중...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  유사 사례 찾기
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 검색 결과 */}
        {cases.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-900">
                유사 사례 ({cases.length}개)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cases.map((caseItem) => (
                <Card
                  key={caseItem.id}
                  className={cn(
                    "border-2 cursor-pointer transition-all hover:shadow-lg",
                    selectedCase?.id === caseItem.id
                      ? "border-purple-500 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-lg"
                      : "border-slate-200 hover:border-purple-300"
                  )}
                  onClick={() => setSelectedCase(caseItem)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <FileText className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 mb-2 line-clamp-2">
                          {caseItem.title}
                        </h3>
                        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                          {caseItem.situation}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-3">
                      {caseItem.main_issues.slice(0, 3).map((issue, index) => (
                        <span
                          key={index}
                          className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium"
                        >
                          {issue}
                        </span>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full border-purple-300 hover:bg-purple-50 hover:border-purple-400"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleCompareWithCase(caseItem)
                      }}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing && selectedCase?.id === caseItem.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          분석 중...
                        </>
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4 mr-2" />
                          이 사례와의 차이는?
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* 비교 분석 결과 */}
        {comparisonResult && selectedCase && (
          <div className="mt-8 space-y-6">
            <Card className="border-2 border-purple-300 shadow-xl bg-gradient-to-br from-white to-purple-50/30">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <span className="font-bold">내 상황과의 차이점 분석</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 선택된 케이스 정보 */}
                <div className="border-2 border-purple-200 rounded-xl p-5 bg-gradient-to-br from-purple-50/80 to-indigo-50/50">
                  <h3 className="text-sm font-bold text-slate-900 mb-2">비교 대상 사례:</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{selectedCase.title}</p>
                </div>

                {/* 내 상황 */}
                <div className="border-2 border-blue-200 rounded-xl p-5 bg-gradient-to-br from-blue-50/80 to-indigo-50/50">
                  <h3 className="text-sm font-bold text-slate-900 mb-2">내 상황:</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{situationText}</p>
                </div>

                {/* 차이점 분석 */}
                <div className="border-2 border-slate-200 rounded-xl p-5 bg-white">
                  <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-blue-600" />
                    주요 차이점
                  </h3>
                  <div className="space-y-3">
                    {comparisonResult.criteria.map((criterion, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                          <span className="text-blue-600 font-bold text-xs">{index + 1}</span>
                        </div>
                        <p className="text-sm text-slate-700 leading-relaxed flex-1">
                          {criterion.reason || criterion.name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 행동 가이드 */}
                <div className="border-2 border-emerald-200 rounded-xl p-5 bg-gradient-to-br from-emerald-50/80 to-green-50/50">
                  <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    단계별 행동 가이드
                  </h3>
                  <div className="space-y-2">
                    {comparisonResult.actionPlan.steps.flatMap((step, stepIndex) =>
                      step.items.map((item, itemIndex) => (
                        <div
                          key={`step-${stepIndex}-item-${itemIndex}`}
                          className="flex items-start gap-2 text-sm text-slate-700"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 행동 버튼 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t-2 border-slate-200">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const textToCopy = comparisonResult.scripts.toCompany || comparisonResult.scripts.toAdvisor || ''
                      navigator.clipboard.writeText(textToCopy)
                      toast({
                        title: '복사 완료',
                        description: '수정 예시가 복사되었습니다.',
                      })
                    }}
                    className="border-slate-300 hover:bg-slate-50"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    수정 예시 복사
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      window.open('https://www.moel.go.kr/info/publict/publictNoticeView.do?bbs_seq=20241201001', '_blank')
                    }}
                    className="border-slate-300 hover:bg-slate-50"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    공공기관 연락처
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const caseData = {
                        situationText,
                        selectedCase,
                        comparisonResult,
                        timestamp: new Date().toISOString(),
                      }
                      localStorage.setItem('myCase', JSON.stringify(caseData))
                      toast({
                        title: '저장 완료',
                        description: '나의 상황이 저장되었습니다.',
                      })
                    }}
                    className="border-slate-300 hover:bg-slate-50"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    나의 상황 저장
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 검색 결과가 없을 때 */}
        {!isSearching && cases.length === 0 && situationText && (
          <Card className="border-2 border-slate-200 shadow-lg">
            <CardContent className="p-12 text-center">
              <Search className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                유사한 사례를 찾지 못했어요
              </h3>
              <p className="text-slate-600 mb-6">
                그래도 상담이 필요하다면, 바로 내 상황을 직접 입력해서 분석 받아보세요.
              </p>
              <Button
                onClick={() => router.push('/legal/assist/quick')}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                즉시 상담 받기
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

