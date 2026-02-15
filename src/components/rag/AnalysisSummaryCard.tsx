'use client'

import { TagChip } from '@/components/common/TagChip'
import { EvidenceBadge } from '@/components/common/EvidenceBadge'
import { Money } from '@/components/common/Money'
import { Code, DollarSign, Calendar, AlertTriangle, Info } from 'lucide-react'

interface AnalysisItem {
  label: string
  value: string
  evidenceId?: number
}

interface AnalysisSummaryCardProps {
  title: string
  icon?: React.ReactNode
  items: AnalysisItem[]
  variant?: 'default' | 'risk' | 'info'
}

export function AnalysisSummaryCard({
  title,
  icon,
  items,
  variant = 'default',
}: AnalysisSummaryCardProps) {
  const getIcon = () => {
    if (icon) return icon
    if (variant === 'risk') return <AlertTriangle className="w-5 h-5 text-amber-500" />
    if (variant === 'info') return <Info className="w-5 h-5 text-blue-500" />
    return null
  }

  return (
    <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        {getIcon()}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <ul className="space-y-2 text-sm">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="flex-1 text-slate-700">
              <span className="font-medium">{item.label}:</span>{' '}
              <span>{item.value}</span>
              {item.evidenceId && (
                <EvidenceBadge
                  chunkId={item.evidenceId}
                  onShowEvidence={(id) => {
                    // 근거 패널 열기 로직
                    console.log('Show evidence:', id)
                  }}
                />
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// 특화된 카드 컴포넌트들
export function TechStackCard({ items }: { items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Code className="w-5 h-5 text-blue-500" />
        <h3 className="text-lg font-semibold">요구기술</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((tech, i) => (
          <TagChip key={i} label={tech} variant="tech" />
        ))}
      </div>
    </div>
  )
}

export function BudgetCard({
  min,
  max,
  evidenceId,
}: {
  min?: number
  max?: number
  evidenceId?: number
}) {
  const items: AnalysisItem[] = []
  if (min && max) {
    items.push({
      label: '예산 범위',
      value: `${min.toLocaleString()}원 ~ ${max.toLocaleString()}원`,
      evidenceId,
    })
  } else if (min) {
    items.push({
      label: '최소 예산',
      value: min.toLocaleString() + '원',
      evidenceId,
    })
  }

  return (
    <AnalysisSummaryCard
      title="예산 범위"
      icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
      items={items}
    />
  )
}

export function PeriodCard({
  months,
  evidenceId,
}: {
  months?: number
  evidenceId?: number
}) {
  const items: AnalysisItem[] = []
  if (months) {
    items.push({
      label: '예상 기간',
      value: `${months}개월`,
      evidenceId,
    })
  }

  return (
    <AnalysisSummaryCard
      title="예상 기간"
      icon={<Calendar className="w-5 h-5 text-purple-500" />}
      items={items}
    />
  )
}

