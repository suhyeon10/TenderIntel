'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { fetchMyTeams } from '@/apis/team.service'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Users, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface Team {
  id: number
  name: string
  description: string | null
  manager_profile_id: string
  isManager: boolean
  team_members?: any[]
}

interface ProjectJoinModalProps {
  open: boolean
  onClose: () => void
  counselId: number
  onSuccess?: () => void
}

export default function ProjectJoinModal({
  open,
  onClose,
  counselId,
  onSuccess,
}: ProjectJoinModalProps) {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (open) {
      loadTeams()
    }
  }, [open])

  const loadTeams = async () => {
    try {
      setLoading(true)
      setError(null)
      const { data, error: teamsError } = await fetchMyTeams()
      
      if (teamsError) {
        throw teamsError
      }
      
      setTeams(data || [])
      
      // 첫 번째 팀을 자동 선택
      if (data && data.length > 0) {
        setSelectedTeamId(data[0].id)
      }
    } catch (err: any) {
      setError(err.message || '팀을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleEstimate = () => {
    if (!selectedTeamId) {
      setError('팀을 선택해주세요.')
      return
    }

    // 견적서 작성 페이지로 이동 (팀 ID와 프로젝트 ID 전달)
    router.push(`/my/estimate-requests?counsel_id=${counselId}&team_id=${selectedTeamId}`)
    onClose()
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>팀으로 견적서 작성하기</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-600">팀 목록을 불러오는 중...</p>
            </div>
          ) : teams.length === 0 ? (
            <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-yellow-900 mb-2">팀이 없습니다</h3>
                  <p className="text-sm text-yellow-800 mb-4">
                    프로젝트에 견적서를 제출하려면 팀이 필요합니다. 먼저 팀을 생성하거나 팀에 합류해주세요.
                  </p>
                  <Link href="/my/team-proposal">
                    <Button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white">
                      팀 생성하기
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 팀 선택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  견적서를 작성할 팀 선택
                </label>
                <div className="space-y-3">
                  {teams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeamId(team.id)}
                      className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                        selectedTeamId === team.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Users className="w-4 h-4 text-gray-600" />
                            <div className="font-semibold text-gray-900">{team.name}</div>
                            {team.isManager && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                매니저
                              </span>
                            )}
                          </div>
                          {team.description && (
                            <div className="text-sm text-gray-600 mt-1">{team.description}</div>
                          )}
                          {team.team_members && team.team_members.length > 0 && (
                            <div className="text-xs text-gray-500 mt-2">
                              팀원 {team.team_members.length}명
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 선택된 팀 정보 */}
              {selectedTeam && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">선택된 팀</div>
                  <div className="font-semibold text-gray-900">{selectedTeam.name}</div>
                  {selectedTeam.description && (
                    <div className="text-sm text-gray-600 mt-1">{selectedTeam.description}</div>
                  )}
                </div>
              )}

              {/* 에러 메시지 */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                  disabled={loading}
                >
                  취소
                </Button>
                <Button
                  onClick={handleEstimate}
                  className="flex-1"
                  disabled={loading || !selectedTeamId}
                >
                  견적서 작성하기
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

