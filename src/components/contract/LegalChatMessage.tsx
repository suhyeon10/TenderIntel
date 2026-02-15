'use client'

import { useMemo, useState } from 'react'
import { Scale, AlertTriangle, CheckCircle2, MessageSquare, FileText, Copy, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { MarkdownRenderer } from '@/components/rag/MarkdownRenderer'

interface ParsedLegalResponse {
  summary: string
  riskLevel: '경미' | '보통' | '높음' | '매우 높음' | null
  riskLevelDescription: string // 위험도 설명 (예: "법적 분쟁 가능성은 크지 않지만...")
  riskContent: string
  checklist: string[]
  negotiationPoints: {
    clauseModification?: string
    conversationExamples: string[]
  }
  legalReferences: Array<{
    name: string
    description: string
  }>
}

interface LegalChatMessageProps {
  content: string
  selectedIssue?: {
    id?: string
    category?: string
    summary?: string
    location?: {
      clauseNumber?: string
    }
  }
}

/**
 * 법률 챗 답변을 구조화된 카드 형태로 렌더링
 * 마크다운을 파싱하여 탭/아코디언 형태로 표시
 */
export function LegalChatMessage({ content, selectedIssue }: LegalChatMessageProps) {
  const [activeTab, setActiveTab] = useState('risk') // 기본 탭을 리스크로 변경
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [showAllLegalRefs, setShowAllLegalRefs] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({})
  const [expandedLegalRefs, setExpandedLegalRefs] = useState<Record<number, boolean>>({})

  // JSON 파싱 및 검증 함수
  const safeParseLegalResponse = (raw: string): ParsedLegalResponse => {
    const defaultResult: ParsedLegalResponse = {
      summary: '',
      riskLevel: null,
      riskLevelDescription: '',
      riskContent: '',
      checklist: [],
      negotiationPoints: {
        conversationExamples: [],
      },
      legalReferences: [],
    }

    if (!raw || !raw.trim()) return defaultResult

    try {
      // JSON 파싱 시도
      let parsed: any
      
      // JSON 코드 블록 제거 (```json ... ```)
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1])
      } else {
        // 직접 JSON 파싱 시도
        parsed = JSON.parse(raw.trim())
      }

      // 최소한의 구조 검증
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('invalid response structure')
      }

      // 안전하게 파싱된 데이터 반환
      return {
        summary: typeof parsed.summary === 'string' ? parsed.summary : defaultResult.summary,
        riskLevel: parsed.riskLevel === '경미' || parsed.riskLevel === '보통' || parsed.riskLevel === '높음' || parsed.riskLevel === '매우 높음'
          ? parsed.riskLevel 
          : parsed.riskLevel === null 
            ? null 
            : defaultResult.riskLevel,
        riskLevelDescription: typeof parsed.riskLevelDescription === 'string' 
          ? parsed.riskLevelDescription 
          : defaultResult.riskLevelDescription,
        riskContent: typeof parsed.riskContent === 'string' ? parsed.riskContent : defaultResult.riskContent,
        checklist: Array.isArray(parsed.checklist) 
          ? parsed.checklist.filter((item: any) => typeof item === 'string')
          : defaultResult.checklist,
        negotiationPoints: {
          clauseModification: parsed.negotiationPoints?.clauseModification && typeof parsed.negotiationPoints.clauseModification === 'string'
            ? parsed.negotiationPoints.clauseModification
            : defaultResult.negotiationPoints.clauseModification,
          conversationExamples: Array.isArray(parsed.negotiationPoints?.conversationExamples)
            ? parsed.negotiationPoints.conversationExamples.filter((item: any) => typeof item === 'string')
            : defaultResult.negotiationPoints.conversationExamples,
        },
        legalReferences: Array.isArray(parsed.legalReferences)
          ? parsed.legalReferences
              .filter((ref: any) => ref && typeof ref === 'object' && typeof ref.name === 'string' && typeof ref.description === 'string')
              .map((ref: any) => ({ name: ref.name, description: ref.description }))
          : defaultResult.legalReferences,
      }
    } catch (e) {
      console.error('legal chat parse failed:', e)
      // 파싱 실패 시 원본 텍스트를 summary로 사용 (fallback)
      return {
        ...defaultResult,
        summary: raw.length > 500 ? raw.substring(0, 500) + '...' : raw,
      }
    }
  }

  // 마크다운을 파싱하여 구조화된 데이터로 변환 (하위 호환성 유지)
  const parsed = useMemo(() => {
    // 먼저 JSON 파싱 시도
    const jsonParsed = safeParseLegalResponse(content)
    
    // JSON 파싱이 성공하고 summary가 있고, riskContent나 checklist가 있으면 JSON 형식으로 간주
    if (jsonParsed.summary && (jsonParsed.riskContent || jsonParsed.checklist.length > 0)) {
      return jsonParsed
    }

    // JSON 파싱 실패 또는 마크다운 형식인 경우 기존 마크다운 파싱 로직 사용
    const result: ParsedLegalResponse = {
      summary: jsonParsed.summary || '',
      riskLevel: jsonParsed.riskLevel,
      riskLevelDescription: jsonParsed.riskLevelDescription || '',
      riskContent: jsonParsed.riskContent || '',
      checklist: jsonParsed.checklist.length > 0 ? jsonParsed.checklist : [],
      negotiationPoints: {
        clauseModification: jsonParsed.negotiationPoints.clauseModification,
        conversationExamples: jsonParsed.negotiationPoints.conversationExamples.length > 0 
          ? jsonParsed.negotiationPoints.conversationExamples 
          : [],
      },
      legalReferences: jsonParsed.legalReferences.length > 0 ? jsonParsed.legalReferences : [],
    }

    if (!content) return result

    // 위험도 레벨 및 설명 추출 (다양한 패턴 지원)
    const riskLevelPatterns = [
      /위험도:\s*(경미|보통|높음|매우 높음)/i,
      /\[(경미|보통|높음|매우 높음)\]:\s*([^\n]+)/,  // [경미]: 설명
      /\[(경미|보통|높음|매우 높음)\]\s*([^\n]+)/,  // [경미] 설명
      /위험도:\s*(경미|보통|높음|매우 높음)\([^)]+\)/i,
    ]
    
    for (const pattern of riskLevelPatterns) {
      const match = content.match(pattern)
      if (match) {
        const level = match[1] as '경미' | '보통' | '높음' | '매우 높음'
        result.riskLevel = level
        // 설명 추출 (있는 경우)
        if (match[2]) {
          result.riskLevelDescription = match[2].trim()
        }
        break
      }
    }

    // 섹션별로 분리 (더 정확한 패턴)
    const sections = content.split(/(?=##\s)/)

    for (const section of sections) {
      // 요약 결론
      if (section.includes('## 요약 결론')) {
        const summaryMatch = section.match(/## 요약 결론\s*\n([\s\S]*?)(?=\n##|$)/)
        if (summaryMatch) {
          let summaryText = summaryMatch[1]
            .replace(/위험도:.*/i, '')
            .replace(/\[(경미|보통|높음|매우 높음)\]:\s*/g, '')
            .replace(/요약|리스크|협상|체크/g, '') // 탭 라벨 제거
            .trim()
          result.summary = summaryText
        }
      }

      // 왜 위험한지 (더 넓은 패턴 매칭)
      if (section.includes('## 왜 위험한지') || 
          section.includes('## 법적') || 
          section.includes('## 리스크')) {
        const riskMatch = section.match(/## [^#]+\n([\s\S]*?)(?=\n##|$)/)
        if (riskMatch) {
          let riskText = riskMatch[1]
            .replace(/요약|리스크|협상|체크/g, '') // 탭 라벨 제거
            .trim()
          
          // 빈 내용이 아닌 경우만 저장
          if (riskText.length > 10) {
            result.riskContent = riskText
          }
        }
      }

      // 체크리스트
      if (section.includes('## 체크리스트')) {
        const checklistMatch = section.match(/## 체크리스트\s*\n([\s\S]*?)(?=\n##|$)/)
        if (checklistMatch) {
          const checklistText = checklistMatch[1]
          // bullet point 추출 (더 정확한 패턴)
          const items = checklistText
            .split(/\n/)
            .map(line => {
              // 탭 라벨 제거
              line = line.replace(/요약|리스크|협상|체크/g, '')
              // bullet 제거
              line = line.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, '').trim()
              return line
            })
            .filter(line => line.length > 0 && !line.startsWith('##') && !line.match(/^위험도:/i))
          result.checklist = items
        }
      }

      // 실무 협상 포인트
      if (section.includes('## 실무 협상 포인트')) {
        const negotiationMatch = section.match(/## 실무 협상 포인트\s*\n([\s\S]*?)(?=\n##|$)/)
        if (negotiationMatch) {
          let negotiationText = negotiationMatch[1]
            .replace(/요약|리스크|협상|체크/g, '') // 탭 라벨 제거
          
          // 조항 수정 예시 추출 (더 넓은 패턴)
          const modificationPatterns = [
            /기존[:\s]*["']([^"']+)["']/i,
            /수정안[:\s]*["']([^"']+)["']/i,
            /기존:\s*([^\n]+)/i,
            /수정안:\s*([^\n]+)/i,
          ]
          
          for (const pattern of modificationPatterns) {
            const match = negotiationText.match(pattern)
            if (match && match[1].length > 10) {
              result.negotiationPoints.clauseModification = match[1].trim()
              break
            }
          }

          // 협상 문장 예시 추출 (따옴표, 인용구 등 다양한 패턴)
          const examplePatterns = [
            /["']([^"']{30,})["']/g,  // 따옴표
            /^-\s*["']([^"']{30,})["']/gm,  // bullet + 따옴표
            /^[0-9]+\.\s*["']([^"']{30,})["']/gm,  // 번호 + 따옴표
          ]
          
          const allExamples: string[] = []
          for (const pattern of examplePatterns) {
            const matches = negotiationText.match(pattern)
            if (matches) {
              allExamples.push(...matches.map(m => m.replace(/^[-*•0-9.\s]+["']|["']$/g, '').trim()))
            }
          }
          
          // 중복 제거 및 필터링
          result.negotiationPoints.conversationExamples = Array.from(new Set(allExamples))
            .filter(text => text.length > 20 && !text.includes('##'))
        }
      }

      // 참고 법령/표준 계약 (더 정확한 파싱)
      if (section.includes('## 참고 법령') || section.includes('## 참고')) {
        const legalMatch = section.match(/## [^#]+\n([\s\S]*?)(?=\n---|$)/)
        if (legalMatch) {
          const legalText = legalMatch[1]
            .replace(/요약|리스크|협상|체크/g, '') // 탭 라벨 제거
          
          // 다양한 패턴으로 법령 추출
          const lawPatterns = [
            /\*\*([^*]+)\*\*[:\s]*\n?([^\n]+)/g,  // **법령명**: 설명
            /^-\s*\*\*([^*]+)\*\*[:\s]*\n?([^\n]+)/gm,  // - **법령명**: 설명
            /([가-힣\s]+법\s*제\d+조[^:]*):\s*([^\n]+)/g,  // 법령명: 설명
          ]
          
          const allRefs: Array<{ name: string; description: string }> = []
          
          for (const pattern of lawPatterns) {
            const matches = Array.from(legalText.matchAll(pattern))
            for (const match of matches) {
              if (match[1] && match[2]) {
                allRefs.push({
                  name: match[1].trim(),
                  description: match[2].trim(),
                })
              }
            }
          }
          
          // 중복 제거
          const uniqueRefs = Array.from(
            new Map(allRefs.map(ref => [ref.name, ref])).values()
          ).filter(ref => ref.name.length > 3 && ref.description.length > 5)
          
          result.legalReferences = uniqueRefs
        }
      }
    }

    return result
  }, [content])

  // 복사 기능
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedText(text)
    setTimeout(() => setCopiedText(null), 2000)
  }

  // 위험도 배지 색상
  const getRiskBadgeColor = (level: string | null) => {
    switch (level) {
      case '높음':
        return 'bg-red-100 text-red-700 border-red-200'
      case '보통':
        return 'bg-amber-100 text-amber-700 border-amber-200'
      case '경미':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200'
    }
  }

  // 카테고리 라벨
  const categoryLabel = selectedIssue?.category
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
      }[selectedIssue.category] || selectedIssue.category
    : '계약 조항'

  // 조항 번호 및 제목 구성
  const clauseNumber = selectedIssue?.location?.clauseNumber || ''
  const clauseTitle = clauseNumber 
    ? `제${clauseNumber}조 ${categoryLabel}`
    : categoryLabel
  const clauseSubtitle = selectedIssue?.summary || `${categoryLabel} 관련 조항`

  return (
    <div className="w-full space-y-3">
      {/* 상단 헤더: 조항 정보 + 위험도 배지 */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-3 bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-lg border border-slate-200">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <div className="p-1.5 bg-blue-100 rounded-lg flex-shrink-0">
            <Scale className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="font-semibold text-sm text-slate-900 mb-0.5 break-words leading-relaxed whitespace-normal">
              {clauseTitle}
            </div>
            <div className="text-xs text-slate-500 leading-relaxed">
              {clauseSubtitle}
            </div>
          </div>
        </div>
        {parsed.riskLevel && (
          <div className="flex flex-col items-start sm:items-end gap-1.5 flex-shrink-0 w-full sm:w-auto">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold border flex-wrap',
                getRiskBadgeColor(parsed.riskLevel)
              )}
            >
              {parsed.riskLevel === '매우 높음' && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
              {parsed.riskLevel === '높음' && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
              {parsed.riskLevel === '보통' && <AlertTriangle className="w-3 h-3 flex-shrink-0" />}
              {parsed.riskLevel === '경미' && <CheckCircle2 className="w-3 h-3 flex-shrink-0" />}
              <span className="whitespace-nowrap">{parsed.riskLevel}</span>
              {parsed.riskLevel === '매우 높음' && <span className="whitespace-nowrap">(즉시 조치 필요)</span>}
              {parsed.riskLevel === '높음' && <span className="whitespace-nowrap">(삭제/수정 권장)</span>}
              {parsed.riskLevel === '보통' && <span className="whitespace-nowrap">(주의/협상 권장)</span>}
              {parsed.riskLevel === '경미' && <span className="whitespace-nowrap">(주의 필요)</span>}
            </span>
            {parsed.riskLevelDescription && (
              <div className="text-xs text-slate-600 text-left sm:text-right w-full sm:max-w-[200px] leading-relaxed break-words">
                {parsed.riskLevelDescription}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 탭 영역 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-slate-100 gap-1">
          <TabsTrigger 
            value="summary" 
            className={cn(
              "text-xs py-2 font-medium transition-all duration-200 rounded-md",
              activeTab === 'summary'
                ? "bg-white text-blue-700 border-2 border-blue-500 shadow-sm font-bold"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            )}
          >
            요약
          </TabsTrigger>
          <TabsTrigger 
            value="risk" 
            className={cn(
              "text-xs py-2 font-medium transition-all duration-200 rounded-md",
              activeTab === 'risk'
                ? "bg-white text-amber-700 border-2 border-amber-500 shadow-sm font-bold"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            )}
          >
            위험 포인트
          </TabsTrigger>
          <TabsTrigger 
            value="deal" 
            className={cn(
              "text-xs py-2 font-medium transition-all duration-200 rounded-md",
              activeTab === 'deal'
                ? "bg-white text-indigo-700 border-2 border-indigo-500 shadow-sm font-bold"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            )}
          >
            협상 전략
          </TabsTrigger>
          <TabsTrigger 
            value="check" 
            className={cn(
              "text-xs py-2 font-medium transition-all duration-200 rounded-md",
              activeTab === 'check'
                ? "bg-white text-emerald-700 border-2 border-emerald-500 shadow-sm font-bold"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            )}
          >
            체크리스트
          </TabsTrigger>
        </TabsList>

        {/* 요약 탭 */}
        <TabsContent value="summary" className="mt-3 space-y-2">
          {selectedIssue?.summary && (
            <div className="text-xs text-slate-500 mb-2">
              검토 중인 조항: <span className="font-medium text-slate-700">{selectedIssue.summary}</span>
            </div>
          )}
          {parsed.summary ? (
            <div className="text-sm text-slate-700 leading-relaxed">
              <MarkdownRenderer content={parsed.summary} />
            </div>
          ) : (
            <div className="text-sm text-slate-500 italic">요약 정보를 불러오는 중...</div>
          )}
        </TabsContent>

        {/* 위험 포인트 탭 */}
        <TabsContent value="risk" className="mt-3 space-y-3">
          {/* 위험도 배지 + 한 줄 요약 */}
          <div className="space-y-2">
            {parsed.riskLevel && (
              <div className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 bg-slate-100 text-xs text-slate-700">
                <span className="font-semibold">위험도: {parsed.riskLevel}</span>
                {parsed.riskLevelDescription && (
                  <span className="text-[11px] text-slate-500">· {parsed.riskLevelDescription}</span>
                )}
              </div>
            )}
            {parsed.summary && (
              <div className="text-sm text-slate-700 leading-relaxed">
                {parsed.summary.split('\n')[0]} {/* 첫 줄만 표시 */}
              </div>
            )}
          </div>

          {/* 왜 위험한지 3줄 bullet */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700">왜 위험한지</div>
            {parsed.riskContent ? (
              <div className="text-sm text-slate-700 leading-relaxed">
                {/* 마크다운에서 bullet point 추출 (최대 3개) */}
                {(() => {
                  // bullet point 찾기
                  const lines = parsed.riskContent.split('\n').filter(line => {
                    const trimmed = line.trim()
                    return trimmed.startsWith('-') || 
                           trimmed.startsWith('*') || 
                           trimmed.startsWith('•') ||
                           trimmed.match(/^[0-9]+\./)
                  })
                  
                  if (lines.length > 0) {
                    const bullets = lines.slice(0, 3).map(line => {
                      const cleaned = line
                        .replace(/^[-*•]\s+/, '')
                        .replace(/^\d+\.\s+/, '')
                        .trim()
                      return cleaned.length > 0 ? cleaned : null
                    }).filter(Boolean) as string[]
                    
                    if (bullets.length > 0) {
                      return (
                        <ul className="space-y-1.5">
                          {bullets.map((bullet, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-amber-600 mt-1 flex-shrink-0">•</span>
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      )
                    }
                  }
                  
                  // bullet이 없으면 문장을 3개로 나누어 표시
                  const sentences = parsed.riskContent
                    .replace(/\n/g, ' ')
                    .split(/[.!?。]/)
                    .filter(s => s.trim().length > 10)
                    .slice(0, 3)
                    .map(s => s.trim())
                  
                  if (sentences.length > 0) {
                    return (
                      <ul className="space-y-1.5">
                        {sentences.map((sentence, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-amber-600 mt-1 flex-shrink-0">•</span>
                            <span>{sentence}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  }
                  
                  // fallback: 원본의 첫 3줄
                  const contentLines = parsed.riskContent.split('\n').slice(0, 3).filter(l => l.trim().length > 0)
                  return (
                    <ul className="space-y-1.5">
                      {contentLines.map((line, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-amber-600 mt-1 flex-shrink-0">•</span>
                          <span>{line.trim()}</span>
                        </li>
                      ))}
                    </ul>
                  )
                })()}
              </div>
            ) : (
              <div className="text-sm text-slate-600 leading-relaxed">
                해당 조항은 법적 분쟁 가능성은 크지 않지만, 세부 사항을 확인해 보세요.
              </div>
            )}
          </div>

          {/* 다음 단계 버튼 */}
          {parsed.negotiationPoints.conversationExamples.length > 0 || parsed.negotiationPoints.clauseModification && (
            <div className="pt-2 border-t border-slate-200">
              <button
                onClick={() => setActiveTab('deal')}
                className="w-full px-3 py-2 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 border border-indigo-200 rounded-lg text-xs font-medium text-indigo-700 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                다음 단계: 협상 멘트 보기
              </button>
            </div>
          )}
        </TabsContent>

        {/* 협상 전략 탭 */}
        <TabsContent value="deal" className="mt-3 space-y-3">
          {/* 조항 수정 예시 */}
          {parsed.negotiationPoints.clauseModification && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-700 mb-1">조항 수정 제안</div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {parsed.negotiationPoints.clauseModification.split(/\n/).map((line, idx) => (
                  <div key={idx} className={idx > 0 ? 'mt-2' : ''}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 협상 문장 예시 */}
          {parsed.negotiationPoints.conversationExamples.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-1">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                <span>사업주에게 이렇게 말해보세요</span>
              </div>
              <div className="space-y-2">
                {parsed.negotiationPoints.conversationExamples.slice(0, 3).map((example, index) => (
                  <div
                    key={index}
                    className="relative group p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-100 text-sm text-slate-700 leading-relaxed"
                  >
                    <div className="pr-8">
                      {parsed.negotiationPoints.conversationExamples.length > 1 && (
                        <span className="text-xs font-semibold text-indigo-600 mr-2">{index + 1})</span>
                      )}
                      {example}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(example)}
                      className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="복사"
                    >
                      <Copy className={cn('w-3.5 h-3.5', copiedText === example && 'text-green-600')} />
                    </Button>
                    {copiedText === example && (
                      <div className="absolute top-2 right-8 text-xs text-green-600 font-medium">
                        복사됨!
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {parsed.negotiationPoints.conversationExamples.length === 0 && !parsed.negotiationPoints.clauseModification && (
            <div className="text-sm text-slate-500">협상 전략 정보가 없습니다.</div>
          )}
        </TabsContent>

        {/* 체크리스트 탭 */}
        <TabsContent value="check" className="mt-3 space-y-3">
          {parsed.checklist.length > 0 ? (
            <>
              <div className="text-xs font-semibold text-slate-700 mb-2">내 계약서 점검하기</div>
              <div className="space-y-3">
                {parsed.checklist.slice(0, 5).map((item, index) => {
                  const isChecked = checkedItems[index] || false
                  return (
                    <div key={index} className="flex items-start gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                      <button
                        onClick={() => setCheckedItems(prev => ({ ...prev, [index]: !prev[index] }))}
                        className={cn(
                          "flex-shrink-0 w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center",
                          isChecked
                            ? "bg-blue-600 border-blue-600"
                            : "bg-white border-slate-300 hover:border-blue-400"
                        )}
                        aria-label={`${item} 체크`}
                      >
                        {isChecked && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                      </button>
                      <span className={cn(
                        "flex-1 text-sm leading-relaxed",
                        isChecked ? "text-slate-500 line-through" : "text-slate-700"
                      )}>
                        {item}
                      </span>
                    </div>
                  )
                })}
              </div>
              
              {/* 피드백 */}
              {(() => {
                const checkedCount = Object.values(checkedItems).filter(Boolean).length
                const totalCount = parsed.checklist.slice(0, 5).length
                const uncheckedCount = totalCount - checkedCount
                
                if (checkedCount > 0) {
                  return (
                    <div className={cn(
                      "mt-4 p-3 rounded-lg border",
                      uncheckedCount >= totalCount * 0.5
                        ? "bg-amber-50 border-amber-200"
                        : "bg-emerald-50 border-emerald-200"
                    )}>
                      <div className="text-xs font-semibold text-slate-700 mb-1">
                        점검 결과
                      </div>
                      <div className="text-sm text-slate-700">
                        {uncheckedCount >= totalCount * 0.5 ? (
                          <span>
                            {totalCount}개 중 {uncheckedCount}개 미충족 → 이 조항은 실제로 위험할 수 있어요.
                          </span>
                        ) : (
                          <span>
                            {totalCount}개 중 {checkedCount}개 충족 → 대부분의 조건을 만족하고 있어요.
                          </span>
                        )}
                      </div>
                    </div>
                  )
                }
                return null
              })()}
            </>
          ) : (
            <div className="text-sm text-slate-500">체크리스트 항목이 없습니다.</div>
          )}
        </TabsContent>
      </Tabs>


      {/* 파싱 실패 시 fallback: 기존 마크다운 렌더링 */}
      {!parsed.summary && !parsed.riskContent && (
        <div className="text-sm text-slate-700 leading-relaxed">
          <MarkdownRenderer content={content} />
        </div>
      )}

      {/* 참고 법령 (탭 공통 하단) */}
      <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-slate-700">참고 법령/표준 계약</div>
          {parsed.legalReferences.length > 2 && (
            <button
              onClick={() => setShowAllLegalRefs(!showAllLegalRefs)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {showAllLegalRefs ? '접기' : `관련 법령 더 보기 (${parsed.legalReferences.length - 2})`}
            </button>
          )}
        </div>
        {parsed.legalReferences.length > 0 ? (
          <div className="space-y-2">
            {(showAllLegalRefs ? parsed.legalReferences : parsed.legalReferences.slice(0, 2)).map((ref, index) => {
              const isExpanded = expandedLegalRefs[index] || false
              return (
                <div key={index} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="font-semibold text-sm text-slate-900 mb-1">{ref.name}</div>
                  {isExpanded ? (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-600 leading-relaxed">{ref.description}</div>
                      <button
                        onClick={() => setExpandedLegalRefs(prev => ({ ...prev, [index]: false }))}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        간략히 보기
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-xs text-slate-600 leading-relaxed line-clamp-1">
                        {ref.description.split('\n')[0]}
                      </div>
                      {ref.description.length > 50 && (
                        <button
                          onClick={() => setExpandedLegalRefs(prev => ({ ...prev, [index]: true }))}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          자세히 보기
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-xs text-slate-600 leading-relaxed">
              {selectedIssue?.category === 'pay' || selectedIssue?.category === 'wage' 
                ? '이 조항은 주로 근로기준법 제17조(근로조건의 명시), 제43조(임금 지급 원칙), 제56조(연장·야간·휴일근로 가산수당)와 관련됩니다.'
                : '이 조항은 일반적인 근로계약 관련 법령과 관련됩니다. 구체적인 법령 정보는 위 위험 포인트 섹션을 참고하세요.'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

