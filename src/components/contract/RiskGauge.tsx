'use client'

import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { getSeverityFromScore, SEVERITY_COLORS, SEVERITY_LABELS } from './contract-design-tokens'

interface RiskGaugeProps {
  riskScore: number // 0-100
}

export function RiskGauge({ riskScore }: RiskGaugeProps) {
  const severity = getSeverityFromScore(riskScore)
  
  const getRiskColor = () => SEVERITY_COLORS[severity].textDark
  const getRiskBgColor = () => SEVERITY_COLORS[severity].bg
  const getRiskLabel = () => SEVERITY_LABELS[severity]

  const circumference = 2 * Math.PI * 90 // 반지름 90
  const offset = circumference - (riskScore / 100) * circumference

  return (
    <div className="rounded-2xl border border-slate-200 p-8 bg-white shadow-sm">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2 text-slate-900">전체 위험도</h2>
        <p className="text-sm text-slate-600">계약서의 전반적인 위험 수준을 평가합니다</p>
      </div>

      <div className="flex flex-col items-center">
        {/* 원형 게이지 */}
        <div className="relative w-64 h-64 mb-6">
          <svg className="transform -rotate-90 w-64 h-64">
            {/* 배경 원 */}
            <circle
              cx="128"
              cy="128"
              r="90"
              stroke="currentColor"
              strokeWidth="16"
              fill="none"
              className="text-slate-200"
            />
            {/* 진행 원 */}
            <circle
              cx="128"
              cy="128"
              r="90"
              stroke="currentColor"
              strokeWidth="16"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className={`transition-all duration-1000 ${getRiskColor()}`}
            />
          </svg>
          {/* 중앙 점수 */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={`text-6xl font-bold ${getRiskColor()}`}>
              {riskScore}
            </div>
            <div className={`text-sm font-medium mt-2 px-3 py-1 rounded-full ${getRiskBgColor()} ${getRiskColor()}`}>
              {getRiskLabel()}
            </div>
          </div>
        </div>

        {/* 위험도 설명 */}
        <div className={`w-full p-4 rounded-xl ${getRiskBgColor()}`}>
          <div className="flex items-start gap-3">
            {severity === 'high' ? (
              <AlertTriangle className={`w-5 h-5 mt-0.5 ${getRiskColor()}`} />
            ) : (
              <CheckCircle2 className={`w-5 h-5 mt-0.5 ${getRiskColor()}`} />
            )}
            <div>
              <p className={`font-medium ${getRiskColor()}`}>
                {severity === 'high'
                  ? '주의가 필요한 계약서입니다'
                  : severity === 'medium'
                  ? '일부 조항을 검토해보세요'
                  : '전반적으로 양호한 계약서입니다'}
              </p>
              <p className="text-sm text-slate-600 mt-1">
                {severity === 'high'
                  ? '문제가 될 수 있는 조항이 다수 발견되었습니다. 전문가 상담을 권장합니다.'
                  : severity === 'medium'
                  ? '일부 조항에 대해 추가 검토가 필요할 수 있습니다.'
                  : '주요 조항이 법령에 부합하는 것으로 보입니다.'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

