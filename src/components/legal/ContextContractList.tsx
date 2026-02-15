'use client'

import { useState, useEffect } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getContractHistoryV2 } from '@/apis/legal.service'

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

interface ContextContractListProps {
  onSelect: (contract: { id: string; doc_id: string; title: string }) => void
  currentContextId: string | null
}

export function ContextContractList({ onSelect, currentContextId }: ContextContractListProps) {
  const [contracts, setContracts] = useState<Array<{ id: string; doc_id: string; title: string; created_at: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false
    
    const loadContracts = async () => {
      try {
        setLoading(true)
        setError(null)
        const userId = await getUserId()
        
        if (isCancelled) return
        
        if (!userId) {
          setError('로그인이 필요합니다')
          setContracts([])
          setLoading(false)
          return
        }
        
        // 타임아웃 추가 (30초)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.')), 30000)
        })
        
        const historyPromise = getContractHistoryV2(10, 0, userId)
        const history = await Promise.race([historyPromise, timeoutPromise]) as any
        
        if (isCancelled) return
        
        setContracts(history.map((c: any) => ({
          id: c.id,
          doc_id: c.doc_id,
          title: c.title || c.original_filename || '계약서 분석',
          created_at: c.created_at,
        })))
      } catch (error: any) {
        if (isCancelled) return
        setError(error?.message || '계약서 분석을 불러오는 중 오류가 발생했습니다')
        setContracts([])
      } finally {
        if (!isCancelled) {
          setLoading(false)
        }
      }
    }
    
    loadContracts()
    
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

  if (contracts.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-sm text-slate-500">저장된 계약서 분석이 없습니다</div>
        <div className="text-xs text-slate-400 mt-1">계약서 분석 페이지에서 먼저 분석을 진행해주세요</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {contracts.map((contract) => (
        <button
          key={contract.id}
          onClick={() => onSelect(contract)}
          className={cn(
            "w-full p-3 rounded-lg border-2 transition-all text-left",
            currentContextId === contract.doc_id || currentContextId === contract.id
              ? "border-blue-500 bg-blue-50"
              : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
          )}
        >
          <div className="text-sm font-medium text-slate-900 line-clamp-2">
            {contract.title || '계약서 분석'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {formatDate(contract.created_at)}
          </div>
        </button>
      ))}
    </div>
  )
}

