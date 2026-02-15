'use client'

import { useState, useEffect } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSituationHistoryV2 } from '@/apis/legal.service'

// 공통 유저 ID 가져오기 함수
async function getUserId(): Promise<string | null> {
  const { createSupabaseBrowserClient } = await import('@/supabase/supabase-client')
  const supabase = createSupabaseBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

// 날짜 포맷팅
function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (dateObj.toDateString() === today.toDateString()) {
    return '오늘'
  } else if (dateObj.toDateString() === yesterday.toDateString()) {
    return '어제'
  } else {
    return `${dateObj.getMonth() + 1}/${dateObj.getDate()}`
  }
}

interface ContextSituationListProps {
  onSelect: (situation: { id: string; situation: string }) => void
  currentContextId: string | null
}

export function ContextSituationList({ onSelect, currentContextId }: ContextSituationListProps) {
  const [situations, setSituations] = useState<Array<{ id: string; situation: string; created_at: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false
    
    const loadSituations = async () => {
      try {
        setLoading(true)
        setError(null)
        const userId = await getUserId()
        
        if (isCancelled) return
        
        if (!userId) {
          setError('로그인이 필요합니다')
          setSituations([])
          setLoading(false)
          return
        }

        // 타임아웃 추가 (30초)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.')), 30000)
        })
        
        const historyPromise = getSituationHistoryV2(20, 0, userId)
        const history = await Promise.race([historyPromise, timeoutPromise]) as any
        
        if (isCancelled) return
        
        if (history && Array.isArray(history)) {
          // 데이터 형식 변환 (백엔드 응답 형식에 맞춤)
          const formattedSituations = history.map((item: any) => ({
            id: item.id,
            situation: item.situation || '',
            created_at: item.created_at || new Date().toISOString(),
          }))
          setSituations(formattedSituations)
        } else {
          setSituations([])
        }
      } catch (error: any) {
        if (isCancelled) return
        setError(error?.message || '상황 분석을 불러오는 중 오류가 발생했습니다')
        setSituations([])
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }
    
    loadSituations()
    
    return () => {
      isCancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        <span className="ml-2 text-sm text-slate-500">로딩 중...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 p-4" role="alert">
        <div className="flex items-center gap-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      </div>
    )
  }

  if (situations.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-sm text-slate-500">저장된 상황 분석이 없습니다</div>
        <div className="text-xs text-slate-400 mt-1">상황 분석 페이지에서 먼저 분석을 진행해주세요</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {situations.map((situation) => (
        <button
          key={situation.id}
          onClick={() => onSelect(situation)}
          className={cn(
            "w-full p-3 rounded-lg border-2 transition-all text-left",
            currentContextId === situation.id
              ? "border-blue-500 bg-blue-50"
              : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
          )}
        >
          <div className="text-sm font-medium text-slate-900 line-clamp-2">
            {situation.situation?.substring(0, 50) || '상황 분석'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {formatDate(situation.created_at)}
          </div>
        </button>
      ))}
    </div>
  )
}

