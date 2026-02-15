'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '../../../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card'
import { Loader2, AlertTriangle, Copy, FileText, Sparkles, Info, Scale, Clock, DollarSign, Users, Briefcase, TrendingUp, Zap, MessageSquare, XCircle, ExternalLink, Phone, Globe, BookOpen, Download, ArrowLeft } from 'lucide-react'
import { getSituationAnalysisByIdV2 } from '../../../../apis/legal.service'
import { useToast } from '../../../../hooks/use-toast'
import { cn } from '../../../../lib/utils'
import { MarkdownRenderer } from '../../../../components/rag/MarkdownRenderer'
import { RAGHighlightedMarkdown, RAGHighlightedText } from '../../../../components/legal/RAGHighlightedText'
import { LegalReportCard } from '../../../../components/legal/LegalReportCard'
import { ActionDashboard } from '../../../../components/legal/ActionDashboard'
import { LegalEmailHelper } from '../../../../components/legal/LegalEmailHelper'
import { parseSummary, findSectionByEmoji, removeEmojiFromTitle } from '../../../../utils/parseSummary'
import type { 
  SituationCategory, 
  SituationAnalysisResponse,
  RelatedCase
} from '../../../../types/legal'

// 카테고리 라벨 매핑
const getCategoryLabel = (category: SituationCategory): string => {
  const labels: Record<SituationCategory, string> = {
    harassment: '직장 내 괴롭힘',
    unpaid_wage: '임금 체불·무급 야근',
    unfair_dismissal: '부당해고',
    overtime: '근로시간 문제',
    probation: '수습·인턴 문제',
    freelancer: '프리랜서/용역',
    stock_option: '스톡옵션/성과급',
    other: '기타/복합 상황',
    unknown: '기타',
  }
  return labels[category] || '알 수 없음'
}

// 위험도 색상
const getRiskColor = (score: number): string => {
  if (score <= 30) return 'bg-green-500'
  if (score <= 70) return 'bg-yellow-500'
  return 'bg-red-500'
}

