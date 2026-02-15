'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'

interface EvidenceBadgeProps {
  chunkId: number
  chunkText?: string
  onShowEvidence?: (chunkId: number) => void
}

export function EvidenceBadge({
  chunkId,
  chunkText,
  onShowEvidence,
}: EvidenceBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  const handleClick = () => {
    if (onShowEvidence) {
      onShowEvidence(chunkId)
    } else {
      setShowTooltip(!showTooltip)
    }
  }

  return (
    <span className="relative inline-block">
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
        aria-label={`근거 ${chunkId} 보기`}
      >
        <FileText className="w-3 h-3" />
        [id:{chunkId}]
      </button>

      {showTooltip && chunkText && (
        <div className="absolute bottom-full left-0 mb-2 w-64 p-3 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
          <div className="text-xs text-slate-600 mb-1">근거 {chunkId}</div>
          <p className="text-sm text-slate-800 line-clamp-3">{chunkText}</p>
          <button
            onClick={() => setShowTooltip(false)}
            className="mt-2 text-xs text-blue-600 hover:underline"
          >
            닫기
          </button>
        </div>
      )}
    </span>
  )
}

