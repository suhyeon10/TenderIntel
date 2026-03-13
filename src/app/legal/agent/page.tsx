'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  MessageSquare,
  FileText,
  Upload,
  FolderOpen,
  Send,
  Loader2,
  Scale,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronRight,
  BookOpen,
  Clock,
  X,
  Paperclip,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Menu,
  Edit2,
  Save,
  History,
  Phone,
  FileSearch,
  ShieldAlert,
  Zap,
} from 'lucide-react'

// ───────────────────────────── Types ─────────────────────────────

type AgentMode = 'question' | 'situation' | 'contract' | 'report'

interface Citation {
  id: string
  source: string
  excerpt: string
  law?: string
}

interface RiskLevel {
  level: 'high' | 'medium' | 'low' | 'info'
  label: string
}

interface AgentMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  mode?: AgentMode
  riskLevel?: RiskLevel
  citations?: Citation[]
  attachedFileName?: string
  timestamp: Date
}

interface NextAction {
  id: string
  label: string
  description: string
  type: 'consult' | 'document' | 'search' | 'report'
  icon: React.ElementType
}

interface RecentSession {
  id: string
  title: string
  mode: AgentMode
  preview: string
  date: Date
}

// ───────────────────────────── Constants ─────────────────────────────

const MODES: { id: AgentMode; label: string; icon: React.ElementType; description: string; placeholder: string }[] = [
  {
    id: 'question',
    label: '질문하기',
    icon: MessageSquare,
    description: '법률 관련 궁금한 점을 자유롭게 질문하세요.',
    placeholder: '예: 수습 기간 중 해고가 합법인가요? 퇴직금은 언제부터 받을 수 있나요?',
  },
  {
    id: 'situation',
    label: '상황 설명하기',
    icon: FileText,
    description: '지금 겪는 상황을 자세히 설명하면 법적 쟁점을 정리해 드립니다.',
    placeholder: `예:\n- 언제부터: 2025년 1월부터 인턴으로 근무 중\n- 어떤 일이 있었나요: 이번 주 팀장으로부터 "그만 나와도 될 것 같다"는 말을 들었습니다\n- 내가 느끼는 문제점: 수습이라서 아무런 보호를 받지 못한다고 생각하지만, 정확히 모르겠습니다`,
  },
  {
    id: 'contract',
    label: '계약서 첨부',
    icon: Upload,
    description: '계약서를 업로드하면 위험 조항을 분석해 드립니다.',
    placeholder: '계약서에 대해 추가로 궁금한 점이 있으면 입력하세요. (선택사항)',
  },
  {
    id: 'report',
    label: '리포트 불러오기',
    icon: FolderOpen,
    description: '이전에 분석한 리포트를 컨텍스트로 연결해 후속 질문을 이어가세요.',
    placeholder: '선택한 리포트에 대해 추가로 질문하거나 후속 조치를 물어보세요.',
  },
]

const MOCK_RECENT_SESSIONS: RecentSession[] = [
  {
    id: '1',
    title: '수습 해고 통보 대응',
    mode: 'situation',
    preview: '수습 기간 중 해고 통보를 받은 경우 근로기준법 제35조에 따라...',
    date: new Date('2026-03-12'),
  },
  {
    id: '2',
    title: '프리랜서 계약서 검토',
    mode: 'contract',
    preview: '제7조 지식재산권 조항에 위험 요소가 발견되었습니다...',
    date: new Date('2026-03-10'),
  },
  {
    id: '3',
    title: '야근 수당 미지급 문의',
    mode: 'question',
    preview: '연장근로수당은 통상임금의 50% 이상으로 지급해야 합니다...',
    date: new Date('2026-03-08'),
  },
]

const MOCK_NEXT_ACTIONS: NextAction[] = [
  {
    id: '1',
    label: '노동청에 신고하기',
    description: '고용노동부 민원마당에서 임금체불 진정 신청이 가능합니다.',
    type: 'consult',
    icon: Phone,
  },
  {
    id: '2',
    label: '내용증명 작성하기',
    description: '해고 또는 임금 체불에 대한 내용증명 발송으로 기록을 남기세요.',
    type: 'document',
    icon: FileSearch,
  },
  {
    id: '3',
    label: '유사 케이스 찾아보기',
    description: '비슷한 상황의 판례와 결과를 확인하세요.',
    type: 'search',
    icon: BookOpen,
  },
  {
    id: '4',
    label: '분석 리포트 저장하기',
    description: '이 대화의 분석 내용을 리포트로 저장해 두세요.',
    type: 'report',
    icon: Save,
  },
]

