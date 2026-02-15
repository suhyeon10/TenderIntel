'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, AlertTriangle, Lightbulb, Scale, BookOpen, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchResult {
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
}

interface SearchResultCardProps {
  result: SearchResult
}

export function SearchResultCard({ result }: SearchResultCardProps) {
  const riskColors = {
    high: {
      bg: 'bg-red-50',
      text: 'text-red-600',
      border: 'border-red-200',
      label: '높음',
    },
    medium: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      border: 'border-amber-200',
      label: '보통',
    },
    low: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'border-emerald-200',
      label: '낮음',
    },
  }

  const docTypeLabels: Record<string, { label: string; icon: typeof FileText; color: string }> = {
    law: { label: '법령', icon: Scale, color: 'bg-blue-100 text-blue-700' },
    standard_contract: { label: '표준계약', icon: FileText, color: 'bg-purple-100 text-purple-700' },
    case: { label: '케이스', icon: BookOpen, color: 'bg-green-100 text-green-700' },
    manual: { label: '매뉴얼', icon: FileText, color: 'bg-slate-100 text-slate-700' },
  }

  const colors = riskColors[result.riskLevel]
  const docTypeInfo = result.docType ? docTypeLabels[result.docType] : null
  const DocTypeIcon = docTypeInfo?.icon || FileText

  return (
    <Card className={cn(`${colors.border} border-2 hover:shadow-lg transition-shadow`)}>
      <CardHeader>
        <div className="space-y-3">
          {/* 상단: 제목과 위험도 */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {result.title && (
                <div className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-2">
                  {docTypeInfo && (
                    <span className={cn("px-2 py-0.5 rounded text-[10px] flex items-center gap-1", docTypeInfo.color)}>
                      <DocTypeIcon className="w-3 h-3" />
                      {docTypeInfo.label}
                    </span>
                  )}
                  {result.sectionTitle && (
                    <span className="text-slate-400">· {result.sectionTitle}</span>
                  )}
                </div>
              )}
              <CardTitle className="text-lg leading-relaxed">{result.scenario}</CardTitle>
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <span className={cn(`px-3 py-1 rounded-full text-sm font-medium ${colors.text} ${colors.bg}`)}>
                {colors.label}
              </span>
              {result.score !== undefined && (
                <span className="text-xs text-slate-500">
                  관련도: {(result.score * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>

          {/* 출처 정보 */}
          {(result.source || result.title) && (
            <div className="flex items-center gap-2 text-xs text-slate-500 pt-2 border-t border-slate-200">
              {result.source && (
                <span className="flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  출처: {result.source}
                </span>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 법적 근거 */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-start gap-2 mb-2">
            <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <h4 className="font-medium text-blue-900">법적 근거</h4>
          </div>
          <p className="text-sm text-blue-800 ml-7 leading-relaxed">{result.legalBasis}</p>
        </div>

        {/* 추천 대응 */}
        {result.recommendation && (
          <div className="bg-emerald-50 p-4 rounded-lg">
            <div className="flex items-start gap-2 mb-2">
              <Lightbulb className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <h4 className="font-medium text-emerald-900">추천 대응 방법</h4>
            </div>
            <p className="text-sm text-emerald-800 ml-7 leading-relaxed">{result.recommendation}</p>
          </div>
        )}

        {/* 관련 법률 */}
        {result.relatedLaws && result.relatedLaws.length > 0 && (
          <div className="bg-slate-50 p-4 rounded-lg">
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-slate-600 mt-0.5 flex-shrink-0" />
              <h4 className="font-medium text-slate-900">관련 법률</h4>
            </div>
            <ul className="list-disc list-inside text-sm text-slate-700 ml-7 space-y-1">
              {result.relatedLaws.map((law, index) => (
                <li key={index}>{law}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

