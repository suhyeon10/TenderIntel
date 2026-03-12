'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import { FileText, AlertTriangle, Clock, DollarSign, Briefcase, Scale, BookOpen, ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SEVERITY_COLORS, SEVERITY_LABELS_SHORT, FOCUS_STYLE } from './contract-design-tokens'
import type { LegalIssue, LegalBasisItem } from '../../types/legal'

interface HighlightedText {
  text: string
  startIndex: number
  endIndex: number
  severity: 'low' | 'medium' | 'high'
  issueId: string
}

interface Clause {
  id: string
  number: number
  title: string
  content: string
  startIndex: number
  endIndex: number
  maxSeverity?: 'low' | 'medium' | 'high'
  issueCount: number
  issues: LegalIssue[]
  category?: string
}

interface ContractViewerProps {
  contractText: string
  issues: LegalIssue[]
  selectedIssueId?: string
  selectedClauseId?: string
  onIssueClick?: (issueId: string) => void
  highlightedTexts?: HighlightedText[]
  clauses?: Array<{
    id: string
    title: string
    content: string
    articleNumber?: number
    category?: string
    startIndex?: number
    endIndex?: number
  }>
  scrollContainerRef?: React.RefObject<HTMLDivElement>
}

export function ContractViewer({
  contractText,
  issues,
  selectedIssueId,
  selectedClauseId,
  onIssueClick,
  highlightedTexts = [],
  clauses: clausesProp = [],
  scrollContainerRef,
}: ContractViewerProps) {
  // 외부 스크롤 컨테이너를 사용하는 경우 (scrollContainerRef가 전달된 경우)
  const isExternalScroll = !!scrollContainerRef
  
  const internalContainerRef = useRef<HTMLDivElement>(null)
  const containerRef = scrollContainerRef || internalContainerRef
  const highlightedRefs = useRef<Map<string, HTMLSpanElement>>(new Map())
  const clauseRefs = useRef<Map<number, HTMLElement>>(new Map())
  const [currentHoveredIssue, setCurrentHoveredIssue] = useState<LegalIssue | null>(null)
  const [selectedClauseNumber, setSelectedClauseNumber] = useState<number | null>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const [pinnedTooltipIssueId, setPinnedTooltipIssueId] = useState<string | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const hideTooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 조항 파싱 및 이슈 매핑
  const parsedClauses = useMemo(() => {
    console.log('[ContractViewer] parsedClauses 계산 시작:', {
      hasContractText: !!contractText,
      contractTextLength: contractText?.length || 0,
      contractTextPreview: contractText?.substring(0, 200) || '(없음)',
      clausesPropLength: clausesProp?.length || 0,
      clausesProp: clausesProp,
      issuesLength: issues?.length || 0,
    })
    
    if (!contractText) {
      console.log('[ContractViewer] contractText가 없어서 빈 배열 반환')
      return []
    }

    // clauses prop이 있으면 사용, 없으면 텍스트에서 파싱
    if (clausesProp.length > 0) {
      console.log('[ContractViewer] clausesProp 사용:', clausesProp.length, '개')
      return clausesProp.map((clause, idx) => {
        const clauseNumber = clause.articleNumber || idx + 1
        const clauseIssues = issues.filter(issue => {
          const issueClauseNum = issue.location.clauseNumber
          return issueClauseNum === clauseNumber.toString() || issueClauseNum === clause.articleNumber?.toString()
        })

        const severities = clauseIssues.map(i => i.severity)
        const maxSeverity = severities.includes('high') ? 'high' :
                           severities.includes('medium') ? 'medium' :
                           severities.includes('low') ? 'low' : undefined

        // clauses prop에서 startIndex와 endIndex 가져오기
        const clauseStartIndex = clause.startIndex ?? 0
        const clauseEndIndex = clause.endIndex ?? (clauseStartIndex + clause.content.length)
        
        return {
          id: clause.id,
          number: clauseNumber,
          title: clause.title || `제${clauseNumber}조`,
          content: clause.content,
          startIndex: clauseStartIndex, // clauses prop에서 전달된 실제 위치 사용
          endIndex: clauseEndIndex,
          maxSeverity,
          issueCount: clauseIssues.length,
          issues: clauseIssues,
          category: clause.category,
        } as Clause
      })
    }

    // 텍스트에서 조항 파싱
    console.log('[ContractViewer] 텍스트에서 조항 파싱 시도')
    
    // 🔥 정규식 lastIndex 문제 해결: test용과 match용 분리
    const CLAUSE_REGEX = /제\s*(\d+)\s*조[^\n]*\n([\s\S]*?)(?=제\s*\d+\s*조|$)/g  // 실제 파싱용 (global)
    const CLAUSE_REGEX_TEST = /제\s*\d+\s*조/  // 존재 여부 확인용 (non-global)
    
    // 패턴 존재 여부 확인 (non-global 정규식 사용)
    const hasClausePattern = CLAUSE_REGEX_TEST.test(contractText)
    
    // 🔥 중요: global 정규식의 lastIndex를 리셋 (혹시 몰라서)
    CLAUSE_REGEX.lastIndex = 0
    
    // matchAll로 모든 매칭 찾기
    const clauseMatches = Array.from(contractText.matchAll(CLAUSE_REGEX))
    const parsed: Clause[] = []
    let lastIndex = 0
    let matchCount = 0

    for (const match of clauseMatches) {
      matchCount++
      const clauseNumber = parseInt(match[1])
      const clauseText = match[0]
      const startIndex = match.index || lastIndex
      const endIndex = startIndex + clauseText.length

      const clauseIssues = issues.filter(issue => {
        const issueStart = issue.location.startIndex ?? 0
        return issueStart >= startIndex && issueStart < endIndex
      })

      const severities = clauseIssues.map(i => i.severity)
      const maxSeverity = severities.includes('high') ? 'high' :
                         severities.includes('medium') ? 'medium' :
                         severities.includes('low') ? 'low' : undefined

      // 조항 제목 추출
      const titleMatch = clauseText.match(/제\s*\d+\s*조[^\n]*/)
      const title = titleMatch ? titleMatch[0].trim() : `제${clauseNumber}조`

      parsed.push({
        id: `clause-${clauseNumber}`,
        number: clauseNumber,
        title,
        content: clauseText,
        startIndex,
        endIndex,
        maxSeverity,
        issueCount: clauseIssues.length,
        issues: clauseIssues,
      })

      lastIndex = endIndex
    }
    
    console.log('[ContractViewer] 텍스트 파싱 결과:', {
      matchCount,
      parsedCount: parsed.length,
      parsedClauses: parsed.map(c => ({ id: c.id, number: c.number, title: c.title, contentLength: c.content.length })),
      contractTextSample: contractText.substring(0, 300),
      hasClausePattern,
      lastIndexReset: true,  // lastIndex 리셋 확인용
    })
    
    if (parsed.length === 0) {
      console.warn('[ContractViewer] ⚠️ 조항 파싱 실패 - 정규식 매칭 없음')
      // 정규식이 실패한 경우, "제X조" 패턴만 찾아서 간단한 조항 생성
      // 🔥 fallback도 lastIndex 문제 방지: 새로운 정규식 인스턴스 사용
      const SIMPLE_CLAUSE_REGEX = /제\s*(\d+)\s*조[^\n]*/g
      SIMPLE_CLAUSE_REGEX.lastIndex = 0  // 리셋
      const simpleClauseMatches = Array.from(contractText.matchAll(SIMPLE_CLAUSE_REGEX))
      const simpleParsed: Clause[] = []
      for (const match of simpleClauseMatches) {
        const clauseNumber = parseInt(match[1])
        const matchIndex = match.index || 0
        // 다음 조항까지 또는 텍스트 끝까지
        // 🔥 search도 새로운 정규식 인스턴스 사용
        const NEXT_CLAUSE_REGEX = /제\s*\d+\s*조/
        const nextMatch = contractText.substring(matchIndex + match[0].length).search(NEXT_CLAUSE_REGEX)
        const contentEnd = nextMatch >= 0 ? matchIndex + match[0].length + nextMatch : contractText.length
        const content = contractText.substring(matchIndex, contentEnd)
        
        simpleParsed.push({
          id: `clause-${clauseNumber}`,
          number: clauseNumber,
          title: match[0].trim(),
          content: content,
          startIndex: matchIndex,
          endIndex: contentEnd,
          maxSeverity: undefined,
          issueCount: 0,
          issues: [],
        })
      }
      if (simpleParsed.length > 0) {
        console.log('[ContractViewer] 간단한 파싱으로 조항 생성:', simpleParsed.length, '개')
        return simpleParsed
      }
    }

    return parsed
  }, [contractText, issues, clausesProp])

  // 카테고리 아이콘
  const getCategoryIcon = (category: string) => {
    const icons: Record<string, React.ReactNode> = {
      working_hours: <Clock className="w-3 h-3" />,
      wage: <DollarSign className="w-3 h-3" />,
      probation: <Briefcase className="w-3 h-3" />,
      stock_option: <Scale className="w-3 h-3" />,
      ip: <BookOpen className="w-3 h-3" />,
      harassment: <AlertTriangle className="w-3 h-3" />,
      other: <FileText className="w-3 h-3" />,
    }
    return icons[category] || <FileText className="w-3 h-3" />
  }

  // 카테고리 한글 라벨
  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      working_hours: '근로시간',
      wage: '보수·수당',
      probation: '수습·해지',
      stock_option: '스톡옵션',
      ip: 'IP/저작권',
      harassment: '직장내괴롭힘',
      job_stability: '고용안정',
      dismissal: '해고·해지',
      payment: '보수·수당',
      non_compete: '경업금지',
      liability: '손해배상',
      dispute: '분쟁해결',
      nda: '비밀유지',
      other: '기타',
    }
    return labels[category] || category
  }

  // 위험도 라벨
  const getSeverityLabel = (severity: string): string => {
    const labels: Record<string, string> = {
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    }
    return labels[severity] || severity
  }

  // 툴팁 위치 계산
  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>, issue: LegalIssue) => {
    // 이전 타임아웃이 있으면 취소
    if (hideTooltipTimeoutRef.current) {
      clearTimeout(hideTooltipTimeoutRef.current)
      hideTooltipTimeoutRef.current = null
    }
    
    const rect = e.currentTarget.getBoundingClientRect()
    const container = containerRef.current
    if (!container) return
    
    const tooltipWidth = 280 // 툴팁 너비
    const margin = 16 // 여유 공간 (양쪽 마진)
    
    // 부모 컨테이너 찾기 (계약서 텍스트 영역)
    const textContainer = e.currentTarget.closest('.flex-1.space-y-4.relative') as HTMLElement
    if (!textContainer) return
    
    const textContainerRect = textContainer.getBoundingClientRect()
    const scrollTop = container.scrollTop
    const scrollLeft = container.scrollLeft
    
    // 화면 기준 공간 확인
    const spaceOnRight = window.innerWidth - rect.right
    const spaceOnLeft = rect.left
    
    // 텍스트 컨테이너 기준 상대 위치 계산 (스크롤 오프셋 포함)
    let x = rect.right - textContainerRect.left + scrollLeft + 12 // 오른쪽에 12px 간격
    let y = rect.top - textContainerRect.top + scrollTop
    
    // 오른쪽 공간이 부족하면 왼쪽에 표시
    if (spaceOnRight < tooltipWidth + margin) {
      x = rect.left - textContainerRect.left + scrollLeft - tooltipWidth - 12
    }
    
    // 컨테이너 경계 내에서 조정 (양쪽 마진 확보)
    const minX = margin
    const maxX = textContainerRect.width - tooltipWidth - margin
    
    if (x < minX) {
      x = minX
    } else if (x > maxX) {
      x = maxX
    }
    
    // 위쪽으로 넘어가지 않도록 조정
    if (y < scrollTop + margin) {
      y = scrollTop + margin
    }
    
    setTooltipPosition({ x, y })
    setCurrentHoveredIssue(issue)
  }

  const handleMouseLeave = () => {
    // 툴팁을 즉시 숨기지 않고 약간의 지연을 추가하여 툴팁으로 마우스를 이동할 시간을 줌
    if (hideTooltipTimeoutRef.current) {
      clearTimeout(hideTooltipTimeoutRef.current)
    }
    hideTooltipTimeoutRef.current = setTimeout(() => {
      setCurrentHoveredIssue(null)
      setTooltipPosition(null)
      hideTooltipTimeoutRef.current = null
    }, 150) // 150ms 지연
  }

  const handleTooltipMouseEnter = () => {
    // 툴팁 위에 마우스가 있으면 숨기지 않음
    if (hideTooltipTimeoutRef.current) {
      clearTimeout(hideTooltipTimeoutRef.current)
      hideTooltipTimeoutRef.current = null
    }
  }

  const handleTooltipMouseLeave = () => {
    // 고정된 툴팁이면 숨기지 않음
    if (pinnedTooltipIssueId && currentHoveredIssue?.id === pinnedTooltipIssueId) {
      return
    }
    // 툴팁에서 마우스가 벗어나면 숨김
    if (hideTooltipTimeoutRef.current) {
      clearTimeout(hideTooltipTimeoutRef.current)
    }
    hideTooltipTimeoutRef.current = setTimeout(() => {
      // 고정된 툴팁이 아니면 숨김
      if (!pinnedTooltipIssueId || currentHoveredIssue?.id !== pinnedTooltipIssueId) {
        setCurrentHoveredIssue(null)
        setTooltipPosition(null)
      }
      hideTooltipTimeoutRef.current = null
    }, 100) // 100ms 지연
  }

  // 툴팁 고정/해제 토글
  const handleTooltipTogglePin = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (pinnedTooltipIssueId === currentHoveredIssue?.id) {
      // 고정 해제
      setPinnedTooltipIssueId(null)
      setCurrentHoveredIssue(null)
      setTooltipPosition(null)
    } else {
      // 고정
      if (currentHoveredIssue) {
        setPinnedTooltipIssueId(currentHoveredIssue.id)
      }
    }
  }

  // 하이라이트된 텍스트 렌더링 (태그 + 아이콘 포함)
  const renderHighlightedText = (text: string, issue: LegalIssue, isSelected: boolean) => {
    return (
      <span className="relative inline-block group">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold mr-2 align-middle transition-all shadow-sm border",
            SEVERITY_COLORS[issue.severity].badge,
            "border-white/50"
          )}
        >
          {getCategoryIcon(issue.category)}
          <span>{getCategoryLabel(issue.category)}</span>
          <span className="opacity-50">·</span>
          <span>{getSeverityLabel(issue.severity)}</span>
        </span>
        <span
          className={cn(
            "inline-block transition-all rounded-md px-1 py-0.5 font-semibold",
            FOCUS_STYLE,
            "highlight interactive",
            issue.severity === 'high' && `highlight-severity-high ${SEVERITY_COLORS.high.bg}/80 hover:${SEVERITY_COLORS.high.bgHover} underline decoration-red-500 decoration-3 underline-offset-3 shadow-sm`,
            issue.severity === 'medium' && `highlight-severity-medium ${SEVERITY_COLORS.medium.bg}/70 hover:${SEVERITY_COLORS.medium.bgHover} underline decoration-amber-500 decoration-3 underline-offset-3 shadow-sm`,
            issue.severity === 'low' && `highlight-severity-low ${SEVERITY_COLORS.low.bg}/60 hover:${SEVERITY_COLORS.low.bgHover} underline decoration-green-500 decoration-3 underline-offset-3 shadow-sm`,
            isSelected && "ring-4 ring-blue-500 ring-offset-2 shadow-xl scale-110"
          )}
          onMouseEnter={(e) => handleMouseEnter(e, issue)}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => {
            // 클릭 시 툴팁 고정/해제 토글
            if (pinnedTooltipIssueId === issue.id) {
              // 이미 고정된 경우 해제
              setPinnedTooltipIssueId(null)
              setCurrentHoveredIssue(null)
              setTooltipPosition(null)
            } else {
              // 고정하고 툴팁 표시
              handleMouseEnter(e, issue)
              setPinnedTooltipIssueId(issue.id)
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`${getCategoryLabel(issue.category)} 위험 조항, 위험도: ${getSeverityLabel(issue.severity)}, 클릭하여 상세 정보 보기`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              if (pinnedTooltipIssueId === issue.id) {
                setPinnedTooltipIssueId(null)
                setCurrentHoveredIssue(null)
                setTooltipPosition(null)
              } else {
                const syntheticEvent = {
                  currentTarget: e.currentTarget,
                  preventDefault: () => {},
                } as React.MouseEvent<HTMLElement>
                handleMouseEnter(syntheticEvent, issue)
                setPinnedTooltipIssueId(issue.id)
              }
            }
          }}
        >
          {text}
        </span>
      </span>
    )
  }

  // 조항으로 스크롤
  const scrollToClause = (clauseNumber: number) => {
    const element = clauseRefs.current.get(clauseNumber)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setSelectedClauseNumber(clauseNumber)
      setTimeout(() => setSelectedClauseNumber(null), 2000)
    }
  }

  // 선택된 이슈로 스크롤
  useEffect(() => {
    if (selectedIssueId) {
      const timeoutId = setTimeout(() => {
        const element = highlightedRefs.current.get(selectedIssueId)
        if (element) {
          element.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center',
            inline: 'nearest'
          })
          // 선택된 이슈의 조항으로도 스크롤
          const issue = issues.find(i => i.id === selectedIssueId)
          if (issue?.location.clauseNumber) {
            const clauseNum = parseInt(issue.location.clauseNumber)
            scrollToClause(clauseNum)
          }
        }
      }, 100)
      return () => clearTimeout(timeoutId)
    }
  }, [selectedIssueId, issues])

  useEffect(() => {
    if (!selectedClauseId || parsedClauses.length === 0) return

    const matchedClause = parsedClauses.find(clause => clause.id === selectedClauseId)
    if (!matchedClause) return

    const timeoutId = setTimeout(() => {
      scrollToClause(matchedClause.number)
    }, 100)

    return () => clearTimeout(timeoutId)
  }, [selectedClauseId, parsedClauses])

  // 스크롤 진행률 계산 및 툴팁 위치 업데이트
  useEffect(() => {
    const handleScroll = () => {
      // 외부 스크롤 컨테이너를 사용하는 경우 외부 컨테이너의 스크롤을 기준으로 계산
      const scrollContainer = isExternalScroll && scrollContainerRef?.current 
        ? scrollContainerRef.current 
        : containerRef.current
      
      if (!scrollContainer) return
      
      const scrollTop = scrollContainer.scrollTop
      const scrollHeight = scrollContainer.scrollHeight - scrollContainer.clientHeight
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0
      setScrollProgress(progress)
      
      // 스크롤 시 고정되지 않은 툴팁만 숨기기 (위치 계산이 복잡하므로)
      if (tooltipPosition && !pinnedTooltipIssueId) {
        if (hideTooltipTimeoutRef.current) {
          clearTimeout(hideTooltipTimeoutRef.current)
        }
        setTooltipPosition(null)
        setCurrentHoveredIssue(null)
        hideTooltipTimeoutRef.current = null
      }
    }

    const scrollContainer = isExternalScroll && scrollContainerRef?.current 
      ? scrollContainerRef.current 
      : containerRef.current
    
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
      handleScroll() // 초기값 설정
      return () => scrollContainer.removeEventListener('scroll', handleScroll)
    }
  }, [contractText, tooltipPosition, isExternalScroll, scrollContainerRef])

  // 컴포넌트 언마운트 시 타임아웃 정리
  useEffect(() => {
    return () => {
      if (hideTooltipTimeoutRef.current) {
        clearTimeout(hideTooltipTimeoutRef.current)
      }
    }
  }, [])

  // 조항별 텍스트 렌더링
  const renderClauseContent = (clause: Clause) => {
    const content = clause.content
    // highlightedTexts에서 이 clause 범위에 있는 하이라이트 필터링
    // startIndex/endIndex가 clause의 startIndex와 endIndex 사이에 있으면 포함
    const clauseHighlights = [
      ...highlightedTexts.filter(ht => {
        // highlightedTexts의 startIndex/endIndex는 전체 contractText 기준
        // clause의 startIndex/endIndex와 겹치는지 확인
        const htStart = ht.startIndex
        const htEnd = ht.endIndex
        const clauseStart = clause.startIndex
        const clauseEnd = clause.endIndex
        
        // 하이라이트가 clause 범위와 겹치는지 확인
        const overlaps = (htStart < clauseEnd && htEnd > clauseStart)
        return overlaps
      }),
      // fallback: clause.issues에서 하이라이트가 없는 경우
      ...clause.issues
        .filter(issue => {
          // 이미 highlightedTexts에 포함된 이슈는 제외
          return !highlightedTexts.some(ht => ht.issueId === issue.id)
        })
        .map(issue => ({
          startIndex: issue.location.startIndex ?? 0,
          endIndex: issue.location.endIndex ?? (issue.location.startIndex ?? 0) + (issue.originalText?.length ?? 0),
          severity: issue.severity,
          issueId: issue.id,
          text: issue.originalText || '',
        }))
    ].sort((a, b) => a.startIndex - b.startIndex)

    if (clauseHighlights.length === 0) {
      return <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-slate-800">{content}</p>
    }

    let lastIndex = 0
    const elements: React.ReactNode[] = []

    clauseHighlights.forEach((highlight, idx) => {
      const issue = issues.find(i => i.id === highlight.issueId)
      if (!issue) return

      const relativeStart = Math.max(0, highlight.startIndex - clause.startIndex)
      const relativeEnd = Math.min(content.length, highlight.endIndex - clause.startIndex)
      const isSelected = highlight.issueId === selectedIssueId

      // 하이라이트 앞의 텍스트
      if (relativeStart > lastIndex) {
        elements.push(
          <span key={`text-before-${idx}`}>
            {content.substring(lastIndex, relativeStart)}
          </span>
        )
      }

      // 하이라이트된 텍스트
      const highlightText = content.substring(relativeStart, relativeEnd)
      elements.push(
        <span
          key={`highlight-${highlight.issueId}`}
          ref={(el) => {
            if (el) {
              highlightedRefs.current.set(highlight.issueId, el)
            } else {
              highlightedRefs.current.delete(highlight.issueId)
            }
          }}
          onClick={(e) => {
            // 클릭 시 툴팁 고정/해제 토글
            if (pinnedTooltipIssueId === highlight.issueId) {
              // 이미 고정된 경우 해제
              setPinnedTooltipIssueId(null)
              setCurrentHoveredIssue(null)
              setTooltipPosition(null)
            } else {
              // 고정하고 툴팁 표시
              handleMouseEnter(e, issue)
              setPinnedTooltipIssueId(highlight.issueId)
            }
            onIssueClick?.(highlight.issueId)
          }}
          onMouseEnter={(e) => handleMouseEnter(e, issue)}
          onMouseLeave={handleMouseLeave}
          className={cn(
            "inline-block viewer-chunk cursor-pointer transition-all duration-200 rounded-md",
            highlight.severity === 'high' && "highlight-severity-high hover:bg-red-100/60 hover:shadow-md",
            highlight.severity === 'medium' && "highlight-severity-medium hover:bg-amber-100/60 hover:shadow-md",
            highlight.severity === 'low' && "highlight-severity-low hover:bg-green-100/60 hover:shadow-md",
            isSelected && "ring-4 ring-blue-500 ring-offset-2 rounded-lg shadow-xl scale-105"
          )}
        >
          {renderHighlightedText(highlightText, issue, isSelected)}
        </span>
      )

      lastIndex = Math.max(lastIndex, relativeEnd)
    })

    // 남은 텍스트
    if (lastIndex < content.length) {
      elements.push(
        <span key="text-end">
          {content.substring(lastIndex)}
        </span>
      )
    }

    return <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-slate-800">{elements}</p>
  }

  // 요약 통계 계산
  const summaryStats = useMemo(() => {
    const categoryStats: Record<string, { count: number; maxSeverity: 'low' | 'medium' | 'high' | undefined }> = {}
    
    issues.forEach(issue => {
      if (!categoryStats[issue.category]) {
        categoryStats[issue.category] = { count: 0, maxSeverity: undefined }
      }
      categoryStats[issue.category].count++
      const current = categoryStats[issue.category].maxSeverity
      const priority = { high: 3, medium: 2, low: 1 }
      if (!current || priority[issue.severity] > priority[current]) {
        categoryStats[issue.category].maxSeverity = issue.severity
      }
    })

    return categoryStats
  }, [issues])

  // TOP 3 위험 조항
  const topRiskyClauses = useMemo(() => {
    return parsedClauses
      .filter(c => c.issueCount > 0)
      .sort((a, b) => {
        const priority = { high: 3, medium: 2, low: 1, undefined: 0 }
        return priority[b.maxSeverity || 'undefined'] - priority[a.maxSeverity || 'undefined']
      })
      .slice(0, 3)
  }, [parsedClauses])

  return (
    <div className="min-h-full flex flex-col relative">
      {/* 스크롤 진행률 표시 바 - 외부 스크롤 사용 시에만 표시 */}
      {isExternalScroll && containerRef.current && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200/50 z-30">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-150"
            style={{ width: `${scrollProgress}%` }}
            aria-hidden="true"
          />
        </div>
      )}
      
      <div 
        className={cn(
          "h-full overflow-x-hidden",
          isExternalScroll ? "min-h-full" : "flex-1 overflow-y-auto"
        )}
        ref={containerRef}
        role="main"
        aria-label="계약서 전문 뷰어"
      >
      <div className="w-full pb-4 sm:pb-5 min-h-full" style={{ overflowX: 'hidden' }}>
        {/* 상단 조항 네비게이션 - 마진 없이 전체 너비, 가로 스크롤만 */}
        {parsedClauses.length > 0 && (
          <div 
            className="sticky top-0 bg-white backdrop-blur-xl z-20 pt-4 sm:pt-5 pb-3 mb-4 sm:mb-5 border-b-2 border-slate-200/80 shadow-lg shadow-slate-200/20 overflow-x-auto scrollbar-hide px-4 sm:px-6 md:px-8 lg:px-10"
            role="navigation"
            aria-label="조항 네비게이션"
          >
            <div className="flex gap-1.5 sm:gap-2 min-w-max">
              {parsedClauses.map(clause => {
                const isSelected = selectedClauseNumber === clause.number
                
                // 위험도에 따른 배경색 결정 (하이라이팅 색상과 일치)
                const getBackgroundColor = () => {
                  if (isSelected) {
                    return "bg-gradient-to-br from-blue-500 to-indigo-600 border-2 border-blue-600 shadow-xl"
                  }
                  if (clause.maxSeverity === 'high') {
                    return "bg-gradient-to-br from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 border border-red-300/60"
                  }
                  if (clause.maxSeverity === 'medium') {
                    return "bg-gradient-to-br from-amber-50 to-amber-100 hover:from-amber-100 hover:to-amber-200 border border-amber-300/60"
                  }
                  if (clause.maxSeverity === 'low') {
                    return "bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 border border-green-300/60"
                  }
                  return "bg-gradient-to-br from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200 border border-slate-200/60"
                }

                return (
                <button
                  key={clause.id}
                  onClick={() => scrollToClause(clause.number)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      scrollToClause(clause.number)
                    }
                  }}
                  aria-label={`제${clause.number}조 ${clause.title}로 이동, ${clause.maxSeverity ? getSeverityLabel(clause.maxSeverity) : '안전'} 위험도, 이슈 ${clause.issueCount}건`}
                  className={cn(
                    "relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all duration-200 cursor-pointer group flex-shrink-0",
                    "text-xs",
                    "hover:scale-105 hover:shadow-md active:scale-95",
                    getBackgroundColor(),
                    FOCUS_STYLE,
                    isSelected && "ring-2 ring-blue-400 ring-offset-1"
                  )}
                >
                  {/* 활성 조항 상단 파란 바 */}
                  {isSelected && (
                    <div className="absolute -top-0.5 left-0 right-0 h-1 bg-blue-500 rounded-t-lg" />
                  )}
                  <span className={cn(
                    "text-xs font-bold whitespace-nowrap transition-colors",
                    isSelected 
                      ? "text-white" 
                      : clause.maxSeverity === 'high' 
                        ? "text-red-700 group-hover:text-red-800"
                        : clause.maxSeverity === 'medium'
                          ? "text-amber-700 group-hover:text-amber-800"
                          : clause.maxSeverity === 'low'
                            ? "text-green-700 group-hover:text-green-800"
                            : "text-slate-700 group-hover:text-slate-900"
                  )}>
                    제{clause.number}조
                  </span>
                  {clause.issueCount > 0 && (
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                      isSelected 
                        ? "bg-white/30 text-white border border-white/50" 
                        : clause.maxSeverity === 'high'
                          ? "bg-red-200 text-red-800 group-hover:bg-red-300"
                          : clause.maxSeverity === 'medium'
                            ? "bg-amber-200 text-amber-800 group-hover:bg-amber-300"
                            : clause.maxSeverity === 'low'
                              ? "bg-green-200 text-green-800 group-hover:bg-green-300"
                              : "bg-slate-200 text-slate-600 group-hover:bg-slate-300"
                    )}>
                      {clause.issueCount}
                    </span>
                  )}
                </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 상단 요약 헤더 - 개선된 레이아웃 */}
        <div className="sticky top-0 bg-white backdrop-blur-xl z-20 pt-3 pb-3 px-3 sm:px-4 md:px-5 mb-4 border-b border-slate-200 shadow-sm">
          {/* 요약 통계 - 간소화된 레이아웃 */}
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="p-1.5 bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 rounded-lg shadow-md flex-shrink-0" aria-hidden="true">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5">
                  계약서 전문
                </h2>
                {/* 시각적 강조된 안내 문구 */}
                <div className="flex items-start gap-1.5 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs font-semibold text-slate-900 leading-relaxed">
                    빨간색/주황색으로 표시된 조항부터 먼저 확인해 주세요.
                  </p>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  하이라이트된 텍스트를 <span className="font-medium text-blue-600">클릭</span>하면 상세 정보를 확인할 수 있습니다.
                </p>
              </div>
            </div>

            {/* 카테고리별 위험도 바 - 컴팩트 버전 */}
            {Object.keys(summaryStats).length > 0 && (
              <div className="flex flex-wrap gap-1.5" role="region" aria-label="카테고리별 위험도 통계">
                {Object.entries(summaryStats).map(([category, stats]) => {
                  return (
                    <div 
                      key={category} 
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all duration-200 hover:scale-105",
                        stats.maxSeverity === 'high' && "bg-gradient-to-br from-red-50 to-rose-50 border-red-300 shadow-sm",
                        stats.maxSeverity === 'medium' && "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300 shadow-sm",
                        stats.maxSeverity === 'low' && "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 shadow-sm",
                        !stats.maxSeverity && "bg-slate-50 border-slate-200"
                      )}
                    >
                      <span className="text-xs text-slate-700 font-medium whitespace-nowrap">{getCategoryLabel(category)}</span>
                      <span className={cn(
                        "text-xs font-semibold px-1.5 py-0.5 rounded shadow-sm",
                        stats.maxSeverity === 'high' && "bg-red-200 text-red-800 border border-red-300",
                        stats.maxSeverity === 'medium' && "bg-amber-200 text-amber-800 border border-amber-300",
                        stats.maxSeverity === 'low' && "bg-blue-200 text-blue-800 border border-blue-300",
                        !stats.maxSeverity && "bg-slate-200 text-slate-700 border border-slate-300"
                      )}>
                        {stats.count}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* TOP 3 위험 조항 - 접을 수 있는 섹션으로 변경 */}
            {topRiskyClauses.length > 0 && (
              <details className="group" open={false}>
                <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-1 list-none">
                  <span>가장 위험한 조항 TOP 3</span>
                  <ChevronRight className="w-3 h-3 text-slate-400 group-open:rotate-90 transition-transform" />
                </summary>
                <div className="mt-1.5 space-y-1" role="region" aria-label="가장 위험한 조항 TOP 3">
                  {topRiskyClauses.map((clause, idx) => (
                    <button
                      key={clause.id}
                      onClick={() => scrollToClause(clause.number)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          scrollToClause(clause.number)
                        }
                      }}
                      aria-label={`${idx + 1}위: 제${clause.number}조 ${clause.title}로 이동`}
                      className={cn("w-full flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-800 cursor-pointer transition-colors rounded px-1.5 py-1 hover:bg-slate-50", FOCUS_STYLE)}
                    >
                      <span className="font-semibold text-blue-600">{idx + 1}.</span>
                      <span className="flex-1 text-left truncate">제{clause.number}조 {clause.title}</span>
                      {clause.maxSeverity && (
                        <span className={cn(
                          "px-1 py-0.5 rounded text-[10px] font-medium flex-shrink-0",
                          clause.maxSeverity === 'high' && SEVERITY_COLORS.high.badge,
                          clause.maxSeverity === 'medium' && SEVERITY_COLORS.medium.badge,
                          clause.maxSeverity === 'low' && SEVERITY_COLORS.low.badge
                        )}>
                          {getSeverityLabel(clause.maxSeverity)} {clause.issueCount}건
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>

        {/* 계약서 본문 */}
        {parsedClauses.length === 0 ? (
          // parsedClauses가 없어도 contractText가 있으면 직접 표시
          contractText && contractText.trim().length > 0 ? (
            <div className="relative flex gap-2 px-3 sm:px-4 md:px-5">
              {/* 중앙: 계약서 텍스트 (파싱 실패 시 원문 그대로 표시) */}
              <div className="flex-1 space-y-3 relative overflow-visible">
                <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">계약서 전문</h3>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-slate-800">
                      {contractText}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
          <div className="text-center py-12">
            <div className="p-3 bg-slate-100 rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600 mb-1">계약서 내용이 없습니다.</p>
            <p className="text-xs text-slate-500">
                계약서 텍스트를 불러올 수 없습니다.
            </p>
          </div>
          )
        ) : (
          <div className="relative flex gap-2 px-3 sm:px-4 md:px-5">
            {/* 왼쪽: 리스크 minimap */}
            <div 
              className="w-1 flex-shrink-0 flex flex-col rounded-full overflow-hidden bg-slate-100"
              role="navigation"
              aria-label="위험도 미니맵"
            >
              {parsedClauses.map(clause => {
                const clauseHeight = Math.max(30, (clause.endIndex - clause.startIndex) / 15) // 대략적인 높이 계산
                return (
                  <button
                    key={clause.id}
                    onClick={() => scrollToClause(clause.number)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        scrollToClause(clause.number)
                      }
                    }}
                    aria-label={`제${clause.number}조 ${clause.title}로 이동, ${clause.maxSeverity ? getSeverityLabel(clause.maxSeverity) : '안전'} 위험도, 이슈 ${clause.issueCount}건`}
                    className={cn(
                      "transition-all hover:opacity-100 cursor-pointer group relative rounded",
                      FOCUS_STYLE,
                      clause.maxSeverity === 'high' && `${SEVERITY_COLORS.high.solid}/70 hover:${SEVERITY_COLORS.high.solid}`,
                      clause.maxSeverity === 'medium' && `${SEVERITY_COLORS.medium.solid}/70 hover:${SEVERITY_COLORS.medium.solid}`,
                      clause.maxSeverity === 'low' && `${SEVERITY_COLORS.low.solid}/70 hover:${SEVERITY_COLORS.low.solid}`,
                      !clause.maxSeverity && "bg-slate-300/50 hover:bg-slate-300"
                    )}
                    style={{ minHeight: `${clauseHeight}px` }}
                    title={`제${clause.number}조 ${clause.title} – ${clause.maxSeverity ? getSeverityLabel(clause.maxSeverity) : '안전'} ${clause.issueCount}건`}
                  >
                    <div className="absolute left-full ml-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-50 pointer-events-none shadow-lg">
                      제{clause.number}조 {clause.title} – {clause.maxSeverity ? getSeverityLabel(clause.maxSeverity) : '안전'} {clause.issueCount}건
                    </div>
                  </button>
                )
              })}
            </div>

            {/* 중앙: 계약서 텍스트 */}
            <div className="flex-1 space-y-2 relative overflow-x-hidden">
              {/* 호버 툴팁 - 호버한 위치에 표시 */}
              {(currentHoveredIssue || (pinnedTooltipIssueId && issues.find(i => i.id === pinnedTooltipIssueId))) && tooltipPosition && (
                <div
                  ref={tooltipRef}
                  className="absolute z-50 w-[240px] pointer-events-auto"
                  style={{
                    left: `${tooltipPosition.x}px`,
                    top: `${tooltipPosition.y}px`,
                    maxWidth: 'calc(100% - 24px)', // 양쪽 마진 확보
                  }}
                  role="tooltip"
                  aria-label="위험 조항 상세 정보"
                  onMouseEnter={handleTooltipMouseEnter}
                  onMouseLeave={handleTooltipMouseLeave}
                >
                  {(() => {
                    const displayIssue = currentHoveredIssue || issues.find(i => i.id === pinnedTooltipIssueId)
                    if (!displayIssue) return null
                    const isPinned = pinnedTooltipIssueId === displayIssue.id
                    
                    return (
                      <div className="bg-gradient-to-br from-white to-slate-50 rounded-lg border shadow-lg p-3 animate-in fade-in zoom-in-95 duration-200 backdrop-blur-sm">
                        {/* 툴팁 헤더 */}
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-200/60">
                          <div className={cn(
                            "p-1.5 rounded-lg shadow-sm",
                            displayIssue.severity === 'high' && "bg-gradient-to-br from-red-100 to-red-200",
                            displayIssue.severity === 'medium' && "bg-gradient-to-br from-amber-100 to-amber-200",
                            displayIssue.severity === 'low' && "bg-gradient-to-br from-blue-100 to-blue-200"
                          )}>
                            {getCategoryIcon(displayIssue.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {getCategoryLabel(displayIssue.category)}
                            </div>
                            <div className="text-[10px] text-slate-600 mt-0.5">
                              {getSeverityLabel(displayIssue.severity)} 위험도
                            </div>
                          </div>
                          {/* 고정 버튼 */}
                          <button
                            onClick={handleTooltipTogglePin}
                            className={cn(
                              "p-1.5 rounded-md transition-all duration-200 shadow-sm border",
                              isPinned 
                                ? "bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 border-blue-300 hover:from-blue-200 hover:to-blue-300" 
                                : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                            )}
                            aria-label={isPinned ? "툴팁 고정 해제" : "툴팁 고정"}
                            title={isPinned ? "고정 해제" : "고정"}
                          >
                            {isPinned ? (
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        </div>
                    
                        {/* 요약 */}
                        <div className="mb-2">
                          <p className="text-xs text-slate-800 line-clamp-3 leading-relaxed">
                            {displayIssue.summary}
                          </p>
                        </div>
                        
                        {/* 법적 근거 (있는 경우) */}
                        {displayIssue.legalBasis && displayIssue.legalBasis.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200/60">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <BookOpen className="w-3 h-3 text-blue-600" aria-hidden="true" />
                              <span className="text-[10px] font-semibold text-slate-700">관련 법령</span>
                            </div>
                            <div className="space-y-1">
                              {displayIssue.legalBasis.slice(0, 2).map((basis, idx) => {
                                // 구조화된 형식인지 확인
                                const isStructured = typeof basis === 'object' && basis !== null && 'title' in basis;
                                
                                if (isStructured) {
                                  const basisItem = basis as LegalBasisItem;
                                  return (
                                    <div key={idx} className="text-[10px] text-slate-700 bg-blue-50/50 px-1.5 py-1 rounded border border-blue-100">
                                      <div className="flex items-center gap-1 mb-0.5">
                                        <span className="px-1 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
                                          {basisItem.sourceType === 'law' ? '법령' :
                                           basisItem.sourceType === 'manual' ? '가이드' :
                                           basisItem.sourceType === 'case' ? '판례' :
                                           basisItem.sourceType === 'standard_contract' ? '표준계약서' : '참고'}
                                        </span>
                                        {basisItem.filePath && (
                                          <a
                                            href={`${process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000'}/api/v2/legal/file?path=${encodeURIComponent(basisItem.filePath)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-700 hover:text-blue-800 hover:underline ml-auto text-[10px]"
                                            title="파일 열기"
                                          >
                                            열기
                                          </a>
                                        )}
                                </div>
                                      <p className="font-medium text-slate-800 mb-0.5 line-clamp-1 text-[10px]">{basisItem.title}</p>
                                      <p className="text-slate-600 line-clamp-2 text-[10px]">{basisItem.snippet}</p>
                                    </div>
                                  );
                                } else {
                                  // 단순 문자열 형식 (레거시 호환)
                                  const basisText = typeof basis === 'string' ? basis : JSON.stringify(basis);
                                  return (
                                    <div key={idx} className="text-[10px] text-slate-700 line-clamp-2 bg-blue-50/50 px-1.5 py-1 rounded border border-blue-100">
                                      {basisText}
                                    </div>
                                  );
                                }
                              })}
                            </div>
                          </div>
                        )}
                        
                        {/* 클릭 안내 */}
                        <div className="mt-2 pt-2 border-t border-slate-200/60">
                          <button
                            onClick={() => onIssueClick?.(displayIssue.id)}
                            className="w-full text-[10px] font-semibold text-blue-700 hover:text-blue-800 hover:underline text-center bg-blue-50/50 px-2 py-1.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors duration-200"
                          >
                            클릭하여 상세 정보 보기 →
                          </button>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}
              
              {parsedClauses.map(clause => (
                <section
                  key={clause.id}
                  id={`clause-${clause.number}`}
                  ref={(el) => {
                    if (el) {
                      clauseRefs.current.set(clause.number, el)
                    } else {
                      clauseRefs.current.delete(clause.number)
                    }
                  }}
                  className={cn(
                    "w-full max-w-full box-border mb-3 rounded-lg border bg-white shadow-sm transition-all duration-200 hover:shadow-md",
                    "focus-within:ring-2 focus-within:ring-blue-400/50 focus-within:ring-offset-2",
                    clause.maxSeverity === 'high' && `border-red-300 ${SEVERITY_COLORS.high.bg}/40 shadow-red-200/20`,
                    clause.maxSeverity === 'medium' && `border-amber-300 ${SEVERITY_COLORS.medium.bg}/40 shadow-amber-200/20`,
                    clause.maxSeverity === 'low' && `border-blue-300 ${SEVERITY_COLORS.low.bg}/30 shadow-blue-200/20`,
                    !clause.maxSeverity && "border-slate-200 shadow-slate-200/10",
                    selectedClauseNumber === clause.number && "ring-2 ring-blue-400 ring-offset-2 shadow-md"
                  )}
                  aria-labelledby={`clause-${clause.number}-header`}
                >
                  {/* 조항 헤더 */}
                  <header 
                    id={`clause-${clause.number}-header`}
                    onClick={() => scrollToClause(clause.number)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2.5 border-b transition-all duration-200 cursor-pointer hover:bg-opacity-90",
                      clause.maxSeverity === 'high' && `bg-gradient-to-r ${SEVERITY_COLORS.high.bg}/90 to-red-50/80 border-red-300/60`,
                      clause.maxSeverity === 'medium' && `bg-gradient-to-r ${SEVERITY_COLORS.medium.bg}/90 to-amber-50/80 border-amber-300/60`,
                      clause.maxSeverity === 'low' && `bg-gradient-to-r ${SEVERITY_COLORS.low.bg}/90 to-blue-50/80 border-blue-300/60`,
                      !clause.maxSeverity && "bg-gradient-to-r from-slate-50/90 to-slate-100/80 border-slate-200"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn(
                        "text-sm sm:text-base font-bold flex-shrink-0 clause-number clause-number-clickable px-2 py-1 rounded-md",
                        clause.maxSeverity === 'high' && `${SEVERITY_COLORS.high.text} bg-red-100/50`,
                        clause.maxSeverity === 'medium' && `${SEVERITY_COLORS.medium.text} bg-amber-100/50`,
                        clause.maxSeverity === 'low' && `${SEVERITY_COLORS.low.text} bg-blue-100/50`,
                        !clause.maxSeverity && "text-slate-700 bg-slate-100/50"
                      )}>
                        제{clause.number}조
                      </div>
                      <div className="text-sm sm:text-base font-semibold text-slate-900 truncate">{clause.title}</div>
                    </div>
                    <div className="flex items-center gap-2 text-xs flex-shrink-0">
                      {clause.maxSeverity && (
                        <span 
                          className={cn(
                            "px-2 py-1 rounded-full font-semibold shadow-sm border",
                            clause.maxSeverity === 'high' && `${SEVERITY_COLORS.high.badge} border-red-400`,
                            clause.maxSeverity === 'medium' && `${SEVERITY_COLORS.medium.badge} border-amber-400`,
                            clause.maxSeverity === 'low' && `${SEVERITY_COLORS.low.badge} border-blue-400`
                          )}
                          aria-label={`위험도: ${getSeverityLabel(clause.maxSeverity)}`}
                        >
                          {getSeverityLabel(clause.maxSeverity)}
                        </span>
                      )}
                      {clause.issueCount > 0 && (
                        <span 
                          className="rounded-full bg-gradient-to-br from-slate-100 to-slate-200 px-2 py-1 text-slate-700 font-semibold border border-slate-300 shadow-sm"
                          aria-label={`이슈 ${clause.issueCount}건`}
                        >
                          이슈 {clause.issueCount}건
                        </span>
                      )}
                    </div>
                  </header>

                  {/* 조항 내용 */}
                  <div className="px-3 py-3 bg-gradient-to-b from-white to-slate-50/30">
                    {renderClauseContent(clause)}
                  </div>
                </section>
              ))}
            </div>

          </div>
        )}
      </div>

      </div>
      
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
