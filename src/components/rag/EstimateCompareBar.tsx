'use client'

import { X, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EstimateCompareBarProps {
  selectedTeamIds: number[]
  teamNames: Record<number, string>
  onRemoveTeam: (teamId: number) => void
  onCompare: () => void
}

export function EstimateCompareBar({
  selectedTeamIds,
  teamNames,
  onRemoveTeam,
  onCompare,
}: EstimateCompareBarProps) {
  if (selectedTeamIds.length === 0) return null

  return (
    <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700">선택된 팀:</span>
            <div className="flex items-center gap-2">
              {selectedTeamIds.map((teamId) => (
                <span
                  key={teamId}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium"
                >
                  {teamNames[teamId] || `팀 ${teamId}`}
                  <button
                    onClick={() => onRemoveTeam(teamId)}
                    className="hover:text-blue-900"
                    aria-label="제거"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </span>
              ))}
            </div>
          </div>
          <Button
            onClick={onCompare}
            disabled={selectedTeamIds.length < 2}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-2 font-medium shadow-sm"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            비교하기 ({selectedTeamIds.length})
          </Button>
        </div>
      </div>
    </div>
  )
}

