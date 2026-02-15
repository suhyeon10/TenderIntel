'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'

interface PhaseIndicatorProps {
  phase: string
  status: 'completed' | 'active' | 'pending'
  label: string
}

function PhaseIndicator({ phase, status, label }: PhaseIndicatorProps) {
  const Icon =
    status === 'completed' ? CheckCircle2 : status === 'active' ? Loader2 : Circle
  const color =
    status === 'completed'
      ? 'text-green-600'
      : status === 'active'
        ? 'text-blue-600 animate-spin'
        : 'text-gray-400'

  return (
    <div className="flex items-center gap-3">
      <Icon className={`w-5 h-5 ${color}`} />
      <span className={`text-sm ${status === 'active' ? 'font-semibold' : ''}`}>
        {label}
      </span>
    </div>
  )
}

interface AnalysisProgressProps {
  docId: string
  onComplete?: () => void
}

export function AnalysisProgress({ docId, onComplete }: AnalysisProgressProps) {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState('')
  const [currentPhase, setCurrentPhase] = useState<
    'upload' | 'metadata' | 'analysis' | 'matching' | 'estimates' | 'completed'
  >('upload')

  useEffect(() => {
    // Server-Sent Events로 실시간 업데이트
    const eventSource = new EventSource(`/api/analysis/stream/${docId}`)

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setProgress(data.progress || 0)
      setPhase(data.message || '')
      setCurrentPhase(data.phase || 'upload')

      if (data.status === 'completed' && onComplete) {
        eventSource.close()
        onComplete()
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [docId, onComplete])

  const phases = [
    { key: 'upload', label: '문서 업로드' },
    { key: 'metadata', label: '메타데이터 추출' },
    { key: 'analysis', label: '심층 분석' },
    { key: 'matching', label: '팀 매칭' },
    { key: 'estimates', label: '견적 생성' },
  ] as const

  return (
    <Card>
      <CardHeader>
        <CardTitle>공고 분석 중...</CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={progress} className="mb-6" />

        <div className="space-y-3">
          {phases.map((p) => {
            let status: 'completed' | 'active' | 'pending' = 'pending'
            const phaseIndex = phases.findIndex((ph) => ph.key === p.key)
            const currentIndex = phases.findIndex((ph) => ph.key === currentPhase)

            if (phaseIndex < currentIndex) {
              status = 'completed'
            } else if (phaseIndex === currentIndex) {
              status = 'active'
            }

            return (
              <PhaseIndicator
                key={p.key}
                phase={p.key}
                status={status}
                label={p.label}
              />
            )
          })}
        </div>

        {phase && (
          <p className="text-sm text-muted-foreground mt-4">{phase}</p>
        )}

        <div className="mt-4 text-right">
          <span className="text-sm font-medium">{Math.round(progress)}%</span>
        </div>
      </CardContent>
    </Card>
  )
}

