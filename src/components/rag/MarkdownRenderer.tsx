'use client'

import { useMemo } from 'react'

interface MarkdownRendererProps {
  content: string
  className?: string
}

/**
 * 마크다운 텍스트를 HTML로 렌더링
 * 제목, 리스트, 강조, 링크 등을 지원
 */
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const htmlContent = useMemo(() => {
    if (!content) return ''

    let html = content

    // 제목 처리 (#, ##, ###)
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold mt-4 mb-2 text-gray-900">$1</h3>')
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-base font-bold mt-5 mb-3 text-gray-900">$1</h2>')
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-lg font-bold mt-6 mb-4 text-gray-900">$1</h1>')

    // 강조 처리 (**텍스트** -> <strong>)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')

    // 코드 블록 처리 (```코드```)
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 p-4 rounded-lg my-4 overflow-x-auto"><code class="text-sm">$1</code></pre>')
    html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')

    // 링크 처리 [텍스트](URL)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">$1</a>')

    // 리스트 처리 (- 또는 *)
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
        // 제목이나 다른 태그가 아닌 일반 텍스트만 처리
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

    // 인용구 처리 (>)
    html = html.replace(/^>\s+(.*$)/gim, '<blockquote class="border-l-4 border-blue-300 pl-4 my-3 italic text-sm text-gray-600">$1</blockquote>')

    // 수평선 처리 (---)
    html = html.replace(/^---$/gim, '<hr class="my-6 border-gray-300" />')

    // 줄바꿈 처리 개선
    // 이미 처리된 태그는 건너뛰고, 일반 텍스트만 <p> 태그로 감싸기
    const finalLines = html.split('\n')
    const finalProcessed: string[] = []
    let currentParagraph: string[] = []

    for (const line of finalLines) {
      const trimmed = line.trim()
      
      // 이미 태그가 있거나 빈 줄이면 현재 문단 종료
      if (trimmed.match(/^<[h|u|o|l|b|p|d|t|r|s]/) || trimmed === '') {
        if (currentParagraph.length > 0) {
          finalProcessed.push(`<p class="mb-3 leading-relaxed text-sm text-gray-700">${currentParagraph.join(' ')}</p>`)
          currentParagraph = []
        }
        if (trimmed) {
          finalProcessed.push(line)
        }
      } else {
        currentParagraph.push(trimmed)
      }
    }

    // 남은 문단 처리
    if (currentParagraph.length > 0) {
      finalProcessed.push(`<p class="mb-3 leading-relaxed text-sm text-gray-700">${currentParagraph.join(' ')}</p>`)
    }

    html = finalProcessed.join('\n')

    // 근거 ID 처리 [id:123]
    html = html.replace(/\[id:(\d+)\]/g, '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono bg-blue-100 text-blue-700 border border-blue-200">[id:$1]</span>')

    return html
  }, [content])

  return (
    <div
      className={`prose prose-slate max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  )
}

