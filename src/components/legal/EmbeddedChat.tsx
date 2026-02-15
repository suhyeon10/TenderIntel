'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, Bot, User, AlertCircle, FileText, ClipboardList } from 'lucide-react'
import { MarkdownRenderer } from '@/components/rag/MarkdownRenderer'
import { SituationChatMessage } from './SituationChatMessage'
import { ChatAiMessage } from './ChatAiMessage'
import { cn } from '@/lib/utils'
import { 
  getChatMessages, 
  saveChatMessage, 
  chatWithContractV2,
  getChatSessions,
  createChatSession,
} from '@/apis/legal.service'
import { createSupabaseBrowserClient } from '@/supabase/supabase-client'
import type { SituationAnalysisResponse } from '@/types/legal'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isError?: boolean
  retryable?: boolean
  originalQuery?: string
  dbId?: string // DB에 저장된 메시지 ID
  context_type?: 'none' | 'situation' | 'contract'
  context_id?: string | null
  metadata?: any // 메시지 metadata (cases 포함 가능)
}

interface EmbeddedChatProps {
  reportId: string // situation_analyses.id
  analysisResult: SituationAnalysisResponse
  situationSummary?: string
  onLoadingChange?: (loading: boolean) => void
  onMessageCountChange?: (count: number) => void
}

/**
 * EmbeddedChat 컴포넌트
 * reportId를 사용하여 situation_conversations를 구독하고 조회하는 챗봇
 */
