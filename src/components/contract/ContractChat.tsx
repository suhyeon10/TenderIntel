'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, MessageSquare, Sparkles, Bot, User, FileText, Zap, RefreshCw, AlertCircle } from 'lucide-react'
import { MarkdownRenderer } from '@/components/rag/MarkdownRenderer'
import { LegalChatMessage } from './LegalChatMessage'
import { cn } from '@/lib/utils'
import { PRIMARY_GRADIENT, PRIMARY_GRADIENT_HOVER, FOCUS_STYLE } from './contract-design-tokens'
import type { LegalIssue, ContractAnalysisResult } from '@/types/legal'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isError?: boolean
  retryable?: boolean
  originalQuery?: string
}

interface ContractChatProps {
  docId: string
  analysisResult: ContractAnalysisResult
  selectedIssueId?: string
  prefilledQuestion?: string
  onQuestionPrefilled?: () => void
  externalMessage?: string
  onExternalMessageSent?: () => void
  onLoadingChange?: (loading: boolean) => void
  onMessageCountChange?: (count: number) => void
}

export function ContractChat({
  docId,
  analysisResult,
  selectedIssueId,
  prefilledQuestion,
  onQuestionPrefilled,
  externalMessage,
  onExternalMessageSent,
  onLoadingChange,
  onMessageCountChange,
}: ContractChatProps) {
  // localStorage에서 메시지 로드
  const loadMessages = (): Message[] => {
    if (typeof window === 'undefined') return []
    try {
      const stored = localStorage.getItem(`contract_chat_${docId}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }))
      }
    } catch (error) {
      console.error('메시지 로드 실패:', error)
    }
    return []
  }

  // 메시지 저장
  const saveMessages = (msgs: Message[]) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(`contract_chat_${docId}`, JSON.stringify(msgs))
    } catch (error) {
      console.error('메시지 저장 실패:', error)
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

  // 분석 결과 기반 추천 질문 생성 (해커톤용 강화)
  const generateSuggestedQuestions = (): string[] => {
    const questions: string[] = []
    const { issues, riskScore, summary } = analysisResult
    const currentIssue = selectedIssueId
      ? analysisResult.issues.find(i => i.id === selectedIssueId)
      : undefined

    // 선택된 조항이 있는 경우 해당 조항 관련 질문 우선
    if (currentIssue) {
      const clauseNumber = currentIssue.location?.clauseNumber
      const clauseText = clauseNumber ? `제${clauseNumber}조` : '이 조항'
      
      questions.push(`가장 위험한 조항은?`)
      questions.push(`${clauseText} 어떻게 수정하면 좋을까?`)
      questions.push(`법적 근거 설명해줘`)
      
      // 카테고리별 맞춤 질문
      if (currentIssue.category === 'wage' || currentIssue.category === 'payment') {
        questions.push('임금 지급 조건은 적절한가요?')
      } else if (currentIssue.category === 'working_hours') {
        questions.push('근로시간 관련 법적 위험은?')
      } else if (currentIssue.category === 'probation' || currentIssue.category === 'dismissal') {
        questions.push('해지 조건은 공정한가요?')
      }
      
      return questions.slice(0, 4) // 최대 4개
    }

    // 전체 계약서 관련 질문
    questions.push('가장 위험한 조항은?')
    
    const highRiskIssues = issues.filter(i => i.severity === 'high')
    if (highRiskIssues.length > 0) {
      questions.push('이 계약서에서 가장 먼저 수정해야 할 조항은 무엇인가요?')
    }

    const workingHoursIssues = issues.filter(i => i.category === 'working_hours')
    if (workingHoursIssues.length > 0) {
      questions.push('근로시간/수당 관련해서 법적으로 위험한 부분을 정리해 주세요.')
    }

    const wageIssues = issues.filter(i => i.category === 'wage' || i.category === 'payment')
    if (wageIssues.length > 0) {
      questions.push('임금 지급 조건은 적절한가요?')
    }

    // 기본 질문 (질문이 부족할 경우)
    if (questions.length < 3) {
      questions.push('이 계약서의 주요 위험 요소는 무엇인가요?')
      questions.push('법적 근거 설명해줘')
    }

    return questions.slice(0, 4) // 최대 4개
  }

  const suggestedQuestions = generateSuggestedQuestions()

  // 메시지 전송 (해커톤용 강화 - 자동 프리필 지원)
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
      
      // docId를 contractAnalysisId로 사용 (이미 분석된 계약서)
      const data = await chatWithAgent({
        mode: 'contract',
        message: query,
        sessionId: sessionId,
        contractAnalysisId: docId, // 이미 분석된 계약서의 ID
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
      console.error('메시지 전송 실패:', error)
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
  }, [docId, sessionId, inputMessage])

  // 재시도 함수
  const handleRetry = useCallback((originalQuery: string) => {
    // 마지막 에러 메시지만 제거
    setMessages((prev) => {
      const filtered = [...prev]
      const lastErrorIndex = filtered.findLastIndex(msg => msg.isError && msg.retryable)
      if (lastErrorIndex !== -1) {
        filtered.splice(lastErrorIndex, 1)
      }
      return filtered
    })
    // 메시지 재전송
    handleSendMessage(undefined, originalQuery)
  }, [handleSendMessage])

  // 초기 메시지 개수 알림
  useEffect(() => {
    const initialMessages = loadMessages()
    onMessageCountChange?.(initialMessages.length)
  }, [docId, onMessageCountChange])

  // 메시지가 변경될 때마다 저장
  useEffect(() => {
    saveMessages(messages)
    onMessageCountChange?.(messages.length)
  }, [messages, docId, onMessageCountChange])

  // 외부에서 메시지 전송 요청
  useEffect(() => {
    if (externalMessage && externalMessage.trim()) {
      handleSendMessage(undefined, externalMessage)
      onExternalMessageSent?.()
    }
  }, [externalMessage, onExternalMessageSent, handleSendMessage])

  // 로딩 상태 변경 알림
  useEffect(() => {
    onLoadingChange?.(chatLoading)
  }, [chatLoading, onLoadingChange])

  // 프리필된 질문이 있으면 입력창에 설정
  useEffect(() => {
    if (prefilledQuestion && prefilledQuestion.trim()) {
      setInputMessage(prefilledQuestion)
      onQuestionPrefilled?.()
    }
  }, [prefilledQuestion, onQuestionPrefilled])

  // 선택된 이슈가 변경되면 자동으로 질문 생성 (프리필이 없을 때만)
  useEffect(() => {
    if (selectedIssueId && messages.length === 0 && !prefilledQuestion) {
      const issue = analysisResult.issues.find(i => i.id === selectedIssueId)
      if (issue) {
        const categoryLabels: Record<string, string> = {
          working_hours: '근로시간·연장근로',
          wage: '보수·수당',
          probation: '수습·해지',
          stock_option: '스톡옵션',
          ip: 'IP/저작권',
          harassment: '직장내괴롭힘',
          other: '이',
        }
        const categoryLabel = categoryLabels[issue.category] || '이'
        const autoQuestion = categoryLabel === '이' 
          ? `${categoryLabel} 조항에 대해 자세히 설명해주세요.`
          : `이 ${categoryLabel} 조항에 대해 자세히 설명해주세요.`
        setInputMessage(autoQuestion)
      }
    }
  }, [selectedIssueId, analysisResult.issues, messages.length, prefilledQuestion])

  // 사용자 스크롤 감지
  useEffect(() => {
    const container = chatContainerRef.current
    if (!container) return

    let scrollTimeout: NodeJS.Timeout
    const handleScroll = () => {
      setIsUserScrolling(true)
      clearTimeout(scrollTimeout)
      
      // 스크롤이 하단 근처인지 확인 (50px 이내)
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

  // 스크롤을 하단으로 이동 (자동 스크롤이 활성화된 경우만)
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

      {/* 추천 질문 - 현대적인 카드 디자인 */}
      {messages.length === 0 && (
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white flex-shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-blue-100 rounded-lg">
              <Sparkles className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm font-semibold text-slate-700">추천 질문</span>
          </div>
          <p className="text-[11px] text-slate-500 mb-2">
            자주 묻는 질문이에요. 하나 골라서 바로 시작해도 좋습니다.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => handleSendMessage(question)}
                disabled={chatLoading}
                aria-label={`추천 질문: ${question}`}
                className={cn(
                  "group relative px-3 py-2 text-xs font-medium min-h-[44px]", // 최소 터치 영역
                  "bg-white border border-slate-200 rounded-xl",
                  "hover:border-blue-400 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50",
                  "hover:shadow-md hover:scale-[1.02]",
                  "transition-all duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
                  FOCUS_STYLE,
                  "text-left ai-button cursor-pointer"
                )}
              >
                <span className="relative z-10 text-slate-700 group-hover:text-blue-700 line-clamp-2">
                  {question}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 선택된 조항 태그 - sticky로 고정 */}
      {selectedIssueId && (() => {
        const issue = analysisResult.issues.find(i => i.id === selectedIssueId)
        if (!issue) return null
        
        const clauseNumber = issue.location?.clauseNumber
        const categoryLabel = issue.category
          ? {
              pay: '보수·수당',
              wage: '보수·수당',
              working_hours: '근로시간',
              leave: '연차·휴가',
              termination: '해지·해고',
              non_compete: '경업금지',
              nda: '비밀유지',
              ip: '저작권',
              job_stability: '고용안정',
              dismissal: '해고·해지',
              payment: '보수·수당',
              liability: '손해배상',
              dispute: '분쟁해결',
              harassment: '직장 내 괴롭힘',
              probation: '수습/해지',
              stock_option: '스톡옵션',
              other: '기타',
            }[issue.category] || issue.category
          : '계약 조항'
        
        const clauseTitle = clauseNumber 
          ? `제${clauseNumber}조 ${categoryLabel}`
          : categoryLabel
        
        const severityLabel =
          issue.severity === 'high' ? '위험 HIGH' :
          issue.severity === 'medium' ? '주의 MED' : '안전 LOW'
        const severityClass =
          issue.severity === 'high'
            ? 'bg-red-100 text-red-700 border-red-200'
            : issue.severity === 'medium'
            ? 'bg-amber-100 text-amber-700 border-amber-200'
            : 'bg-emerald-100 text-emerald-700 border-emerald-200'

        return (
          <div className="sticky top-0 z-10 px-4 py-2.5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0 flex items-center justify-between backdrop-blur-sm bg-opacity-95">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="p-1 bg-blue-100 rounded-md flex-shrink-0">
                <FileText className="w-3 h-3 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-blue-700 truncate">
                  {clauseTitle}
                </div>
                {issue.summary && (
                  <div className="text-[10px] text-slate-500 truncate">
                    {issue.summary}
                  </div>
                )}
              </div>
            </div>
            <span className={cn("text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 font-semibold", severityClass)}>
              {severityLabel}
            </span>
          </div>
        )
      })()}

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
                      위의 추천 질문을 선택하거나 직접 질문을 입력해주세요
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
                  {/* 아바타 - 사용자는 오른쪽, AI는 왼쪽 */}
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
                          ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-br-md message-bubble-user"
                          : message.isError
                          ? "bg-red-50 border-2 border-red-200 text-slate-900 rounded-bl-md message-bubble-ai"
                          : "bg-white border border-slate-100 text-slate-900 rounded-bl-md message-bubble-ai"
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
                                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                                  aria-label="재시도"
                                >
                                  <RefreshCw className={cn("w-4 h-4 mr-2", chatLoading && "animate-spin")} />
                                  다시 시도
                                </Button>
                              )}
                            </div>
                          ) : (
                            <LegalChatMessage
                              content={message.content}
                              selectedIssue={selectedIssueId 
                                ? {
                                    id: analysisResult.issues.find(i => i.id === selectedIssueId)?.id,
                                    category: analysisResult.issues.find(i => i.id === selectedIssueId)?.category,
                                    summary: analysisResult.issues.find(i => i.id === selectedIssueId)?.summary,
                                    location: analysisResult.issues.find(i => i.id === selectedIssueId)?.location,
                                  }
                                : undefined}
                            />
                          )}
                        </>
                      ) : (
                        // Contract 페이지용 사용자 메시지 - 단순 텍스트만 표시
                        // (Quick 상담 페이지와 달리 컨텍스트 정보 없이 깔끔하게)
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-white font-medium">
                          {message.content}
                        </p>
                      )}
                    </div>
                    <p className={cn(
                      "text-xs px-1",
                      message.role === 'user' ? 'text-slate-500' : 'text-slate-400'
                    )}>
                      {message.timestamp.toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {/* 사용자 아바타 */}
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
              
              {/* 로딩 상태 */}
              {chatLoading && (
                <div className="flex gap-3 sm:gap-4 justify-start animate-in fade-in slide-in-from-bottom-2" role="status" aria-live="polite">
                  <div 
                    className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg ring-2 ring-white"
                    aria-label="AI 어시스턴트"
                  >
                    <Bot className="w-5 h-5 text-white" aria-hidden="true" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      <div className="flex gap-1" aria-hidden="true">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                      <span className="text-sm text-slate-600">답변 생성 중...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
              
              {/* 새 메시지 알림 (사용자가 위로 스크롤한 경우) */}
              {!shouldAutoScroll && messages.length > 0 && (
                <button
                  onClick={() => {
                    setShouldAutoScroll(true)
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  className="sticky bottom-4 mx-auto px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-full shadow-lg hover:bg-blue-700 transition-colors z-10"
                  aria-label="새 메시지 보기"
                >
                  새 메시지 보기 ↓
                </button>
              )}
            </>
          )}
        </div>

        {/* 입력 영역 - 현대적인 디자인 */}
        <div className="border-t border-slate-200 bg-white/80 backdrop-blur-sm p-4 flex-shrink-0">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={
                  (() => {
                    const currentIssue = selectedIssueId
                      ? analysisResult.issues.find(i => i.id === selectedIssueId)
                      : undefined
                    
                    if (currentIssue) {
                      const clauseNumber = currentIssue.location?.clauseNumber
                      const categoryLabelForPlaceholder = ({
                        working_hours: '근로시간/연장근로',
                        wage: '보수·수당',
                        probation: '수습/해지',
                        stock_option: '스톡옵션',
                        ip: 'IP/저작권',
                        harassment: '직장 내 괴롭힘',
                        job_stability: '고용안정',
                        dismissal: '해고·해지',
                        payment: '보수·수당',
                        non_compete: '경업금지',
                        liability: '손해배상',
                        dispute: '분쟁해결',
                        nda: '비밀유지',
                        other: '이 조항',
                      }[currentIssue.category] ?? '이 조항')
                      
                      const clauseText = clauseNumber 
                        ? `제${clauseNumber}조 ${categoryLabelForPlaceholder}` 
                        : categoryLabelForPlaceholder
                      return `예) ${clauseText} 이대로 서명해도 괜찮나요? / 회사에 이렇게 수정 요청해도 될까요?`
                    }
                    
                    return "예) 이 조항 이대로 서명해도 괜찮나요? / 회사에 이렇게 수정 요청해도 될까요?"
                  })()
                }
                disabled={chatLoading}
                aria-label="AI에게 질문 입력"
                aria-describedby="chat-input-hint"
                className={cn(
                  "min-h-[60px] max-h-[140px] resize-none text-sm",
                  "border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100",
                  "rounded-xl pr-12",
                  "transition-all duration-200"
                )}
                rows={2}
              />
              <span id="chat-input-hint" className="sr-only">
                질문을 입력하고 Ctrl+Enter를 눌러 전송하세요
              </span>
              <div className="absolute bottom-2 right-2 flex items-center gap-1.5 text-xs text-slate-400">
                <span className="hidden sm:flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">Ctrl</kbd>
                  <span>+</span>
                  <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-xs">Enter</kbd>
                </span>
                <span className="sm:hidden text-[10px]">전송</span>
              </div>
            </div>
            <Button
              onClick={() => handleSendMessage()}
              disabled={chatLoading || !inputMessage.trim()}
              size="lg"
              aria-label="질문 전송"
              className={cn(
                "h-[60px] min-w-[60px] px-6 rounded-xl", // 최소 터치 영역 보장
                PRIMARY_GRADIENT,
                PRIMARY_GRADIENT_HOVER,
                "text-white shadow-lg hover:shadow-xl",
                "transition-all duration-200",
                "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg",
                "focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-blue-600",
                "flex-shrink-0"
              )}
            >
              {chatLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  <span className="sr-only">전송 중</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" aria-hidden="true" />
                  <span className="sr-only">전송</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
