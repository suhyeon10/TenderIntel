'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Loader2, ClipboardList, FileText } from 'lucide-react'
import { getSituationAnalysisByIdV2, getContractAnalysisV2 } from '@/apis/legal.service'

// 공통 유저 ID 가져오기 함수
async function getUserId(): Promise<string | null> {
  const { createSupabaseBrowserClient } = await import('@/supabase/supabase-client')
  const supabase = createSupabaseBrowserClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  context_type?: 'none' | 'situation' | 'contract'
  context_id?: string | null
}

interface ReportInfo {
  title: string
  summary: string
  type: 'situation' | 'contract'
}

interface UserMessageWithContextProps {
  message: ChatMessage
  reportCache: Map<string, ReportInfo>
  setReportCache: React.Dispatch<React.SetStateAction<Map<string, ReportInfo>>>
}

export function UserMessageWithContext({ 
  message, 
  reportCache, 
  setReportCache 
}: UserMessageWithContextProps) {
  const [isLoadingReport, setIsLoadingReport] = useState(false)
  const [reportInfo, setReportInfo] = useState<ReportInfo | null>(null)
  // reportCache를 ref로 추적하여 최신 값을 읽을 수 있도록 함
  const reportCacheRef = useRef(reportCache)
  
  // reportCache가 변경될 때마다 ref 업데이트
  useEffect(() => {
    reportCacheRef.current = reportCache
  }, [reportCache])

  useEffect(() => {
    let isCancelled = false

    const loadReportInfo = async () => {
      if (!message.context_id || !message.context_type || message.context_type === 'none') {
        return
      }

      // 캐시에서 확인 (ref를 통해 최신 값 읽기)
      const cached = reportCacheRef.current.get(message.context_id)
      if (cached) {
        if (!isCancelled) {
          setReportInfo(cached)
        }
        return
      }

      // 리포트 정보 가져오기
      if (!isCancelled) {
        setIsLoadingReport(true)
      }
      
      try {
        const userId = await getUserId()

        if (isCancelled) return

        if (message.context_type === 'situation' && message.context_id) {
          const situation = await getSituationAnalysisByIdV2(message.context_id, userId)
          
          if (isCancelled) return
          
          const situationSummary = situation.analysis?.summary || ''
          const info: ReportInfo = {
            title: situationSummary.substring(0, 50) || '상황 분석 리포트',
            summary: situationSummary,
            type: 'situation'
          }
          
          if (!isCancelled) {
            setReportInfo(info)
            setReportCache(prev => {
              // 이미 캐시에 있으면 업데이트하지 않음 (중복 방지)
              if (prev.has(message.context_id!)) {
                return prev
              }
              return new Map(prev).set(message.context_id!, info)
            })
          }
        } else if (message.context_type === 'contract' && message.context_id) {
          const contract = await getContractAnalysisV2(message.context_id)
          
          if (isCancelled) return
          
          const info: ReportInfo = {
            title: contract.summary?.substring(0, 50) || '계약서 분석 리포트',
            summary: contract.summary || '',
            type: 'contract'
          }
          
          if (!isCancelled) {
            setReportInfo(info)
            setReportCache(prev => {
              // 이미 캐시에 있으면 업데이트하지 않음 (중복 방지)
              if (prev.has(message.context_id!)) {
                return prev
              }
              return new Map(prev).set(message.context_id!, info)
            })
          }
        }
      } catch (error) {
        // 로그 제거: 리포트 정보 로드 실패는 무시
        if (!isCancelled) {
          console.warn('리포트 정보 로드 실패:', error)
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingReport(false)
        }
      }
    }

    loadReportInfo()
    
    // cleanup 함수: 컴포넌트 언마운트 시 비동기 작업 취소
    return () => {
      isCancelled = true
    }
    // reportCache를 의존성에서 제거하여 무한 루프 방지
    // reportCacheRef를 통해 최신 값을 읽을 수 있음
  }, [message.context_id, message.context_type])

  return (
    <div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-white font-medium">
        {message.content}
      </p>
      {/* 참고 리포트 표시 */}
      {message.context_type && message.context_type !== 'none' && message.context_id && (
        <div className="mt-2 pt-2 border-t border-white/20">
          {isLoadingReport ? (
            <div className="flex items-center gap-1.5 text-xs text-white/60">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>리포트 정보 로딩 중...</span>
            </div>
          ) : reportInfo ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-white/90">
                {message.context_type === 'situation' ? (
                  <>
                    <ClipboardList className="h-3.5 w-3.5" />
                    <span className="font-semibold">상황 분석 리포트 참고 중</span>
                  </>
                ) : message.context_type === 'contract' ? (
                  <>
                    <FileText className="h-3.5 w-3.5" />
                    <span className="font-semibold">계약서 분석 리포트 참고 중</span>
                  </>
                ) : null}
              </div>
              <div className="bg-white/10 rounded-lg p-2 space-y-1">
                <div className="text-xs font-medium text-white/90 line-clamp-1">
                  {reportInfo.title}
                </div>
                {reportInfo.summary && (
                  <div className="text-xs text-white/70 line-clamp-2">
                    {reportInfo.summary}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-white/80">
              {message.context_type === 'situation' ? (
                <>
                  <ClipboardList className="h-3.5 w-3.5" />
                  <span>상황 분석 리포트 참고 중</span>
                </>
              ) : message.context_type === 'contract' ? (
                <>
                  <FileText className="h-3.5 w-3.5" />
                  <span>계약서 분석 리포트 참고 중</span>
                </>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