// 위험도 뱃지 스타일 매핑
const RISK_STYLES = {
  high: {
    bg: 'bg-red-50 border-red-200',
    badge: 'bg-red-100 text-red-700 border-red-200',
    icon: AlertTriangle,
    iconColor: 'text-red-500',
  },
  medium: {
    bg: 'bg-amber-50 border-amber-200',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
  },
  low: {
    bg: 'bg-emerald-50 border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
    iconColor: 'text-emerald-500',
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    badge: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Info,
    iconColor: 'text-blue-500',
  },
}

const MODE_COLORS: Record<AgentMode, { from: string; to: string; text: string; light: string; border: string }> = {
  question: { from: 'from-blue-500', to: 'to-indigo-600', text: 'text-blue-600', light: 'bg-blue-50', border: 'border-blue-200' },
  situation: { from: 'from-emerald-500', to: 'to-green-600', text: 'text-emerald-600', light: 'bg-emerald-50', border: 'border-emerald-200' },
  contract: { from: 'from-violet-500', to: 'to-purple-600', text: 'text-violet-600', light: 'bg-violet-50', border: 'border-violet-200' },
  report: { from: 'from-amber-500', to: 'to-orange-600', text: 'text-amber-600', light: 'bg-amber-50', border: 'border-amber-200' },
}

// ───────────────────────────── Sub Components ─────────────────────────────

