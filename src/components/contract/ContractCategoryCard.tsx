'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react'

export interface ContractIssue {
  clause: string // 문제 조항
  reason: string // 근거 법령
  standardClause?: string // 표준계약 문장
  recommendation: string // 권장 대응
}

export interface ContractCategoryData {
  category: string
  riskScore: number // 0-100
  issues: ContractIssue[]
  icon: React.ComponentType<{ className?: string }>
}

interface ContractCategoryCardProps {
  data: ContractCategoryData
}

export function ContractCategoryCard({ data }: ContractCategoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const Icon = data.icon

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-red-600 bg-red-50 border-red-200'
    if (score >= 40) return 'text-amber-600 bg-amber-50 border-amber-200'
    return 'text-emerald-600 bg-emerald-50 border-emerald-200'
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      {/* 카드 헤더 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-6 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-4 flex-1">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getRiskColor(data.riskScore)}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">{data.category}</h3>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${data.riskScore >= 70 ? 'text-red-600' : data.riskScore >= 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
                위험도: {data.riskScore}점
              </span>
              {data.issues.length > 0 && (
                <span className="text-xs text-slate-500">
                  ({data.issues.length}개 문제 조항 발견)
                </span>
              )}
            </div>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {/* 확장된 내용 */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-slate-200 pt-6 space-y-4">
          {data.issues.length === 0 ? (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <p className="text-sm text-emerald-800">이 카테고리에서 발견된 문제 조항이 없습니다.</p>
            </div>
          ) : (
            data.issues.map((issue, index) => (
              <div key={index} className="p-4 bg-slate-50 rounded-xl space-y-3">
                {/* 문제 조항 */}
                <div>
                  <div className="flex items-start gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-slate-500 mb-1">문제될 수 있는 조항</p>
                      <p className="text-sm text-slate-900 bg-yellow-50 p-2 rounded border border-yellow-200">
                        {issue.clause}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 근거 법령 (법령이 있는 경우에만 표시) */}
                {issue.reason && issue.reason.trim() && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">근거가 되는 법령</p>
                  <p className="text-sm text-slate-700 bg-blue-50 p-2 rounded border border-blue-200">
                    {issue.reason}
                  </p>
                </div>
                )}

                {/* 표준계약 문장 (있는 경우) */}
                {issue.standardClause && (
                  <div>
                    <p className="text-xs font-medium text-slate-500 mb-1">표준계약 문장</p>
                    <p className="text-sm text-slate-700 bg-emerald-50 p-2 rounded border border-emerald-200">
                      {issue.standardClause}
                    </p>
                  </div>
                )}

                {/* 권장 대응 */}
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">권장 대응</p>
                  <p className="text-sm text-slate-900 bg-purple-50 p-2 rounded border border-purple-200">
                    {issue.recommendation}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

