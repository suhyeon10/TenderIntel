'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, FileText, MessageSquare, ChevronRight, ChevronDown, ExternalLink, BookOpen } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MarkdownRenderer } from '@/components/rag/MarkdownRenderer'

/**
 * 상황분석 메시지 페이로드 타입
 */
export interface CaseCard {
  id: string
  title: string
  situation: string
  main_issues: string[]
  category?: 'all' | 'intern' | 'wage' | 'stock' | 'freelancer' | 'harassment'
  severity?: 'low' | 'medium' | 'high'
  keywords?: string[]
  legalIssues?: string[]
  learnings?: string[]
  actions?: string[]
}

export interface SituationAnalysisMessagePayload {
  reportTitle: string
  legalPerspective: {
    description: string
    references?: Array<{
      name: string
      description: string
    }>
  }
  actions?: Array<{
    key: string
    description: string
  }>
  cases?: CaseCard[]
  conversationExamples?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

/**
 * 메시지에서 JSON 추출
 */
function extractJsonFromMessage(raw: string): any | null {
  let text = raw.trim()

  if (!text) {
    return null
  }

  // ```json ... ``` 형식이면 코드펜스 제거
  if (text.startsWith('```')) {
    const firstNewline = text.indexOf('\n')
    if (firstNewline !== -1) {
      text = text.slice(firstNewline + 1) // 언어줄(json) 자르고
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
    return JSON.parse(text)
  } catch {
    return null
  }
}

/**
 * 타입 가드: 상황분석 페이로드인지 확인
 */
function isSituationPayload(v: any): v is SituationAnalysisMessagePayload {
  return (
    v &&
    typeof v.reportTitle === 'string' &&
    v.legalPerspective &&
    typeof v.legalPerspective.description === 'string'
  )
}

interface SituationChatMessageProps {
  content: string
  contextId?: string | null
  metadata?: any // 메시지 metadata (cases 포함 가능)
}

/**
 * 상황분석 챗 답변을 구조화된 카드 형태로 렌더링
 * JSON 형식의 응답을 파싱하여 표시
 */
const CATEGORY_LABELS: Record<string, string> = {
  all: '전체',
  intern: '인턴/수습',
  wage: '근로시간·임금',
  stock: '스톡옵션',
  freelancer: '프리랜서',
  harassment: '직장 내 괴롭힘',
}

export function SituationChatMessage({ content, contextId, metadata }: SituationChatMessageProps) {
  const router = useRouter()
  const [expandedRefs, setExpandedRefs] = useState<Record<number, boolean>>({})
  const [expandedActions, setExpandedActions] = useState<Record<number, boolean>>({})
  const [expandedExamples, setExpandedExamples] = useState<Record<number, boolean>>({})

  // JSON 파싱 시도
  const json = extractJsonFromMessage(content)
  const parsed = json && isSituationPayload(json) ? json : null
  
  // metadata에서 cases 가져오기 (JSON에 cases가 없을 때 fallback)
  const casesFromMetadata = metadata?.cases && Array.isArray(metadata.cases) ? metadata.cases : null
  const finalCases = parsed?.cases || casesFromMetadata || []

  // 파싱 실패 시 마크다운 렌더링 (fallback)
  if (!parsed) {
    return (
      <div className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-code:text-blue-600 prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 text-sm leading-relaxed">
        <MarkdownRenderer content={content} />
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-4">
      {/* 리포트 제목 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">
          {parsed.reportTitle}
        </h3>
        {contextId && (
          <a
            href={`/legal/situation/${contextId}`}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>전체 리포트 보러가기</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* 법적 관점 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-2">
          <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900 mb-2">⚖️ 법적 관점에서 본 현재상황</h3>
            <p className="text-sm text-blue-800 leading-relaxed whitespace-pre-wrap">
              {parsed.legalPerspective.description}
            </p>
          </div>
        </div>

        {/* 참고 문서 */}
        {parsed.legalPerspective.references && parsed.legalPerspective.references.length > 0 && (
          <div className="mt-3 pt-3 border-t border-blue-200">
            <h4 className="text-xs font-semibold text-blue-700 mb-2">참고 문서</h4>
            <div className="space-y-2">
              {parsed.legalPerspective.references.map((ref, idx) => (
                <div key={idx} className="text-xs">
                  <button
                    onClick={() =>
                      setExpandedRefs((prev) => ({ ...prev, [idx]: !prev[idx] }))
                    }
                    className="flex items-start gap-2 w-full text-left hover:text-blue-900 transition-colors"
                  >
                    {expandedRefs[idx] ? (
                      <ChevronDown className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-blue-800">{ref.name}</div>
                      {expandedRefs[idx] && (
                        <div className="mt-1 text-blue-700 leading-relaxed">
                          {ref.description}
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 행동 항목 */}
      {parsed.actions && parsed.actions.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            🎯 지금 당장 할 수 있는 행동
          </h3>
          <div className="space-y-2">
            {parsed.actions.map((action, idx) => (
              <div
                key={action.key || idx}
                className="flex items-start gap-2 text-sm text-green-800"
              >
                <span className="font-semibold text-green-700 flex-shrink-0">
                  {action.key}.
                </span>
                <span className="leading-relaxed">{action.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 유사 케이스 */}
      {finalCases && finalCases.length > 0 && (
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            📚 유사한 사례
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {finalCases.map((caseItem: CaseCard) => (
              <Card
                key={caseItem.id}
                className="rounded-xl border-2 border-purple-200 bg-white shadow-sm hover:shadow-md hover:border-purple-300 transition-all duration-200 cursor-pointer"
                onClick={() => router.push(`/legal/cases/${caseItem.id}`)}
              >
                <CardContent className="p-4">
                  {/* 상단 라벨 영역 */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] bg-slate-100 text-slate-700 rounded-full px-2 py-[2px] font-semibold">
                      {CATEGORY_LABELS[caseItem.category || 'all']}
                    </span>
                    {caseItem.severity && (
                      <span className={cn(
                        "text-[10px] rounded-full px-2 py-[2px] font-semibold border",
                        caseItem.severity === 'high'
                          ? "bg-red-100 text-red-700 border-red-300"
                          : caseItem.severity === 'medium'
                          ? "bg-amber-100 text-amber-700 border-amber-300"
                          : "bg-emerald-100 text-emerald-700 border-emerald-300"
                      )}>
                        {caseItem.severity === 'high' ? '높음' : caseItem.severity === 'medium' ? '중간' : '낮음'}
                      </span>
                    )}
                  </div>

                  {/* 제목 */}
                  <h4 className="text-xs font-semibold text-slate-900 mb-2 line-clamp-1 hover:text-purple-700 transition-colors">
                    {caseItem.title}
                  </h4>

                  {/* 한 줄 설명 */}
                  <p className="text-[11px] text-slate-600 mb-3 line-clamp-2 leading-relaxed">
                    {caseItem.situation}
                  </p>

                  {/* 키워드 */}
                  {caseItem.main_issues && caseItem.main_issues.length > 0 && (
                    <p className="text-[10px] text-slate-500 line-clamp-1">
                      키워드: {caseItem.main_issues.slice(0, 3).join(', ')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 대화 예시 (레거시 호환성 - cases가 없을 때만 표시) */}
      {finalCases.length === 0 && parsed?.conversationExamples && parsed.conversationExamples.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            💬 이렇게 말해보세요
          </h3>
          <div className="space-y-3">
            {parsed.conversationExamples.map((example, idx) => (
              <div
                key={idx}
                className={cn(
                  'rounded-lg p-3 text-sm',
                  example.role === 'user'
                    ? 'bg-white border border-purple-200'
                    : 'bg-purple-100 border border-purple-200'
                )}
              >
                <div className="font-semibold text-purple-700 mb-1">
                  {example.role === 'user' ? '사용자' : 'AI'}
                </div>
                <div className="text-purple-800 leading-relaxed whitespace-pre-wrap">
                  {example.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 참고 문구 */}
      <p className="mt-1 text-[11px] text-slate-400 leading-snug pt-2 border-t border-slate-200">
        ⚠️ 이 답변은 정보 안내를 위한 것이며 법률 자문이 아닙니다. 중요한 사안은 변호사,
        노동청, 노동위원회 등 전문기관에 상담하시기 바랍니다.
      </p>
    </div>
  )
}

