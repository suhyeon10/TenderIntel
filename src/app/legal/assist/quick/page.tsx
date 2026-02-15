'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Zap, 
  Send,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Copy,
  FileText,
  FolderArchive,
  Edit,
  X,
  Bot,
  User,
  Clock,
  Briefcase,
  DollarSign,
  Users,
  TrendingUp,
  Sparkles,
  Plus,
  Paperclip,
  Globe,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { 
  analyzeSituationV2, 
  type SituationRequestV2, 
  chatWithContractV2, 
  getSituationHistoryV2, 
  getContractHistoryV2,
  getSituationAnalysisByIdV2,
  getContractAnalysisV2,
  // 새로운 통합 챗 API
  createChatSession,
  getChatSessions,
  getChatSession,
  saveChatMessage,
  getChatMessages,
  updateChatSession,
  deleteChatSession,
  chatWithAgent,
  type ChatSession,
  type ChatMessage as ChatMessageType,
} from '@/apis/legal.service'
import { ChatAiMessage } from '@/components/legal/ChatAiMessage'
import { SituationChatMessage } from '@/components/legal/SituationChatMessage'
import { ContractChatMessage } from '@/components/legal/ContractChatMessage'
import type { 
  SituationAnalysisResponse,
  SituationCategory,
  EmploymentType,
  WorkPeriod,
} from '@/types/legal'
// import { parseJsonFromMessage } from '@/utils/jsonParser' // TODO: 유틸 생성 필요

// 색상 상수 (다른 페이지와 통일)
const PRIMARY_GRADIENT = 'from-blue-600 to-indigo-600'
const PRIMARY_GRADIENT_HOVER = 'hover:from-blue-700 hover:to-indigo-700'

// 상황 분석 프리셋 템플릿
const SITUATION_PRESETS = [
  {
    title: '인턴/수습 해고 통보',
    icon: Briefcase,
    category: 'probation' as SituationCategory,
    employmentType: 'intern' as EmploymentType,
    workPeriod: '3개월 미만' as string, // 한글 형식
    summary: '수습 인턴인데, 해고 통보를 받았어요',
    description: '수습 기간 중 갑작스러운 해고 통보를 받은 경우',
    details: `[언제부터]
예: 2025년 1월부터, 수습 인턴으로 근무 중입니다.

[어떤 일이 반복되나요]
예: 최근 2주 동안, 팀장님이...

[내가 느끼는 문제점]
예: 수습이라서 언제든 내보낼 수 있다고 반복적으로 말하며...`,
    socialInsurance: ['health', 'employment'] as string[],
  },
  {
    title: '임금 체불·수당 미지급',
    icon: DollarSign,
    category: 'unpaid_wage' as SituationCategory,
    employmentType: 'regular' as EmploymentType,
    workPeriod: '1년 이상' as string, // 한글 형식
    summary: '3개월째 월급이 매번 일주일 이상 늦게 들어와요',
    description: '월급이나 수당이 지급되지 않거나 지연되는 경우',
    details: `[언제부터]
예: 2024년 9월부터 월급 지급이 불규칙해지기 시작했습니다.

[어떤 일이 반복되나요]
예: 계약서에는 매월 25일 지급이라고 되어 있는데, 실제로는 다음 달 초에야 들어옵니다.

[내가 느끼는 문제점]
예: 생활비 계획을 세우기 어려워서...`,
    socialInsurance: ['health', 'employment'] as string[],
  },
  {
    title: '프리랜서/용역 대금 미지급',
    icon: FileText,
    category: 'freelancer' as SituationCategory,
    employmentType: 'freelancer' as EmploymentType,
    workPeriod: '3~12개월' as string, // 한글 형식
    summary: '프리랜서인데, 대금이 계속 밀려요',
    description: '프리랜서나 용역 계약에서 대금이 지급되지 않는 경우',
    details: `[언제부터]
예: 2024년 11월부터, 프로젝트 완료 후 대금 지급이 계속 지연되고 있습니다.

[어떤 일이 반복되나요]
예: 계약서에는 "프로젝트 완료 후 7일 이내 지급"이라고 되어 있는데, 3개월째 미지급 상태입니다.

[내가 느끼는 문제점]
예: 생활비를 충당하기 어려워서...`,
    socialInsurance: [] as string[],
  },
  {
    title: '무급 야근·추가 근무',
    icon: Clock,
    category: 'unpaid_wage' as SituationCategory,
    employmentType: 'regular' as EmploymentType,
    workPeriod: '1년 이상' as string, // 한글 형식
    summary: '야근은 매일인데 수당은 없어요',
    description: '연장근로 수당 없이 야근이나 추가 근무를 요구받는 경우',
    details: `[언제부터]
예: 2024년 10월쯤부터, 거의 매주 회의 때마다...

[어떤 일이 반복되나요]
예: 매일 밤 10시 이후까지 근무하는데, 연장근로 수당은 전혀 지급되지 않습니다.

[내가 느끼는 문제점]
예: 법적으로 받아야 할 수당을 받지 못하고 있어서...`,
    socialInsurance: ['health', 'employment'] as string[],
  },
  {
    title: '직장 내 괴롭힘·모욕 발언',
    icon: Users,
    category: 'harassment' as SituationCategory,
    employmentType: 'regular' as EmploymentType,
    workPeriod: '1년 이상' as string, // 한글 형식
    summary: '단톡방/회의에서 모욕적인 말을 들어요',
    description: '상사나 동료로부터 모욕적 발언이나 괴롭힘을 당하는 경우',
    details: `[언제부터]
예: 2024년 10월쯤부터, 거의 매주 회의 때마다...

[누가, 누구에게, 어떤 상황에서 그런 말을/행동을 하나요]
예: 팀장 A가, 팀원들 다 있는 자리에서 특정 사람을 지목해...

[내가 느끼기에 어떤 점이 가장 힘들었나요]
예: 인격을 부정당하는 느낌이라 정신적으로 버티기 힘듦...`,
    socialInsurance: ['health', 'employment'] as string[],
  },
  {
    title: '스톡옵션/성과급 관련 문제',
    icon: TrendingUp,
    category: 'stock_option' as SituationCategory,
    employmentType: 'regular' as EmploymentType,
    workPeriod: '1년 이상' as string, // 한글 형식
    summary: '스톡옵션이나 성과급이 약속과 다르게 지급되지 않아요',
    description: '스톡옵션이나 성과급 관련 약속이 지켜지지 않는 경우',
    details: `[언제부터]
예: 입사 시 스톡옵션을 받기로 약속받았는데...

[어떤 일이 반복되나요]
예: 계약서에는 명시되어 있지 않고, 구두로만 약속받았습니다.

[내가 느끼는 문제점]
예: 퇴사 시 스톡옵션을 받을 수 있을지 불확실해서...`,
    socialInsurance: ['health', 'employment'] as string[],
  },
]


// 메시지 타입 정의
interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  reportId?: string // 리포트가 생성된 경우 리포트 ID
  context_type?: 'none' | 'situation' | 'contract'
  context_id?: string | null
  metadata?: any // 메시지 metadata (cases 포함 가능)
}

// 리포트 타입 정의 (Supabase와 호환)
interface Report {
  id: string
  question: string
  answer: string
  legalBasis: string[]
  recommendations: string[]
  riskScore?: number
  tags?: string[] // 유형 태그
  createdAt: Date
  expiresAt?: Date // Supabase에서는 만료일 없음 (선택사항)
}

// 대화 세션 타입
interface ConversationSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
  sessionId: string  // legal_chat_sessions의 ID
}

// 컨텍스트 타입 정의
type ChatContextType = 'none' | 'situation' | 'contract'

interface ChatContext {
  type: ChatContextType
  id: string | null      // situation_analyses.id or contract_analyses.id
  label?: string         // UI 표시용 (예: "편의점 야간 알바 상황", "김인턴 계약서")
}

// 컨텍스트 링크 정보 생성 유틸 함수
function getContextLink(message: ChatMessage): { href: string; label: string; badge: string } | null {
  if (!message.context_type || !message.context_id || message.context_type === 'none') {
    return null
  }

  if (message.context_type === 'situation') {
    return {
      href: `/legal/situation/${message.context_id}`,
      label: '상황 분석 리포트 보러가기',
      badge: '상황분석'
    }
  }

  if (message.context_type === 'contract') {
    return {
      href: `/legal/contract/${message.context_id}`,
      label: '계약서 분석 리포트 보러가기',
      badge: '계약서분석'
    }
  }

  return null
}

// 컨텍스트 리포트 URL 생성 함수
function getContextReportUrl(context_type?: string, context_id?: string | null): string | null {
  if (!context_type || !context_id || context_type === 'none') return null

  if (context_type === 'situation') return `/legal/situation/${context_id}`
  if (context_type === 'contract') return `/legal/contract/${context_id}`

  return null
}

// 컨텍스트 타입별 스타일 함수
/**
 * 메시지에서 상황분석 JSON 추출 (SituationChatMessage의 extractJsonFromMessage 로직과 동일)
 */
function extractSituationJsonFromMessage(raw: string): { isJson: boolean; parsed?: any } {
  let text = raw.trim()

  if (!text) {
    return { isJson: false }
  }

  // ```json ... ``` 형식이면 코드펜스 제거
  if (text.startsWith('```')) {
    const firstNewline = text.indexOf('\n')
    if (firstNewline !== -1) {
      text = text.slice(firstNewline + 1)
    }
    if (text.endsWith('```')) {
      text = text.slice(0, -3)
    }
    text = text.trim()
  }

  // --- 구분선 찾기 (JSON과 안내 문구 사이)
  const separatorIndex = text.indexOf('---')
  if (separatorIndex !== -1) {
    text = text.substring(0, separatorIndex).trim()
  }

  // ⚠️ 뒤에 붙는 안내 문구 분리
  const warningIndex = text.indexOf('⚠️')
  if (warningIndex !== -1) {
    text = text.substring(0, warningIndex).trim()
  }

  // JSON 객체 시작/끝 찾기 (중괄호 매칭)
  const firstBrace = text.indexOf('{')
  if (firstBrace !== -1) {
    let braceCount = 0
    let lastBrace = -1
    for (let i = firstBrace; i < text.length; i++) {
      if (text[i] === '{') {
        braceCount++
      } else if (text[i] === '}') {
        braceCount--
        if (braceCount === 0) {
          lastBrace = i
          break
        }
      }
    }
    if (lastBrace !== -1) {
      text = text.substring(firstBrace, lastBrace + 1)
    } else {
      // 중괄호 매칭 실패 시 마지막 } 사용
      const lastBraceIndex = text.lastIndexOf('}')
      if (lastBraceIndex !== -1 && lastBraceIndex > firstBrace) {
        text = text.substring(firstBrace, lastBraceIndex + 1)
      }
    }
  }

  try {
    const parsed = JSON.parse(text)
    // reportTitle과 legalPerspective가 있으면 상황분석 JSON으로 판단
    const isJson = parsed && 
                   typeof parsed.reportTitle === 'string' && 
                   parsed.legalPerspective && 
                   typeof parsed.legalPerspective.description === 'string'
    return { isJson, parsed: isJson ? parsed : undefined }
  } catch {
    return { isJson: false }
  }
}

function getContextStyle(type: 'situation' | 'contract') {
  if (type === 'situation') {
    return {
      badgeLabel: '상황 분석 리포트',
      badgeClass: 'bg-sky-50 text-sky-700 border-sky-100',
      borderClass: 'border-l-sky-400',
      icon: <AlertTriangle className="h-3.5 w-3.5 text-sky-500" />,
    }
  }
  return {
    badgeLabel: '계약서 분석 리포트',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-100',
    borderClass: 'border-l-amber-400',
    icon: <FileText className="h-3.5 w-3.5 text-amber-500" />,
  }
}