export default function SituationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const situationId = params.id as string

  const [loading, setLoading] = useState(true)
  const [analysisResult, setAnalysisResult] = useState<SituationAnalysisResponse | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 분석 결과 불러오기
  const loadAnalysis = useCallback(async () => {
    if (!situationId) return

    try {
      setLoading(true)
      setError(null)
      
      const { createSupabaseBrowserClient } = await import('../../../../supabase/supabase-client')
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id || null
      
      // DB에서 직접 answer 필드 조회
      const { data: dbAnalysisRaw, error: dbError } = await supabase
        .from('situation_analyses')
        .select('answer, analysis, risk_score, classified_type')
        .eq('id', situationId)
        .maybeSingle()
      
      if (dbError) {
        console.warn('DB 조회 오류:', dbError)
      }
      
      // 타입 단언으로 변환
      const dbAnalysis = dbAnalysisRaw as any
      
      const analysis = await getSituationAnalysisByIdV2(situationId, userId) as any
      
      if (!analysis && !dbAnalysis) {
        setError('분석 결과를 찾을 수 없습니다')
        return
      }
      
      setAnalysisId(situationId)
      
      // v2 응답을 v1 형식으로 변환
      const analysisData = analysis?.analysis || dbAnalysis?.analysis || {}
      
      // findings 찾기 (최상위 레벨 우선, 그 다음 analysis 내부, 마지막으로 dbAnalysis)
      const findingsArray = (analysis?.findings && Array.isArray(analysis.findings) && analysis.findings.length > 0)
        ? analysis.findings
        : (analysisData?.findings && Array.isArray(analysisData.findings) && analysisData.findings.length > 0)
        ? analysisData.findings
        : (dbAnalysis?.analysis?.findings && Array.isArray(dbAnalysis.analysis.findings) && dbAnalysis.analysis.findings.length > 0)
        ? dbAnalysis.analysis.findings
        : []
      
      // 디버깅: findings 데이터 확인
      console.log('[page.tsx] findings 데이터 확인:', {
        'analysis?.findings': analysis?.findings,
        'analysisData?.findings': analysisData?.findings,
        'dbAnalysis?.analysis?.findings': dbAnalysis?.analysis?.findings,
        'findingsArray': findingsArray,
        'findingsArray.length': findingsArray.length,
        'analysis 전체': analysis
      })
      
      // scripts 변환 - 이메일 템플릿 구조: {subject, body}
      const scriptsData = analysis?.scripts
      const scripts = scriptsData
        ? {
            toCompany: scriptsData.toCompany 
              ? (typeof scriptsData.toCompany === 'string'
                ? { subject: '근로계약 관련 확인 요청', body: scriptsData.toCompany }
                : scriptsData.toCompany)
              : undefined,
            toAdvisor: scriptsData.toAdvisor
              ? (typeof scriptsData.toAdvisor === 'string'
                ? { subject: '노무 상담 요청', body: scriptsData.toAdvisor }
                : scriptsData.toAdvisor)
              : undefined,
          }
        : {
            toCompany: undefined,
            toAdvisor: undefined,
          }
      
      // answer 필드를 summary로 사용 (DB에서 가져온 값 우선)
      const summaryText = dbAnalysis?.answer || analysisData?.summary || analysis?.analysis?.summary || ''
      
      const v1Format: SituationAnalysisResponse = {
        classifiedType: (analysis?.tags?.[0] || analysisData?.classifiedType || dbAnalysis?.classified_type || 'unknown') as SituationCategory,
        riskScore: analysis?.riskScore ?? dbAnalysis?.risk_score ?? analysisData?.riskScore ?? 0,
        summary: summaryText,
        // findings 사용 (최상위 레벨에 위치)
        findings: findingsArray,

        scripts: scripts,
        relatedCases: (analysis?.relatedCases || []).map((c: any) => {
          // 새 구조 (documentTitle, fileUrl, sourceType, externalId, overallSimilarity, summary, snippets)
          if (c?.documentTitle && c?.snippets) {
            return {
              documentTitle: c.documentTitle,
              fileUrl: c.fileUrl,
              sourceType: c.sourceType || 'law',
              externalId: c.externalId || '',
              overallSimilarity: c.overallSimilarity || 0,
              summary: c.summary || '',
              snippets: c.snippets || [],
            };
          }
          // 레거시 구조 (id, title, summary) - 하위 호환성
          return {
            documentTitle: c?.title || c?.documentTitle || '',
            fileUrl: c?.fileUrl,
            sourceType: c?.sourceType || 'law',
            externalId: c?.externalId || c?.id || '',
            overallSimilarity: c?.overallSimilarity || 0,
            summary: c?.summary || '',
            snippets: [{
              snippet: c?.summary || '',
              similarityScore: 0,
              usageReason: '',
            }],
          };
        }),
        sources: (analysis?.sources || []).map((source: any) => ({
          sourceId: source.sourceId || source.source_id || '',
          sourceType: (source.sourceType || source.source_type || 'law') as 'law' | 'manual' | 'case' | 'standard_contract',
          title: source.title || '',
          snippet: source.snippet || '',
          score: source.score || 0,
          externalId: source.externalId || source.external_id,
          fileUrl: source.fileUrl || source.file_url,
        })),
        organizations: analysis?.organizations || [],
      }
      
      setAnalysisResult(v1Format)
    } catch (err: any) {
      setError(err.message || '분석 결과를 불러오는 중 오류가 발생했습니다.')
      toast({
        title: '오류',
        description: err.message || '분석 결과를 불러오는 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [situationId, toast])

  useEffect(() => {
    loadAnalysis()
  }, [loadAnalysis])

  // 페이지 진입 시 상단으로 스크롤
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [situationId])

  // 분석 결과가 로드된 후 상단으로 스크롤
  useEffect(() => {
    if (!loading && analysisResult) {
      // 렌더링 완료를 위해 약간의 지연 후 스크롤
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }, 100)
    }
  }, [loading, analysisResult])

  const handleCopy = (text: string, description: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: '복사 완료',
      description,
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-lg font-medium text-slate-700">분석 결과를 불러오는 중...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !analysisResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
        <div className="container mx-auto px-4">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                오류
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 mb-4">{error || '분석 결과를 찾을 수 없습니다.'}</p>
              <Button onClick={() => router.push('/legal/situation')} variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                상황 분석 페이지로 돌아가기
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // summary를 섹션별로 파싱
  const sections = parseSummary(analysisResult.summary || '')
  const summarySection = findSectionByEmoji(sections, '📊')
  const legalViewSection = findSectionByEmoji(sections, '⚖️')
  const actionSection = findSectionByEmoji(sections, '🎯')
  const speakSection = findSectionByEmoji(sections, '💬')

  // 요약 텍스트 추출 (첫 줄만)
  const summaryText = summarySection?.content?.split('\n')[0] || summarySection?.content || ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* 분석 결과 */}
        <div id="analysis-result" className="space-y-6">
          {/* 1. 상단 헤더 영역 */}
          <Card className="border-2 border-blue-200 shadow-xl bg-gradient-to-br from-white to-blue-50/30">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-slate-900 text-center mb-4">
                사용자님의 상황 분석 결과입니다.
              </CardTitle>
              
              {/* 배지 영역 */}
              <div className="flex flex-wrap gap-2 justify-center mb-4">
                {/* 메인 카테고리 배지 */}
                <div className="px-3 py-1.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg shadow-md font-semibold text-sm flex items-center gap-2">
                  <span>🚨</span>
                  <span>{getCategoryLabel(analysisResult.classifiedType as SituationCategory)}</span>
                </div>
                
                {/* 위험도 배지 */}
                <div className={`px-3 py-1.5 rounded-lg shadow-md font-semibold text-sm flex items-center gap-2 text-white ${getRiskColor(analysisResult.riskScore)}`}>
                  <span>{analysisResult.riskScore <= 30 ? '✅' : analysisResult.riskScore <= 70 ? '⚠️' : '🚨'}</span>
                  <span>위험도 {analysisResult.riskScore}</span>
                </div>
                
                {/* findings 첫 번째 항목 배지 */}
                {analysisResult.findings && analysisResult.findings.length > 0 && (
                  <div className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg shadow-md font-semibold text-sm flex items-center gap-2">
                    <span>📋</span>
                    <span className="max-w-[200px] truncate">{analysisResult.findings[0].title || '법적 근거'}</span>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* 2. AI 법률 진단 리포트 블록 (기존 LegalReportCard 스타일 반영) */}
          <LegalReportCard 
            analysisResult={analysisResult}
            onCopy={handleCopy}
          />

          {/* 3. 실전 대응 대시보드 */}
          <ActionDashboard 
            classifiedType={analysisResult.classifiedType as SituationCategory}
            analysisId={analysisId}
            onCopy={handleCopy}
            organizations={analysisResult.organizations}
          />

          {/* 5. 행동 카드 (🎯 지금 당장 할 수 있는 행동) */}
          {actionSection && (
            <Card className="border-2 border-green-200 shadow-xl bg-gradient-to-br from-white to-green-50/30">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg shadow-md">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <span>{removeEmojiFromTitle(actionSection.title)}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-slate max-w-none">
                  <RAGHighlightedMarkdown 
                    content={actionSection.content}
                    sources={analysisResult.sources || []}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* 6. AI 전담 노무사 채팅 (말하기 스크립트 포함) */}
          <Card className="border-2 border-purple-300 shadow-xl bg-gradient-to-br from-white to-purple-50/30">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-md">
                  <MessageSquare className="w-5 h-5 text-white" />
                </div>
                <span>AI 전담 노무사와 상담하기</span>
              </CardTitle>
              <CardDescription>
                상황 분석 결과를 바탕으로 AI 노무사와 실시간 상담할 수 있습니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 말하기 팁 카드 */}
              {/* 이렇게 말해보세요 섹션 - Gmail 메일 작성 도우미 */}
              {(speakSection || analysisResult.scripts?.toCompany || analysisResult.scripts?.toAdvisor) && (
                <div className="space-y-4">
                  {speakSection?.content && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <h4 className="font-semibold text-slate-900 flex items-center gap-2 mb-3">
                        <span>💬</span>
                        <span>이렇게 말해보세요</span>
                      </h4>
                      <div className="prose prose-slate max-w-none text-sm">
                        <RAGHighlightedMarkdown 
                          content={speakSection.content}
                          sources={analysisResult.sources || []}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* 회사에 보낼 메일 */}
                  {analysisResult.scripts?.toCompany && (
                    <LegalEmailHelper
                      toEmail=""
                      recipientName="회사"
                      emailTemplate={analysisResult.scripts.toCompany}
                      title="회사에 이렇게 말해보세요"
                      description="아래 내용을 복사하거나 Gmail로 바로 보낼 수 있습니다."
                    />
                  )}
                  
                  {/* 노무사/기관에 보낼 메일 */}
                  {analysisResult.scripts?.toAdvisor && (
                    <LegalEmailHelper
                      toEmail=""
                      recipientName="노무사/상담 기관"
                      emailTemplate={analysisResult.scripts.toAdvisor}
                      title="노무사/상담 기관에 이렇게 말해보세요"
                      description="아래 내용을 복사하거나 Gmail로 바로 보낼 수 있습니다."
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 즉시 상담으로 돌아가기 버튼 */}
          <div className="flex justify-center mt-8 mb-8 px-4">
            <Button
              onClick={() => router.push('/legal/assist/quick')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-sm font-semibold rounded-lg shadow-sm transition-all min-w-[200px] w-auto max-w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="whitespace-nowrap">즉시 상담으로 돌아가기</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

