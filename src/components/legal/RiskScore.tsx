'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'

interface RiskScoreProps {
  score: number // 0-100
  label?: string
}

export function RiskScore({ score, label = '위험도 점수' }: RiskScoreProps) {
  const getRiskLevel = (score: number) => {
    if (score >= 70) return { level: 'high', color: 'red', text: '높음', icon: AlertTriangle }
    if (score >= 40) return { level: 'medium', color: 'amber', text: '보통', icon: Info }
    return { level: 'low', color: 'emerald', text: '낮음', icon: CheckCircle2 }
  }

  const risk = getRiskLevel(score)
  const Icon = risk.icon

  const colorClasses = {
    red: {
      bg: 'bg-red-50',
      text: 'text-red-600',
      border: 'border-red-200',
      progress: 'bg-red-500',
    },
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-600',
      border: 'border-amber-200',
      progress: 'bg-amber-500',
    },
    emerald: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'border-emerald-200',
      progress: 'bg-emerald-500',
    },
  }

  const colors = colorClasses[risk.color as keyof typeof colorClasses]

  return (
    <Card className={`${colors.bg} ${colors.border} border-2`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={`w-6 h-6 ${colors.text}`} />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold text-slate-900">{score}점</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${colors.text} ${colors.bg}`}>
              {risk.text}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full ${colors.progress} transition-all duration-500 ease-out`}
              style={{ width: `${score}%` }}
            />
          </div>
          <p className="text-sm text-slate-600">
            {score >= 70
              ? '법적 위험이 높습니다. 전문가 상담을 권장합니다.'
              : score >= 40
              ? '일부 법적 리스크가 있습니다. 주의가 필요합니다.'
              : '법적 위험이 낮습니다. 안전한 수준입니다.'}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