// 사용자 메시지에 리포트 정보 표시 컴포넌트
function UserMessageWithContext({ 
  message, 
  reportCache, 
  setReportCache 
}: { 
  message: ChatMessage
  reportCache: Map<string, { title: string; summary: string; type: 'situation' | 'contract' }>
  setReportCache: React.Dispatch<React.SetStateAction<Map<string, { title: string; summary: string; type: 'situation' | 'contract' }>>>
}) {
  const [isLoadingReport, setIsLoadingReport] = useState(false)
  const [reportInfo, setReportInfo] = useState<{ title: string; summary: string; type: 'situation' | 'contract' } | null>(null)
  // reportCache를 ref로 추적하여 최신 값을 읽을 수 있도록 함
  const reportCacheRef = useRef(reportCache)
  
  // reportCache가 변경될 때마다 ref 업데이트
  useEffect(() => {
    reportCacheRef.current = reportCache
  }, [reportCache])

  // 리포트 요약 텍스트 추출 유틸 함수
  const extractSummary = (text: string, maxLength: number = 100): string => {
    if (!text) return ''
    const lines = text.split('\n').filter(line => line.trim())
    const shortSummary = lines.slice(0, 2).join(' ').substring(0, maxLength)
    return shortSummary || text.substring(0, maxLength)
  }

  // 상황 분석 리포트 로드
  const loadSituationReport = async (contextId: string, userId: string | null) => {
    const situation = await getSituationAnalysisByIdV2(contextId, userId)
    // SituationResponseV2에는 situation 필드가 없으므로 analysis.summary 사용
    const rawSummary = situation.analysis?.summary || ''
    
    return {
      title: rawSummary?.substring(0, 80) || '상황 분석 리포트',
      summary: extractSummary(rawSummary),
      type: 'situation' as const
    }
  }

  // 계약서 분석 리포트 로드
  const loadContractReport = async (contextId: string) => {
    const contract = await getContractAnalysisV2(contextId)
    const rawSummary = contract.summary || ''
    
    return {
      title: contract.summary?.substring(0, 80) || '계약서 분석 리포트',
      summary: extractSummary(rawSummary),
      type: 'contract' as const
    }
  }

  useEffect(() => {
    const loadReportInfo = async () => {
      // 유효성 검사
      if (!message.context_id || !message.context_type || message.context_type === 'none') {
        return
      }

      // 캐시에서 확인 (ref를 통해 최신 값 읽기)
      const cached = reportCacheRef.current.get(message.context_id!)
      if (cached) {
        setReportInfo(cached)
        return
      }

      // 캐시가 없으면 리포트 정보 가져오기
      setIsLoadingReport(true)
      try {
        const { createSupabaseBrowserClient } = await import('@/supabase/supabase-client')
        const supabase = createSupabaseBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        const userId = user?.id || null

        let info: { title: string; summary: string; type: 'situation' | 'contract' } | null = null

        if (message.context_type === 'situation') {
          info = await loadSituationReport(message.context_id, userId)
        } else if (message.context_type === 'contract') {
          info = await loadContractReport(message.context_id)
        }

        if (info) {
          setReportInfo(info)
          setReportCache(prev => {
            // 이미 캐시에 있으면 업데이트하지 않음 (중복 방지)
            if (prev.has(message.context_id!)) {
              return prev
            }
            return new Map(prev).set(message.context_id!, info)
          })
        }
      } catch (error) {
        console.warn('리포트 정보 로드 실패:', error)
        // 에러 발생 시에도 빈 상태로 유지 (UI 깨짐 방지)
      } finally {
        setIsLoadingReport(false)
      }
    }

    loadReportInfo()
    // reportCache를 의존성에서 제거하여 무한 루프 방지
    // reportCacheRef를 통해 최신 값을 읽을 수 있음
  }, [message.context_id, message.context_type])

  const reportUrl = getContextReportUrl(message.context_type, message.context_id)

  // 리포트 정보가 없으면 아무것도 렌더링하지 않음
  if (!message.context_type || message.context_type === 'none' || !message.context_id) {
    return null
  }

  return (
    <div className="max-w-[80%] text-xs text-right">
      {/* 로딩 상태 */}
      {isLoadingReport && (
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
          <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
          리포트 정보를 불러오는 중입니다…
        </div>
      )}

      {/* 리포트 정보 표시 */}
      {reportInfo && (() => {
        const style = getContextStyle(reportInfo.type)
        return (
          <div
            className={`ml-auto rounded-xl border border-slate-100 bg-white px-3.5 py-2.5 shadow-sm flex flex-col gap-1.5 text-left border-l-4 ${style.borderClass}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {style.icon}
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${style.badgeClass}`}
                >
                  {style.badgeLabel}
                </span>
              </div>
              {reportUrl && (
                <Link
                  href={reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
                >
                  전체 보기 ↗
                </Link>
              )}
            </div>

            <div className="mt-0.5 text-[11px] font-medium text-slate-900 line-clamp-1">
              {reportInfo.title || '제목 없는 리포트'}
            </div>

            {reportInfo.summary && (
              <div className="text-[11px] text-slate-500 line-clamp-2">
                {reportInfo.summary || '요약 정보가 없습니다.'}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

export default function QuickAssistPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isUserScrollingRef = useRef(false)
  const shouldAutoScrollRef = useRef(true)

  // URL 쿼리 파라미터에서 context 정보 가져오기
  const contextType = searchParams.get('contextType') as 'none' | 'situation' | 'contract' | null
  const contextId = searchParams.get('contextId')
  const prefilledQuestion = searchParams.get('question')

  const [inputMessage, setInputMessage] = useState(prefilledQuestion || '')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasInitialGreeting, setHasInitialGreeting] = useState(false)
  const [conversations, setConversations] = useState<ConversationSession[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [reports, setReports] = useState<Report[]>([])
  const [isLoadingReports, setIsLoadingReports] = useState(false)
  const [situationAnalysis, setSituationAnalysis] = useState<SituationAnalysisResponse | null>(null)
  const [situationContext, setSituationContext] = useState<{
    summary: string
    details: string
    categoryHint: string
    employmentType?: string
    workPeriod?: string
    socialInsurance?: string
  } | null>(null)
  // 🔥 컨텍스트 상태 추가
  const [currentContext, setCurrentContext] = useState<ChatContext>({
    type: 'none',
    id: null,
  })
  const [showContextSelector, setShowContextSelector] = useState(false)
  const [contextSelectorType, setContextSelectorType] = useState<'situation' | 'contract' | null>(null)
  const [openReportMenu, setOpenReportMenu] = useState(false) // + 버튼 메뉴 열림 상태
  const [selectedFile, setSelectedFile] = useState<File | null>(null) // 선택된 파일
  const [showSituationForm, setShowSituationForm] = useState(false) // 상황 분석 폼 표시 여부
  const [showSituationPresets, setShowSituationPresets] = useState(false) // 상황 분석 프리셋 칩 표시 여부
  const [selectedSituationPreset, setSelectedSituationPreset] = useState<typeof SITUATION_PRESETS[0] | null>(null) // 선택된 프리셋
  const fileInputRef = useRef<HTMLInputElement>(null)
  // 리포트 정보 캐시 (context_id -> 리포트 정보)
  const [reportCache, setReportCache] = useState<Map<string, { title: string; summary: string; type: 'situation' | 'contract' }>>(new Map())
  
  // 상황 분석/계약서 분석 리스트 캐시 (모달 열기 전에 미리 로드)
  const [situationListCache, setSituationListCache] = useState<Array<{ id: string; situation: string; created_at: string }>>([])
  const [contractListCache, setContractListCache] = useState<Array<{ id: string; doc_id: string; title: string; created_at: string }>>([])
  const [isLoadingSituationList, setIsLoadingSituationList] = useState(false)
  const [isLoadingContractList, setIsLoadingContractList] = useState(false)
  const situationListLoadedRef = useRef(false)
  const contractListLoadedRef = useRef(false)
  

  // localStorage 및 DB에서 대화 내역 로드
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const loadConversations = async () => {
      try {
        // 1. localStorage에서 대화 로드 (즉시 표시)
        const stored = localStorage.getItem('legal_assist_conversations')
        let localConversations: ConversationSession[] = []
        
        if (stored) {
          const parsed = JSON.parse(stored)
          localConversations = parsed.map((s: any) => ({
            ...s,
            createdAt: new Date(s.createdAt),
            updatedAt: new Date(s.updatedAt),
            messages: s.messages.map((m: any) => ({
              ...m,
              timestamp: new Date(m.timestamp),
            })),
          }))
          
          // localStorage 데이터를 먼저 표시 (빠른 초기 렌더링)
          setConversations(localConversations)
          
          // 최근 대화가 있으면 자동으로 선택
          if (localConversations.length > 0 && !selectedConversationId) {
            const latestConversation = localConversations.sort((a, b) => 
              b.createdAt.getTime() - a.createdAt.getTime()
            )[0]
            setSelectedConversationId(latestConversation.id)
          }
        }

        // 2. DB에서 상황 분석 히스토리 가져오기 (백그라운드 동기화)
        try {
          const { createSupabaseBrowserClient } = await import('@/supabase/supabase-client')
          const supabase = createSupabaseBrowserClient()
          const { data: { user } } = await supabase.auth.getUser()
          const userId = user?.id || null

          if (userId) {
            const dbConversations: ConversationSession[] = []
            
            // 2-1. 새 테이블 구조에서 챗 세션 로드 (legal_chat_sessions)
            // 성능 최적화: 최근 20개 세션만 로드 (초기 로드)
            try {
              const chatSessions = await getChatSessions(userId, 20, 0)
              
              // 병렬 처리: 각 세션의 메시지를 동시에 가져오기
              // 성능 최적화: 최대 10개 세션만 동시에 처리 (너무 많으면 타임아웃 위험)
              const BATCH_SIZE = 10
              const batches: ChatSession[][] = []
              for (let i = 0; i < chatSessions.length; i += BATCH_SIZE) {
                batches.push(chatSessions.slice(i, i + BATCH_SIZE))
              }
              
              // 배치별로 순차 처리 (각 배치는 병렬)
              for (const batch of batches) {
                const chatSessionPromises = batch.map(async (session: ChatSession) => {
                  try {
                    // 타임아웃 추가 (15초로 증가 - 네트워크 지연 대응)
                    const timeoutPromise = new Promise((_, reject) => {
                      setTimeout(() => reject(new Error('메시지 로드 시간이 초과되었습니다. 네트워크 상태를 확인해주세요.')), 15000)
                    })
                    
                    const messagesPromise = getChatMessages(session.id, userId)
                    const messages = await Promise.race([messagesPromise, timeoutPromise]) as any
                    
                    if (!messages || messages.length === 0) {
                      return null
                    }
                    
                    // 메시지를 ChatMessage 형식으로 변환
                    const chatMessages: ChatMessage[] = messages
                      .sort((a: any, b: any) => a.sequence_number - b.sequence_number)
                      .map((msg: any) => ({
                        id: msg.id,
                        role: msg.sender_type,
                        content: msg.message,
                        timestamp: new Date(msg.created_at),
                        context_type: (msg.context_type as 'none' | 'situation' | 'contract') || 'none',
                        context_id: msg.context_id || null,
                        metadata: msg.metadata || null,
                      }))
                    
                    // 대화 세션 생성
                    const conversation: ConversationSession = {
                      id: `session-${session.id}`,
                      sessionId: session.id,
                      title: session.title || '대화',
                      messages: chatMessages,
                      createdAt: new Date(session.created_at),
                      updatedAt: new Date(session.updated_at),
                    }
                    
                    return conversation
                  } catch (error) {
                    console.warn(`챗 메시지 조회 실패 (session_id: ${session.id}):`, error)
                    return null
                  }
                })
                
                const batchResults = await Promise.all(chatSessionPromises)
                for (const result of batchResults) {
                  if (result) {
                    dbConversations.push(result)
                  }
                }
              }
            } catch (error) {
              console.warn('새 챗 세션 로드 실패, 레거시만 사용:', error)
            }
            
            
            // 3. localStorage와 DB 대화 병합
            // DB 대화와 localStorage 대화 병합 (ID 중복 제거)
            const mergedConversations: ConversationSession[] = []
            const idSet = new Set<string>()  // ID 중복 방지
            
            // DB 대화를 먼저 추가 (최신 데이터)
            for (const dbConv of dbConversations) {
              if (!idSet.has(dbConv.id)) {
                idSet.add(dbConv.id)
                mergedConversations.push(dbConv)
              }
            }
            
            // localStorage 대화 추가 (ID 중복 체크)
            for (const localConv of localConversations) {
              if (!idSet.has(localConv.id)) {
                idSet.add(localConv.id)
                mergedConversations.push(localConv)
              }
            }
            
            // 생성일 기준으로 정렬 (최신순)
            mergedConversations.sort((a, b) => 
              b.createdAt.getTime() - a.createdAt.getTime()
            )
            
            // DB 동기화 결과로 업데이트 (이미 localStorage 데이터는 표시됨)
            setConversations(mergedConversations)
            
            // localStorage 업데이트 (DB 데이터 포함, DB 삭제 반영)
            localStorage.setItem('legal_assist_conversations', JSON.stringify(mergedConversations))
            
            // 최근 대화가 있으면 자동으로 선택 (아직 선택되지 않은 경우만)
            if (mergedConversations.length > 0 && !selectedConversationId) {
              const latestConversation = mergedConversations[0]
              setSelectedConversationId(latestConversation.id)
            }
          } else {
            // 사용자 ID가 없으면 localStorage만 사용 (이미 표시됨)
            // 추가 작업 없음
          }
        } catch (dbError) {
          console.warn('DB에서 대화 로드 실패, localStorage만 사용:', dbError)
          setConversations(localConversations)
        }

        // 4. 상황 분석 결과 확인 (situation 페이지에서 전달된 경우)
        const situationData = localStorage.getItem('legal_situation_for_quick')
        if (situationData) {
          try {
            const parsed = JSON.parse(situationData)
            if (parsed.analysisResult) {
              setSituationAnalysis(parsed.analysisResult)
              setSituationContext({
                summary: parsed.summary || '',
                details: parsed.details || '',
                categoryHint: parsed.categoryHint || 'unknown',
                employmentType: parsed.employmentType,
                workPeriod: parsed.workPeriod,
                socialInsurance: parsed.socialInsurance,
              })
              
              // 자동으로 대화 세션 생성
              // DB에서 이미 저장된 메시지가 있는지 확인
              let dbMessages: ChatMessage[] = []
              if (parsed.situationAnalysisId) {
                try {
                  const { createSupabaseBrowserClient } = await import('@/supabase/supabase-client')
                  const supabase = createSupabaseBrowserClient()
                  const { data: { user } } = await supabase.auth.getUser()
                  const userId = user?.id || null
                  
                  // 새 테이블 구조에서는 이 부분이 필요 없음 (세션 기반으로 로드)
                } catch (error) {
                  console.warn('DB에서 메시지 조회 실패, 로컬 메시지 사용:', error)
                }
              }
              
              // DB 메시지가 있으면 사용, 없으면 로컬 메시지 생성
              let finalMessages: ChatMessage[] = []
              if (dbMessages.length > 0) {
                // DB 메시지 사용 (트리거가 이미 저장한 메시지)
                finalMessages = dbMessages
              } else {
                // 로컬 메시지 생성 (DB 메시지가 없는 경우에만)
                const userInput = [parsed.summary, parsed.details].filter(Boolean).join('\n\n')
                const aiResponse = parsed.analysisResult.summary || '분석이 완료되었습니다.'
                
                finalMessages = [
                  {
                    id: `msg-${Date.now()}-user`,
                    role: 'user',
                    content: userInput,
                    timestamp: new Date(),
                  },
                  {
                    id: `msg-${Date.now()}-ai`,
                    role: 'assistant',
                    content: aiResponse,
                    timestamp: new Date(),
                    reportId: parsed.situationAnalysisId,
                  }
                ]
              }
              
              // 새 테이블 구조에서는 세션을 찾거나 생성해야 함
              // 여기서는 로컬 메시지만 표시하고, 실제 세션은 메시지 전송 시 생성됨
              const newSessionId = `conv-${Date.now()}`
              const newConversation: ConversationSession = {
                id: newSessionId,
                sessionId: '', // 나중에 생성됨
                title: parsed.summary?.substring(0, 30) || '상황 분석',
                messages: finalMessages,
                createdAt: new Date(),
                updatedAt: new Date(),
              }
              
              // 대화 세션 추가 (중복 제거)
              setConversations((prev) => {
                const filtered = prev.filter(c => c.id !== newConversation.id)
                const updated = [newConversation, ...filtered]
                localStorage.setItem('legal_assist_conversations', JSON.stringify(updated))
                return updated
              })
              setSelectedConversationId(newSessionId)
              setMessages(finalMessages)
              setHasInitialGreeting(true)
              
              // 사용 후 삭제 (한 번만 사용)
              localStorage.removeItem('legal_situation_for_quick')
            }
          } catch (error) {
            console.error('상황 분석 결과 로드 실패:', error)
          }
        }
      } catch (error) {
        console.error('데이터 로드 실패:', error)
      }
    }
    
    loadConversations()
  }, [])

  // contextType과 contextId가 있을 때 상황 분석 결과 불러오기
  useEffect(() => {
    const loadContextData = async () => {
      if (contextType === 'situation' && contextId) {
        try {
          const { createSupabaseBrowserClient } = await import('@/supabase/supabase-client')
          const supabase = createSupabaseBrowserClient()
          const { data: { user } } = await supabase.auth.getUser()
          const userId = user?.id || null

          // 상황 분석 결과 불러오기
          const analysis = await getSituationAnalysisByIdV2(contextId, userId)
          // SituationResponseV2를 SituationAnalysisResponse로 변환
          const convertedAnalysis: SituationAnalysisResponse = {
            classifiedType: analysis.tags?.[0] as any || 'unknown',
            riskScore: analysis.riskScore,
            summary: analysis.analysis?.summary || '',
            findings: analysis.findings || [], // findings 필드 사용
            scripts: analysis.scripts || { toCompany: { subject: '', body: '' }, toAdvisor: { subject: '', body: '' } },
            relatedCases: analysis.relatedCases || [],
            sources: analysis.sources,
            organizations: analysis.organizations,
          }
          setSituationAnalysis(convertedAnalysis)

          // 새 세션 생성
          const { getAuthHeaders } = await import('@/apis/legal.service')
          const authHeaders = await getAuthHeaders()
          const headers: Record<string, string> = {
            ...(authHeaders as Record<string, string>),
            'Content-Type': 'application/json',
          }
          if (userId) {
            headers['X-User-Id'] = userId
          }

          const sessionResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000'}/api/v2/legal/chat/sessions`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              initial_context_type: 'situation',
              initial_context_id: contextId,
              title: analysis.analysis?.summary?.substring(0, 30) || '상황 분석',
            }),
          })

          if (sessionResponse.ok) {
            const sessionData = await sessionResponse.json()
            // 세션 ID는 selectedConversationId로 관리됨
            setSelectedConversationId(`session-${sessionData.id}`)
          }
        } catch (error) {
          console.error('컨텍스트 데이터 로드 실패:', error)
        }
      }
    }

    loadContextData()
  }, [contextType, contextId])

  // Supabase에서는 만료일이 없으므로 정리 로직 제거

  // 선택된 대화의 메시지 로드 (DB에서 최신 메시지 가져오기)
  useEffect(() => {
    // 세션이 변경될 때 분석 상태 초기화 (다른 세션으로 전환 시 이전 세션의 상태가 유지되지 않도록)
    // 단, 분석 중이 아닐 때만 초기화 (분석 중에는 사용자가 보낸 메시지를 보존해야 함)
    if (!isAnalyzing) {
      setIsAnalyzing(false)
    }
    
    // 분석 중일 때는 메시지를 다시 로드하거나 초기화하지 않음 (사용자가 보낸 메시지가 사라지는 것을 방지)
    if (isAnalyzing) {
      return
    }
    
    if (selectedConversationId) {
      const conversation = conversations.find(c => c.id === selectedConversationId)
      if (conversation) {
        // 먼저 기존 메시지 표시 (빠른 렌더링)
        if (conversation.messages.length > 0) {
          setMessages(conversation.messages)
          setHasInitialGreeting(true)
        }
        
        let isCancelled = false
        
        const loadLatestMessages = async () => {
          try {
            const { createSupabaseBrowserClient } = await import('@/supabase/supabase-client')
            const supabase = createSupabaseBrowserClient()
            const { data: { user } } = await supabase.auth.getUser()
            const userId = user?.id || null
            
            if (isCancelled) return
            
            if (userId && conversation.sessionId) {
              // 타임아웃 추가 (15초로 증가 - 네트워크 지연 대응)
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('메시지 로드 시간이 초과되었습니다. 네트워크 상태를 확인해주세요.')), 15000)
              })
              
              const messagesPromise = getChatMessages(conversation.sessionId, userId)
              const messages = await Promise.race([messagesPromise, timeoutPromise]) as any
                
              if (isCancelled) return
              
              // 최근 메시지 분석 (개발 모드에서만)
              // TODO: messageAnalyzer 유틸 생성 필요
              // if (process.env.NODE_ENV === 'development') {
              //   try {
              //     const { analyzeMessages, logMessageAnalysis } = await import('@/utils/messageAnalyzer')
              //     const analysis = analyzeMessages(messages)
              //     logMessageAnalysis(analysis)
              //   } catch (e) {
              //     // 분석 실패해도 계속 진행
              //     console.warn('메시지 분석 실패:', e)
              //   }
              // }
              
              const chatMessages: ChatMessage[] = messages
                .sort((a: any, b: any) => a.sequence_number - b.sequence_number)
                .map((msg: any) => ({
                  id: msg.id,
                  role: msg.sender_type,
                  content: msg.message,
                  timestamp: new Date(msg.created_at),
                  context_type: (msg.context_type as 'none' | 'situation' | 'contract') || 'none',
                  context_id: msg.context_id || null,
                  metadata: msg.metadata || null,
                }))
              
              if (isCancelled) return
              
              // 현재 표시 중인 메시지와 병합 (아직 DB에 저장되지 않은 사용자 메시지 보존)
              setMessages((currentMessages) => {
                // DB에서 가져온 메시지에 있는 ID 목록
                const dbMessageIds = new Set(chatMessages.map(m => m.id))
                
                // 현재 메시지 중 DB에 없는 메시지 (아직 저장되지 않은 사용자 메시지 등)
                const unsavedMessages = currentMessages.filter(m => !dbMessageIds.has(m.id))
                
                // DB 메시지와 저장되지 않은 메시지를 병합 (시간순 정렬)
                const mergedMessages = [...chatMessages, ...unsavedMessages].sort((a, b) => 
                  a.timestamp.getTime() - b.timestamp.getTime()
                )
                
                return mergedMessages
              })
              
              setConversations((prev) => 
                prev.map((c) => 
                  c.id === selectedConversationId
                    ? { ...c, messages: chatMessages, updatedAt: new Date() }
                    : c
                )
              )
              
              setHasInitialGreeting(true)
            } else {
              // 세션이 없거나 사용자 ID가 없으면 기존 메시지 사용 (이미 표시됨)
              // 추가 작업 없음
            }
          } catch (error: any) {
            if (!isCancelled) {
              const errorMessage = error?.message || '알 수 없는 오류'
              console.warn('DB에서 최신 메시지 로드 실패, 기존 메시지 사용:', errorMessage)
              
              // 타임아웃 에러인 경우 사용자에게 알림 (선택적)
              if (errorMessage.includes('시간이 초과') || errorMessage.includes('타임아웃')) {
                // 조용히 처리 (기존 메시지 사용)
                // 필요시 toast 알림 추가 가능
              }
              // 기존 메시지는 이미 표시됨
            }
          }
        }
        
        // 백그라운드에서 최신 메시지 동기화
        loadLatestMessages()
        
        // cleanup 함수: 컴포넌트 언마운트 시 요청 취소
        return () => {
          isCancelled = true
        }
      }
    } else {
      // selectedConversationId가 없을 때도 분석 중이면 메시지를 초기화하지 않음
      if (!isAnalyzing) {
        setMessages([])
        setHasInitialGreeting(false)
      }
    }
  }, [selectedConversationId, conversations, isAnalyzing])

  // 초기 인사말 추가 (상황 분석 결과가 있으면 리포트 표시)
  useEffect(() => {
    // 일반 챗 모드에서는 초기 메시지를 자동으로 추가하지 않음
    // 환영 화면이 계속 표시되도록 함
    // 상황 분석 결과가 있을 때만 초기 메시지 추가
    if (!selectedConversationId && messages.length === 0 && !hasInitialGreeting) {
      if (situationAnalysis && situationContext) {
        // 상황 분석 결과가 있으면 summary 필드의 내용을 그대로 표시
        // summary 필드는 /legal/situation의 프롬프트(build_situation_analysis_prompt)에서 생성된
        // 4개 섹션(📊 상황 분석의 결과, ⚖️ 법적 관점, 🎯 지금 당장 할 수 있는 행동, 💬 이렇게 말해보세요)을 포함
        const reportContent = situationAnalysis.summary || '리포트 내용을 불러올 수 없습니다.'
        
        const initialMessage: ChatMessage = {
          id: `report-${Date.now()}`,
          role: 'assistant',
          content: reportContent,
          timestamp: new Date(),
      }
      
      setMessages([initialMessage])
      setHasInitialGreeting(true)
      }
      // 일반 챗 모드에서는 초기 메시지를 추가하지 않고 환영 화면 유지
    }
  }, [selectedConversationId, messages.length, hasInitialGreeting, situationAnalysis, situationContext])

  // 사용자 스크롤 감지
  useEffect(() => {
    const container = chatContainerRef.current
    if (!container) return

    const handleScroll = () => {
      if (!container) return
      
      const { scrollTop, scrollHeight, clientHeight } = container
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100 // 하단 100px 이내
      
      // 사용자가 맨 아래 근처에 있으면 자동 스크롤 허용
      shouldAutoScrollRef.current = isNearBottom
      isUserScrollingRef.current = !isNearBottom
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    
    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [])

  // 메시지 스크롤 (사용자가 맨 아래에 있을 때만)
  useEffect(() => {
    if (shouldAutoScrollRef.current && messagesEndRef.current) {
      // 약간의 지연을 두어 DOM 업데이트 후 스크롤
      setTimeout(() => {
        if (shouldAutoScrollRef.current && messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
      }, 100)
    }
  }, [messages])

  // 입력창 높이 조절
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current
      const maxHeight = window.innerHeight * 0.33 // 화면 높이의 1/3
      textarea.style.height = 'auto'
      const newHeight = Math.min(textarea.scrollHeight, maxHeight)
      textarea.style.height = `${Math.max(60, newHeight)}px`
      textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
    }
  }, [inputMessage])

  // 외부 클릭 시 리포트 메뉴 닫기
  useEffect(() => {
    if (!openReportMenu) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // 메뉴 버튼이나 메뉴 내부 클릭은 무시
      if (target.closest('[data-report-menu]') || target.closest('[data-report-menu-button]')) {
        return
      }
      setOpenReportMenu(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openReportMenu])

  // 대화 저장
  const saveConversations = (updatedConversations: ConversationSession[]) => {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem('legal_assist_conversations', JSON.stringify(updatedConversations))
    } catch (error) {
      console.error('대화 저장 실패:', error)
    }
  }

  // 리포트 저장 (Supabase에 저장되므로 로컬 저장 불필요)
  const saveReports = (updatedReports: Report[]) => {
    // Supabase에 저장되므로 로컬 저장 불필요
    // 리포트는 /legal/situation에서 자동으로 저장됨
  }

  // 질문 요약 생성 (타임라인용)
  const generateQuestionSummary = (text: string): string => {
    if (text.length <= 30) return text
    return text.substring(0, 30) + '...'
  }

  // 대화 삭제
  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation() // 버튼 클릭 시 대화 선택 방지
    
    const conversation = conversations.find(c => c.id === conversationId)
    if (!conversation) return
    
    try {
      // 새 테이블 구조에서 DB에서도 삭제
      if (conversation.sessionId) {
        const { createSupabaseBrowserClient } = await import('@/supabase/supabase-client')
        const supabase = createSupabaseBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        const userId = user?.id || null
        
        if (userId) {
          await deleteChatSession(conversation.sessionId, userId)
        }
      }
      
      // 로컬 상태에서 제거
    const updatedConversations = conversations.filter(c => c.id !== conversationId)
    setConversations(updatedConversations)
    saveConversations(updatedConversations)
    
    // 삭제된 대화가 현재 선택된 대화인 경우 선택 해제
    if (selectedConversationId === conversationId) {
      setSelectedConversationId(null)
      setMessages([])
    }
    
    toast({
      title: "대화 삭제 완료",
      description: "대화 내역이 삭제되었습니다.",
    })
    } catch (error: any) {
      console.error('대화 삭제 실패:', error)
      toast({
        title: "대화 삭제 실패",
        description: error.message || "대화 삭제 중 오류가 발생했습니다.",
        variant: 'destructive',
      })
    }
  }

  // 상황 분석 아카이브 로드 (DB에서 가져오기 - 상황 분석 데이터만)
  const loadReports = async () => {
    setIsLoadingReports(true)
    try {
      const { createSupabaseBrowserClient } = await import('@/supabase/supabase-client')
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id || null

      if (!userId) {
        setReports([])
        return
      }

      // DB에서 상황 분석 히스토리 가져오기 (situation_analyses 테이블에서만)
      const situationHistory = await getSituationHistoryV2(20, 0, userId)
      
      // Report 형식으로 변환
      const reportsData: Report[] = situationHistory.map((situation) => {
        // analysis 필드에서 summary 추출
        const analysisData = typeof situation.summary === 'string' ? { summary: situation.summary } : {}
        const summary = analysisData.summary || situation.summary || ''
        
        return {
          id: situation.id,
          question: situation.situation || '',
          answer: summary,
          legalBasis: [], // 필요시 추가 파싱
          recommendations: [], // 필요시 추가 파싱
          riskScore: situation.risk_score,
          tags: [situation.category || 'unknown'],
          createdAt: new Date(situation.created_at),
        }
      })
      
      setReports(reportsData)
    } catch (error: any) {
      console.error('상황 분석 로드 실패:', error)
      toast({
        title: '상황 분석 로드 실패',
        description: error.message || '상황 분석을 불러오는 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
      setReports([])
    } finally {
      setIsLoadingReports(false)
    }
  }

  // 상황 분석 아카이브 모달 열기
  const handleOpenArchiveModal = () => {
    setShowArchiveModal(true)
    loadReports()
  }

  // 상황 분석 삭제
  const handleDeleteReport = async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation() // 버튼 클릭 시 분석 선택 방지
    
    try {
      // 상황 분석 삭제는 situation_analyses 테이블을 사용하도록 변경됨
      // 필요시 백엔드 API 추가 필요
      // 현재는 로컬에서만 제거
      const updatedReports = reports.filter(r => r.id !== reportId)
      setReports(updatedReports)
      
      toast({
        title: "상황 분석 삭제 완료",
        description: "상황 분석이 삭제되었습니다.",
      })
    } catch (error: any) {
      console.error('상황 분석 삭제 실패:', error)
      toast({
        title: "상황 분석 삭제 실패",
        description: error.message || "상황 분석 삭제 중 오류가 발생했습니다.",
        variant: 'destructive',
      })
    }
  }

  // 파일 업로드 핸들러
  const handleFileUpload = async (file: File) => {
    try {
      setIsAnalyzing(true)
      setSelectedFile(file)
      
      // 사용자 ID 가져오기
      const { createSupabaseBrowserClient } = await import('@/supabase/supabase-client')
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id || null
      
      if (!userId) {
        toast({
          title: '로그인 필요',
          description: '파일 업로드를 위해 로그인이 필요합니다.',
          variant: 'destructive',
        })
        setIsAnalyzing(false)
        setSelectedFile(null)
        return
      }
      
      // Agent API로 계약서 분석 시작
      const response = await chatWithAgent({
        mode: 'contract',
        message: '이 계약서를 분석해주세요.',
        file: file,
      }, userId)
      
      // 분석 결과를 컨텍스트로 설정
      if (response.contractAnalysisId) {
        setCurrentContext({
          type: 'contract',
          id: response.contractAnalysisId,
          label: response.contractAnalysis?.title || file.name,
        })
        
        // 세션 ID 저장
        if (response.sessionId) {
          const newSessionId = `session-${response.sessionId}`
          setSelectedConversationId(newSessionId)
        }
        
        // 메시지 추가
        const userMessage: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'user',
          content: `파일 업로드: ${file.name}`,
          timestamp: new Date(),
          context_type: 'contract',
          context_id: response.contractAnalysisId,
        }
        
        const assistantMessage: ChatMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: response.answerMarkdown,
          timestamp: new Date(),
          context_type: 'contract',
          context_id: response.contractAnalysisId,
        }
        
        setMessages((prev) => [...prev, userMessage, assistantMessage])
        
        toast({
          title: '계약서 분석 완료',
          description: '계약서가 분석되었습니다. 추가 질문을 해보세요.',
        })
      }
    } catch (error: any) {
      console.error('파일 업로드 실패:', error)
      toast({
        title: '파일 업로드 실패',
        description: error.message || '파일 업로드 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
      setSelectedFile(null)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 메시지 전송
  const handleSendMessage = async () => {
    const trimmedMessage = inputMessage.trim()
    
    // 파일이 선택되어 있으면 message는 선택사항 (빈 값이어도 됨)
    const hasFile = selectedFile !== null
    
    // 입력 검증 (파일이 없을 때만 message 필수)
    if (!hasFile && !trimmedMessage) {
      toast({
        title: '입력 필요',
        description: '메시지를 입력하거나 파일을 첨부해주세요.',
        variant: 'destructive',
      })
      return
    }
    
    // 파일이 있을 때는 message가 없어도 기본 메시지 사용
    const messageToSend = trimmedMessage || (hasFile ? '이 계약서를 분석해주세요.' : '')
    
    if (!hasFile && messageToSend.length < 5) {
      toast({
        title: '입력이 너무 짧습니다',
        description: '최소 5자 이상 입력해주세요.',
        variant: 'destructive',
      })
      return
    }
    
    if (messageToSend.length > 2000) {
      toast({
        title: '입력이 너무 깁니다',
        description: '최대 2000자까지 입력 가능합니다.',
        variant: 'destructive',
      })
      return
    }
    
    if (isAnalyzing) {
      toast({
        title: '처리 중',
        description: '이전 요청이 처리 중입니다. 잠시만 기다려주세요.',
      })
      return
    }

    // 사용자 메시지 생성: 파일이나 상황 분석 프리셋이 있으면 정보와 메시지를 모두 표시
    let userMessageContent = messageToSend
    
    // 상황 분석 프리셋 정보 구성
    let situationInfo = ''
    if (selectedSituationPreset && !currentContext.id) {
      const preset = selectedSituationPreset
      const infoParts: string[] = []
      infoParts.push(`📋 상황 분석: ${preset.title}`)
      if (preset.category) {
        const categoryMap: Record<string, string> = {
          'probation': '수습/인턴',
          'unpaid_wage': '임금 체불',
          'freelancer': '프리랜서',
          'harassment': '괴롭힘',
          'stock_option': '스톡옵션',
        }
        infoParts.push(`카테고리: ${categoryMap[preset.category] || preset.category}`)
      }
      if (preset.employmentType) {
        const employmentMap: Record<string, string> = {
          'regular': '정규직',
          'intern': '인턴/수습',
          'freelancer': '프리랜서',
          'part_time': '파트타임',
        }
        infoParts.push(`고용 형태: ${employmentMap[preset.employmentType] || preset.employmentType}`)
      }
      if (preset.workPeriod) {
        infoParts.push(`근무 기간: ${preset.workPeriod}`)
      }
      if (preset.socialInsurance && preset.socialInsurance.length > 0) {
        const insuranceMap: Record<string, string> = {
          'health': '건강보험',
          'employment': '고용보험',
          'pension': '국민연금',
          'industrial': '산재보험',
        }
        const insuranceNames = preset.socialInsurance.map(ins => insuranceMap[ins] || ins)
        infoParts.push(`사회보험: ${insuranceNames.join(', ')}`)
      }
      situationInfo = infoParts.join('\n')
    }
    
    // 파일 정보 구성
    let fileInfo = ''
    if (hasFile && selectedFile) {
      fileInfo = `📎 파일: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)}KB)`
    }
    
    // 모든 정보를 조합
    const infoParts: string[] = []
    if (situationInfo) infoParts.push(situationInfo)
    if (fileInfo) infoParts.push(fileInfo)
    
    if (infoParts.length > 0) {
      const combinedInfo = infoParts.join('\n\n')
      if (messageToSend && messageToSend.trim()) {
        // 정보와 메시지를 함께 표시
        userMessageContent = `${combinedInfo}\n\n${messageToSend}`
      } else {
        // 정보만 표시
        userMessageContent = combinedInfo
      }
    }
    
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userMessageContent,
      timestamp: new Date(),
    }

    // 메시지 전송 시 자동 스크롤 활성화
    shouldAutoScrollRef.current = true

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInputMessage('')
    setIsAnalyzing(true)

    // 사용자 ID 가져오기 (세션 생성 및 메시지 저장에 필요)
    const { createSupabaseBrowserClient } = await import('@/supabase/supabase-client')
    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id || null

    // 현재 대화 세션 업데이트 또는 생성
    // API 호출 전에 세션 ID를 저장하여, 응답 시 세션이 변경되었는지 확인
    const sessionIdAtRequestStart = selectedConversationId
    let currentSession: ConversationSession
    let chatSessionId: string | null = null  // legal_chat_sessions의 ID
    
    if (selectedConversationId) {
      const existing = conversations.find(c => c.id === selectedConversationId)
      if (existing) {
        currentSession = {
          ...existing,
          messages: [...existing.messages, userMessage],
          updatedAt: new Date(),
        }
        // 새 구조 세션 ID가 있으면 사용
        chatSessionId = existing.sessionId || null
      } else {
        currentSession = {
          id: selectedConversationId,
          sessionId: '',
          title: generateQuestionSummary(inputMessage),
          messages: [userMessage],
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      }
    } else {
      // 새 대화 시작 시 - API에서 세션을 생성하므로 여기서는 로컬 세션만 생성
      // API 응답에서 받은 sessionId로 나중에 업데이트됨
      const newSessionId = `conv-${Date.now()}`
      currentSession = {
        id: newSessionId,
        sessionId: '', // API에서 생성된 세션 ID로 업데이트됨
        title: generateQuestionSummary(inputMessage),
        messages: [userMessage],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      // selectedConversationId는 API 응답 후에 설정됨
    }

    try {
      let assistantMessage: ChatMessage
      
      // 파일이 선택되어 있으면 contract 모드로 전송 (최우선)
      if (hasFile && selectedFile) {
        // contract 모드 - Agent API 사용
        const { chatWithAgent } = await import('@/apis/legal.service')
        
        // 첫 요청인지 후속 요청인지 확인
        const isFirstRequest = currentContext.type !== 'contract' || !currentContext.id
        
        let chatResult
        if (isFirstRequest) {
          // 첫 요청: mode=contract, message, file (필수), sessionId (선택)
          chatResult = await chatWithAgent({
            mode: 'contract',
            message: messageToSend,
            file: selectedFile,
            ...(selectedConversationId && chatSessionId ? { sessionId: chatSessionId } : {}),
          }, userId)
          
          // 파일 전송 후 선택 해제
          setSelectedFile(null)
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
          
          // 분석 결과를 컨텍스트로 설정
          if (chatResult.contractAnalysisId) {
            setCurrentContext({
              type: 'contract',
              id: chatResult.contractAnalysisId,
              label: chatResult.contractAnalysis?.title || selectedFile.name,
            })
          }
        } else {
          // 후속 요청: mode=contract, message, contractAnalysisId (필수), sessionId (권장)
          chatResult = await chatWithAgent({
            mode: 'contract',
            message: messageToSend,
            contractAnalysisId: currentContext.id || undefined, // null을 undefined로 변환
            ...(selectedConversationId && chatSessionId ? { sessionId: chatSessionId } : {}),
          }, userId)
          
          // 파일 전송 후 선택 해제
          setSelectedFile(null)
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        }
        
        // 세션 ID 업데이트
        if (chatResult.sessionId) {
          chatSessionId = chatResult.sessionId
          const newSessionId = `session-${chatResult.sessionId}`
          setSelectedConversationId(newSessionId)
        }
        
        assistantMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: chatResult.answerMarkdown || '답변을 생성할 수 없습니다.',
          timestamp: new Date(),
          context_type: 'contract',
          context_id: chatResult.contractAnalysisId || currentContext.id,
        }
        
        // DB에 저장
        if (userId && chatSessionId) {
          try {
            const dbMessages = await getChatMessages(chatSessionId, userId)
            const maxSequenceNumber = dbMessages.length > 0 
              ? Math.max(...dbMessages.map(m => m.sequence_number))
              : -1
            
            const nextSequenceNumber = maxSequenceNumber + 1
            
            await saveChatMessage(
              chatSessionId,
              {
                sender_type: 'user',
                message: userMessage.content,
                sequence_number: nextSequenceNumber,
                context_type: 'contract',
                context_id: chatResult.contractAnalysisId || currentContext.id,
              },
              userId
            )
            
            await saveChatMessage(
              chatSessionId,
              {
                sender_type: 'assistant',
                message: assistantMessage.content,
                sequence_number: nextSequenceNumber + 1,
                context_type: 'contract',
                context_id: chatResult.contractAnalysisId || currentContext.id,
              },
              userId
            )
          } catch (dbError) {
            console.warn('새 테이블 메시지 저장 실패:', dbError)
          }
        }
        
        toast({
          title: isFirstRequest ? '계약서 분석 완료' : '질문 전송 완료',
          description: isFirstRequest 
            ? '계약서가 분석되었습니다. 추가 질문을 해보세요.' 
            : '질문이 전송되었습니다.',
        })
      }
      // 상황 분석 결과가 있으면 chatWithContractV2 사용 (컨텍스트 포함)
      else if (situationAnalysis && situationContext) {
        // 법적 관점 내용을 컨텍스트로 변환 (findings 사용)
        const legalContext = (situationAnalysis.findings || [])
          .map((finding: any, index: number) => {
            // Finding 구조 또는 CriteriaItemV2 구조 지원
            if (finding.usageReason || finding.documentTitle) {
              // CriteriaItemV2 구조
              const reason = finding.usageReason || `${finding.documentTitle}: ${finding.snippet?.substring(0, 50) || ''}`
              return `${index + 1}. ${reason}`
            } else if (finding.basisText || finding.title) {
              // Finding 구조
              return `${index + 1}. ${finding.basisText || finding.title}`
            }
            return `${index + 1}. ${JSON.stringify(finding)}`
          })
          .join('\n')
        
        const analysisSummary = `상황 요약: ${situationContext.summary}\n\n법적 관점:\n${legalContext}\n\n위험도: ${situationAnalysis.riskScore}점`
        
        // chatWithContractV2 API 호출 (상황 분석 결과 기반)
        const chatResult = await chatWithContractV2({
          query: inputMessage.trim(),
          docIds: [], // 상황 분석은 docId 없음
          analysisSummary: analysisSummary,
          riskScore: situationAnalysis.riskScore,
          totalIssues: situationAnalysis.findings?.length || 0,
          topK: 8,
          contextType: currentContext.type,
          contextId: currentContext.id,
        })
        
        assistantMessage = {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: chatResult.answer || '답변을 생성할 수 없습니다.',
          timestamp: new Date(),
          context_type: currentContext.type,
          context_id: currentContext.id,
        }
        
        // DB에 메시지 저장
        try {
          const { createSupabaseBrowserClient } = await import('@/supabase/supabase-client')
          const supabase = createSupabaseBrowserClient()
          const { data: { user } } = await supabase.auth.getUser()
          const userId = user?.id || null
          
          if (userId && chatSessionId) {
            // 새 테이블 구조 사용 (legal_chat_messages)
              try {
              const dbMessages = await getChatMessages(chatSessionId, userId)
                const maxSequenceNumber = dbMessages.length > 0 
                  ? Math.max(...dbMessages.map(m => m.sequence_number))
                  : -1
                
              const nextSequenceNumber = maxSequenceNumber + 1
                
                // 사용자 메시지 저장
              await saveChatMessage(
                chatSessionId,
                {
                  sender_type: 'user',
                  message: userMessage.content,
                  sequence_number: nextSequenceNumber,
                  context_type: currentContext.type,
                  context_id: currentContext.id,
                },
                  userId
                )
                
                // AI 메시지 저장
              await saveChatMessage(
                chatSessionId,
                {
                  sender_type: 'assistant',
                  message: assistantMessage.content,
                  sequence_number: nextSequenceNumber + 1,
                  context_type: currentContext.type,
                  context_id: currentContext.id,
                },
                  userId
                )
              } catch (dbError) {
              console.warn('새 테이블 메시지 저장 실패:', dbError)
            }
          }
        } catch (saveError) {
          console.warn('대화 메시지 DB 저장 실패 (계속 진행):', saveError)
        }
      } else {
        // 컨텍스트에 따라 분기
        // 프리셋이 선택되어 있고 아직 분석이 시작되지 않은 경우 (첫 요청)
        if (selectedSituationPreset && !currentContext.id) {
          // 상황 분석 첫 요청 - Agent API 사용
          const chatResult = await chatWithAgent({
            mode: 'situation',
            message: messageToSend,
            ...(selectedConversationId && chatSessionId ? { sessionId: chatSessionId } : {}),
            situationTemplateKey: selectedSituationPreset.category,
            situationForm: {
              situation: messageToSend,
              category: selectedSituationPreset.category,
              employmentType: selectedSituationPreset.employmentType,
              workPeriod: selectedSituationPreset.workPeriod,
              socialInsurance: selectedSituationPreset.socialInsurance,
            },
          }, userId)
          
          // 세션 ID 업데이트
          if (chatResult.sessionId) {
            chatSessionId = chatResult.sessionId
            const newSessionId = `session-${chatResult.sessionId}`
            setSelectedConversationId(newSessionId)
          }
          
          // 분석 결과를 컨텍스트로 설정
          if (chatResult.situationAnalysisId) {
            setCurrentContext({
              type: 'situation',
              id: chatResult.situationAnalysisId,
              label: chatResult.situationAnalysis?.title || selectedSituationPreset.title,
            })
            // 프리셋 정보 초기화 (다음 요청부터는 후속 요청으로 처리)
            setSelectedSituationPreset(null)
          }
          
          assistantMessage = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            content: chatResult.answerMarkdown || '답변을 생성할 수 없습니다.',
            timestamp: new Date(),
            context_type: 'situation',
            context_id: chatResult.situationAnalysisId || null,
            metadata: chatResult.cases && chatResult.cases.length > 0 ? { cases: chatResult.cases } : null,
          }
          
          // DB에 저장
          if (userId && chatSessionId) {
            try {
              const dbMessages = await getChatMessages(chatSessionId, userId)
              const maxSequenceNumber = dbMessages.length > 0 
                ? Math.max(...dbMessages.map(m => m.sequence_number))
                : -1
              
              const nextSequenceNumber = maxSequenceNumber + 1
              
              await saveChatMessage(
                chatSessionId,
                {
                  sender_type: 'user',
                  message: userMessage.content,
                  sequence_number: nextSequenceNumber,
                  context_type: 'situation',
                  context_id: chatResult.situationAnalysisId || null,
                },
                userId
              )
              
              await saveChatMessage(
                chatSessionId,
                {
                  sender_type: 'assistant',
                  message: assistantMessage.content,
                  sequence_number: nextSequenceNumber + 1,
                  context_type: 'situation',
                  context_id: chatResult.situationAnalysisId || null,
                },
                userId
              )
            } catch (dbError) {
              console.warn('새 테이블 메시지 저장 실패:', dbError)
            }
          }
        } else if (currentContext.type === 'situation' && currentContext.id) {
          // 상황 분석 리포트를 컨텍스트로 사용하는 경우 - Agent API 사용 (후속 요청)
          // 새 대화 시작 시 (selectedConversationId가 null) sessionId를 전달하지 않음
          const chatResult = await chatWithAgent({
            mode: 'situation',
            message: messageToSend,
            ...(selectedConversationId && chatSessionId ? { sessionId: chatSessionId } : {}),
            situationAnalysisId: currentContext.id, // 상황 분석 ID
          }, userId)
          
          // 세션 ID 업데이트
          if (chatResult.sessionId && chatSessionId !== chatResult.sessionId) {
            chatSessionId = chatResult.sessionId
            const newSessionId = `session-${chatResult.sessionId}`
            setSelectedConversationId(newSessionId)
          }
          
          console.log('챗 응답:', chatResult)
          
          assistantMessage = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            content: chatResult.answerMarkdown || '답변을 생성할 수 없습니다.',
            timestamp: new Date(),
            context_type: 'situation',
            context_id: currentContext.id,
          }
          
          // 상황 컨텍스트인 경우 DB에 저장
          if (userId && chatSessionId) {
            try {
              const dbMessages = await getChatMessages(chatSessionId, userId)
              const maxSequenceNumber = dbMessages.length > 0 
                ? Math.max(...dbMessages.map(m => m.sequence_number))
                : -1
              
              const nextSequenceNumber = maxSequenceNumber + 1
              
              await saveChatMessage(
                chatSessionId,
                {
                  sender_type: 'user',
                  message: userMessage.content,
                  sequence_number: nextSequenceNumber,
                  context_type: 'situation',
                  context_id: currentContext.id,
                },
                  userId
                )
                
              await saveChatMessage(
                chatSessionId,
                {
                  sender_type: 'assistant',
                  message: assistantMessage.content,
                  sequence_number: nextSequenceNumber + 1,
                  context_type: 'situation',
                  context_id: currentContext.id,
                },
                  userId
                )
            } catch (dbError) {
              console.warn('새 테이블 메시지 저장 실패:', dbError)
            }
          }
        } else if (currentContext.type === 'contract' && currentContext.id) {
          // 계약서 분석 리포트를 컨텍스트로 사용하는 경우 - Agent API 사용 (후속 요청)
          // mode=contract, message, contractAnalysisId (필수), sessionId (권장)
          const { chatWithAgent } = await import('@/apis/legal.service')
          const chatResult = await chatWithAgent({
            mode: 'contract',
            message: messageToSend,
            contractAnalysisId: currentContext.id || undefined, // null을 undefined로 변환
            ...(selectedConversationId && chatSessionId ? { sessionId: chatSessionId } : {}),
          }, userId)
          
          // 세션 ID 업데이트
          if (chatResult.sessionId && chatSessionId !== chatResult.sessionId) {
            chatSessionId = chatResult.sessionId
            const newSessionId = `session-${chatResult.sessionId}`
            setSelectedConversationId(newSessionId)
          }
          
          console.log('계약서 컨텍스트 챗 응답:', chatResult)
          
          assistantMessage = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            content: chatResult.answerMarkdown || '답변을 생성할 수 없습니다.',
            timestamp: new Date(),
            context_type: 'contract',
            context_id: currentContext.id,
          }
          
          // 계약서 컨텍스트인 경우도 새 테이블에 저장
          if (userId && chatSessionId) {
            try {
              const dbMessages = await getChatMessages(chatSessionId, userId)
              const maxSequenceNumber = dbMessages.length > 0 
                ? Math.max(...dbMessages.map(m => m.sequence_number))
                : -1
              
              const nextSequenceNumber = maxSequenceNumber + 1
              
              await saveChatMessage(
                chatSessionId,
                {
                  sender_type: 'user',
                  message: userMessage.content,
                  sequence_number: nextSequenceNumber,
                  context_type: 'contract',
                  context_id: currentContext.id,
                },
                userId
              )
              
              await saveChatMessage(
                chatSessionId,
                {
                  sender_type: 'assistant',
                  message: assistantMessage.content,
                  sequence_number: nextSequenceNumber + 1,
                  context_type: 'contract',
                  context_id: currentContext.id,
                },
                userId
              )
            } catch (dbError) {
              console.warn('계약서 컨텍스트 메시지 저장 실패:', dbError)
            }
          }
        } else if (currentContext.type === 'none') {
          // 일반 챗 모드 - Agent API 사용 (plain 모드)
          // 새 대화 시작 시 (selectedConversationId가 null) sessionId를 전달하지 않음
          const chatResult = await chatWithAgent({
            mode: 'plain',
            message: messageToSend,
            ...(selectedConversationId && chatSessionId ? { sessionId: chatSessionId } : {}),
          }, userId)
          
          // 세션 ID 업데이트
          if (chatResult.sessionId && chatSessionId !== chatResult.sessionId) {
            chatSessionId = chatResult.sessionId
            const newSessionId = `session-${chatResult.sessionId}`
            setSelectedConversationId(newSessionId)
          }
          
          assistantMessage = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            content: chatResult.answerMarkdown || '답변을 생성할 수 없습니다.',
            timestamp: new Date(),
            context_type: 'none',
            context_id: null,
          }
            
            // 일반 챗도 새 테이블에 저장
            if (userId && chatSessionId) {
              try {
                const dbMessages = await getChatMessages(chatSessionId, userId)
                const maxSequenceNumber = dbMessages.length > 0 
                  ? Math.max(...dbMessages.map(m => m.sequence_number))
                  : -1
                
                const nextSequenceNumber = maxSequenceNumber + 1
                
                await saveChatMessage(
                  chatSessionId,
                  {
                    sender_type: 'user',
                    message: userMessage.content,
                    sequence_number: nextSequenceNumber,
                    context_type: 'none',
                    context_id: null,
                  },
                  userId
                )
                
                await saveChatMessage(
                  chatSessionId,
                  {
                    sender_type: 'assistant',
                    message: assistantMessage.content,
                    sequence_number: nextSequenceNumber + 1,
                    context_type: 'none',
                    context_id: null,
                  },
                  userId
                )
              } catch (dbError) {
                console.warn('일반 챗 메시지 저장 실패:', dbError)
              }
            }
        } else {
          // 상황 분석 API 호출 (새로운 분석 생성)
          const request: SituationRequestV2 = {
            situation: inputMessage.trim(),
            category: 'unknown',
          }

          const result = await analyzeSituationV2(request)

          // AI 응답 메시지 생성
          assistantMessage = {
            id: `msg-${Date.now()}-assistant`,
            role: 'assistant',
            content: result.analysis?.summary || '분석 결과를 불러올 수 없습니다.',
            timestamp: new Date(),
            context_type: result.id ? 'situation' : 'none',
            context_id: result.id || null,
          }
          
          // 새로운 상황 분석인 경우 컨텍스트 업데이트
          if (result.id) {
            // 상황 분석 결과를 컨텍스트로 설정
            setCurrentContext({
              type: 'situation',
              id: result.id,
              label: result.analysis?.summary?.substring(0, 30) || '상황 분석',
            })
          }

          // 리포트 생성 여부 판단 (위험도가 높거나 특정 키워드가 있는 경우)
          const shouldGenerateReport = result.riskScore > 50 || 
            ['해고', '임금', '체불', '위반', '불법'].some(keyword => inputMessage.includes(keyword))

          if (shouldGenerateReport && result.id) {
            // 리포트는 백엔드에서 자동으로 situation_analyses 테이블에 저장됨
            assistantMessage.reportId = result.id

            // 로컬 상태 업데이트
            const report: Report = {
              id: result.id,
              question: inputMessage.trim(),
              answer: result.analysis?.summary || '',
              legalBasis: result.analysis?.legalBasis?.map((b: any) => b.snippet) || [],
              recommendations: result.analysis?.recommendations || [],
              riskScore: result.riskScore,
              tags: result.tags || [],
              createdAt: new Date(),
            }

            const updatedReports = [report, ...reports].slice(0, 50) // 최근 50개만 유지
            setReports(updatedReports)
          }
        }
      }

      // API 응답 후 세션이 변경되었는지 확인
      // 세션이 변경되었다면 (새 대화를 시작했다면) 응답을 무시
      const currentSessionId = selectedConversationId
      const sessionChanged = sessionIdAtRequestStart !== currentSessionId
      
      if (sessionChanged) {
        // 세션이 변경되었으므로 응답을 무시하고 DB에만 저장 (나중에 확인 가능)
        console.log('세션이 변경되어 응답을 무시합니다. 원래 세션:', sessionIdAtRequestStart, '현재 세션:', currentSessionId)
        
        // DB에는 저장 (나중에 해당 세션을 선택하면 볼 수 있음)
        if (userId && chatSessionId) {
          try {
            const dbMessages = await getChatMessages(chatSessionId, userId)
            const maxSequenceNumber = dbMessages.length > 0 
              ? Math.max(...dbMessages.map(m => m.sequence_number))
              : -1
            
            const nextSequenceNumber = maxSequenceNumber + 1
            
            // 사용자 메시지 저장
            await saveChatMessage(
              chatSessionId,
              {
                sender_type: 'user',
                message: userMessage.content,
                sequence_number: nextSequenceNumber,
                context_type: userMessage.context_type || 'none',
                context_id: userMessage.context_id || null,
              },
              userId
            )
            
            // AI 응답 메시지 저장
            await saveChatMessage(
              chatSessionId,
              {
                sender_type: 'assistant',
                message: assistantMessage.content,
                sequence_number: nextSequenceNumber + 1,
                context_type: assistantMessage.context_type || 'none',
                context_id: assistantMessage.context_id || null,
              },
              userId
            )
          } catch (dbError) {
            console.warn('세션 변경 후 메시지 저장 실패:', dbError)
          }
        }
        
        // 현재 세션의 대화 목록은 업데이트하지 않음 (이미 다른 세션으로 전환됨)
        // 하지만 원래 세션의 대화 목록은 업데이트해야 함 (나중에 선택하면 볼 수 있도록)
        if (sessionIdAtRequestStart) {
          setConversations(prevConversations => {
            const originalSession = prevConversations.find(c => c.id === sessionIdAtRequestStart)
            if (originalSession) {
              // userMessage가 이미 포함되어 있는지 확인 (중복 방지)
              const hasUserMessage = originalSession.messages.some(m => 
                m.id === userMessage.id || 
                (m.role === 'user' && m.content === userMessage.content && 
                 Math.abs(m.timestamp.getTime() - userMessage.timestamp.getTime()) < 1000)
              )
              
              const messagesToAdd = hasUserMessage 
                ? [assistantMessage] 
                : [userMessage, assistantMessage]
              
              const finalMessages = [...originalSession.messages, ...messagesToAdd]
              const updatedSession = {
                ...originalSession,
                messages: finalMessages,
                updatedAt: new Date(),
              }
              const updatedConversations = prevConversations.map(c => 
                c.id === sessionIdAtRequestStart ? updatedSession : c
              )
              saveConversations(updatedConversations)
              return updatedConversations
            }
            return prevConversations
          })
        }
        
        return // 세션이 변경되었으므로 더 이상 진행하지 않음
      }

      const finalMessages = [...newMessages, assistantMessage]
      // AI 응답 시에도 자동 스크롤 활성화
      shouldAutoScrollRef.current = true
      setMessages(finalMessages)

      // 대화 세션 업데이트
      const updatedSession = {
        ...currentSession,
        messages: finalMessages,
        updatedAt: new Date(),
      }

      const updatedConversations = selectedConversationId
        ? conversations.map(c => c.id === selectedConversationId ? updatedSession : c)
        : [updatedSession, ...conversations]

      setConversations(updatedConversations)
      saveConversations(updatedConversations)

    } catch (error: any) {
      console.error('분석 오류:', error)
      toast({
        title: '분석 실패',
        description: error.message || '분석 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 메시지 수정
  const handleEditMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId)
    if (message && message.role === 'user') {
      setEditText(message.content)
      setEditingMessageId(messageId)
    }
  }

  // 메시지 수정 저장
  const handleSaveEdit = () => {
    if (!editingMessageId || !editText.trim()) return

    const updatedMessages = messages.map(m =>
      m.id === editingMessageId ? { ...m, content: editText.trim() } : m
    )
    setMessages(updatedMessages)

    // 대화 세션도 업데이트
    if (selectedConversationId) {
      const updatedConversations = conversations.map(c =>
        c.id === selectedConversationId
          ? { ...c, messages: updatedMessages, updatedAt: new Date() }
          : c
      )
      setConversations(updatedConversations)
      saveConversations(updatedConversations)
    }

    setEditingMessageId(null)
    setEditText('')
  }

  // 메시지 복사
  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: '복사 완료',
      description: '메시지가 클립보드에 복사되었습니다.',
    })
  }

  // 리포트 보기 (SIMULATION 상세 페이지로 이동)
  const handleViewReport = (reportId: string) => {
    router.push(`/legal/situation?analysisId=${reportId}`)
  }

  // 새 대화 시작
  const handleNewConversation = () => {
    setSelectedConversationId(null)
    setMessages([])
    setHasInitialGreeting(false)
    setCurrentContext({ type: 'none', id: null })
    setInputMessage('')
    setIsAnalyzing(false) // 분석 상태 초기화 (다른 세션의 상태가 유지되지 않도록)
    // 새 대화를 시작할 때는 상황 분석 결과도 초기화
    // (URL 파라미터에서 온 경우는 페이지 로드 시 다시 설정됨)
    setSituationAnalysis(null)
    setSituationContext(null)
    setSelectedFile(null) // 파일도 초기화
  }

  // 대화 선택
  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId)
  }

  // 상황 분석 리포트 선택 핸들러
  const handleSelectSituationReport = useCallback((situation: { id: string; situation: string }) => {
    setCurrentContext({
      type: 'situation',
      id: situation.id,
      label: situation.situation?.substring(0, 30) || '상황 분석',
    })
    setShowContextSelector(false)
    setContextSelectorType(null)
  }, [])

  // 계약서 분석 리포트 선택 핸들러
  const handleSelectContractReport = useCallback((contract: { id: string; doc_id: string; title: string }) => {
    setCurrentContext({
      type: 'contract',
      id: contract.doc_id || contract.id,
      label: contract.title || '계약서 분석',
    })
    setShowContextSelector(false)
    setContextSelectorType(null)
  }, [])

  // 상황 템플릿 선택 - 카드 클릭 시 입력창에 예시 문장 자동 채우기
  const handleSituationSelect = (situation: typeof SITUATION_PRESETS[0]) => {
    // 카드 클릭 시 입력창에 예시 문장 자동 채우기
    // 예: "인턴인데 수습 기간 중에 회사가 일방적으로 계약 해지를 통보했습니다."
    const exampleText = situation.details || situation.summary || ''
    setInputMessage(exampleText)
    // 입력창으로 포커스 이동
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(exampleText.length, exampleText.length)
      }
    }, 100)
  }

  // 날짜 포맷팅
  const formatDate = (date: Date | string): string => {
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

  // 컨텍스트 선택 컴포넌트 (상황 분석 리스트)
  const ContextSituationList = React.memo(({ onSelect, currentContextId }: { 
    onSelect: (situation: { id: string; situation: string }) => void
    currentContextId: string | null
  }) => {
    const [situations, setSituations] = useState<Array<{ id: string; situation: string; created_at: string }>>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const hasLoadedRef = useRef(false)

    useEffect(() => {
      // 이미 로드했으면 다시 로드하지 않음
      if (hasLoadedRef.current) return
      
      let isCancelled = false
      
      const loadSituations = async () => {
        try {
          setLoading(true)
          setError(null)
          
          // 사용자 인증 확인
          const { createSupabaseBrowserClient } = await import('@/supabase/supabase-client')
          const supabase = createSupabaseBrowserClient()
          const { data: { user } } = await supabase.auth.getUser()
          const userId = user?.id || null
          
          if (isCancelled) return
          
          if (!userId) {
            setError('로그인이 필요합니다')
            setSituations([])
            setLoading(false)
            hasLoadedRef.current = true
            return
          }
          
          // 타임아웃 설정 (10초로 단축)
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.')), 10000)
          })
          
          // 상황 분석 히스토리 로드 (최근 5개만)
          const historyPromise = getSituationHistoryV2(5, 0, userId)
          const history = await Promise.race([historyPromise, timeoutPromise])
          
          if (isCancelled) return
          
          // 데이터 형식 검증 및 변환
          if (Array.isArray(history)) {
            const formattedSituations = history.map((item: any) => ({
              id: item.id,
              situation: item.situation || '',
              created_at: item.created_at || new Date().toISOString(),
            }))
            setSituations(formattedSituations)
            hasLoadedRef.current = true
          } else {
            console.warn('[ContextSituationList] 예상과 다른 데이터 형식:', history)
            setSituations([])
            hasLoadedRef.current = true
          }
        } catch (error: any) {
          if (isCancelled) return
          console.error('[ContextSituationList] 상황 분석 로드 실패:', error)
          setError(error?.message || '상황 분석을 불러오는 중 오류가 발생했습니다')
          setSituations([])
          hasLoadedRef.current = true
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
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
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
              "w-full p-4 rounded-lg border transition-all text-left",
              "hover:shadow-sm active:scale-[0.98]",
              currentContextId === situation.id
                ? "border-blue-500 bg-blue-50/50 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
            )}
          >
            <div className="text-sm font-medium text-slate-900 line-clamp-2 mb-1.5">
              {situation.situation?.substring(0, 80) || '상황 분석'}
            </div>
            <div className="text-xs text-slate-500">
              {formatDate(situation.created_at)}
            </div>
          </button>
        ))}
      </div>
    )
  })
  
  ContextSituationList.displayName = 'ContextSituationList'

  // 컨텍스트 선택 컴포넌트 (계약서 분석 리스트)
  const ContextContractList = React.memo(({ onSelect, currentContextId }: { 
    onSelect: (contract: { id: string; doc_id: string; title: string }) => void
    currentContextId: string | null
  }) => {
    const [contracts, setContracts] = useState<Array<{ id: string; doc_id: string; title: string; created_at: string }>>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const hasLoadedRef = useRef(false)

    useEffect(() => {
      // 이미 로드했으면 다시 로드하지 않음
      if (hasLoadedRef.current) return
      
      let isCancelled = false
      
      const loadContracts = async () => {
        try {
          setLoading(true)
          setError(null)
          
          // 사용자 인증 확인
          const { createSupabaseBrowserClient } = await import('@/supabase/supabase-client')
          const supabase = createSupabaseBrowserClient()
          const { data: { user } } = await supabase.auth.getUser()
          const userId = user?.id || null
          
          if (isCancelled) return
          
          if (!userId) {
            setError('로그인이 필요합니다')
            setContracts([])
            setLoading(false)
            hasLoadedRef.current = true
            return
          }
          
          // 타임아웃 설정 (10초로 단축)
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.')), 10000)
          })
          
          // 계약서 분석 히스토리 로드 (최근 5개만)
          const historyPromise = getContractHistoryV2(5, 0, userId)
          const history = await Promise.race([historyPromise, timeoutPromise])
          
          if (isCancelled) return
          
          // 데이터 형식 검증 및 변환
          if (Array.isArray(history)) {
            const formattedContracts = history.map((c: any) => ({
              id: c.id,
              doc_id: c.doc_id,
              title: c.title || c.original_filename || '계약서 분석',
              created_at: c.created_at,
            }))
            setContracts(formattedContracts)
            hasLoadedRef.current = true
          } else {
            console.warn('[ContextContractList] 예상과 다른 데이터 형식:', history)
            setContracts([])
            hasLoadedRef.current = true
          }
        } catch (error: any) {
          if (isCancelled) return
          console.error('[ContextContractList] 계약서 분석 로드 실패:', error)
          setError(error?.message || '계약서 분석을 불러오는 중 오류가 발생했습니다')
          setContracts([])
          hasLoadedRef.current = true
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
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
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
              "w-full p-4 rounded-lg border transition-all text-left",
              "hover:shadow-sm active:scale-[0.98]",
              currentContextId === contract.doc_id || currentContextId === contract.id
                ? "border-blue-500 bg-blue-50/50 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
            )}
          >
            <div className="text-sm font-medium text-slate-900 line-clamp-2 mb-1.5">
              {contract.title}
            </div>
            <div className="text-xs text-slate-500">
              {formatDate(contract.created_at)}
            </div>
          </button>
        ))}
      </div>
    )
  })
  
  ContextContractList.displayName = 'ContextContractList'

  // 전체 화면 스크롤 방지
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  return (
    <div className="h-[calc(100vh-64px)] w-full overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex flex-col">
      <div className="flex flex-1 min-h-0 w-full">
        {/* 사이드바 (왼쪽 고정 너비) */}
        <div className="w-[280px] border-r border-slate-200/80 flex flex-col bg-white/80 backdrop-blur-sm shadow-lg overflow-hidden min-h-0 flex-shrink-0">
          <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-indigo-600 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <div className="p-1.5 bg-white/20 rounded-lg">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <span>대화 내역</span>
              </h2>
              <Button
                onClick={handleNewConversation}
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border-0 shadow-md hover:shadow-lg transition-all h-7 w-7 p-0"
                title="새 대화 시작"
              >
                <Zap className="w-3.5 h-3.5" />
              </Button>
            </div>
            {conversations.length > 0 && (
              <div className="text-xs text-white/80 font-medium">
                총 {conversations.length}개
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent min-h-0">
            {conversations.length === 0 ? (
              <div className="p-5 text-center">
                <div className="p-3 bg-slate-100 rounded-full w-14 h-14 mx-auto mb-3 flex items-center justify-center">
                  <MessageSquare className="w-7 h-7 text-slate-400" />
                </div>
                <p className="text-sm text-slate-500 font-medium mb-1">대화 내역이 없습니다</p>
                <p className="text-xs text-slate-400">새로운 대화를 시작해보세요</p>
              </div>
            ) : (
              <div className="p-2.5 space-y-1.5">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={cn(
                      "w-full text-left p-2.5 rounded-lg transition-all group relative",
                      "hover:shadow-md active:scale-[0.98]",
                      selectedConversationId === conv.id
                        ? "bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 shadow-sm"
                        : "bg-slate-50/50 hover:bg-slate-100/70 border border-transparent"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            selectedConversationId === conv.id ? "bg-blue-500" : "bg-slate-300"
                          )} />
                          <div className="text-xs text-slate-500 font-medium">
                            {formatDate(conv.updatedAt)}
                          </div>
                        </div>
                        <div className={cn(
                          "text-sm font-semibold truncate leading-snug",
                          selectedConversationId === conv.id ? "text-blue-900" : "text-slate-800"
                        )}>
                          {conv.messages.length > 0 
                            ? (conv.messages.find(m => m.role === 'user')?.content || conv.messages[0]?.content || conv.title)
                            : conv.title}
                        </div>
                        {conv.messages.length > 0 && (
                          <div className="text-xs text-slate-500 mt-1 line-clamp-1">
                            {conv.messages.length}개의 메시지
                          </div>
                        )}
                      </div>
                      <div
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            handleDeleteConversation(conv.id, e as any)
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className={cn(
                          "opacity-0 group-hover:opacity-100 rounded-lg p-1.5 transition-all cursor-pointer",
                          "hover:bg-red-100 hover:text-red-600",
                          selectedConversationId === conv.id && "opacity-100"
                        )}
                        title="대화 삭제"
                      >
                        <X className="w-4 h-4" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 메인 채팅 영역 (오른쪽 80%) */}
        <div className="flex-1 flex flex-col bg-gradient-to-b from-white via-slate-50/50 to-white overflow-hidden min-h-0">
          {/* 채팅 메시지 영역 */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-white via-slate-50/30 to-white px-5 sm:px-6 lg:px-8 pt-4 pb-6 space-y-5 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent min-h-0">
            {messages.length === 0 && !hasInitialGreeting && (
              <div className="flex flex-col items-center justify-center h-full pb-8">
                <div className="p-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl mb-6 shadow-lg animate-pulse">
                  <Bot className="w-16 h-16 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">안녕하세요! 👋</h2>
                <p className="text-slate-600 text-center max-w-md">
                  법률 상담이 필요하신가요? 아래에서 상황을 한 줄로 설명해주시면<br />
                  AI가 도와드릴게요.
                </p>
              </div>
            )}
            {messages.map((message, index) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-3 sm:gap-4 animate-in fade-in slide-in-from-bottom-3 duration-500",
                      message.role === 'user' ? 'justify-end' : 'justify-start',
                      index === 0 && "mt-2"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg ring-2 ring-white/50">
                        <Bot className="w-5 h-5 text-white" />
                      </div>
                    )}
                    
                    <div className={cn(
                      "flex flex-col max-w-[85%] sm:max-w-[75%]",
                      message.role === 'user' ? 'items-end' : 'items-start'
                    )}>
                      {(() => {
                        // situation 모드에서 JSON 형식이면 버블 숨김 (카드만 표시)
                        if (message.role === 'assistant' && message.context_type === 'situation') {
                          const { isJson } = extractSituationJsonFromMessage(message.content)
                          if (isJson) {
                            // JSON 형식이면 버블을 렌더링하지 않음
                            return null
                          }
                        }
                        
                        // 버블 렌더링
                        return (
                          <div
                            className={cn(
                              "relative rounded-2xl px-5 py-3.5 shadow-md transition-all duration-200",
                              "hover:shadow-lg",
                              message.role === 'user'
                                ? "bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-br-sm"
                                : "bg-white border border-slate-200/80 text-slate-900 rounded-bl-sm"
                            )}
                          >
                            {message.role === 'assistant' ? (
                              // context_type에 따라 다른 컴포넌트 사용
                              (() => {
                                // context_type === 'situation'인 경우
                                // JSON이 아니면 일반 텍스트로 표시
                                if (message.context_type === 'situation') {
                                  return <ChatAiMessage content={message.content} />
                                }
                                
                                // context_type === 'contract'인 경우도 간단한 안내만 표시
                                if (message.context_type === 'contract') {
                                  return (
                                    <p className="text-sm text-slate-700">
                                      업로드하신 계약서를 기준으로 위험 요소와 협상 포인트를 정리해 드렸어요.
                                    </p>
                                  )
                                }
                                
                                // 그 외의 경우 일반 채팅 메시지 표시
                                return <ChatAiMessage content={message.content} />
                              })()
                            ) : (
                              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white font-medium">
                                {message.content}
                              </p>
                            )}
                          </div>
                        )
                      })()}
                      
                      {/* AI 메시지의 상황분석/계약서 분석 카드 (버블 밖에 표시) */}
                      {message.role === 'assistant' && (() => {
                        // TODO: jsonParser 유틸 생성 필요
                        // const parsed = parseJsonFromMessage(message.content)
                        // const detectedContextType = parsed.success ? parsed.data?.contextType : null
                        const detectedContextType = null
                        
                        // 디버깅 로그 (개발 모드)
                        if (process.env.NODE_ENV === 'development') {
                          console.log('[메시지 렌더링]', {
                            messageId: message.id,
                            messageContextType: message.context_type,
                            contextId: message.context_id,
                            detectedContextType,
                            role: message.role,
                            contentLength: message.content.length,
                            contentPreview: message.content.substring(0, 100),
                            willRenderContract: message.context_type === 'contract' || detectedContextType === 'contract',
                          })
                        }
                        
                        // context_type 또는 파싱된 contextType으로 판단
                        if (message.context_type === 'situation' || detectedContextType === 'situation') {
                          return (
                            <div className="mt-1.5">
                              <SituationChatMessage 
                                content={message.content} 
                                contextId={message.context_id || null}
                                metadata={message.metadata}
                              />
                            </div>
                          )
                        }
                        
                        if (message.context_type === 'contract' || detectedContextType === 'contract') {
                          return (
                            <div className="mt-1.5">
                              <ContractChatMessage 
                                content={message.content}
                                contextId={message.context_id || null}
                              />
                            </div>
                          )
                        }
                        
                        return null
                      })()}
                      
                      {/* 사용자 메시지의 리포트 카드 (버블 밖에 표시, 살짝 붙어있는 느낌) */}
                      {/* 파일 첨부 시 답변기준 정보는 표시하지 않음 */}
                      {message.role === 'user' && message.context_type !== 'contract' && (
                        <div className="mt-1.5">
                          <UserMessageWithContext 
                            message={message}
                            reportCache={reportCache}
                            setReportCache={setReportCache}
                          />
                        </div>
                      )}
                      
                      {/* 컨텍스트 링크 버튼 (assistant 메시지에만 표시) */}
                      {message.role === 'assistant' && (() => {
                        const contextLink = getContextLink(message)
                        return contextLink ? (
                          <div className="flex items-center gap-2 px-1">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                              {contextLink.badge}
                            </span>
                            <Link
                              href={contextLink.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-sky-600 hover:border-sky-300 hover:bg-sky-50 transition-colors"
                            >
                              <span>리포트 자세히 보기</span>
                              <span className="text-[10px]">↗</span>
                            </Link>
                          </div>
                        ) : null
                      })()}
                      
                      <div className="flex items-center gap-2 px-1">
                        <span className={cn(
                          "text-xs font-medium",
                          message.role === 'user' ? 'text-slate-500' : 'text-slate-400'
                        )}>
                          {message.timestamp.toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {message.role === 'user' && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditMessage(message.id)}
                              className="h-6 px-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                              title="수정"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyMessage(message.content)}
                              className="h-6 px-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                              title="복사"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                        {/* 기존 reportId 기반 리포트 보기 버튼 (컨텍스트 링크가 없을 때만 표시) */}
                        {message.role === 'assistant' && message.reportId && !getContextLink(message) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewReport(message.reportId!)}
                            className="h-7 px-3 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400 transition-all"
                          >
                            <FileText className="w-3.5 h-3.5 mr-1.5" />
                            리포트 보기
                          </Button>
                        )}
                      </div>
                    </div>

                    {message.role === 'user' && (
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center shadow-lg ring-2 ring-white/50">
                        <User className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </div>
                ))}
                
                {isAnalyzing && (
                  <div className="flex gap-3 sm:gap-4 justify-start animate-in fade-in slide-in-from-bottom-3" role="status" aria-live="polite">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg ring-2 ring-white/50 animate-pulse">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div className="bg-white border border-slate-200/80 rounded-2xl rounded-bl-sm px-5 py-3.5 shadow-md">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1.5" aria-hidden="true">
                          <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                        <span className="text-sm text-slate-700 font-medium">답변 생성 중...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
          </div>

          {/* 입력 영역 - 화면 하단 고정 */}
          <div className="flex-shrink-0 border-t border-slate-200/80 bg-white/95 backdrop-blur-md px-5 py-4 shadow-lg">
            {/* 상황 분석 프리셋 칩 영역 */}
            {showSituationPresets && (
              <div className="mb-4 space-y-2">
                <div className="text-xs font-semibold text-slate-600 mb-2">
                  상황 유형을 선택하세요
                </div>
                <div className="flex flex-wrap gap-2">
                  {SITUATION_PRESETS.map((preset, index) => {
                    const Icon = preset.icon
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          // 프리셋 선택 및 입력창에 텍스트 설정
                          setSelectedSituationPreset(preset)
                          setShowSituationPresets(false)
                          setInputMessage(preset.details)
                          
                          // 입력창으로 포커스 이동
                          setTimeout(() => {
                            textareaRef.current?.focus()
                          }, 100)
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-slate-700 hover:from-blue-100 hover:to-indigo-100 hover:border-blue-300 transition-all text-xs font-medium"
                      >
                        <Icon className="h-4 w-4 text-blue-600" />
                        <span>{preset.title}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 라벨 */}
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              한 줄로 상황을 요약해 주세요
            </label>

            {/* GPT 스타일 입력 바 */}
            <div className="relative">
              <div className="flex items-end rounded-3xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                {/* textarea (채팅 입력창 느낌) */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={inputMessage}
                  onChange={(e) => {
                    setInputMessage(e.target.value)
                    // 자동 높이 조절
                    e.target.style.height = "0px"
                    e.target.style.height = e.target.scrollHeight + "px"
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  placeholder="예: 단톡방/회의에서 모욕적인 말을 들었어요"
                  className="max-h-32 flex-1 resize-none border-0 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
                  style={{
                    minHeight: '32px',
                    maxHeight: '128px',
                  }}
                />

                {/* 오른쪽 영역: 전송 버튼 */}
                <div className="ml-2 flex flex-col items-end gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={(!inputMessage.trim() && !selectedFile) || isAnalyzing}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-indigo-400 to-violet-400 text-white shadow-md disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg transition-all"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 -translate-y-[1px] rotate-45" />
                    )}
                  </button>
                </div>
              </div>

              {/* 하단 버튼 영역 */}
              <div className="flex items-center gap-2 mt-2">
                {/* 파일 첨부 버튼 */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex-shrink-0"
                  title="파일 첨부"
                >
                  <Paperclip className="h-4 w-4" />
                  <span className="text-xs font-medium">Attach</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.hwp,.hwpx,.doc,.docx,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      // 파일만 선택하고 전송은 하지 않음 (전송 버튼 클릭 시 전송)
                      setSelectedFile(file)
                    }
                  }}
                />

                {/* 리포트 불러오기 버튼 */}
                <button
                  type="button"
                  onClick={() => setOpenReportMenu((v) => !v)}
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex-shrink-0"
                  title="리포트 불러오기"
                >
                  <Globe className="h-4 w-4" />
                  <span className="text-xs font-medium">Report</span>
                </button>

                {/* 상황 분석 폼 버튼 */}
                <button
                  type="button"
                  onClick={() => setShowSituationPresets((v) => !v)}
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex-shrink-0"
                  title="상황 분석 폼"
                >
                  <BookOpen className="h-4 w-4" />
                  <span className="text-xs font-medium">Situation Analysis</span>
                </button>
              </div>

              {/* 리포트 메뉴 (Globe 버튼 클릭 시) */}
              {openReportMenu && (
                <div data-report-menu className="absolute left-0 bottom-full z-10 mb-2 w-64 rounded-2xl border border-slate-100 bg-white p-1 shadow-lg">
                  <div className="px-3 py-1.5 text-xs text-slate-500 font-medium border-b border-slate-100">
                    참고할 리포트
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setContextSelectorType('situation')
                      setShowContextSelector(true)
                      setOpenReportMenu(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-slate-50 transition-colors text-slate-700"
                  >
                    <FileText className="w-4 h-4" />
                    <span>상황 분석 리포트 불러오기</span>
                    {currentContext.type === 'situation' && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 ml-auto" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setContextSelectorType('contract')
                      setShowContextSelector(true)
                      setOpenReportMenu(false)
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-slate-50 transition-colors text-slate-700"
                  >
                    <FileText className="w-4 h-4" />
                    <span>계약서 분석 리포트 불러오기</span>
                    {currentContext.type === 'contract' && (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 ml-auto" />
                    )}
                  </button>
                </div>
              )}

              {/* 선택된 파일 표시 */}
              {selectedFile && (
                <div className="mt-2 px-3 py-2 rounded-lg bg-blue-50/50 border border-blue-200/50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span className="text-blue-700 font-medium">{selectedFile.name}</span>
                    <span className="text-blue-500">({(selectedFile.size / 1024).toFixed(1)}KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* 현재 컨텍스트 표시 (선택된 경우) */}
            {currentContext.type !== 'none' && currentContext.label && (
              <div className="mt-3 px-3 py-1.5 rounded-lg bg-blue-50/50 border border-blue-200/50">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">상담 기준:</span>
                  <span className="font-medium text-blue-700">
                    {currentContext.type === 'situation' && '📋 '}
                    {currentContext.type === 'contract' && '📄 '}
                    {currentContext.label}
                  </span>
                  <button
                    onClick={() => setCurrentContext({ type: 'none', id: null })}
                    className="ml-auto text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 메시지 수정 모달 */}
      <Dialog open={editingMessageId !== null} onOpenChange={(open) => !open && setEditingMessageId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>메시지 수정</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="min-h-[120px]"
            style={{ fontFamily: 'Noto Sans KR, sans-serif' }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingMessageId(null)}>
              취소
            </Button>
            <Button 
              onClick={handleSaveEdit} 
              className={cn("bg-gradient-to-r text-white", PRIMARY_GRADIENT, PRIMARY_GRADIENT_HOVER)}
            >
              저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 컨텍스트 선택 모달 */}
      <Dialog 
        open={showContextSelector} 
        onOpenChange={(open) => {
          setShowContextSelector(open)
          if (!open) {
            setContextSelectorType(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-sm">
                {contextSelectorType === 'situation' ? (
                  <MessageSquare className="w-5 h-5 text-white" />
                ) : contextSelectorType === 'contract' ? (
                  <FileText className="w-5 h-5 text-white" />
                ) : (
                  <Sparkles className="w-5 h-5 text-white" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {contextSelectorType === 'situation' 
                    ? '상황 분석 리포트 선택'
                    : contextSelectorType === 'contract'
                    ? '계약서 분석 리포트 선택'
                    : '컨텍스트 선택'}
                </h3>
                <p className="text-sm text-slate-600 mt-1 font-normal">
                  {contextSelectorType === 'situation'
                    ? '대화에 참조할 상황 분석 리포트를 선택하세요'
                    : contextSelectorType === 'contract'
                    ? '대화에 참조할 계약서 분석 리포트를 선택하세요'
                    : '대화에 참조할 리포트를 선택하세요'}
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-5 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
            <div className="space-y-3">
              {/* 상황 분석 선택 - 상황 분석 버튼 클릭 시에만 표시 */}
              {contextSelectorType === 'situation' && (
                <ContextSituationList
                  onSelect={handleSelectSituationReport}
                  currentContextId={currentContext.type === 'situation' ? currentContext.id : null}
                />
              )}

              {/* 계약서 분석 선택 - 계약서 분석 버튼 클릭 시에만 표시 */}
              {contextSelectorType === 'contract' && (
                <ContextContractList
                  onSelect={handleSelectContractReport}
                  currentContextId={currentContext.type === 'contract' ? currentContext.id : null}
                />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 상황 분석 아카이브 모달 */}
      <Dialog open={showArchiveModal} onOpenChange={setShowArchiveModal}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200 bg-gradient-to-r from-blue-50/50 to-indigo-50/50">
            <DialogTitle className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-sm">
                <FolderArchive className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  상황 분석 아카이브
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">저장된 상황 분석 결과를 확인하세요</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
            {isLoadingReports ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-blue-100 rounded-full"></div>
                  <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                </div>
                <p className="text-sm text-slate-600 mt-4 font-medium">상황 분석을 불러오는 중...</p>
                <p className="text-xs text-slate-400 mt-1">잠시만 기다려주세요</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-16">
                <div className="p-5 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl w-20 h-20 mx-auto mb-5 flex items-center justify-center shadow-inner">
                  <FolderArchive className="w-10 h-10 text-slate-400" />
                </div>
                <h4 className="text-lg font-semibold text-slate-800 mb-2">저장된 상황 분석이 없습니다</h4>
                <p className="text-sm text-slate-500 mb-1">상황 분석을 진행하면 결과가 자동으로 저장됩니다</p>
                <p className="text-xs text-slate-400">분석 결과를 나중에 다시 확인할 수 있어요</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report, index) => (
                  <div
                    key={report.id}
                    className={cn(
                      "group relative bg-white border-2 rounded-xl transition-all duration-200",
                      "hover:border-blue-300 hover:shadow-lg hover:scale-[1.01]",
                      "cursor-pointer active:scale-[0.99]",
                      "border-slate-200"
                    )}
                    onClick={() => {
                      setShowArchiveModal(false)
                      handleViewReport(report.id)
                    }}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          {/* 제목 및 날짜 */}
                          <div className="flex items-start gap-3 mb-3">
                            <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex-shrink-0 mt-0.5">
                              <FileText className="w-4 h-4 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-base text-slate-900 mb-1.5 line-clamp-2 group-hover:text-blue-700 transition-colors">
                                {report.question || '상황 분석'}
                              </h4>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Clock className="w-3.5 h-3.5" />
                                <span>
                                  {report.createdAt.toLocaleString('ko-KR', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 위험도 표시 */}
                          {report.riskScore !== undefined && (
                            <div className="mb-3">
                              <div className="flex items-center gap-3">
                                {/* 위험도 레벨 배지 */}
                                <div className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm",
                                  "border-2 shadow-sm",
                                  report.riskScore > 70 
                                    ? "bg-red-50 border-red-300 text-red-700" 
                                    : report.riskScore > 40 
                                    ? "bg-amber-50 border-amber-300 text-amber-700" 
                                    : "bg-green-50 border-green-300 text-green-700"
                                )}>
                                  {report.riskScore > 70 ? (
                                    <>
                                      <AlertTriangle className="w-4 h-4" />
                                      <span>높음</span>
                                    </>
                                  ) : report.riskScore > 40 ? (
                                    <>
                                      <AlertTriangle className="w-4 h-4" />
                                      <span>보통</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="w-4 h-4" />
                                      <span>낮음</span>
                                    </>
                                  )}
                                </div>
                                
                                {/* 점수 표시 */}
                                <div className="flex items-baseline gap-1">
                                  <span className={cn(
                                    "text-2xl font-bold",
                                    report.riskScore > 70 ? "text-red-600" : 
                                    report.riskScore > 40 ? "text-amber-600" : "text-green-600"
                                  )}>
                                    {report.riskScore}
                                  </span>
                                  <span className="text-xs text-slate-500 font-medium">/ 100</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 태그 */}
                          {report.tags && report.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {report.tags.slice(0, 3).map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 rounded-full border border-blue-200/50"
                                >
                                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                  {tag}
                                </span>
                              ))}
                              {report.tags.length > 3 && (
                                <span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
                                  +{report.tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 액션 버튼 */}
                        <div className="flex flex-col items-center gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteReport(report.id, e)
                            }}
                            className={cn(
                              "opacity-0 group-hover:opacity-100 p-2 rounded-lg transition-all",
                              "hover:bg-red-50 hover:text-red-600 text-slate-400",
                              "border border-transparent hover:border-red-200"
                            )}
                            title="상황 분석 삭제"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* 호버 효과 - 하단 그라데이션 */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-b-xl"></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* 하단 정보 */}
          {reports.length > 0 && (
            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/50">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium">총 {reports.length}개의 상황 분석</span>
                <span className="text-slate-400">분석 결과를 클릭하면 상세 내용을 확인할 수 있습니다</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
