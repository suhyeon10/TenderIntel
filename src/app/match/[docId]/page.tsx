'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import SubHeader from '@/components/layout/SubHeader'
import { TeamRecommendationList } from '@/components/rag/TeamRecommendationList'
import { EstimateCompareBar } from '@/components/rag/EstimateCompareBar'
import { Button } from '@/components/ui/button'
import { Loader2, Filter, ArrowRight } from 'lucide-react'
import type { QueryResponse } from '@/types/rag'

export default function MatchPage() {
  const params = useParams()
  const router = useRouter()
  const docId = params.docId as string

  const [loading, setLoading] = useState(true)
  const [teams, setTeams] = useState<any[]>([])
  const [selectedTeams, setSelectedTeams] = useState<number[]>([])
  const [teamNames, setTeamNames] = useState<Record<number, string>>({})

  useEffect(() => {
    loadTeams()
  }, [docId])

  const loadTeams = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'match',
          query: '이 공고에 적합한 팀을 추천해주세요.',
          topK: 10,
          withTeams: true,
          docIds: [parseInt(docId)],
        }),
      })

      if (!response.ok) throw new Error('팀 매칭 실패')

      const data: QueryResponse = await response.json()

      if (data.teams) {
        // 팀 정보 확장 (실제로는 API에서 더 많은 정보 제공)
        const expandedTeams = data.teams.map((team) => ({
          team_id: team.team_id,
          name: `팀 ${team.team_id}`,
          score: team.score,
          price: Math.floor(Math.random() * 50000000) + 10000000, // 임시
          duration: `${Math.floor(Math.random() * 6) + 3}개월`, // 임시
          tags: ['React', 'Node.js', 'AWS'], // 임시
          region: '서울', // 임시
          similarProjects: Math.floor(Math.random() * 10) + 1, // 임시
        }))

        setTeams(expandedTeams)

        // 팀 이름 매핑
        const names: Record<number, string> = {}
        expandedTeams.forEach((team) => {
          names[team.team_id] = team.name
        })
        setTeamNames(names)
      }
    } catch (error) {
      console.error('팀 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectTeam = (teamId: number) => {
    if (!selectedTeams.includes(teamId) && selectedTeams.length < 3) {
      setSelectedTeams([...selectedTeams, teamId])
    }
  }

  const handleDeselectTeam = (teamId: number) => {
    setSelectedTeams(selectedTeams.filter((id) => id !== teamId))
  }

  const handleViewEstimate = (teamId: number) => {
    // 견적서 보기 (새 탭 또는 모달)
    console.log('View estimate for team:', teamId)
  }

  const handleCompare = () => {
    if (selectedTeams.length >= 2) {
      router.push(`/compare/${docId}?teams=${selectedTeams.join(',')}`)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <SubHeader currentStep={3} totalSteps={5} />
      <main className="flex-1 container mx-auto px-6 py-8 max-w-7xl pb-24">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold mb-2">팀 매칭 추천</h1>
            <p className="text-slate-600">
              AI가 분석한 공고에 적합한 팀을 추천합니다.
            </p>
          </div>
          <Button variant="outline" className="rounded-xl">
            <Filter className="w-4 h-4 mr-2" />
            필터
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-600">매칭된 팀이 없습니다.</p>
          </div>
        ) : (
          <TeamRecommendationList
            teams={teams}
            selectedTeams={selectedTeams}
            onSelectTeam={handleSelectTeam}
            onDeselectTeam={handleDeselectTeam}
            onViewEstimate={handleViewEstimate}
          />
        )}
      </main>

      <EstimateCompareBar
        selectedTeamIds={selectedTeams}
        teamNames={teamNames}
        onRemoveTeam={handleDeselectTeam}
        onCompare={handleCompare}
      />

      <Footer />
    </div>
  )
}

