'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, MessageSquare, Bot, User, AlertCircle, FileText, ClipboardList } from 'lucide-react'
import { MarkdownRenderer } from '@/components/rag/MarkdownRenderer'
import { SituationChatMessage } from './SituationChatMessage'
import { cn } from '@/lib/utils'
import type { SituationAnalysisResponse } from '@/types/legal'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isError?: boolean
  retryable?: boolean
  originalQuery?: string
  context_type?: 'none' | 'situation' | 'contract'
  context_id?: string | null
}

interface SituationChatProps {
  analysisResult: SituationAnalysisResponse
  analysisId?: string | null
  situationSummary?: string
  initialMessage?: string
  suggestedQuestions?: string[]
  onLoadingChange?: (loading: boolean) => void
  onMessageCountChange?: (count: number) => void
}

export function SituationChat({
  analysisResult,
  situationSummary,
  initialMessage,
  suggestedQuestions: propSuggestedQuestions,
  onLoadingChange,
  onMessageCountChange,
  analysisId,
}: SituationChatProps) {
  // 상황 분석 결과 기반 고유 ID 생성
  const chatId = `situation_${Date.now()}_${analysisResult.riskScore}`

  // 초기 AI 메시지 생성
  const generateInitialMessage = (): string => {
    if (initialMessage) return initialMessage
    
    // 분석 결과 기반으로 초기 메시지 생성
    const riskScore = analysisResult.riskScore || 50
    const criteria = analysisResult.criteria || []
    
    if (criteria.length > 0) {
      const firstCriterion = criteria[0]
      const criterionName = firstCriterion.name || ''
      
      // 수습기간 관련 체크
      if (criterionName.includes('수습') || criterionName.includes('인턴')) {
        return '위 분석 결과를 보니 수습기간 관련 부분이 법적으로 모호해 보입니다. 이 부분에 대해 구체적으로 상담해 드릴까요?'
      }
      
      // 임금 체불 관련
      if (criterionName.includes('임금') || criterionName.includes('체불')) {
        return '분석 결과에서 임금 체불 의심 사항이 확인되었습니다. 이 상황에서 어떤 조치를 취해야 하는지 자세히 알려드릴 수 있습니다.'
      }
      
      // 일반적인 초기 메시지
      return '분석 결과를 바탕으로 궁금한 점을 물어보세요.'
    }
    
    return '분석 결과를 바탕으로 궁금한 점을 물어보세요. 법적 권리나 다음 단계에 대해 상담해 드릴 수 있습니다.'
  }

  // localStorage에서 메시지 로드
  const loadMessages = (): Message[] => {
    if (typeof window === 'undefined') return []
    try {
      const stored = localStorage.getItem(`situation_chat_${chatId}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        const loaded = parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }))
        // 초기 메시지가 없으면 추가
        if (loaded.length === 0) {
          return [{
            id: 'initial',
            role: 'assistant' as const,
            content: generateInitialMessage(),
            timestamp: new Date(),
          }]
        }
        return loaded
      }
    } catch (error) {
      // 로그 제거: localStorage 로드 실패는 무시
    }
    // 초기 메시지 반환
    return [{
      id: 'initial',
      role: 'assistant' as const,
      content: generateInitialMessage(),
      timestamp: new Date(),
    }]
  }

  // 메시지 저장
  const saveMessages = (msgs: Message[]) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(`situation_chat_${chatId}`, JSON.stringify(msgs))
    } catch (error) {
      // 로그 제거: localStorage 저장 실패는 무시
    }
  }

  const [messages, setMessages] = useState<Message[]>(loadMessages())
  const [inputMessage, setInputMessage] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)

  // 분석 결과 기반 추천 질문 생성
  const generateSuggestedQuestions = (): string[] => {
    // prop으로 전달된 질문이 있으면 우선 사용
    if (propSuggestedQuestions && propSuggestedQuestions.length > 0) {
      return propSuggestedQuestions
    }
    
    const questions: string[] = []
    
    // 기본 추천 질문
    questions.push('지금 그만두면 손해인가요?')
    questions.push('신고 절차 알려줘')
    
    // 상황 분석 결과 기반 질문
    if (analysisResult.riskScore >= 70) {
      questions.push('위험이 높다고 나왔는데, 어떤 조치를 우선해야 하나요?')
    }
    
    if (analysisResult.criteria && analysisResult.criteria.length > 0) {
      questions.push('법적 관점에서 가장 중요한 포인트는 무엇인가요?')
    }
    
    // actionPlan 제거됨

    return questions.slice(0, 4) // 최대 4개
  }

  const suggestedQuestions = generateSuggestedQuestions()

  // 법적 관점 내용을 컨텍스트로 변환
  const getLegalContext = useCallback((): string => {
    const contextParts: string[] = []
    
    // 법적 관점에서 본 현재 상황 (사용자 제공 예시 형식에 맞춤)
    if (analysisResult.criteria && analysisResult.criteria.length > 0) {
      contextParts.push('법적 관점에서 본 현재 상황')
      analysisResult.criteria.forEach((criterion, index) => {
        const reason = criterion.reason || `${criterion.name}: ${criterion.status}`
        contextParts.push(`${index + 1}\n${reason}`)
      })
    }
    
    // 상황 요약
    if (analysisResult.summary) {
      contextParts.push(`\n상황 요약: ${analysisResult.summary}`)
    }
    
    // 위험도
    contextParts.push(`위험도: ${analysisResult.riskScore}점`)
    
    return contextParts.join('\n\n')
  }, [analysisResult])

  // 메시지 전송
  const handleSendMessage = useCallback(async (question?: string, prefilledText?: string) => {
    const query = question || prefilledText || inputMessage.trim()
    if (!query) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputMessage('')
    setChatLoading(true)

    try {
      // Agent API 호출
      const { chatWithAgent } = await import('@/apis/legal.service')
      
      // 사용자 ID 가져오기
      const { createSupabaseBrowserClient } = await import('@/supabase/supabase-client')
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id || null
      
      // analysisId를 situationAnalysisId로 사용 (이미 분석된 상황)
      const data = await chatWithAgent({
        mode: 'situation',
        message: query,
        sessionId: sessionId,
        situationAnalysisId: analysisId || undefined, // 이미 분석된 상황의 ID
      }, userId)
      
      // 세션 ID 저장
      if (data.sessionId) {
        setSessionId(data.sessionId)
      }
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answerMarkdown || '답변을 생성할 수 없습니다.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
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
    }
  }, [analysisId, sessionId, inputMessage])

  // 재시도 함수
  const handleRetry = useCallback((originalQuery: string) => {
    setMessages((prev) => {
      const filtered = [...prev]
      const lastErrorIndex = filtered.findLastIndex(msg => msg.isError && msg.retryable)
      if (lastErrorIndex !== -1) {
        filtered.splice(lastErrorIndex, 1)
      }
      return filtered
    })
    handleSendMessage(undefined, originalQuery)
  }, [handleSendMessage])

  // 초기 메시지 개수 알림
  useEffect(() => {
    const initialMessages = loadMessages()
    onMessageCountChange?.(initialMessages.length)
  }, [chatId, onMessageCountChange])

  // 메시지가 변경될 때마다 저장
  useEffect(() => {
    saveMessages(messages)
    onMessageCountChange?.(messages.length)
  }, [messages, chatId, onMessageCountChange])

  // 로딩 상태 변경 알림
  useEffect(() => {
    onLoadingChange?.(chatLoading)
  }, [chatLoading, onLoadingChange])

  // 사용자 스크롤 감지
  useEffect(() => {
    const container = chatContainerRef.current
    if (!container) return

    let scrollTimeout: NodeJS.Timeout
    const handleScroll = () => {
      setIsUserScrolling(true)
      clearTimeout(scrollTimeout)
      
      const isNearBottom = 
        container.scrollHeight - container.scrollTop - container.clientHeight < 50
      
      if (isNearBottom) {
        setShouldAutoScroll(true)
      } else {
        setShouldAutoScroll(false)
      }

      scrollTimeout = setTimeout(() => {
        setIsUserScrolling(false)
      }, 1000)
    }

    container.addEventListener('scroll', handleScroll)
    return () => {
      container.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [])

  // 스크롤을 하단으로 이동
  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current && !isUserScrolling) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, shouldAutoScroll, isUserScrolling])

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 채팅 영역 */}
      <div
        ref={chatContainerRef}
        className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50 relative"
      >
        {/* 메시지 목록 */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                  <div className="relative p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100">
                    <MessageSquare className="w-12 h-12 mx-auto text-blue-500 mb-3" />
                    <p className="text-base font-medium text-slate-700 mb-1">질문을 시작해보세요</p>
                    <p className="text-sm text-slate-500">
                      직접 질문을 입력해주세요
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* 아바타 */}
                  {message.role === 'assistant' && (
                    <div 
                      className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg ring-2 ring-white"
                      aria-label="AI 어시스턴트"
                    >
                      <Bot className="w-5 h-5 text-white" aria-hidden="true" />
                    </div>
                  )}

                  {/* 메시지 내용 */}
                  <div className={cn(
                    "flex flex-col gap-1.5 max-w-[85%] sm:max-w-[75%]",
                    message.role === 'user' ? 'items-end' : 'items-start'
                  )}>
                    <div
                      className={cn(
                        "relative rounded-2xl px-4 py-3 shadow-sm",
                        "transition-all duration-200",
                        message.role === 'user'
                          ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md"
                          : message.isError
                          ? "bg-red-50 border-2 border-red-200 text-slate-900 rounded-bl-md"
                          : "bg-white border border-slate-100 text-slate-900 rounded-bl-md"
                      )}
                    >
                      {message.role === 'assistant' ? (
                        <>
                          {message.isError ? (
                            <div className="flex flex-col gap-3">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-red-900 mb-1">{message.content}</p>
                                  <p className="text-xs text-red-700">네트워크 오류가 발생했거나 서버에 일시적인 문제가 있을 수 있습니다.</p>
                                </div>
                              </div>
                              {message.retryable && message.originalQuery && (
                                <Button
                                  onClick={() => handleRetry(message.originalQuery!)}
                                  disabled={chatLoading}
                                  size="sm"
                                  variant="outline"
                                  className="w-full border-red-300 text-red-700 hover:bg-red-50"
                                >
                                  다시 시도
                                </Button>
                              )}
                            </div>
                          ) : (
                            <SituationChatMessage content={message.content} />
                          )}
                        </>
                      ) : (
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
                      )}
                    </div>
                  </div>

                  {message.role === 'user' && (
                    <div 
                      className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center shadow-lg ring-2 ring-white"
                      aria-label="사용자"
                    >
                      <User className="w-5 h-5 text-white" aria-hidden="true" />
                    </div>
                  )}
                </div>
              ))}
              
              {chatLoading && (
                <div className="flex gap-3 sm:gap-4 justify-start">
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg ring-2 ring-white">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                      <span className="text-sm text-slate-600">답변을 생성하는 중...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>


        {/* 입력 영역 */}
        <div className="flex-shrink-0 border-t border-slate-200 bg-white p-4">
          <div className="flex gap-2">
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="질문을 입력하세요... (⌘/Ctrl + Enter로 전송)"
              disabled={chatLoading}
              className="min-h-[60px] max-h-[200px] resize-none"
              rows={2}
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || chatLoading}
              className="self-end bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl min-w-[60px] min-h-[60px]"
            >
              {chatLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
