'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, AlertTriangle, FileText, Clock, DollarSign, Briefcase, Send, Bot, User, Loader2, MessageSquare } from 'lucide-react'
import { MarkdownRenderer } from '@/components/rag/MarkdownRenderer'

interface Situation {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  description: string
  checklist: {
    item: string
    description?: string
  }[]
  evidenceGuide: {
    title: string
    items: string[]
  }[]
  nextSteps: string[]
}

const situations: Situation[] = [
  {
    id: 'probation-dismissal',
    title: '수습 중 해고',
    icon: Briefcase,
    description: '수습기간 중 해고 통보를 받은 경우',
    checklist: [
      {
        item: '해고 사유 확인',
        description: '구체적인 해고 사유가 명시되어 있는지 확인',
      },
      {
        item: '수습기간 확인',
        description: '계약서에 명시된 수습기간이 법정 기준(3개월)을 초과하지 않는지 확인',
      },
      {
        item: '해고 통보서 수령',
        description: '해고 통보서를 반드시 받아 보관',
      },
      {
        item: '근로기준법 위반 여부 확인',
        description: '정당한 사유 없이 해고된 경우 근로기준법 위반 가능성',
      },
    ],
    evidenceGuide: [
      {
        title: '필수 증거 자료',
        items: [
          '근로계약서 사본',
          '해고 통보서 (또는 이메일/문자 메시지)',
          '급여 명세서',
          '출퇴근 기록 (근태 기록)',
          '회사와의 대화 녹음 파일 (있는 경우)',
        ],
      },
      {
        title: '추가 수집 권장 자료',
        items: [
          '회사 규정집 (인사 규정)',
          '평가서 또는 피드백 문서',
          '동료 증언 (가능한 경우)',
          '회사와의 이메일/메신저 대화 기록',
        ],
      },
    ],
    nextSteps: [
      '노동위원회에 부당해고 구제 신청',
      '근로감독관에게 신고',
      '노동조합 또는 노동상담센터 상담',
      '법률 전문가 상담 (필요시)',
    ],
  },
  {
    id: 'wage-theft',
    title: '임금 체불',
    icon: DollarSign,
    description: '급여가 지급되지 않거나 지연되는 경우',
    checklist: [
      {
        item: '미지급 금액 확인',
        description: '정확한 미지급 금액과 기간을 계산',
      },
      {
        item: '계약서 확인',
        description: '계약서에 명시된 급여 금액과 실제 지급 금액 비교',
      },
      {
        item: '급여 명세서 확인',
        description: '급여 명세서를 모두 보관하고 확인',
      },
      {
        item: '회사에 서면 요청',
        description: '미지급 임금에 대해 회사에 서면으로 요청 (증거 확보)',
      },
    ],
    evidenceGuide: [
      {
        title: '필수 증거 자료',
        items: [
          '근로계약서 (급여 조항)',
          '급여 명세서 (모든 분기)',
          '은행 계좌 거래 내역',
          '회사에 보낸 임금 지급 요청서',
          '회사로부터 받은 답변 (이메일/문자)',
        ],
      },
      {
        title: '추가 수집 권장 자료',
        items: [
          '출퇴근 기록 (실제 근로 시간)',
          '초과근무 기록',
          '회사와의 대화 녹음',
          '동료 증언 (같은 상황인 경우)',
        ],
      },
    ],
    nextSteps: [
      '근로감독관에게 신고 (체불임금 신고)',
      '노동위원회에 임금 체불 구제 신청',
      '법률 전문가 상담 (소송 고려)',
      '임금 채권 보호 보험 신청 (해당 시)',
    ],
  },
  {
    id: 'workplace-harassment',
    title: '직장 내 괴롭힘',
    icon: AlertTriangle,
    description: '직장 내 괴롭힘, 성희롱, 권력 남용 등을 경험한 경우',
    checklist: [
      {
        item: '사건 기록',
        description: '발생한 사건을 구체적으로 기록 (날짜, 시간, 장소, 인물, 내용)',
      },
      {
        item: '증거 수집',
        description: '가능한 모든 증거 자료 수집 (메시지, 이메일, 녹음 등)',
      },
      {
        item: '회사 내부 신고',
        description: '회사 내부 신고 절차 확인 및 신고 (있는 경우)',
      },
      {
        item: '상담 및 지원',
        description: '직장 내 괴롭힘 상담센터 또는 전문가 상담',
      },
    ],
    evidenceGuide: [
      {
        title: '필수 증거 자료',
        items: [
          '사건 일지 (상세 기록)',
          '대화 녹음 파일 (법적으로 허용되는 경우)',
          '이메일/메신저 대화 기록',
          'CCTV 영상 (있는 경우)',
          '의료 기록 (정신적/신체적 피해)',
        ],
      },
      {
        title: '추가 수집 권장 자료',
        items: [
          '동료 증언 (목격자)',
          '회사 내부 신고서',
          '회사로부터 받은 답변',
          '상담 기록',
        ],
      },
    ],
    nextSteps: [
      '직장 내 괴롭힘 신고센터 신고 (고용노동부)',
      '경찰 신고 (범죄에 해당하는 경우)',
      '법률 전문가 상담',
      '정신건강 전문가 상담',
    ],
  },
]

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function GuidePage() {
  const router = useRouter()
  const [selectedSituation, setSelectedSituation] = useState<Situation | null>(null)
  
  // 챗봇 관련 상태
  const [showChat, setShowChat] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // 메시지 스크롤
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // 상황이 변경되면 챗봇 초기화
  useEffect(() => {
    if (selectedSituation) {
      setMessages([])
      setShowChat(false)
    }
  }, [selectedSituation])

  // 메시지 전송
  const handleSendMessage = async () => {
    const query = inputMessage.trim()
    if (!query || chatLoading) return

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
      // 상황 컨텍스트를 포함한 질문 구성
      const situationContext = selectedSituation
        ? `${selectedSituation.title} 상황에 대해 질문합니다: ${query}`
        : query

      const response = await fetch('/api/legal/analyze-situation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: situationContext }),
      })

      if (response.ok) {
        const data = await response.json()
        
        // 응답 포맷팅
        let answer = ''
        if (data.summary) {
          answer = `## 요약\n\n${data.summary}\n\n`
        }
        
        if (data.issues && data.issues.length > 0) {
          answer += `## 주요 이슈\n\n`
          data.issues.forEach((issue: any, idx: number) => {
            answer += `${idx + 1}. **${issue.name}** (심각도: ${issue.severity})\n   ${issue.description}\n\n`
          })
        }
        
        if (data.recommendations && data.recommendations.length > 0) {
          answer += `## 권장 사항\n\n`
          data.recommendations.forEach((rec: any, idx: number) => {
            answer += `${idx + 1}. **${rec.title}**\n   ${rec.description}\n`
            if (rec.steps && rec.steps.length > 0) {
              answer += `   단계:\n`
              rec.steps.forEach((step: string) => {
                answer += `   - ${step}\n`
              })
            }
            answer += `\n`
          })
        }

        if (!answer) {
          answer = '관련 정보를 찾을 수 없습니다. 더 구체적으로 질문해주세요.'
        }

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: answer,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMessage])
      } else {
        throw new Error('답변 생성 실패')
      }
    } catch (error) {
      console.error('메시지 전송 실패:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '답변을 생성하는 중 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setChatLoading(false)
    }
  }

  // 제안 질문들
  const suggestedQuestions = selectedSituation
    ? [
        `${selectedSituation.title} 상황에서 어떤 법적 권리가 있나요?`,
        `이 상황에서 어떤 증거를 수집해야 하나요?`,
        `이 상황의 법적 위험도는 어느 정도인가요?`,
        `이 상황에서 권장되는 대응 방법은 무엇인가요?`,
      ]
    : [
        '수습 중 해고는 법적으로 어떻게 보호받을 수 있나요?',
        '임금 체불 시 어떤 절차를 따라야 하나요?',
        '직장 내 괴롭힘을 당했을 때 어떻게 해야 하나요?',
      ]

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 max-w-6xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3 text-slate-900">
            상황별 상담 가이드
          </h1>
          <p className="text-lg text-slate-600">
            어떤 상황이신가요? 상황을 선택하면 단계별 체크리스트와 증거 수집 가이드를 확인할 수 있습니다
          </p>
        </div>

        {/* 상황 선택 카드 */}
        {!selectedSituation && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {situations.map((situation) => {
              const Icon = situation.icon
              return (
                <button
                  key={situation.id}
                  onClick={() => setSelectedSituation(situation)}
                  className="p-6 rounded-2xl border-2 border-slate-200 bg-white hover:border-blue-400 hover:shadow-lg transition-all text-left"
                >
                  <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-slate-900">{situation.title}</h3>
                  <p className="text-sm text-slate-600">{situation.description}</p>
                </button>
              )
            })}
          </div>
        )}

        {/* 선택된 상황 상세 정보 */}
        {selectedSituation && (
          <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedSituation(null)}
                  className="text-slate-600 hover:text-slate-900"
                >
                  ← 돌아가기
                </button>
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                  {(() => {
                    const Icon = selectedSituation.icon
                    return <Icon className="w-6 h-6" />
                  })()}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedSituation.title}</h2>
                  <p className="text-slate-600">{selectedSituation.description}</p>
                </div>
              </div>
            </div>

            {/* 체크리스트 */}
            <div className="rounded-2xl border border-slate-200 p-6 bg-white shadow-sm">
              <h3 className="text-xl font-semibold mb-4 text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                단계별 체크리스트
              </h3>
              <div className="space-y-3">
                {selectedSituation.checklist.map((item, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                    <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-900 mb-1">{item.item}</p>
                      {item.description && (
                        <p className="text-sm text-slate-600">{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 증거 수집 가이드 */}
            <div className="rounded-2xl border border-slate-200 p-6 bg-white shadow-sm">
              <h3 className="text-xl font-semibold mb-4 text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                증거 수집 가이드
              </h3>
              <div className="space-y-6">
                {selectedSituation.evidenceGuide.map((guide, index) => (
                  <div key={index}>
                    <h4 className="font-semibold text-slate-900 mb-3">{guide.title}</h4>
                    <ul className="space-y-2">
                      {guide.items.map((item, itemIndex) => (
                        <li key={itemIndex} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-slate-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* 다음 단계 */}
            <div className="rounded-2xl border border-blue-200 p-6 bg-blue-50">
              <h3 className="text-xl font-semibold mb-4 text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-blue-600" />
                권장 대응 방법
              </h3>
              <ul className="space-y-2">
                {selectedSituation.nextSteps.map((step, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                      {index + 1}
                    </div>
                    <span className="text-sm text-slate-700">{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* AI 상담 챗봇 */}
            <div className="rounded-2xl border border-slate-200 p-6 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  AI 법률 상담
                </h3>
                <Button
                  onClick={() => setShowChat(!showChat)}
                  variant="outline"
                  size="sm"
                  className="text-sm"
                >
                  {showChat ? '접기' : '펼치기'}
                </Button>
              </div>
              
              {showChat && (
                <div className="space-y-4">
                  {/* 제안 질문 */}
                  {messages.length === 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-600 mb-3">
                        아래 질문을 클릭하거나 직접 질문해보세요:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {suggestedQuestions.slice(0, 4).map((question, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setInputMessage(question)
                              setTimeout(() => handleSendMessage(), 100)
                            }}
                            className="text-left p-3 text-sm bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                          >
                            {question}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 메시지 목록 */}
                  <div
                    ref={chatContainerRef}
                    className="h-96 overflow-y-auto space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    {messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-slate-500">
                        <div className="text-center">
                          <Bot className="w-12 h-12 mx-auto mb-2 text-slate-400" />
                          <p>질문을 입력하면 AI가 법률 정보를 검색하여 답변해드립니다.</p>
                        </div>
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex gap-3 ${
                            message.role === 'user' ? 'justify-end' : 'justify-start'
                          }`}
                        >
                          {message.role === 'assistant' && (
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <Bot className="w-4 h-4 text-blue-600" />
                            </div>
                          )}
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                              message.role === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-white text-slate-900 border border-slate-200'
                            }`}
                          >
                            {message.role === 'assistant' ? (
                              <MarkdownRenderer content={message.content} />
                            ) : (
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            )}
                          </div>
                          {message.role === 'user' && (
                            <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-slate-600" />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    {chatLoading && (
                      <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200">
                          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                        </div>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* 입력 영역 */}
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
                      placeholder="법률 상담 질문을 입력하세요..."
                      className="flex-1 min-h-[60px] resize-none"
                      disabled={chatLoading}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || chatLoading}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                    >
                      {chatLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* 하단 버튼 */}
            <div className="flex gap-4">
              <Button
                onClick={() => router.push('/legal/contract')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-3 font-semibold"
                size="lg"
              >
                계약서 업로드하기
              </Button>
              <Button
                onClick={() => setSelectedSituation(null)}
                variant="outline"
                className="flex-1 border-2 border-slate-300 rounded-xl px-6 py-3 font-semibold"
                size="lg"
              >
                다른 상황 보기
              </Button>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}