export function EmbeddedChat({
  reportId,
  analysisResult,
  situationSummary,
  onLoadingChange,
  onMessageCountChange,
}: EmbeddedChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const subscriptionRef = useRef<any>(null)
  const [chatSessionId, setChatSessionId] = useState<string | null>(null)

  // 초기 메시지 생성 (analysis 데이터 기반)
  const generateInitialMessage = useCallback((): string => {
    const riskScore = analysisResult.riskScore || 50
    const summary = analysisResult.summary || ''
    const criteria = analysisResult.criteria || []
    
    // 분석 결과 기반으로 초기 메시지 생성
    let initialMessage = `안녕하세요! 분석 결과를 확인했습니다.\n\n`
    
    if (summary) {
      initialMessage += `📊 **상황 분석 결과**\n${summary}\n\n`
    }
    
    if (riskScore >= 70) {
      initialMessage += `⚠️ 위험도가 ${riskScore}점으로 높게 평가되었습니다. 법적 조치가 필요할 수 있습니다.\n\n`
    } else if (riskScore >= 40) {
      initialMessage += `⚠️ 위험도가 ${riskScore}점으로 중간 수준입니다. 주의가 필요합니다.\n\n`
    } else {
      initialMessage += `✅ 위험도가 ${riskScore}점으로 낮은 편입니다. 다만 상황에 따라 달라질 수 있습니다.\n\n`
    }
    
    if (criteria.length > 0) {
      initialMessage += `⚖️ **법적 관점**\n`
      criteria.slice(0, 3).forEach((criterion, index) => {
        const statusEmoji = 
          criterion.status === 'likely' ? '🔴' :
          criterion.status === 'unclear' ? '🟡' : '🟢'
        initialMessage += `${statusEmoji} ${criterion.name}: ${criterion.reason || ''}\n`
      })
      initialMessage += `\n`
    }
    
    // actionPlan 제거됨
    if (false) { // actionPlan 제거됨
      initialMessage += `🎯 **다음 단계**\n`
      [].forEach((item) => {
        initialMessage += `• ${item}\n`
      })
      initialMessage += `\n`
    }
    
    initialMessage += `궁금한 점이 있으시면 언제든 물어보세요!`
    
    return initialMessage
  }, [analysisResult])

  // 챗 세션 찾기 또는 생성 (상황 분석 리포트 기반)
  const findOrCreateChatSession = useCallback(async (): Promise<string> => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id || null
      
      if (!userId) {
        throw new Error('사용자 인증이 필요합니다.')
      }
      
      // 기존 세션 찾기 (상황 분석 리포트를 초기 컨텍스트로 가진 세션)
      const sessions = await getChatSessions(userId, 50, 0)
      const existingSession = sessions.find(
        (s) => s.initial_context_type === 'situation' && s.initial_context_id === reportId
      )
      
      if (existingSession) {
        return existingSession.id
      }
      
      // 새 세션 생성
      const sessionResult = await createChatSession(
        {
          initial_context_type: 'situation',
          initial_context_id: reportId,
          title: `상황 분석 리포트 - ${reportId.substring(0, 8)}`,
        },
        userId
      )
      
      return sessionResult.id
    } catch (error) {
      throw error
    }
  }, [reportId])

  // DB에서 대화 내역 로드
  const loadConversationsFromDB = useCallback(async () => {
    try {
      setIsLoadingHistory(true)
      
      // 챗 세션 찾기 또는 생성
      const sessionId = await findOrCreateChatSession()
      setChatSessionId(sessionId)
      
      // 새 테이블에서 메시지 조회
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id || null
      
      if (!userId) {
        throw new Error('사용자 인증이 필요합니다.')
      }
      
      const messages = await getChatMessages(sessionId, userId)
      
      // sequence_number 순서대로 정렬하여 메시지로 변환
      const sortedMessages = [...messages].sort(
        (a, b) => a.sequence_number - b.sequence_number
      )
      
      const loadedMessages: Message[] = sortedMessages.map((msg) => {
        const message: Message = {
          id: msg.id,
          dbId: msg.id,
          role: msg.sender_type,
          content: msg.message,
          timestamp: new Date(msg.created_at),
          context_type: msg.context_type || 'none',
          context_id: msg.context_id || null,
          metadata: msg.metadata || null,
        }
        return message
      })
      
      // Warm Start: DB에 초기 메시지가 없으면 생성
      const hasInitialAssistantMessage = loadedMessages.some(
        (msg) => msg.role === 'assistant' && (msg.dbId || msg.id.startsWith('temp_') === false)
      )
      
      if (loadedMessages.length === 0 || !hasInitialAssistantMessage) {
        // DB에 초기 메시지가 없으면 프론트엔드에서 생성
        const initialMessage: Message = {
          id: `initial_${Date.now()}`,
          role: 'assistant',
          content: generateInitialMessage(),
          timestamp: new Date(),
        }
        
        // DB에 저장하지 않고 로컬에서만 표시
        setMessages([initialMessage, ...loadedMessages])
        onMessageCountChange?.([initialMessage, ...loadedMessages].length)
      } else {
        setMessages(loadedMessages)
        onMessageCountChange?.(loadedMessages.length)
      }
    } catch (error) {
      // 에러가 발생하면 초기 메시지만 표시
      const initialMessage: Message = {
        id: `initial_${Date.now()}`,
        role: 'assistant',
        content: generateInitialMessage(),
        timestamp: new Date(),
      }
      setMessages([initialMessage])
      onMessageCountChange?.(1)
    } finally {
      setIsLoadingHistory(false)
    }
  }, [reportId, onMessageCountChange, generateInitialMessage, findOrCreateChatSession])

  // Supabase Realtime 구독 설정 (새 테이블)
  useEffect(() => {
    if (!chatSessionId) return

    const supabase = createSupabaseBrowserClient()
    
    // legal_chat_messages 테이블 구독
    subscriptionRef.current = supabase
      .channel(`legal_chat_messages:${chatSessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'legal_chat_messages',
          filter: `session_id=eq.${chatSessionId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as any
            const newMessage: Message = {
              id: newMsg.id,
              dbId: newMsg.id,
              role: newMsg.sender_type,
              content: newMsg.message,
              timestamp: new Date(newMsg.created_at),
              context_type: newMsg.context_type || 'none',
              context_id: newMsg.context_id || null,
              metadata: newMsg.metadata || null,
            }
            
            setMessages((prev) => {
              // 중복 체크 (이미 있는 메시지는 추가하지 않음)
              const exists = prev.some((msg) => msg.dbId === newMessage.dbId)
              if (exists) return prev
              
              // sequence_number 순서에 맞게 삽입
              const newMessages = [...prev, newMessage].sort((a, b) => {
                // sequence_number를 알 수 없으므로 timestamp로 정렬
                return a.timestamp.getTime() - b.timestamp.getTime()
              })
              
              return newMessages
            })
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as any
            setMessages((prev) =>
              prev.map((msg) =>
                msg.dbId === updatedMsg.id
                  ? {
                      ...msg,
                      content: updatedMsg.message,
                      timestamp: new Date(updatedMsg.created_at),
                    }
                  : msg
              )
            )
          } else if (payload.eventType === 'DELETE') {
            const deletedMsg = payload.old as any
            setMessages((prev) => prev.filter((msg) => msg.dbId !== deletedMsg.id))
          }
        }
      )
      .subscribe()

    // 정리 함수
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current)
        subscriptionRef.current = null
      }
    }
  }, [chatSessionId])

  // 초기 대화 내역 로드
  useEffect(() => {
    if (reportId) {
      loadConversationsFromDB()
    }
  }, [reportId, loadConversationsFromDB])

  // 법적 관점 내용을 컨텍스트로 변환
  const getLegalContext = useCallback((): string => {
    const contextParts: string[] = []
    
    if (analysisResult.criteria && analysisResult.criteria.length > 0) {
      contextParts.push('법적 관점에서 본 현재 상황')
      analysisResult.criteria.forEach((criterion, index) => {
        const reason = criterion.reason || `${criterion.name}: ${criterion.status}`
        contextParts.push(`${index + 1}\n${reason}`)
      })
    }
    
    if (analysisResult.summary) {
      contextParts.push(`\n상황 요약: ${analysisResult.summary}`)
    }
    
    contextParts.push(`위험도: ${analysisResult.riskScore}점`)
    
    return contextParts.join('\n\n')
  }, [analysisResult])

  // 메시지 전송
  const handleSendMessage = useCallback(async (question?: string, prefilledText?: string) => {
    const query = question || prefilledText || inputMessage.trim()
    if (!query) return

    // 사용자 메시지 추가 (로컬 상태에만, DB 저장은 나중에)
    const userMessage: Message = {
      id: `temp_${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputMessage('')
    setChatLoading(true)
    onLoadingChange?.(true)

    try {
      // 챗 세션이 없으면 생성
      if (!chatSessionId) {
        const sessionId = await findOrCreateChatSession()
        setChatSessionId(sessionId)
      }
      
      const sessionId = chatSessionId || await findOrCreateChatSession()
      
      // 현재 메시지 개수로 sequence_number 계산
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id || null
      
      if (!userId) {
        throw new Error('사용자 인증이 필요합니다.')
      }
      
      // 기존 메시지 조회하여 sequence_number 계산
      const existingMessages = await getChatMessages(sessionId, userId)
      const maxSequenceNumber = existingMessages.length > 0
        ? Math.max(...existingMessages.map(m => m.sequence_number))
        : -1
      
      const userSequenceNumber = maxSequenceNumber + 1
      const assistantSequenceNumber = maxSequenceNumber + 2

      // 사용자 메시지를 DB에 저장
      const userSaveResult = await saveChatMessage(
        sessionId,
        {
          sender_type: 'user',
          message: query,
          sequence_number: userSequenceNumber,
          context_type: 'situation',
          context_id: reportId,
        },
        userId
      )

      // 법적 관점 내용을 컨텍스트로 포함한 분석 요약 생성
      const legalContext = getLegalContext()
      const analysisSummary = `${legalContext}\n\n${situationSummary || ''}`

      // v2 API 호출 (컨텍스트 포함)
      const data = await chatWithContractV2({
        query: query,
        docIds: [],
        analysisSummary: analysisSummary,
        riskScore: analysisResult.riskScore,
        totalIssues: analysisResult.criteria?.length || 0,
        topK: 8,
        contextType: 'situation',
        contextId: reportId,
      })

      const assistantContent = data.answer || '답변을 생성할 수 없습니다.'

      // 어시스턴트 메시지를 DB에 저장
      await saveChatMessage(
        sessionId,
        {
          sender_type: 'assistant',
          message: assistantContent,
          sequence_number: assistantSequenceNumber,
          context_type: 'situation',
          context_id: reportId,
        },
        userId
      )

      // 로컬 상태 업데이트는 Realtime 구독을 통해 자동으로 처리됨
      // 하지만 즉시 반영을 위해 임시로 추가
      const assistantMessage: Message = {
        id: `temp_${Date.now() + 1}`,
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        context_type: 'situation',
        context_id: reportId,
      }

      setMessages((prev) => {
        // 사용자 메시지의 임시 ID를 DB ID로 업데이트
        const updated = prev.map((msg) =>
          msg.id === userMessage.id && userSaveResult.id
            ? { ...msg, id: userSaveResult.id, dbId: userSaveResult.id }
            : msg
        )
        return [...updated, assistantMessage]
      })
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '답변을 생성하는 중 오류가 발생했습니다.',
        timestamp: new Date(),
        isError: true,
        retryable: true,
        originalQuery: query,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setChatLoading(false)
      onLoadingChange?.(false)
    }
  }, [reportId, analysisResult, situationSummary, inputMessage, messages.length, getLegalContext, onLoadingChange, chatSessionId, findOrCreateChatSession])

  // 재시도 함수
  const handleRetry = useCallback(
    (originalQuery: string) => {
      setMessages((prev) => {
        const filtered = [...prev]
        const lastErrorIndex = filtered.findLastIndex((msg) => msg.isError && msg.retryable)
        if (lastErrorIndex !== -1) {
          filtered.splice(lastErrorIndex, 1)
        }
        return filtered
      })
      handleSendMessage(undefined, originalQuery)
    },
    [handleSendMessage]
  )

  // 메시지 개수 변경 알림
  useEffect(() => {
    onMessageCountChange?.(messages.length)
  }, [messages.length, onMessageCountChange])

  // 자동 스크롤
  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current && !isUserScrolling) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, shouldAutoScroll, isUserScrolling])

  // 스크롤 이벤트 핸들러
  const handleScroll = useCallback(() => {
    if (!chatContainerRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100

    if (isNearBottom) {
      setShouldAutoScroll(true)
      setIsUserScrolling(false)
    } else {
      setShouldAutoScroll(false)
      setIsUserScrolling(true)
    }
  }, [])

  useEffect(() => {
    const container = chatContainerRef.current
    if (container) {
      container.addEventListener('scroll', handleScroll)
      return () => container.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  if (isLoadingHistory) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 메시지 영역 */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <div className="text-center">
              <Bot className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>대화를 시작해보세요.</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                </div>
              )}
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-4 py-2',
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : message.isError
                    ? 'bg-red-50 text-red-900 border border-red-200'
                    : 'bg-slate-100 text-slate-900'
                )}
              >
                {message.isError ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <p>{message.content}</p>
                    </div>
                    {message.retryable && message.originalQuery && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetry(message.originalQuery!)}
                        className="mt-2"
                      >
                        재시도
                      </Button>
                    )}
                  </div>
                ) : message.role === 'user' ? (
                  <div>
                    <p className="text-sm text-white leading-relaxed whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                    {/* 참고 리포트 표시 */}
                    {message.context_type && message.context_type !== 'none' && message.context_id && (
                      <div className="mt-2 pt-2 border-t border-white/20">
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
                      </div>
                    )}
                  </div>
                ) : message.role === 'assistant' ? (
                  // assistant 메시지는 context_type에 따라 다른 컴포넌트 사용
                  message.context_type === 'situation' ? (
                    <SituationChatMessage 
                      content={message.content} 
                      contextId={message.context_id || null}
                      metadata={message.metadata}
                    />
                  ) : (
                    <ChatAiMessage content={message.content} />
                  )
                ) : (
                  <MarkdownRenderer content={message.content} />
                )}
                <div className="text-xs mt-1 opacity-70">
                  {message.timestamp.toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              {message.role === 'user' && (
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                    <User className="h-5 w-5 text-slate-600" />
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="border-t border-slate-200 p-4">
        <div className="flex gap-2">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            placeholder="메시지를 입력하세요..."
            className="min-h-[60px] resize-none"
            disabled={chatLoading}
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || chatLoading}
            className="self-end"
          >
            {chatLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

