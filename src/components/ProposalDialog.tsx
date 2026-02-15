'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import { propose } from '@/apis/proposal.service'
import { fetchMyTeams, createDefaultTeam } from '@/apis/team.service'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ProposalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  makerUsername: string
  makerId: string
}

export const ProposalDialog = ({
  open,
  onOpenChange,
  makerUsername,
  makerId,
}: ProposalDialogProps) => {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [isLoadingTeams, setIsLoadingTeams] = useState(false)
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const MAX_MESSAGE_LENGTH = 1000

  const loadTeams = useCallback(async () => {
    setIsLoadingTeams(true)
    try {
      const { data, error } = await fetchMyTeams()
      if (error) {
        console.error('팀 목록 로드 실패:', error)
        toast({
          variant: 'destructive',
          title: '팀 목록 로드 실패',
          description: '팀 목록을 불러오는데 실패했습니다.',
        })
        return
      }

      // 매니저인 팀만 필터링 (팀원으로 속한 팀은 제안을 보낼 수 없음)
      const managedTeams = (data || []).filter((team: any) => team.isManager)
      setTeams(managedTeams)

      // 팀이 1개만 있으면 자동 선택
      if (managedTeams.length === 1) {
        setSelectedTeamId(managedTeams[0].id)
      }
    } catch (error) {
      console.error('팀 목록 로드 오류:', error)
    } finally {
      setIsLoadingTeams(false)
    }
  }, [])

  const handleCreateDefaultTeam = async () => {
    setIsCreatingTeam(true)
    try {
      const { data, error } = await createDefaultTeam()
      
      if (error) {
        throw error
      }

      if (data) {
        toast({
          title: '팀 생성 완료',
          description: '기본 팀이 생성되었습니다.',
        })
        
        // 팀 목록 다시 로드
        await loadTeams()
      }
    } catch (error: any) {
      console.error('팀 생성 실패:', error)
      toast({
        variant: 'destructive',
        title: '팀 생성 실패',
        description: error.message || '팀을 생성하는데 실패했습니다.',
      })
    } finally {
      setIsCreatingTeam(false)
    }
  }

  // 팀 목록 로드
  useEffect(() => {
    if (open) {
      loadTeams()
    }
  }, [open, loadTeams])

  // 다이얼로그가 닫힐 때 메시지 및 선택 초기화
  useEffect(() => {
    if (!open) {
      setMessage('')
      setSelectedTeamId(null)
    }
  }, [open])

  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    if (value.length <= MAX_MESSAGE_LENGTH) {
      setMessage(value)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // 팀 선택 확인
    if (!selectedTeamId) {
      toast({
        variant: 'destructive',
        title: '팀을 선택해주세요',
        description: '팀 제안을 보내려면 팀을 선택해야 합니다.',
      })
      return
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      toast({
        variant: 'destructive',
        title: '입력 오류',
        description: `메시지는 ${MAX_MESSAGE_LENGTH}자를 넘을 수 없습니다.`,
      })
      return
    }

    setIsSubmitting(true)
    
    try {
      // 팀 제안 API 호출
      await propose(makerId, {
        teamId: selectedTeamId,
        message: message.trim() || undefined,
      })
      
      toast({
        title: '팀 제안 전송 완료',
        description: `${makerUsername}님에게 팀 제안을 보냈습니다.`,
      })
      
      setMessage('')
      onOpenChange(false)
    } catch (error: any) {
      console.error('제안 전송 실패:', error)
      
      // RLS 정책 에러인 경우 더 명확한 메시지 표시
      let errorMessage = '팀 제안 전송에 실패했습니다. 다시 시도해주세요.'
      if (error?.code === '42501') {
        errorMessage = '권한이 없습니다. 로그인 상태를 확인해주세요.'
      } else if (error?.message) {
        errorMessage = error.message
      }
      
      toast({
        variant: 'destructive',
        title: '전송 실패',
        description: errorMessage,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>팀 제안하기</DialogTitle>
          <DialogDescription>
            {makerUsername}님에게 팀 제안을 보냅니다.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* 팀 선택 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                팀 선택 <span className="text-red-500">*</span>
              </label>
              {isLoadingTeams ? (
                <div className="text-sm text-gray-500">팀 목록을 불러오는 중...</div>
              ) : teams.length === 0 ? (
                <div className="space-y-3">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 mb-3">
                      제안을 보낼 수 있는 팀이 없습니다. 기본 팀을 생성하거나 팀 프로필 페이지에서 팀을 생성해주세요.
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        type="button"
                        onClick={handleCreateDefaultTeam}
                        disabled={isCreatingTeam}
                        className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
                      >
                        {isCreatingTeam ? '생성 중...' : '기본 팀 생성하기'}
                      </Button>
                      <Link href="/my/team-profile" onClick={() => onOpenChange(false)}>
                        <Button 
                          type="button"
                          variant="outline"
                          className="flex-1 border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                        >
                          팀 프로필로 이동
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <Select
                    value={selectedTeamId?.toString() || ''}
                    onValueChange={(value) => setSelectedTeamId(Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="팀을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((team) => (
                        <SelectItem key={team.id} value={team.id.toString()}>
                          {team.name || `팀 #${team.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {teams.length === 1 && (
                    <p className="text-xs text-gray-500 mt-1">
                      팀이 1개만 있어 자동으로 선택되었습니다.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* 메시지 내용 */}
            <div>
              <label className="block text-sm font-medium mb-2">
                메시지 내용 <span className="text-gray-400 font-normal">(선택사항)</span>
              </label>
              <Textarea
                value={message}
                onChange={handleMessageChange}
                placeholder="팀 제안 내용을 입력해주세요... (선택사항)"
                rows={6}
                className="resize-none"
                maxLength={MAX_MESSAGE_LENGTH}
              />
              <p className={`text-xs mt-2 ${
                message.length >= MAX_MESSAGE_LENGTH 
                  ? 'text-red-500' 
                  : 'text-gray-500'
              }`}>
                {message.length}/{MAX_MESSAGE_LENGTH}자
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              취소
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || !selectedTeamId || teams.length === 0}
            >
              {isSubmitting ? '전송 중...' : '전송하기'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

