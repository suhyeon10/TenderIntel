'use client'

import React from 'react'
import { FileText, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Clause {
  id: string
  title: string
  content: string
  articleNumber?: number
  category?: string
}

interface ClauseListProps {
  clauses: Clause[]
  selectedClauseId?: string
  onClauseClick?: (clauseId: string) => void
}

export function ClauseList({ clauses, selectedClauseId, onClauseClick }: ClauseListProps) {
  if (!clauses || clauses.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">조항 정보가 없습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {clauses.map((clause) => (
          <button
            key={clause.id}
            onClick={() => onClauseClick?.(clause.id)}
            className={cn(
              "w-full text-left p-3 rounded-lg border transition-all cursor-pointer",
              "hover:bg-slate-50 hover:border-blue-300",
              selectedClauseId === clause.id
                ? "bg-blue-50 border-blue-400 shadow-sm"
                : "bg-white border-slate-200"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {clause.articleNumber && (
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-600 text-white text-sm font-bold rounded">
                      {clause.articleNumber}
                    </span>
                  )}
                  <span className="font-medium text-slate-900 truncate">
                    {clause.title}
                  </span>
                </div>
                {clause.category && (
                  <span className="text-xs text-slate-500">
                    {getCategoryLabel(clause.category)}
                  </span>
                )}
                <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                  {clause.content.substring(0, 100)}...
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    working_hours: '근로시간',
    wage: '임금',
    probation_termination: '수습/해지',
    stock_option_ip: '스톡옵션/IP',
    vacation: '휴가',
    overtime: '연장근로',
    benefits: '복리후생',
  }
  return labels[category] || category
}