/** 에이전트 응답 메시지 버블 */
function AgentResponseBubble({ message }: { message: AgentMessage }) {
  const risk = message.riskLevel
  const riskStyle = risk ? RISK_STYLES[risk.level] : null

  return (
    <div className={cn(
      'rounded-2xl border-2 p-5 shadow-sm',
      riskStyle?.bg ?? 'bg-slate-50 border-slate-200',
    )}>
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
          <Scale className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-semibold text-slate-700">Linkus Legal AI</span>
        {risk && (
          <span className={cn(
            'ml-auto inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border',
            riskStyle?.badge,
          )}>
            {riskStyle && React.createElement(riskStyle.icon, { className: 'w-3 h-3' })}
            {risk.label}
          </span>
        )}
      </div>

      {/* 본문 */}
      <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap mb-4">
        {message.content}
      </div>

      {/* 법적 근거 인용 */}
      {message.citations && message.citations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            참조 법령 · 근거
          </p>
          <div className="space-y-2">
            {message.citations.map((cite) => (
              <div key={cite.id} className="rounded-lg bg-white border border-slate-200 px-3 py-2">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-500 flex-shrink-0">§</span>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{cite.source}</p>
                    <p className="text-xs text-slate-600 mt-0.5 italic">"{cite.excerpt}"</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400 mt-3">
        {message.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )
}

/** 사용자 메시지 버블 */
function UserMessageBubble({ message }: { message: AgentMessage }) {
  const modeInfo = MODES.find(m => m.id === message.mode)
  const ModeIcon = modeInfo?.icon ?? MessageSquare

  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 px-5 py-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2 opacity-80">
          <ModeIcon className="w-3.5 h-3.5 text-blue-200" />
          <span className="text-xs text-blue-200 font-medium">{modeInfo?.label ?? '메시지'}</span>
          {message.attachedFileName && (
            <span className="ml-1 flex items-center gap-1 text-xs text-blue-200">
              <Paperclip className="w-3 h-3" />
              {message.attachedFileName}
            </span>
          )}
        </div>
        <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{message.content}</p>
        <p className="text-[10px] text-blue-300 mt-2">
          {message.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

/** 모드 선택 탭 */
function ModeSelector({
  activeMode,
  onSelect,
}: {
  activeMode: AgentMode
  onSelect: (mode: AgentMode) => void
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {MODES.map((mode) => {
        const Icon = mode.icon
        const isActive = activeMode === mode.id
        const colors = MODE_COLORS[mode.id]
        return (
          <button
            key={mode.id}
            onClick={() => onSelect(mode.id)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all duration-200',
              isActive
                ? `bg-gradient-to-r ${colors.from} ${colors.to} text-white border-transparent shadow-md`
                : `bg-white ${colors.text} ${colors.border} hover:${colors.light}`,
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{mode.label}</span>
            <span className="sm:hidden">{mode.label.split('하기')[0]}</span>
          </button>
        )
      })}
    </div>
  )
}

/** 계약서 업로드 영역 */
function ContractUploadZone({
  onFileSelect,
  selectedFile,
  onClear,
}: {
  onFileSelect: (file: File) => void
  selectedFile: File | null
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) onFileSelect(file)
  }, [onFileSelect])

  if (selectedFile) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 border-2 border-violet-200">
        <div className="p-2 bg-violet-100 rounded-lg">
          <FileText className="w-5 h-5 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-violet-800 truncate">{selectedFile.name}</p>
          <p className="text-xs text-violet-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
        </div>
        <button onClick={onClear} className="p-1.5 hover:bg-violet-100 rounded-lg transition-colors">
          <X className="w-4 h-4 text-violet-500" />
        </button>
      </div>
    )
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-dashed border-violet-300 bg-violet-50/50 cursor-pointer hover:bg-violet-50 hover:border-violet-400 transition-all"
    >
      <div className="p-3 bg-violet-100 rounded-xl">
        <Upload className="w-6 h-6 text-violet-600" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-violet-800">계약서를 드래그하거나 클릭해서 업로드</p>
        <p className="text-xs text-violet-500 mt-1">PDF, DOCX, TXT · 최대 10MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFileSelect(file)
        }}
      />
    </div>
  )
}

/** 리포트 선택 목록 */
function ReportSelector({
  sessions,
  selectedId,
  onSelect,
}: {
  sessions: RecentSession[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const modeLabels: Record<AgentMode, string> = {
    question: '질문',
    situation: '상황분석',
    contract: '계약서',
    report: '리포트',
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 font-medium">불러올 기존 리포트를 선택하세요</p>
      {sessions.map((session) => {
        const isSelected = session.id === selectedId
        return (
          <button
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={cn(
              'w-full text-left rounded-xl border-2 px-4 py-3 transition-all',
              isSelected
                ? 'border-amber-400 bg-amber-50 shadow-sm'
                : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/50',
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                'mt-0.5 px-2 py-0.5 rounded text-[10px] font-semibold flex-shrink-0',
                isSelected ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-600',
              )}>
                {modeLabels[session.mode]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{session.title}</p>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{session.preview}</p>
              </div>
              <span className="text-[10px] text-slate-400 flex-shrink-0 mt-0.5">
                {session.date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/** 문서 컨텍스트 패널 */
function DocumentContextPanel({
  attachedFile,
  selectedReport,
  sessions,
}: {
  attachedFile: File | null
  selectedReport: string | null
  sessions: RecentSession[]
}) {
  const report = sessions.find(s => s.id === selectedReport)
  const hasContext = attachedFile || report

  if (!hasContext) return null

  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1">
        <Paperclip className="w-3.5 h-3.5" />
        연결된 컨텍스트
      </p>
      <div className="space-y-2">
        {attachedFile && (
          <div className="flex items-center gap-2 rounded-lg bg-violet-50 border border-violet-200 px-3 py-2">
            <FileText className="w-4 h-4 text-violet-600 flex-shrink-0" />
            <span className="text-xs font-medium text-violet-800 truncate">{attachedFile.name}</span>
            <span className="ml-auto text-[10px] text-violet-500">계약서</span>
          </div>
        )}
        {report && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <FolderOpen className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-xs font-medium text-amber-800 truncate">{report.title}</span>
            <span className="ml-auto text-[10px] text-amber-500">리포트</span>
          </div>
        )}
      </div>
    </div>
  )
}

/** 추천 다음 액션 카드 */
function NextActionsPanel({ actions }: { actions: NextAction[] }) {
  const typeColors = {
    consult: 'text-blue-600 bg-blue-50 border-blue-200',
    document: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    search: 'text-violet-600 bg-violet-50 border-violet-200',
    report: 'text-amber-600 bg-amber-50 border-amber-200',
  }

  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1">
        <Zap className="w-3.5 h-3.5" />
        추천 다음 액션
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {actions.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-all hover:shadow-sm hover:-translate-y-0.5',
                typeColors[action.type],
              )}
            >
              <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold">{action.label}</p>
                <p className="text-[11px] mt-0.5 opacity-75 leading-snug">{action.description}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** 최근 히스토리 사이드바 */
function HistoryDrawer({
  open,
  onClose,
  sessions,
  onSelectSession,
}: {
  open: boolean
  onClose: () => void
  sessions: RecentSession[]
  onSelectSession: (id: string) => void
}) {
  const modeIcon: Record<AgentMode, React.ElementType> = {
    question: MessageSquare,
    situation: FileText,
    contract: Upload,
    report: FolderOpen,
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div className={cn(
        'fixed right-0 top-0 h-full w-80 bg-white border-l-2 border-slate-200 shadow-2xl z-50 flex flex-col transition-transform duration-300',
        open ? 'translate-x-0' : 'translate-x-full',
      )}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-600" />
            <span className="font-semibold text-slate-800">최근 상담 기록</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {sessions.map((session) => {
            const Icon = modeIcon[session.mode]
            return (
              <button
                key={session.id}
                onClick={() => { onSelectSession(session.id); onClose() }}
                className="w-full text-left rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 hover:border-blue-300 hover:bg-blue-50/50 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-slate-200 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <Icon className="w-3.5 h-3.5 text-slate-600 group-hover:text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-800">
                      {session.title}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-snug">
                      {session.preview}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {session.date.toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ───────────────────────────── Mock AI Response Generator ─────────────────────────────

function generateMockResponse(mode: AgentMode, input: string, fileName?: string): Omit<AgentMessage, 'id' | 'timestamp' | 'role'> {
  if (mode === 'contract') {
    return {
      content: `계약서 "${fileName ?? '첨부 파일'}" 분석 결과입니다.\n\n**[고위험 조항 발견]**\n\n1. **제3조 수습 해고 조항**: "수습 기간 중 회사는 사전 고지 없이 근로관계를 종료할 수 있다" — 이는 근로기준법 제26조(해고의 예고)를 위반할 소지가 있습니다.\n\n2. **제9조 지식재산권**: "재직 중 및 퇴직 후 2년간 발생한 모든 창작물은 회사 소유로 한다" — 범위가 지나치게 광범위하여 불합리한 조항으로 볼 수 있습니다.\n\n**[주의 조항]**\n3. **제5조 초과근무**: 포괄임금제 적용 조항 포함 — 실제 연장근로수당 지급 여부 확인 필요.\n\n**수정 제안**: 제3조는 "수습 기간 중에도 30일 이상 예고 또는 30일분 이상 통상임금 지급" 문구로 수정을 요청하세요.`,
      mode,
      attachedFileName: fileName,
      riskLevel: { level: 'high', label: '고위험 조항 발견' },
      citations: [
        { id: 'c1', source: '근로기준법 제26조 (해고의 예고)', excerpt: '사용자는 근로자를 해고하려면 적어도 30일 전에 예고를 하여야 한다.' },
        { id: 'c2', source: '근로기준법 제35조', excerpt: '일용근로자, 수습 사용 중인 근로자로서 수습 사용한 날부터 3개월 이내인 사람은 해고예고 적용 예외.' },
      ],
    }
  }

  if (mode === 'situation') {
    return {
      content: `상황을 분석했습니다.\n\n**법적 쟁점**\n귀하가 설명하신 상황은 **부당해고** 또는 **수습해고 절차 위반** 가능성이 있습니다.\n\n**핵심 판단 기준**\n- 수습 기간이 3개월 미만이라면 해고예고 적용 제외이나, 해고 이유가 명확해야 합니다.\n- 구두로만 "나오지 않아도 된다"고 한 경우, 이것이 법적 해고 통보로 인정되는지가 쟁점입니다.\n\n**지금 당장 해야 할 것**\n1. 대화 내용을 메모 또는 녹음으로 기록 (날짜, 장소, 발화자)\n2. 문자/이메일로 회사에 "정식 해고 여부 확인" 요청\n3. 퇴직 전 4대보험 가입 여부 확인\n\n증거를 확보한 후 고용노동부 민원마당 또는 노동청에 진정을 제기할 수 있습니다.`,
      mode,
      riskLevel: { level: 'medium', label: '법적 검토 필요' },
      citations: [
        { id: 's1', source: '근로기준법 제23조 (해고 등의 제한)', excerpt: '사용자는 근로자에게 정당한 이유 없이 해고, 휴직, 정직, 전직, 감봉, 그 밖의 징벌을 하지 못한다.' },
        { id: 's2', source: '고용노동부 수습근로자 해고 가이드 (2024)', excerpt: '수습 중 해고는 객관적이고 합리적인 이유가 있어야 하며, 이를 입증할 책임은 사용자에게 있다.' },
      ],
    }
  }

  if (mode === 'report') {
    return {
      content: `이전 리포트를 바탕으로 후속 분석을 진행했습니다.\n\n이전 분석에서 확인된 주요 쟁점 3가지를 기반으로 현재 질문에 답변드립니다.\n\n**후속 권고**\n- 이전에 확인한 수습 해고 관련 리스크는 현재도 유효합니다.\n- 추가로 내용증명을 발송하셨다면, 발송 날짜와 내용을 기록해 두세요.\n- 상황이 해결되지 않았다면 다음 단계로 노동청 진정 신청을 고려해 보세요.`,
      mode,
      riskLevel: { level: 'info', label: '후속 분석' },
      citations: [
        { id: 'r1', source: '이전 리포트: 수습 해고 통보 대응', excerpt: '수습 기간 중 해고 예고 없이 구두로 퇴직 의사를 표현한 것은 정식 해고 통보로 보기 어렵습니다.' },
      ],
    }
  }

  // question (default)
  return {
    content: `질문에 대해 답변드립니다.\n\n${input.includes('퇴직금') ? '**퇴직금 지급 조건**\n퇴직금은 계속 근로기간이 1년 이상이고, 4주간을 평균하여 1주간 소정근로시간이 15시간 이상인 근로자에게 지급됩니다.\n\n**계산 방법**\n퇴직금 = 1일 평균임금 × 30일 × (총 계속근로기간 / 365)\n\n수습 기간도 계속근로기간에 포함되므로, 수습 시작일부터 퇴직일까지 1년을 채웠다면 퇴직금 수령 자격이 생깁니다.' : `**답변**\n\n귀하의 질문 "${input.slice(0, 30)}..."에 대해 관련 법령과 표준 가이드를 검토했습니다.\n\n핵심 요점을 정리해 드립니다. 더 구체적인 상황이 있다면 '상황 설명하기' 모드로 자세히 알려주세요.`}`,
    mode,
    riskLevel: { level: 'low', label: '일반 법률 정보' },
    citations: [
      { id: 'q1', source: '근로자퇴직급여 보장법 제4조', excerpt: '사용자는 퇴직하는 근로자에게 급여를 지급하기 위하여 퇴직급여제도 중 하나 이상의 제도를 설정하여야 한다.' },
    ],
  }
}

// ───────────────────────────── Main Page ─────────────────────────────

export default function LegalAgentPage() {
  const [activeMode, setActiveMode] = useState<AgentMode>('question')
  const [inputText, setInputText] = useState('')
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [sessionTitle, setSessionTitle] = useState('새 법률 상담')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [showNextActions, setShowNextActions] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const currentMode = MODES.find(m => m.id === activeMode)!
  const modeColors = MODE_COLORS[activeMode]

  // 모드 변경 시 입력 초기화
  const handleModeChange = (mode: AgentMode) => {
    setActiveMode(mode)
    setInputText('')
    if (mode !== 'contract') setAttachedFile(null)
    if (mode !== 'report') setSelectedReportId(null)
  }

  // 메시지 전송
  const handleSend = async () => {
    const hasInput = inputText.trim() || attachedFile || selectedReportId
    if (!hasInput || isLoading) return

    const userContent = inputText.trim() ||
      (attachedFile ? `계약서 "${attachedFile.name}" 분석 요청` : '') ||
      (selectedReportId ? `리포트 "${MOCK_RECENT_SESSIONS.find(s => s.id === selectedReportId)?.title}" 기반 후속 질문` : '')

    const userMsg: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userContent,
      mode: activeMode,
      attachedFileName: attachedFile?.name,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInputText('')
    setIsLoading(true)

    // 스크롤
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)

    // AI 응답 시뮬레이션
    await new Promise(r => setTimeout(r, 1800))

    const mockResponse = generateMockResponse(activeMode, userContent, attachedFile?.name)
    const agentMsg: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'agent',
      timestamp: new Date(),
      ...mockResponse,
    }

    setMessages(prev => [...prev, agentMsg])
    setIsLoading(false)
    setShowNextActions(true)

    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  // 제목 편집
  const handleTitleSave = () => {
    setIsEditingTitle(false)
  }

  useEffect(() => {
    if (isEditingTitle) titleInputRef.current?.focus()
  }, [isEditingTitle])

  const canSend = (inputText.trim() || attachedFile || selectedReportId) && !isLoading

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex flex-col">
      {/* ── 에이전트 헤더 ── */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">
          <div className="flex items-center gap-3 h-14">
            {/* 세션 타이틀 */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex-shrink-0">
                <Scale className="w-4 h-4 text-white" />
              </div>
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                  className="flex-1 min-w-0 text-sm font-semibold text-slate-800 bg-transparent border-b-2 border-blue-400 outline-none px-1"
                />
              ) : (
                <button
                  onClick={() => setIsEditingTitle(true)}
                  className="flex items-center gap-1.5 group"
                >
                  <span className="text-sm font-semibold text-slate-800 truncate">{sessionTitle}</span>
                  <Edit2 className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              )}
            </div>

            {/* 헤더 액션 */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-xs font-semibold text-blue-700">RAG 기반 분석</span>
              </div>
              <button
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                <History className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">상담 기록</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 메인 레이아웃 ── */}
      <div className="flex-1 container mx-auto px-4 sm:px-6 max-w-6xl py-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

          {/* ── 좌측: 대화 + 입력 영역 ── */}
          <div className="flex flex-col gap-5">

            {/* 비어 있을 때 히어로 */}
            {messages.length === 0 && (
              <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                  <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                    <Scale className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                      법률 AI 에이전트
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                      질문하기, 상황 설명, 계약서 분석, 리포트 연계 — 한 화면에서 모두
                    </p>
                  </div>
                </div>

                {/* 빠른 시작 카드 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      label: '수습 기간 중 해고가 합법인가요?',
                      mode: 'question' as AgentMode,
                    },
                    {
                      label: '지금 겪는 상황을 설명하고 싶어요',
                      mode: 'situation' as AgentMode,
                    },
                    {
                      label: '계약서를 올려서 위험 조항 확인하기',
                      mode: 'contract' as AgentMode,
                    },
                    {
                      label: '이전 분석 리포트 이어서 보기',
                      mode: 'report' as AgentMode,
                    },
                  ].map((item) => {
                    const ModeIcon = MODES.find(m => m.id === item.mode)!.icon
                    const colors = MODE_COLORS[item.mode]
                    return (
                      <button
                        key={item.label}
                        onClick={() => {
                          handleModeChange(item.mode)
                          if (item.mode === 'question') setInputText(item.label)
                        }}
                        className={cn(
                          'flex items-start gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-all hover:shadow-md hover:-translate-y-0.5',
                          colors.border,
                          colors.light,
                        )}
                      >
                        <ModeIcon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', colors.text)} />
                        <span className={cn('text-sm font-medium', colors.text)}>{item.label}</span>
                      </button>
                    )
                  })}
                </div>

                {/* 면책 고지 */}
                <div className="mt-5 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                  <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    이 서비스는 <strong>법률 자문이 아닌 정보 제공 도구</strong>입니다.
                    공개된 법령·가이드를 기반으로 분석하며, 구체적 사건은 반드시 전문가 상담을 받으세요.
                  </p>
                </div>
              </div>
            )}

            {/* 대화 메시지 영역 */}
            {messages.length > 0 && (
              <div className="space-y-4">
                {messages.map((msg) =>
                  msg.role === 'user' ? (
                    <UserMessageBubble key={msg.id} message={msg} />
                  ) : (
                    <AgentResponseBubble key={msg.id} message={msg} />
                  ),
                )}

                {/* 로딩 중 */}
                {isLoading && (
                  <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                        <Scale className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        법령 데이터베이스를 검색하고 분석 중입니다...
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}

            {/* ── 입력 영역 ── */}
            <div className={cn(
              'rounded-2xl border-2 bg-white shadow-sm p-5',
              modeColors.border,
            )}>
              {/* 모드 선택 탭 */}
              <div className="mb-4">
                <ModeSelector activeMode={activeMode} onSelect={handleModeChange} />
              </div>

              {/* 모드 설명 */}
              <p className={cn('text-xs mb-3 font-medium', modeColors.text)}>
                {currentMode.description}
              </p>

              {/* 계약서 모드: 파일 업로드 */}
              {activeMode === 'contract' && (
                <div className="mb-4">
                  <ContractUploadZone
                    onFileSelect={setAttachedFile}
                    selectedFile={attachedFile}
                    onClear={() => setAttachedFile(null)}
                  />
                </div>
              )}

              {/* 리포트 모드: 리포트 선택 */}
              {activeMode === 'report' && (
                <div className="mb-4">
                  <ReportSelector
                    sessions={MOCK_RECENT_SESSIONS}
                    selectedId={selectedReportId}
                    onSelect={setSelectedReportId}
                  />
                </div>
              )}

              {/* 텍스트 입력 */}
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={currentMode.placeholder}
                className={cn(
                  'min-h-[100px] sm:min-h-[120px] resize-none text-sm border-2 rounded-xl focus-visible:ring-0 transition-colors',
                  `focus:${modeColors.border}`,
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend()
                }}
              />

              {/* 전송 버튼 */}
              <div className="flex items-center justify-between mt-3">
                <p className="text-[11px] text-slate-400">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">⌘ Enter</kbd>
                  {' '}로 전송
                </p>
                <Button
                  onClick={handleSend}
                  disabled={!canSend}
                  className={cn(
                    'gap-2 bg-gradient-to-r shadow-sm',
                    modeColors.from, modeColors.to,
                    'hover:opacity-90 text-white',
                  )}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {activeMode === 'contract' ? '계약서 분석' :
                   activeMode === 'situation' ? '상황 분석' :
                   activeMode === 'report' ? '리포트 연계 질문' : '질문 전송'}
                </Button>
              </div>
            </div>
          </div>

          {/* ── 우측 패널 (데스크톱) ── */}
          <div className="hidden lg:flex flex-col gap-4 sticky top-24">

            {/* 문서 컨텍스트 */}
            <DocumentContextPanel
              attachedFile={attachedFile}
              selectedReport={selectedReportId}
              sessions={MOCK_RECENT_SESSIONS}
            />

            {/* 추천 다음 액션 */}
            {showNextActions && (
              <NextActionsPanel actions={MOCK_NEXT_ACTIONS} />
            )}

            {/* 최근 상담 요약 */}
            <div className="rounded-xl border-2 border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                최근 상담
              </p>
              <div className="space-y-2">
                {MOCK_RECENT_SESSIONS.slice(0, 3).map((session) => {
                  const Icon = { question: MessageSquare, situation: FileText, contract: Upload, report: FolderOpen }[session.mode]
                  return (
                    <button
                      key={session.id}
                      onClick={() => {
                        handleModeChange('report')
                        setSelectedReportId(session.id)
                      }}
                      className="w-full text-left flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all group"
                    >
                      <div className="p-1.5 bg-slate-100 rounded-lg group-hover:bg-blue-100 transition-colors flex-shrink-0">
                        <Icon className="w-3 h-3 text-slate-500 group-hover:text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate group-hover:text-blue-700">{session.title}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {session.date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <ChevronRight className="w-3 h-3 text-slate-400 mt-1 ml-auto flex-shrink-0 group-hover:text-blue-500" />
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setShowHistory(true)}
                className="mt-3 w-full text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center gap-1 pt-2 border-t border-slate-100"
              >
                전체 기록 보기
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* 모바일: 추천 다음 액션 */}
        {showNextActions && (
          <div className="lg:hidden mt-5">
            <NextActionsPanel actions={MOCK_NEXT_ACTIONS} />
          </div>
        )}
      </div>

      {/* 히스토리 드로어 */}
      <HistoryDrawer
        open={showHistory}
        onClose={() => setShowHistory(false)}
        sessions={MOCK_RECENT_SESSIONS}
        onSelectSession={(id) => {
          handleModeChange('report')
          setSelectedReportId(id)
        }}
      />
    </div>
  )
}
