'use client'

import React, { useMemo, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { FileText, Download, ChevronRight } from 'lucide-react'

/**
 * RAG 검색 결과 소스 타입
 */
export interface RagSource {
  sourceId: string
  title: string
  snippet: string
  score: number
  fileUrl?: string | null
  sourceType: 'law' | 'standard_contract' | 'manual' | 'case'
  externalId?: string | null
}

interface LegalEvidenceSectionProps {
  sources: RagSource[] | Array<{
    sourceId: string
    title: string
    snippet: string
    score: number
    fileUrl?: string | null
    sourceType?: 'law' | 'standard_contract' | 'manual' | 'case'
    externalId?: string | null
  }>
}

/**
 * 파일명 정제 함수
 * .pdf, .hwp, _게시용, _, + 등의 불필요한 문자를 제거
 */
function cleanTitle(title: string): string {
  return title
    .replace(/\.(pdf|hwp|docx?|xlsx?|pptx?)$/i, '') // 확장자 제거
    .replace(/_게시용/g, '')
    .replace(/\+/g, ' ') // + 기호를 공백으로 치환
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 소스 타입에 따른 배지 정보 반환
 */
function getBadgeInfo(sourceType?: string): {
  label: string
  className: string
} {
  switch (sourceType) {
    case 'law':
      return {
        label: '관련 법령',
        className: 'bg-blue-100 text-blue-800 border-blue-300',
      }
    case 'standard_contract':
      return {
        label: '표준 계약서',
        className: 'bg-green-100 text-green-800 border-green-300',
      }
    case 'manual':
      return {
        label: '업무 매뉴얼',
        className: 'bg-orange-100 text-orange-800 border-orange-300',
      }
    case 'case':
      return {
        label: '판례/사례',
        className: 'bg-purple-100 text-purple-800 border-purple-300',
      }
    default:
      return {
        label: '참고 자료',
        className: 'bg-slate-100 text-slate-800 border-slate-300',
      }
  }
}

/**
 * AI 법률 진단 리포트 - 참고 문헌/근거 자료 섹션
 * 
 * Top 1 근거를 하이라이트 카드로 표시합니다.
 * Drawer는 LegalReportCard 헤더에서 열 수 있습니다.
 */
export function LegalEvidenceSection({ sources }: LegalEvidenceSectionProps) {
  // score 내림차순 정렬 후 Top 1 추출
  const topSource = useMemo(() => {
    if (!sources || sources.length === 0) return null
    const sorted = [...sources].sort((a, b) => b.score - a.score)
    return sorted[0]
  }, [sources])

  // Top 1 근거가 없으면 렌더링하지 않음
  if (!topSource) {
    return null
  }

  const topBadge = getBadgeInfo(topSource.sourceType || 'law')
  const cleanedTitle = cleanTitle(topSource.title)

  return (
    <div className="space-y-3">
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2 mb-2">
        <FileText className="w-5 h-5 text-purple-600" />
        <h3 className="text-lg font-bold text-slate-900">참고 문헌</h3>
      </div>

      {/* Top 1 근거 하이라이트 카드 */}
      <div className="bg-white border-2 border-slate-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-all">
        {/* 헤더: 배지 + 제목 */}
        <div className="flex items-start gap-3 mb-3">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${topBadge.className}`}
          >
            {topBadge.label}
          </span>
          <h4 className="flex-1 font-semibold text-slate-900 text-base leading-tight">
            {cleanedTitle}
          </h4>
        </div>

        {/* 본문: snippet 인용구 스타일 */}
        <div>
          <blockquote className="pl-4 border-l-4 border-slate-300 italic text-slate-700 text-sm leading-relaxed line-clamp-3">
            {topSource.snippet}
          </blockquote>
        </div>
      </div>
    </div>
  )
}

/**
 * 근거 자료 Drawer 컴포넌트
 * LegalReportCard 헤더에서 열 수 있는 우측 슬라이드 패널
 */
export function EvidenceDrawer({ 
  sources, 
  isOpen, 
  onOpenChange 
}: { 
  sources: RagSource[] | Array<{
    sourceId: string
    title: string
    snippet: string
    score: number
    fileUrl?: string | null
    sourceType?: 'law' | 'standard_contract' | 'manual' | 'case'
    externalId?: string | null
  }>
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) {
  // 전체 소스 정렬 (score 내림차순)
  const sortedSources = useMemo(() => {
    if (!sources || sources.length === 0) return []
    return [...sources].sort((a, b) => b.score - a.score)
  }, [sources])

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span>🔍</span>
            <span>분석 근거 자료 (총 {sources.length}건)</span>
          </SheetTitle>
        </SheetHeader>

        {/* 전체 근거 자료 리스트 */}
        <div className="space-y-4">
          {sortedSources.map((source, index) => {
            const badge = getBadgeInfo(source.sourceType || 'law')
            const cleanedTitle = cleanTitle(source.title)
            const scorePercent = Math.round(source.score * 100)
            const hasFileUrl = source.fileUrl && source.fileUrl.trim() !== ''

            return (
              <div
                key={source.sourceId || index}
                className="bg-slate-50 border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                {/* 카드 헤더: 배지 + 제목 + 다운로드 버튼 */}
                <div className="flex items-start gap-2 mb-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  <h5 className="flex-1 font-semibold text-slate-900 text-sm leading-tight">
                    {cleanedTitle}
                  </h5>
                  {/* 우측 상단: 다운로드 버튼 */}
                  {hasFileUrl ? (
                    <a
                      href={source.fileUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-white border border-blue-200 rounded-md hover:bg-blue-50 hover:border-blue-300 transition-colors flex-shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      원본 다운로드
                    </a>
                  ) : (
                    <button
                      disabled
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-400 bg-white border border-gray-200 rounded-md cursor-not-allowed flex-shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      다운로드 불가
                    </button>
                  )}
                </div>

                {/* snippet 전체 내용 (배경색 적용) */}
                <div className="mb-3">
                  <div className="bg-gray-50 p-3 rounded-md">
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {source.snippet}
                    </p>
                  </div>
                </div>

                {/* 하단 정보: 유사도 */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-xs text-slate-500">
                    일치도 <span className="font-semibold text-slate-700">{scorePercent}%</span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}

