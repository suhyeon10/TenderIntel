'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, FileText, ChevronRight, ChevronDown, ExternalLink, Scale, ClipboardCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarkdownRenderer } from '@/components/rag/MarkdownRenderer'

/**
 * 계약서 분석 메시지 페이로드 타입
 */
export interface ContractAnalysisMessagePayload {
  summary: string
  riskLevel: '고' | '중' | '저' | 'high' | 'medium' | 'low'
  riskLevelDescription: string
  riskContent?: Array<{
    내용: string
    설명: string
  }>
  checklist?: Array<{
    항목: string
    결론: string
  }>
  negotiationPoints?: {
    [key: string]: string  // 수정안1, 수정안2 등
  }
  legalReferences?: Array<{
    name: string
    description: string
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

  // **참고:** 뒤에 붙는 안내 문구 분리
  const referenceIndex = text.indexOf('**⚠️ 참고:**')
  if (referenceIndex !== -1) {
    text = text.substring(0, referenceIndex).trim()
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
 * 타입 가드: 계약서 분석 페이로드인지 확인
 */
function isContractPayload(v: any): v is ContractAnalysisMessagePayload {
  return (
    v &&
    typeof v.summary === 'string' &&
    typeof v.riskLevel === 'string' &&
    typeof v.riskLevelDescription === 'string'
  )
}

/**
 * 위험도 레벨을 영어로 변환
 */
function normalizeRiskLevel(level: string): 'high' | 'medium' | 'low' {
  const normalized = level.toLowerCase()
  if (normalized === '고' || normalized === 'high') return 'high'
  if (normalized === '중' || normalized === 'medium') return 'medium'
  return 'low'
}

/**
 * 위험도에 따른 색상 클래스 반환
 */
function getRiskLevelColors(level: 'high' | 'medium' | 'low') {
  switch (level) {
    case 'high':
      return {
        bg: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-700',
        textDark: 'text-red-800',
        badge: 'bg-red-100 text-red-800 border-red-300',
        icon: AlertTriangle,
      }
    case 'medium':
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-700',
        textDark: 'text-amber-800',
        badge: 'bg-amber-100 text-amber-800 border-amber-300',
        icon: AlertTriangle,
      }
    case 'low':
      return {
        bg: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-700',
        textDark: 'text-green-800',
        badge: 'bg-green-100 text-green-800 border-green-300',
        icon: CheckCircle2,
      }
  }
}

interface ContractChatMessageProps {
  content: string
  contextId?: string | null
}

/**
 * 계약서 분석 챗 답변을 구조화된 카드 형태로 렌더링
 * JSON 형식의 응답을 파싱하여 표시
 */
export function ContractChatMessage({ content, contextId }: ContractChatMessageProps) {
  const [expandedRefs, setExpandedRefs] = useState<Record<number, boolean>>({})
  const [expandedRiskContent, setExpandedRiskContent] = useState<Record<number, boolean>>({})

  // JSON 파싱 시도
  const json = extractJsonFromMessage(content)
  const parsed = json && isContractPayload(json) ? json : null

  // 파싱 실패 시 마크다운 렌더링 (fallback)
  if (!parsed) {
    return (
      <div className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-code:text-blue-600 prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 text-sm leading-relaxed">
        <MarkdownRenderer content={content} />
      </div>
    )
  }

  const riskLevel = normalizeRiskLevel(parsed.riskLevel)
  const colors = getRiskLevelColors(riskLevel)
  const RiskIcon = colors.icon
  const riskLabel = riskLevel === 'high' ? '고' : riskLevel === 'medium' ? '중' : '저'

  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-4">
      {/* 헤더: 위험도 배지와 리포트 링크 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-sm border-2 shadow-sm",
            colors.badge
          )}>
            <RiskIcon className="w-4 h-4" />
            <span>위험도: {riskLabel}</span>
          </div>
        </div>
        {contextId && (
          <a
            href={`/legal/contract/${contextId}`}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>전체 리포트 보러가기</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* 요약 */}
      <div className={cn("rounded-lg p-4 space-y-2 border", colors.bg, colors.border)}>
        <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: colors.textDark }}>
          <FileText className="h-4 w-4" />
          요약
        </h3>
        <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", colors.text)}>
          {parsed.summary}
        </p>
      </div>

