'use client'

import { useState } from 'react'
import { ScoreBadge } from '@/components/common/ScoreBadge'
import { TagChip } from '@/components/common/TagChip'
import { Money } from '@/components/common/Money'
import { Button } from '@/components/ui/button'
import { FileText, Plus, MapPin, Calendar } from 'lucide-react'

interface Team {
  team_id: number
  name: string
  score: number
  price?: number
  duration?: string
  tags?: string[]
  region?: string
  similarProjects?: number
}

interface TeamRecommendationListProps {
  teams: Team[]
  selectedTeams: number[]
  onSelectTeam: (teamId: number) => void
  onDeselectTeam: (teamId: number) => void
  onViewEstimate: (teamId: number) => void
}

export function TeamRecommendationList({
  teams,
  selectedTeams,
  onSelectTeam,
  onDeselectTeam,
  onViewEstimate,
}: TeamRecommendationListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {teams.map((team) => {
        const isSelected = selectedTeams.includes(team.team_id)

        return (
          <div
            key={team.team_id}
            className={`rounded-2xl border p-5 bg-white shadow-sm transition-all ${
              isSelected
                ? 'border-blue-500 ring-2 ring-blue-200'
                : 'border-slate-200 hover:shadow-md'
            }`}
          >
            {/* 헤더 */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">{team.name}</h3>
                {team.region && (
                  <div className="flex items-center gap-1 text-sm text-slate-600">
                    <MapPin className="w-4 h-4" />
                    <span>{team.region}</span>
                  </div>
                )}
              </div>
              <ScoreBadge score={Math.round(team.score * 100)} />
            </div>

            {/* 태그 */}
            {team.tags && team.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {team.tags.slice(0, 3).map((tag, i) => (
                  <TagChip key={i} label={tag} variant="tech" />
                ))}
                {team.tags.length > 3 && (
                  <TagChip label={`+${team.tags.length - 3}`} variant="default" />
                )}
              </div>
            )}

            {/* 정보 */}
            <div className="space-y-2 mb-4 text-sm">
              {team.price && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">예상 견적</span>
                  <Money amount={team.price} />
                </div>
              )}
              {team.duration && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">예상 기간</span>
                  <span className="font-medium">{team.duration}</span>
                </div>
              )}
              {team.similarProjects !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">유사 실적</span>
                  <span className="font-medium">{team.similarProjects}건</span>
                </div>
              )}
            </div>

            {/* 액션 버튼 */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onViewEstimate(team.team_id)}
              >
                <FileText className="w-4 h-4 mr-2" />
                견적서 보기
              </Button>
              <Button
                variant={isSelected ? 'default' : 'outline'}
                className="flex-1"
                onClick={() =>
                  isSelected
                    ? onDeselectTeam(team.team_id)
                    : onSelectTeam(team.team_id)
                }
              >
                <Plus className="w-4 h-4 mr-2" />
                {isSelected ? '제거' : '비교'}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

