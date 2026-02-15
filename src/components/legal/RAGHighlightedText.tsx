'use client'

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { BookOpen, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarkdownRenderer } from '@/components/rag/MarkdownRenderer'
import { Button } from '@/components/ui/button'
import type { SourceItem } from '@/types/legal'

interface RAGHighlightedTextProps {
  content: string
  sources?: SourceItem[]
}

interface RAGHighlightedMarkdownProps {
  content: string
  sources?: SourceItem[]
}

export function RAGHighlightedText({ content, sources = [] }: RAGHighlightedTextProps) {
  const [hoveredSource, setHoveredSource] = useState<SourceItem | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const hoveredElementRef = useRef<HTMLElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // 문서 제목 패턴 찾기 (『...』, 「...」, "..." 등)
  const documentPatterns = [
    /『([^』]+)』/g,  // 『표준 근로계약서(7종)(19.6월).pdf』
    /「([^」]+)」/g,  // 「문서명」
    /"([^"]+\.pdf)"/g,  // "문서명.pdf"
    /([A-Za-z0-9가-힣\s()_]+\.pdf)/g,  // 문서명.pdf (간단한 패턴, 언더스코어 포함)
  ]

  // sources에서 문서 제목 매칭 함수 (개선된 버전)
  const findSourceByTitle = (title: string): SourceItem | null => {
    if (!sources || sources.length === 0) return null
    
    // 제목 정규화 함수
    const normalizeTitle = (text: string): string => {
      return text
        .replace(/[『」"」]/g, '')  // 특수 문자 제거
        .replace(/\s+/g, '')  // 공백 제거
        .replace(/[()]/g, '')  // 괄호 제거
        .toLowerCase()
        .trim()
    }
    
    const normalizedTitle = normalizeTitle(title)
    
    // 1. 정확한 매칭 시도
    const exactMatch = sources.find(source => {
      const normalizedSource = normalizeTitle(source.title)
      return normalizedSource === normalizedTitle || 
             normalizedSource.includes(normalizedTitle) || 
             normalizedTitle.includes(normalizedSource)
    })
    if (exactMatch) return exactMatch
    
    // 2. 파일명만 추출하여 매칭 (확장자 제거)
    const fileNameWithoutExt = normalizedTitle.replace(/\.pdf$/i, '').replace(/\.hwp$/i, '')
    const fileNameMatch = sources.find(source => {
      const normalizedSource = normalizeTitle(source.title)
      const sourceFileName = normalizedSource.replace(/\.pdf$/i, '').replace(/\.hwp$/i, '')
      return sourceFileName.includes(fileNameWithoutExt) || 
             fileNameWithoutExt.includes(sourceFileName) ||
             // 핵심 키워드 매칭 (3글자 이상)
             (fileNameWithoutExt.length >= 3 && sourceFileName.includes(fileNameWithoutExt.substring(0, Math.min(10, fileNameWithoutExt.length))))
    })
    if (fileNameMatch) return fileNameMatch
    
    // 3. 부분 키워드 매칭 (언더스코어로 구분된 키워드)
    const keywords = fileNameWithoutExt.split('_').filter(k => k.length >= 2)
    if (keywords.length > 0) {
      const keywordMatch = sources.find(source => {
        const normalizedSource = normalizeTitle(source.title)
        return keywords.some(keyword => normalizedSource.includes(keyword))
      })
      if (keywordMatch) return keywordMatch
    }
    
    return null
  }

  // 텍스트를 파싱하여 하이라이팅된 요소로 변환
  const parseContent = () => {
    if (!sources || sources.length === 0) {
      return <span>{content}</span>
    }

    const parts: Array<{ text: string; source: SourceItem | null; isHighlight: boolean }> = []
    let lastIndex = 0

    // 모든 패턴으로 문서 제목 찾기
    const matches: Array<{ index: number; length: number; text: string; source: SourceItem | null }> = []
    
    // 문서 제목 패턴 매칭
    documentPatterns.forEach(pattern => {
      let match
      // 패턴을 재설정하여 다시 검색
      pattern.lastIndex = 0
      while ((match = pattern.exec(content)) !== null) {
        const title = match[1] || match[0]
        const source = findSourceByTitle(title)
        if (source) {
          matches.push({
            index: match.index,
            length: match[0].length,
            text: match[0],
            source,
          })
        }
      }
    })

    // 중복 제거 및 정렬
    const uniqueMatches = matches
      .filter((match, index, self) => 
        index === self.findIndex(m => m.index === match.index && m.length === match.length)
      )
      .sort((a, b) => a.index - b.index)

    // 텍스트 분할
    uniqueMatches.forEach((match, idx) => {
      // 이전 텍스트 추가
      if (match.index > lastIndex) {
        parts.push({
          text: content.substring(lastIndex, match.index),
          source: null,
          isHighlight: false,
        })
      }

      // 하이라이팅된 텍스트 정제 (중복 제거 및 확장자 제거)
      let cleanedText = match.text
      
      // 1. 특수 문자 정리 (『』「」제거) - 먼저 처리
      cleanedText = cleanedText.replace(/[『』「」]/g, '')
      
      // 2. 중복된 부분 제거 (예: "배포).pdf"가 중복되는 경우)
      // 패턴: "배포).pdf"가 뒤에 또 나오는 경우
      cleanedText = cleanedText.replace(/배포\)\.pdf\)\.pdf$/i, '배포)')
      cleanedText = cleanedText.replace(/배포\)\.pdf\)/g, '배포)')
      cleanedText = cleanedText.replace(/\)\.pdf\)\.pdf$/i, ')')
      cleanedText = cleanedText.replace(/\)\.pdf\)/g, ')')
      cleanedText = cleanedText.replace(/\.pdf\)\.pdf$/i, '')
      cleanedText = cleanedText.replace(/\)\.pdf\)\.pdf/g, ')')
      
      // 3. 확장자 제거 (.pdf, .hwp 등) - 모든 위치에서 제거
      cleanedText = cleanedText
        .replace(/\.pdf$/i, '')
        .replace(/\.pdf\)/g, ')')
        .replace(/\.hwp$/i, '')
        .replace(/\.hwpx$/i, '')
      
      // 4. 괄호 내부 중복 제거 (예: "(2025년, 배포)배포)" → "(2025년, 배포)")
      cleanedText = cleanedText.replace(/\(([^)]+)\)\1\)/g, '($1)')
      cleanedText = cleanedText.replace(/\(([^)]*배포[^)]*)\)배포\)/g, '($1)')
      
      // 5. 마지막으로 남은 중복 패턴 제거
      cleanedText = cleanedText.replace(/배포\)배포\)/g, '배포)')
      cleanedText = cleanedText.replace(/\)\)/g, ')')
      
      parts.push({
        text: cleanedText,
        source: match.source,
        isHighlight: true,
      })

      lastIndex = match.index + match.length
    })

    // 마지막 텍스트 추가
    if (lastIndex < content.length) {
      parts.push({
        text: content.substring(lastIndex),
        source: null,
        isHighlight: false,
      })
    }

    // 매칭이 없으면 원본 반환
    if (parts.length === 0 || (parts.length === 1 && !parts[0].isHighlight)) {
      return <span>{content}</span>
    }

    return (
      <>
        {parts.map((part, idx) => {
          if (!part.isHighlight || !part.source) {
            return <span key={idx}>{part.text}</span>
          }

          return (
            <span
              key={idx}
              ref={(el) => {
                if (el && part.source) {
                  hoveredElementRef.current = el
                }
              }}
              className={cn(
                "relative inline-block px-1 py-0.5 rounded",
                "bg-blue-100 text-blue-800 font-medium",
                "border-b-2 border-blue-400 border-dashed",
                "cursor-help transition-all duration-200",
                "hover:bg-blue-200 hover:border-blue-500",
                hoveredSource?.sourceId === part.source.sourceId && "bg-blue-200 border-blue-500"
              )}
              onMouseEnter={(e) => {
                setHoveredSource(part.source)
                const rect = e.currentTarget.getBoundingClientRect()
                setTooltipPosition({
                  x: rect.left + rect.width / 2,
                  y: rect.bottom + 10, // 하이라이팅된 텍스트 아래에 표시
                })
              }}
              onMouseLeave={() => {
                setHoveredSource(null)
                setTooltipPosition(null)
              }}
            >
              {part.text}
            </span>
          )
        })}
      </>
    )
  }

  // 툴팁 위치 조정 (화면 밖으로 나가지 않도록)
  useEffect(() => {
    if (tooltipPosition && tooltipRef.current) {
      const tooltip = tooltipRef.current
      const rect = tooltip.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let adjustedX = tooltipPosition.x
      let adjustedY = tooltipPosition.y

      // 오른쪽으로 넘치면 왼쪽으로 조정
      if (rect.right > viewportWidth - 20) {
        adjustedX = viewportWidth - rect.width - 20
      }
      // 왼쪽으로 넘치면 오른쪽으로 조정
      if (rect.left < 20) {
        adjustedX = 20
      }

      // 위로 넘치면 아래로 조정
      if (rect.top < 20) {
        adjustedY = tooltipPosition.y + 40
      }
      // 아래로 넘치면 위로 조정 (툴팁이 화면 밖으로 나가면)
      if (rect.bottom > viewportHeight - 20) {
        // 원래 위치가 하이라이팅 텍스트 아래라면, 위로 표시
        adjustedY = tooltipPosition.y - rect.height - 20
      }

      if (adjustedX !== tooltipPosition.x || adjustedY !== tooltipPosition.y) {
        setTooltipPosition({ x: adjustedX, y: adjustedY })
      }
    }
  }, [tooltipPosition, hoveredSource])

  const sourceTypeLabels = {
    law: '법령',
    manual: '가이드라인',
    case: '판례',
    standard_contract: '표준계약서',
  }

  const sourceTypeColors = {
    law: 'bg-blue-100 text-blue-700 border-blue-300',
    manual: 'bg-purple-100 text-purple-700 border-purple-300',
    case: 'bg-green-100 text-green-700 border-green-300',
    standard_contract: 'bg-amber-100 text-amber-700 border-amber-300',
  }

  return (
    <div className="relative">
      <div>{parseContent()}</div>

      {/* 툴팁 */}
      {hoveredSource && tooltipPosition && (
        <div
          ref={tooltipRef}
          className="fixed z-50 w-[320px]"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translate(-50%, 0)', // 하이라이팅된 텍스트 아래에 표시
          }}
          role="tooltip"
          aria-label="RAG 출처 정보"
          onMouseLeave={() => {
            // 툴팁에서 마우스가 벗어나면 숨김
            setHoveredSource(null)
            setTooltipPosition(null)
          }}
        >
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl border-2 border-blue-200 shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-200">
            {/* 툴팁 헤더 */}
            <div className="flex items-center gap-3 mb-3 pb-3 border-b-2 border-slate-200/60">
              <div className={cn(
                "p-2 rounded-xl shadow-sm",
                sourceTypeColors[hoveredSource.sourceType as keyof typeof sourceTypeColors] || sourceTypeColors.manual
              )}>
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-600 mb-1">
                  {sourceTypeLabels[hoveredSource.sourceType as keyof typeof sourceTypeLabels] || hoveredSource.sourceType}
                </div>
                <div className="text-sm font-bold text-slate-900 line-clamp-2">
                  {hoveredSource.title}
                </div>
              </div>
            </div>

            {/* 내용 */}
            <div className="mb-2">
              <p className="text-xs text-slate-700 leading-relaxed line-clamp-4">
                {hoveredSource.snippet}
              </p>
            </div>

            {/* 유사도 점수 및 다운로드 버튼 */}
            <div className="mt-3 pt-3 border-t-2 border-slate-200/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 font-medium">검색 유사도</span>
                <span className="text-xs font-mono font-bold text-blue-600">
                  {(hoveredSource.score * 100).toFixed(1)}%
                </span>
              </div>
              {hoveredSource.fileUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    try {
                      // fileUrl이 백엔드 API 경로인 경우 다운로드 모드로 변경
                      let downloadUrl = hoveredSource.fileUrl
                      if (downloadUrl.includes('/api/v2/legal/file')) {
                        // 이미 API 경로인 경우 download 파라미터 추가
                        downloadUrl = downloadUrl.includes('?') 
                          ? `${downloadUrl}&download=true`
                          : `${downloadUrl}?download=true`
                      } else if (hoveredSource.externalId) {
                        // externalId가 있는 경우 백엔드 API 경로 생성
                        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000'
                        const sourceType = hoveredSource.sourceType || 'law'
                        const bucketMap: Record<string, string> = {
                          'law': 'laws',
                          'manual': 'manuals',
                          'case': 'cases',
                          'standard_contract': 'standard_contracts',
                        }
                        const folder = bucketMap[sourceType] || 'laws'
                        const filePath = `${folder}/${hoveredSource.externalId}.pdf`
                        downloadUrl = `${backendUrl}/api/v2/legal/file?path=${encodeURIComponent(filePath)}&download=true`
                      }
                      
                      // 파일 다운로드
                      const response = await fetch(downloadUrl)
                      if (!response.ok) {
                        throw new Error('다운로드 실패')
                      }
                      
                      const blob = await response.blob()
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      const fileName = hoveredSource.title?.replace(/\.pdf$/i, '') || 'document'
                      a.download = `${fileName.replace(/[^a-zA-Z0-9가-힣\s]/g, '_')}.pdf`
                      document.body.appendChild(a)
                      a.click()
                      window.URL.revokeObjectURL(url)
                      document.body.removeChild(a)
                    } catch (error) {
                      // 실패 시 새 탭에서 열기
                      if (hoveredSource.fileUrl) {
                        window.open(hoveredSource.fileUrl, '_blank')
                      }
                    }
                  }}
                  className="w-full text-xs h-8 border-blue-300 hover:bg-blue-50 hover:border-blue-400 text-blue-700"
                >
                  <Download className="w-3 h-3 mr-2" />
                  파일 다운로드
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 마크다운과 RAG 하이라이팅을 함께 사용하는 컴포넌트
export function RAGHighlightedMarkdown({ content, sources = [] }: RAGHighlightedMarkdownProps) {
  const [hoveredSource, setHoveredSource] = useState<SourceItem | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 문서 제목 패턴
  const documentPatterns = [
    /『([^』]+)』/g,
    /「([^」]+)」/g,
    /"([^"]+\.pdf)"/g,
    /([A-Za-z0-9가-힣\s()]+\.pdf)/g,
  ]

  // sources에서 문서 제목 매칭 (useCallback으로 메모이제이션)
  const findSourceByTitle = useCallback((title: string): SourceItem | null => {
    if (!sources || sources.length === 0) return null
    
    const exactMatch = sources.find(source => 
      source.title === title || 
      source.title.includes(title) || 
      title.includes(source.title)
    )
    if (exactMatch) return exactMatch
    
    const fileName = title.replace(/[『」"」]/g, '').trim()
    const partialMatch = sources.find(source => {
      const sourceFileName = source.title.replace(/[『」"」]/g, '').trim()
      return sourceFileName.includes(fileName) || fileName.includes(sourceFileName)
    })
    if (partialMatch) return partialMatch
    
    return null
  }, [sources])

  // 중요 키워드 자동 볼드 처리 (마크다운 파싱 전에 적용)
  const highlightImportantKeywords = (text: string): string => {
    let processed = text
    
    // 이미 **로 감싸진 텍스트는 제외하기 위한 마커
    const alreadyBoldPattern = /\*\*[^*]+\*\*/g
    const placeholders: { [key: string]: string } = {}
    let placeholderIndex = 0
    
    // 이미 볼드 처리된 텍스트를 임시로 치환
    processed = processed.replace(alreadyBoldPattern, (match) => {
      const placeholder = `__BOLD_PLACEHOLDER_${placeholderIndex}__`
      placeholders[placeholder] = match
      placeholderIndex++
      return placeholder
    })
    
    // 법령명 + 조항 패턴 (예: "근로기준법 제26조", "근로기준법 제26조(해고의 예고)")
    const lawPatterns = [
      /([가-힣]+법)\s*(제\d+조(?:\([^)]+\))?)/g,
      /(근로기준법|최저임금법|고용보험법|산업안전보건법|근로자퇴직급여보장법|근로자참여및협력증진에관한법률|근로자복지기본법|근로자직업능력개발법)\s*(제\d+조(?:\([^)]+\))?)/gi,
    ]
    
    lawPatterns.forEach(pattern => {
      processed = processed.replace(pattern, (match, p1, p2) => {
        // 이미 **로 감싸져 있지 않은 경우만 처리
        if (!match.includes('__BOLD_PLACEHOLDER_')) {
          return `**${match}**`
        }
        return match
      })
    })
    
    // 핵심 법적 용어 패턴
    const legalTerms = [
      '해고예고수당', '자발적 퇴사', '부당해고', '임금체불', '무급 야근',
      '해고예고', '퇴직금', '실업급여', '산재보험', '고용보험',
      '최저임금', '연장근로', '휴게시간', '주휴일', '연차유급휴가',
      '수습기간', '인턴', '프리랜서', '용역계약', '도급계약',
      '경업금지', '비밀유지', '손해배상', '위약금', '해지통보',
      '정당한 사유', '합리적 이유', '사전 통지', '예고 기간'
    ]
    
    legalTerms.forEach(term => {
      // 단어 경계를 고려한 정확한 매칭 (이미 **로 감싸지지 않은 경우만)
      // lookbehind 대신 단순한 패턴 사용
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`(^|[^가-힣*])${escapedTerm}([^가-힣*]|$)`, 'g')
      processed = processed.replace(regex, (match, before, after) => {
        // 이미 **로 감싸져 있지 않은 경우만 처리
        if (!match.includes('__BOLD_PLACEHOLDER_')) {
          // 앞뒤 문자는 유지하고 키워드만 볼드 처리
          return `${before}**${term}**${after}`
        }
        return match
      })
    })
    
    // 법적 조항 패턴 (예: "제26조", "제7조(임금지급시기)")
    processed = processed.replace(/(^|[^가-힣*])(제\d+조(?:\([^)]+\))?)([^가-힣*]|$)/g, (match, before, clause, after) => {
      // 이미 **로 감싸져 있지 않은 경우만 처리
      if (!match.includes('__BOLD_PLACEHOLDER_')) {
        return `${before}**${clause}**${after}`
      }
      return match
    })
    
    // 임시로 치환한 볼드 텍스트 복원
    Object.keys(placeholders).forEach(placeholder => {
      processed = processed.replace(placeholder, placeholders[placeholder])
    })
    
    return processed
  }

  // 마크다운 파싱 (MarkdownRenderer와 유사한 로직)
  const parseMarkdown = (text: string) => {
    let html = text

    // 볼드 마크다운 제거 (이상한 볼드 처리 방지)
    html = html.replace(/\*\*/g, '')

    // 제목 처리
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold mt-4 mb-2 text-gray-900">$1</h3>')
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-base font-bold mt-5 mb-3 text-gray-900">$1</h2>')
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-lg font-bold mt-6 mb-4 text-gray-900">$1</h1>')

    // 이탤릭 처리만 유지 (볼드는 제거했으므로)
    html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')

    // 코드 블록 처리
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 p-4 rounded-lg my-4 overflow-x-auto"><code class="text-sm">$1</code></pre>')
    html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')

    // 링크 처리
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">$1</a>')

    // 리스트 처리
    const lines = html.split('\n')
    let inList = false
    let listType = ''
    const processedLines: string[] = []

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const listMatch = line.match(/^[\s]*[-*]\s+(.+)$/)
      const numberedMatch = line.match(/^[\s]*\d+\.\s+(.+)$/)

      if (listMatch || numberedMatch) {
        if (!inList) {
          inList = true
          listType = numberedMatch ? 'ol' : 'ul'
          processedLines.push(`<${listType} class="list-disc list-inside space-y-2 my-4 ml-4">`)
        }
        const content = listMatch ? listMatch[1] : numberedMatch![1]
        processedLines.push(`<li class="text-sm text-gray-700">${content}</li>`)
      } else {
        if (inList) {
          processedLines.push(`</${listType}>`)
          inList = false
        }
        if (line.trim() && !line.match(/^<[h|u|o|l|b|p|d|t|r|s]/)) {
          processedLines.push(line)
        } else if (line.trim()) {
          processedLines.push(line)
        }
      }
    }

    if (inList) {
      processedLines.push(`</${listType}>`)
    }

    html = processedLines.join('\n')

    // 인용구 처리
    html = html.replace(/^>\s+(.*$)/gim, '<blockquote class="border-l-4 border-blue-300 pl-4 my-3 italic text-sm text-gray-600">$1</blockquote>')

    // 수평선 처리
    html = html.replace(/^---$/gim, '<hr class="my-6 border-gray-300" />')

    // 줄바꿈 처리 및 문장 끝 '.' 뒤에 <br/> 추가
    const finalLines = html.split('\n')
    const finalProcessed: string[] = []
    let currentParagraph: string[] = []

    for (const line of finalLines) {
      const trimmed = line.trim()
      
      if (trimmed.match(/^<[h|u|o|l|b|p|d|t|r|s]/) || trimmed === '') {
        if (currentParagraph.length > 0) {
          // 문장 끝 '.' 뒤에 <br/> 추가
          let paragraphText = currentParagraph.join(' ')
          // 문장 끝 '.' 뒤에 줄바꿈 추가 (HTML 태그 내부는 제외)
          paragraphText = paragraphText.replace(/([^<>]\.)\s+/g, '$1<br/>')
          finalProcessed.push(`<p class="mb-3 leading-relaxed text-sm text-gray-700">${paragraphText}</p>`)
          currentParagraph = []
        }
        if (trimmed) {
          finalProcessed.push(line)
        }
      } else {
        currentParagraph.push(trimmed)
      }
    }

    if (currentParagraph.length > 0) {
      // 문장 끝 '.' 뒤에 <br/> 추가
      let paragraphText = currentParagraph.join(' ')
      // 문장 끝 '.' 뒤에 줄바꿈 추가 (HTML 태그 내부는 제외)
      paragraphText = paragraphText.replace(/([^<>]\.)\s+/g, '$1<br/>')
      finalProcessed.push(`<p class="mb-3 leading-relaxed text-sm text-gray-700">${paragraphText}</p>`)
    }

    html = finalProcessed.join('\n')

    return html
  }

  // 마크다운 텍스트를 파싱하여 하이라이팅 적용 (메모이제이션)
  const highlightedContent = useMemo(() => {
    // API에서 이미 HTML이 포함된 경우를 대비해 HTML 태그 완전히 제거 (텍스트만 추출)
    let cleanContent = content
    // HTML 태그가 포함되어 있는지 확인하고 모든 HTML 태그 제거
    if (content.includes('<') && content.includes('>')) {
      // 모든 HTML 태그 제거 (텍스트만 추출)
      cleanContent = content.replace(/<[^>]+>/g, '')
      // HTML 엔티티 디코딩
      cleanContent = cleanContent
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
    }
    
    if (!sources || sources.length === 0) {
      return parseMarkdown(cleanContent)
    }

    let processedContent = cleanContent
    const matches: Array<{ pattern: string; title: string; source: SourceItem }> = []

    // 모든 패턴으로 문서 제목 찾기
    documentPatterns.forEach(pattern => {
      let match
      const regex = new RegExp(pattern.source, 'g')
      while ((match = regex.exec(content)) !== null) {
        const title = match[1] || match[0]
        const source = findSourceByTitle(title)
        if (source) {
          matches.push({
            pattern: match[0],
            title: match[0],
            source,
          })
        }
      }
    })

    // 중복 제거 (긴 패턴 우선)
    const uniqueMatches = matches
      .filter((match, index, self) => 
        index === self.findIndex(m => m.pattern === match.pattern)
      )
      .sort((a, b) => b.pattern.length - a.pattern.length)

    // 하이라이팅 적용 (뒤에서부터 처리하여 인덱스 변경 방지)
    uniqueMatches.reverse().forEach(match => {
      // 하이라이팅된 텍스트 정제 (중복 제거 및 확장자 제거)
      let cleanedText = match.pattern
      
      // 1. 특수 문자 정리 (『』「」제거) - 먼저 처리
      cleanedText = cleanedText.replace(/[『』「」]/g, '')
      
      // 2. 중복된 부분 제거 (예: "배포).pdf"가 중복되는 경우)
      // 패턴: "배포).pdf"가 뒤에 또 나오는 경우
      cleanedText = cleanedText.replace(/배포\)\.pdf\)\.pdf$/i, '배포)')
      cleanedText = cleanedText.replace(/배포\)\.pdf\)/g, '배포)')
      cleanedText = cleanedText.replace(/\)\.pdf\)\.pdf$/i, ')')
      cleanedText = cleanedText.replace(/\)\.pdf\)/g, ')')
      cleanedText = cleanedText.replace(/\.pdf\)\.pdf$/i, '')
      cleanedText = cleanedText.replace(/\)\.pdf\)\.pdf/g, ')')
      
      // 3. 확장자 제거 (.pdf, .hwp 등) - 모든 위치에서 제거
      cleanedText = cleanedText
        .replace(/\.pdf$/i, '')
        .replace(/\.pdf\)/g, ')')
        .replace(/\.hwp$/i, '')
        .replace(/\.hwpx$/i, '')
      
      // 4. 괄호 내부 중복 제거 (예: "(2025년, 배포)배포)" → "(2025년, 배포)")
      cleanedText = cleanedText.replace(/\(([^)]+)\)\1\)/g, '($1)')
      cleanedText = cleanedText.replace(/\(([^)]*배포[^)]*)\)배포\)/g, '($1)')
      
      // 5. 마지막으로 남은 중복 패턴 제거
      cleanedText = cleanedText.replace(/배포\)배포\)/g, '배포)')
      cleanedText = cleanedText.replace(/\)\)/g, ')')
      
      const replacement = `<span 
        class="rag-highlight inline-block px-1 py-0.5 rounded bg-blue-100 text-blue-800 font-medium border-b-2 border-blue-400 border-dashed cursor-help transition-all duration-200 hover:bg-blue-200 hover:border-blue-500" 
        data-source-id="${match.source.sourceId}"
        data-source-title="${match.source.title.replace(/"/g, '&quot;')}"
        data-source-snippet="${match.source.snippet.replace(/"/g, '&quot;').substring(0, 200)}"
        data-source-type="${match.source.sourceType}"
        data-source-score="${match.source.score}"
        data-source-external-id="${match.source.externalId ? match.source.externalId.replace(/"/g, '&quot;') : ''}"
        data-source-file-url="${match.source.fileUrl ? match.source.fileUrl.replace(/"/g, '&quot;') : ''}"
      >${cleanedText}</span>`
      processedContent = processedContent.replace(match.pattern, replacement)
    })

    // 마크다운 파싱
    return parseMarkdown(processedContent)
  }, [content, sources, findSourceByTitle])

  // 툴팁 위치 조정
  useEffect(() => {
    if (tooltipPosition && tooltipRef.current) {
      const tooltip = tooltipRef.current
      const rect = tooltip.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let adjustedX = tooltipPosition.x
      let adjustedY = tooltipPosition.y

      if (rect.right > viewportWidth - 20) {
        adjustedX = viewportWidth - rect.width - 20
      }
      if (rect.left < 20) {
        adjustedX = 20
      }
      if (rect.top < 20) {
        adjustedY = tooltipPosition.y + 40
      }
      if (rect.bottom > viewportHeight - 20) {
        adjustedY = viewportHeight - rect.height - 20
      }

      if (adjustedX !== tooltipPosition.x || adjustedY !== tooltipPosition.y) {
        setTooltipPosition({ x: adjustedX, y: adjustedY })
      }
    }
  }, [tooltipPosition, hoveredSource])

  // 하이라이팅된 요소에 이벤트 리스너 추가
  useEffect(() => {
    if (!containerRef.current) return

    const handleMouseEnter = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const highlightElement = target.closest('.rag-highlight') as HTMLElement
      
      if (highlightElement) {
        const sourceId = highlightElement.getAttribute('data-source-id')
        const sourceTitle = highlightElement.getAttribute('data-source-title')
        const sourceSnippet = highlightElement.getAttribute('data-source-snippet')
        const sourceType = highlightElement.getAttribute('data-source-type')
        const sourceScore = highlightElement.getAttribute('data-source-score')

        const sourceExternalId = highlightElement.getAttribute('data-source-external-id')
        const sourceFileUrl = highlightElement.getAttribute('data-source-file-url')
        
        if (sourceId && sourceTitle && sourceSnippet && sourceType && sourceScore) {
          const source: SourceItem = {
            sourceId,
            sourceType: sourceType as 'law' | 'manual' | 'case',
            title: sourceTitle,
            snippet: sourceSnippet,
            score: parseFloat(sourceScore),
            externalId: sourceExternalId || undefined,
            fileUrl: sourceFileUrl || undefined,
          }
          setHoveredSource(source)
          
          const rect = highlightElement.getBoundingClientRect()
          setTooltipPosition({
            x: rect.left + rect.width / 2,
            y: rect.bottom + 10, // 하이라이팅된 텍스트 아래에 표시
          })
        }
      }
    }

    const handleMouseLeave = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const highlightElement = target.closest('.rag-highlight') as HTMLElement
      const tooltipElement = target.closest('[role="tooltip"]') as HTMLElement
      
      // 하이라이팅 요소에서 벗어났거나, 툴팁에서 벗어났을 때
      if (highlightElement || tooltipElement) {
        // 관련된 요소가 아닌 경우에만 툴팁 숨김
        const relatedToHighlight = highlightElement && (
          hoveredSource?.sourceId === highlightElement.getAttribute('data-source-id')
        )
        const relatedToTooltip = tooltipElement
        
        if (!relatedToHighlight && !relatedToTooltip) {
          setHoveredSource(null)
          setTooltipPosition(null)
        }
      } else {
        // 하이라이팅 요소나 툴팁이 아닌 곳으로 이동한 경우
        setHoveredSource(null)
        setTooltipPosition(null)
      }
    }
    
    const handleMouseOut = (e: MouseEvent) => {
      const relatedTarget = e.relatedTarget as HTMLElement
      if (!relatedTarget) {
        setHoveredSource(null)
        setTooltipPosition(null)
        return
      }
      
      const highlightElement = relatedTarget.closest('.rag-highlight') as HTMLElement
      const tooltipElement = relatedTarget.closest('[role="tooltip"]') as HTMLElement
      
      // 관련 요소로 이동하지 않은 경우에만 툴팁 숨김
      if (!highlightElement && !tooltipElement) {
        setHoveredSource(null)
        setTooltipPosition(null)
      }
    }

    const container = containerRef.current
    container.addEventListener('mouseenter', handleMouseEnter, true)
    container.addEventListener('mouseleave', handleMouseLeave, true)
    container.addEventListener('mouseout', handleMouseOut, true)

    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter, true)
      container.removeEventListener('mouseleave', handleMouseLeave, true)
      container.removeEventListener('mouseout', handleMouseOut, true)
    }
  }, [hoveredSource])

  // 툴팁 위치 조정 (화면 밖으로 나가지 않도록)
  useEffect(() => {
    if (tooltipPosition && tooltipRef.current) {
      const tooltip = tooltipRef.current
      const rect = tooltip.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      let adjustedX = tooltipPosition.x
      let adjustedY = tooltipPosition.y

      // 오른쪽으로 넘치면 왼쪽으로 조정
      if (rect.right > viewportWidth - 20) {
        adjustedX = viewportWidth - rect.width - 20
      }
      // 왼쪽으로 넘치면 오른쪽으로 조정
      if (rect.left < 20) {
        adjustedX = 20
      }

      // 위로 넘치면 아래로 조정
      if (rect.top < 20) {
        adjustedY = tooltipPosition.y + 40
      }
      // 아래로 넘치면 위로 조정 (툴팁이 화면 밖으로 나가면)
      if (rect.bottom > viewportHeight - 20) {
        // 원래 위치가 하이라이팅 텍스트 아래라면, 위로 표시
        adjustedY = tooltipPosition.y - rect.height - 20
      }

      if (adjustedX !== tooltipPosition.x || adjustedY !== tooltipPosition.y) {
        setTooltipPosition({ x: adjustedX, y: adjustedY })
      }
    }
  }, [tooltipPosition, hoveredSource])

  const sourceTypeLabels = {
    law: '법령',
    manual: '가이드라인',
    case: '판례',
    standard_contract: '표준계약서',
  }

  const sourceTypeColors = {
    law: 'bg-blue-100 text-blue-700 border-blue-300',
    manual: 'bg-purple-100 text-purple-700 border-purple-300',
    case: 'bg-green-100 text-green-700 border-green-300',
    standard_contract: 'bg-amber-100 text-amber-700 border-amber-300',
  }

  return (
    <div className="relative" ref={containerRef}>
      <div 
        dangerouslySetInnerHTML={{ __html: highlightedContent }}
        className="rag-content"
      />
      
      {/* 툴팁 */}
      {hoveredSource && tooltipPosition && (
        <div
          ref={tooltipRef}
          className="fixed z-50 w-[320px]"
          style={{
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translate(-50%, 0)', // 하이라이팅된 텍스트 아래에 표시
          }}
          role="tooltip"
          aria-label="RAG 출처 정보"
          onMouseLeave={() => {
            // 툴팁에서 마우스가 벗어나면 숨김
            setHoveredSource(null)
            setTooltipPosition(null)
          }}
        >
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl border-2 border-blue-200 shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-3 pb-3 border-b-2 border-slate-200/60">
              <div className={cn(
                "p-2 rounded-xl shadow-sm",
                sourceTypeColors[hoveredSource.sourceType as keyof typeof sourceTypeColors] || sourceTypeColors.manual
              )}>
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-600 mb-1">
                  {sourceTypeLabels[hoveredSource.sourceType as keyof typeof sourceTypeLabels] || hoveredSource.sourceType}
                </div>
                <div className="text-sm font-bold text-slate-900 line-clamp-2">
                  {hoveredSource.title}
                </div>
              </div>
            </div>
            <div className="mb-2">
              <p className="text-xs text-slate-700 leading-relaxed line-clamp-4">
                {hoveredSource.snippet}
              </p>
            </div>
            <div className="mt-3 pt-3 border-t-2 border-slate-200/60">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-600 font-medium">검색 유사도</span>
                <span className="text-xs font-mono font-bold text-blue-600">
                  {(hoveredSource.score * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

