'use client'

import { MarkdownRenderer } from '@/components/rag/MarkdownRenderer'

interface QuickChatMessageProps {
  content: string
}

/**
 * Quick 페이지용 일반 법률 상담 메시지 컴포넌트
 * 계약서 분석 전용 UI 없이 깔끔한 마크다운 렌더링
 */
export function QuickChatMessage({ content }: QuickChatMessageProps) {
  return (
    <div className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-code:text-blue-600 prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 text-sm leading-relaxed">
      <MarkdownRenderer content={content} />
    </div>
  )
}