      {/* 위험 수준 설명 */}
      {parsed.riskLevelDescription && (
        <div className={cn("rounded-lg p-4 space-y-2 border", colors.bg, colors.border)}>
          <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: colors.textDark }}>
            <AlertTriangle className="h-4 w-4" />
            위험 수준 설명
          </h3>
          <p className={cn("text-sm leading-relaxed whitespace-pre-wrap", colors.text)}>
            {parsed.riskLevelDescription}
          </p>
        </div>
      )}

      {/* 위험 내용 */}
      {parsed.riskContent && parsed.riskContent.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
          <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            위험 요소
          </h3>
          <div className="space-y-3">
            {parsed.riskContent.map((item, idx) => (
              <div key={idx} className="bg-white border border-red-200 rounded-lg p-3">
                <button
                  onClick={() =>
                    setExpandedRiskContent((prev) => ({ ...prev, [idx]: !prev[idx] }))
                  }
                  className="flex items-start gap-2 w-full text-left hover:text-red-900 transition-colors"
                >
                  {expandedRiskContent[idx] ? (
                    <ChevronDown className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-red-800">{item.내용}</div>
                    {expandedRiskContent[idx] && (
                      <div className="mt-2 text-sm text-red-700 leading-relaxed">
                        {item.설명}
                      </div>
                    )}
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 체크리스트 */}
      {parsed.checklist && parsed.checklist.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            체크리스트
          </h3>
          <div className="space-y-2">
            {parsed.checklist.map((item, idx) => (
              <div
                key={idx}
                className="bg-white border border-blue-200 rounded-lg p-3"
              >
                <div className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-blue-800 mb-1">{item.항목}</div>
                    <div className="text-blue-700 leading-relaxed">{item.결론}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 협상 포인트 */}
      {parsed.negotiationPoints && Object.keys(parsed.negotiationPoints).length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            협상 포인트
          </h3>
          <div className="space-y-2">
            {Object.entries(parsed.negotiationPoints).map(([key, value], idx) => (
              <div
                key={key}
                className="bg-white border border-purple-200 rounded-lg p-3"
              >
                <div className="flex items-start gap-2 text-sm">
                  <span className="font-semibold text-purple-700 flex-shrink-0">
                    {key}:
                  </span>
                  <span className="text-purple-800 leading-relaxed">{value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 법적 근거 */}
      {parsed.legalReferences && parsed.legalReferences.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-2">
          <h3 className="font-semibold text-indigo-900 mb-3 flex items-center gap-2">
            <Scale className="h-5 w-5" />
            법적 근거
          </h3>
          <div className="space-y-2">
            {parsed.legalReferences.map((ref, idx) => (
              <div key={idx} className="text-sm">
                <button
                  onClick={() =>
                    setExpandedRefs((prev) => ({ ...prev, [idx]: !prev[idx] }))
                  }
                  className="flex items-start gap-2 w-full text-left hover:text-indigo-900 transition-colors bg-white border border-indigo-200 rounded-lg p-3"
                >
                  {expandedRefs[idx] ? (
                    <ChevronDown className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-indigo-800">{ref.name}</div>
                    {expandedRefs[idx] && (
                      <div className="mt-1 text-indigo-700 leading-relaxed">
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

      {/* 참고 문구 */}
      <p className="mt-1 text-[11px] text-slate-400 leading-snug pt-2 border-t border-slate-200">
        ⚠️ 참고: 이 답변은 정보 안내를 위한 것이며 법률 자문이 아닙니다. 중요한 사안은 전문 변호사나 노동위원회 등 전문 기관에 상담하시기 바랍니다.
      </p>
    </div>
  )
}

