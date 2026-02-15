'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, FileText, CheckCircle2, XCircle, AlertCircle, Calendar, Hash } from 'lucide-react'
import { MarkdownRenderer } from '@/components/rag/MarkdownRenderer'
import type { AnalysisJSON, RAGReference, LegalCriteria, SituationSummary } from '@/types/legal'
import { cn } from '@/lib/utils'

interface DiagnosisReportV2Props {
  analysis: AnalysisJSON
  reportId?: string
  analysisDate?: string
  onDownload?: (reference: RAGReference) => void
}

/**
 * AI 법률 진단 리포트 컴포넌트 (Paper UI Style)
 * 전문적인 종이 보고서 느낌, 좌측/우측 레이아웃
 */
export function DiagnosisReportV2({ 
  analysis, 
  reportId,
  analysisDate,
  onDownload 
}: DiagnosisReportV2Props) {
  const summary = analysis.summary || ''
  const situationSummary = analysis.situation_summary
  const legalCriteria = analysis.legal_criteria || []
  const ragReferences = analysis.rag_references || []

  const getCriteriaStatusIcon = (status: LegalCriteria['status']) => {
    switch (status) {
      case 'fulfilled':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case 'unclear':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />
      case 'not_fulfilled':
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <AlertCircle className="h-5 w-5 text-slate-400" />
    }
  }

  const getCriteriaStatusText = (status: LegalCriteria['status']) => {
    switch (status) {
      case 'fulfilled':
        return '충족'
      case 'unclear':
        return '불명확'
      case 'not_fulfilled':
        return '미충족'
      default:
        return '알 수 없음'
    }
  }

  return (
    <Card className="relative overflow-hidden shadow-lg border-2 border-amber-200/50">
      {/* 종이 질감 배경 효과 */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50/60 via-white to-amber-50/40 pointer-events-none" />
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.1) 2px,
            rgba(0,0,0,0.1) 4px
          )`
        }}
      />
      
      {/* 헤더 */}
      <CardHeader className="relative border-b-2 border-amber-300/50 bg-gradient-to-r from-amber-50/90 via-white to-amber-50/90">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center shadow-md border-2 border-amber-200">
              <FileText className="h-7 w-7 text-amber-700" />
            </div>
            <div>
              <CardTitle className="text-3xl font-bold text-slate-800 mb-1">
                📋 AI 법률 진단 리포트
              </CardTitle>
              <div className="flex items-center gap-4 text-sm text-slate-600">
                {analysisDate && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>분석 일시: {new Date(analysisDate).toLocaleString('ko-KR')}</span>
                  </div>
                )}
                {reportId && (
                  <div className="flex items-center gap-1">
                    <Hash className="h-4 w-4" />
                    <span className="font-mono text-xs">ID: {reportId.slice(0, 8)}...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 좌측: 상황 분석 */}
          <div className="space-y-6">
            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-amber-200">
                📊 상황 분석
              </h3>
              
              {/* 요약 멘트 */}
              {situationSummary && (
                <div className="bg-white/90 rounded-lg p-5 border-2 border-amber-100 shadow-sm mb-4">
                  <p className="text-base text-slate-800 leading-relaxed">
                    사용자님은 현재 <span className="font-semibold text-amber-700">'{situationSummary.category}'</span> 상황입니다.
                  </p>
                </div>
              )}
              
              {/* 법적 판단 기준 체크리스트 */}
              {legalCriteria.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                    법적 판단 기준
                  </h4>
                  <div className="bg-white/90 rounded-lg p-4 border-2 border-amber-100 shadow-sm space-y-2">
                    {legalCriteria.map((criterion) => (
                      <div
                        key={criterion.id}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-lg border transition-all',
                          criterion.status === 'fulfilled'
                            ? 'bg-green-50/50 border-green-200'
                            : criterion.status === 'unclear'
                            ? 'bg-yellow-50/50 border-yellow-200'
                            : 'bg-red-50/50 border-red-200'
                        )}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {getCriteriaStatusIcon(criterion.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-slate-800">
                              {criterion.name}
                            </span>
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded',
                              criterion.status === 'fulfilled'
                                ? 'bg-green-100 text-green-700'
                                : criterion.status === 'unclear'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                            )}>
                              {getCriteriaStatusText(criterion.status)}
                            </span>
                          </div>
                          {criterion.description && (
                            <p className="text-sm text-slate-600 mt-1">
                              {criterion.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* 우측/하단: 근거 자료 (RAG Sources - 논문 각주 스타일) */}
          <div className="space-y-6">
            <section>
              <h3 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b-2 border-amber-200">
                📚 참고 법령 및 근거 자료
              </h3>
              
              {ragReferences.length > 0 ? (
                <div className="space-y-4">
                  {ragReferences.map((reference, index) => (
                    <div
                      key={reference.chunk_id || index}
                      className="bg-white/90 rounded-lg p-5 border-2 border-amber-100 shadow-sm hover:shadow-md transition-all"
                    >
                      {/* 배지 스타일 */}
                      <div className="mb-3">
                        <span className="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                          <span>관련 근거:</span>
                          <span className="font-normal">
                            {reference.title}
                            {reference.source_agency && ` (${reference.source_agency})`}
                          </span>
                        </span>
                      </div>
                      
                      {/* 법령 원문 요약 */}
                      <p className="text-sm text-slate-700 leading-relaxed mb-3 pl-4 border-l-2 border-amber-200">
                        {reference.summary}
                      </p>
                      
                      {/* 다운로드 버튼 */}
                      {reference.download_info && (
                        <div className="flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onDownload?.(reference)}
                            className="border-amber-200 text-amber-700 hover:bg-amber-50"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            원본 다운로드
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 bg-white/50 rounded-lg border-2 border-dashed border-amber-200">
                  <p>참고 법령 정보가 없습니다.</p>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* 하단: 전체 요약 (전체 너비) */}
        <div className="mt-8 pt-6 border-t-2 border-amber-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">
            📝 종합 요약
          </h3>
          <div className="bg-white/90 rounded-lg p-6 border-2 border-amber-100 shadow-sm">
            <div className="prose prose-slate max-w-none">
              <MarkdownRenderer content={summary} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

