'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download, FileText, BookOpen } from 'lucide-react'
import { MarkdownRenderer } from '@/components/rag/MarkdownRenderer'
import type { AnalysisJSON, RAGReference } from '@/types/legal'
import { cn } from '@/lib/utils'

interface DiagnosisReportProps {
  analysis: AnalysisJSON
  onDownload?: (reference: RAGReference) => void
}

/**
 * 진단 리포트 섹션 컴포넌트 (Paper UI 스타일)
 * 종이 질감, 전문적인 보고서 스타일
 */
export function DiagnosisReport({ analysis, onDownload }: DiagnosisReportProps) {
  const summary = analysis.summary || ''
  const ragReferences = analysis.rag_references || []

  return (
    <Card className="relative overflow-hidden">
      {/* 종이 질감 배경 효과 */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 via-white to-amber-50/30 pointer-events-none" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmOWY5ZjkiIGZpbGwtb3BhY2l0eT0iMC40Ij48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-20 pointer-events-none" />
      
      <CardHeader className="relative border-b border-amber-200/50 bg-gradient-to-r from-amber-50/80 to-white">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center shadow-sm">
            <FileText className="h-6 w-6 text-amber-700" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-slate-800">
              전문가 진단 리포트
            </CardTitle>
            <p className="text-sm text-slate-600 mt-1">
              법률 전문가가 분석한 상세 진단 결과
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative p-8 space-y-8">
        {/* 진단 요약 */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-800 border-b border-amber-200 pb-2">
            📊 진단 요약
          </h3>
          <div className="prose prose-slate max-w-none">
            <div className="bg-white/80 rounded-lg p-6 border border-amber-100 shadow-sm">
              <MarkdownRenderer content={summary} />
            </div>
          </div>
        </section>

        {/* RAG 근거 자료 */}
        {ragReferences.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 border-b border-amber-200 pb-2">
              📚 참고 법령 및 근거 자료
            </h3>
            <div className="space-y-4">
              {ragReferences.map((reference, index) => (
                <div
                  key={reference.chunk_id || index}
                  className="bg-white/90 rounded-lg p-5 border border-amber-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-amber-600" />
                        <h4 className="font-semibold text-slate-800">
                          {reference.title}
                        </h4>
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        {reference.summary}
                      </p>
                    </div>
                    {reference.download_info && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDownload?.(reference)}
                        className="flex-shrink-0 border-amber-200 text-amber-700 hover:bg-amber-50"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        원본 다운로드
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 위험도 점수 표시 */}
        {analysis.risk_score !== undefined && (
          <section className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 border-b border-amber-200 pb-2">
              ⚠️ 위험도 평가
            </h3>
            <div className="bg-white/90 rounded-lg p-6 border border-amber-100 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold text-slate-800">
                  {analysis.risk_score}
                </div>
                <div className="flex-1">
                  <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full transition-all duration-500',
                        analysis.risk_score >= 70
                          ? 'bg-gradient-to-r from-red-500 to-red-600'
                          : analysis.risk_score >= 40
                          ? 'bg-gradient-to-r from-yellow-500 to-yellow-600'
                          : 'bg-gradient-to-r from-green-500 to-green-600'
                      )}
                      style={{ width: `${analysis.risk_score}%` }}
                    />
                  </div>
                  <p className="text-sm text-slate-600 mt-2">
                    {analysis.risk_score >= 70
                      ? '높은 위험도 - 즉시 조치 권장'
                      : analysis.risk_score >= 40
                      ? '중간 위험도 - 주의 필요'
                      : '낮은 위험도 - 지속 모니터링 권장'}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}
      </CardContent>
    </Card>
  )
}

