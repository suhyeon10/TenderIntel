'use client'

interface ScoreBadgeProps {
  score: number // 0~100
  showLabel?: boolean
}

export function ScoreBadge({ score, showLabel = false }: ScoreBadgeProps) {
  const getColor = (score: number) => {
    if (score >= 85) return 'bg-emerald-500 text-white'
    if (score >= 70) return 'bg-blue-500 text-white'
    return 'bg-slate-400 text-white'
  }

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center justify-center w-12 h-12 rounded-xl font-bold text-lg ${getColor(
          score
        )}`}
      >
        {score}
      </span>
      {showLabel && (
        <span className="text-sm text-slate-600">적합도</span>
      )}
    </div>
  )
}

