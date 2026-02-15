'use client'

import { Loader2, Download } from 'lucide-react'
import type { QueryResponse } from '@/types/rag'
import { MarkdownTable } from '@/components/rag/MarkdownTable'
import { MarkdownRenderer } from '@/components/rag/MarkdownRenderer'
import { Button } from '@/components/ui/button'
import {
  TechStackCard,
  BudgetCard,
  PeriodCard,
} from '@/components/rag/AnalysisSummaryCard'

interface RAGQueryResultViewProps {
  analysis: QueryResponse | null
  loading?: boolean
  onShowEvidence?: (chunkId: number) => void
}

export default function RAGQueryResultView({
  analysis,
  loading = false,
  onShowEvidence,
}: RAGQueryResultViewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (!analysis) {
    return null
  }

  // 분석 결과에서 정보 추출 (간단한 파싱)
  const extractInfo = () => {
    if (!analysis?.answer) return null

    const answer = analysis.answer
    const techStack: string[] = []
    const budget: { min?: number; max?: number; evidenceId?: number } = {}
    const period: { months?: number; evidenceId?: number } = {}

    // 간단한 파싱 (실제로는 더 정교한 파싱 필요)
    const techKeywords = ['React', 'Node.js', 'Python', 'Java', 'AWS', 'Docker', 'TypeScript', 'Vue', 'Angular', 'Spring', 'Django']
    techKeywords.forEach((tech) => {
      if (answer.includes(tech)) techStack.push(tech)
    })

    const budgetMatch = answer.match(/(\d+)\s*만?원?\s*[~-]\s*(\d+)\s*만?원?/i)
    if (budgetMatch) {
      budget.min = parseInt(budgetMatch[1]) * 10000
      budget.max = parseInt(budgetMatch[2]) * 10000
    }

    const periodMatch = answer.match(/(\d+)\s*개월/i)
    if (periodMatch) {
      period.months = parseInt(periodMatch[1])
    }

    // 근거 ID 추출
    const evidenceIds = answer.match(/\[id:(\d+)\]/g)?.map((m) => parseInt(m.replace(/\[id:|\]/g, ''))) || []
    if (evidenceIds.length > 0) {
      budget.evidenceId = evidenceIds[0]
      period.evidenceId = evidenceIds[0]
    }

    return { techStack, budget, period }
  }

  const info = extractInfo()

  return (
    <div className="space-y-6">
      {/* 추출된 정보 카드들 */}
      {info?.techStack && info.techStack.length > 0 && (
        <div className="rounded-2xl border border-slate-200/60 p-6 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4">요구기술</h3>
          <div className="flex flex-wrap gap-2.5">
            {info.techStack.map((tech, i) => (
              <span
                key={i}
                className="inline-flex items-center px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200/60 hover:border-blue-300 hover:from-blue-100 hover:to-indigo-100 transition-all duration-200"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}

      {info?.budget && (info.budget.min || info.budget.max) && (
        <BudgetCard
          min={info.budget.min}
          max={info.budget.max}
          evidenceId={info.budget.evidenceId}
        />
      )}

      {info?.period && info.period.months && (
        <PeriodCard
          months={info.period.months}
          evidenceId={info.period.evidenceId}
        />
      )}

      {/* 상세 분석 결과 */}
      {analysis.answer && (
        <div className="rounded-2xl border border-slate-200/60 p-6 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-gray-900">상세 분석</h3>
            <Button
              onClick={async () => {
                try {
                  const markdown = analysis.markdown || analysis.answer
                  const title = analysis.query || '분석_결과'
                  
                  const response = await fetch('/api/rag/query/download', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      markdown,
                      title,
                    }),
                  })

                  if (!response.ok) {
                    throw new Error('다운로드 실패')
                  }

                  const blob = await response.blob()
                  const url = window.URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${title.replace(/[^a-zA-Z0-9가-힣\s]/g, '_')}_${new Date().toISOString().split('T')[0]}.md`
                  document.body.appendChild(a)
                  a.click()
                  window.URL.revokeObjectURL(url)
                  document.body.removeChild(a)
                } catch (error) {
                  console.error('다운로드 오류:', error)
                  alert('다운로드 중 오류가 발생했습니다.')
                }
              }}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              마크다운 다운로드
            </Button>
          </div>
          
          {/* 표가 있는 경우 표로 렌더링 */}
          <MarkdownTable content={analysis.answer} />
          
          {/* 마크다운 렌더링 */}
          <div className="mt-4">
            <MarkdownRenderer 
              content={analysis.answer.replace(/\|.+\|[\n\r]+/g, '')} 
              className="text-slate-700"
            />
          </div>
        </div>
      )}
    </div>
  )
}

