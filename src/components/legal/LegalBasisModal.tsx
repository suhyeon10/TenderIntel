'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { X, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'

/**
 * 법적 근거 항목 (모달 내부에서 사용)
 */
export interface LegalBasisDetail {
  docId: string
  docTitle: string
  docType: 'law' | 'manual' | 'case' | 'standard_contract'
  chunkIndex?: number
  article?: string // 조항 제목 (예: "제7조(임금지급시기)")
  snippet: string // 원문 청크
  snippetHighlight?: string // 강조할 부분
  reason?: string // 이 청크를 근거로 쓴 이유
  explanation?: string // 적용 이유 상세 설명
  similarityScore?: number
  fileUrl?: string
  externalId?: string // 파일 ID
}

/**
 * 법적 근거 모달 Props
 */
interface LegalBasisModalProps {
  isOpen: boolean
  onClose: () => void
  issueTitle: string // 예: "임금 지급 기준"
  issueStatus: 'likely' | 'unclear' | 'unlikely' // 'compliant' | 'insufficient' | 'unclear'로 매핑 가능
  detailSummary?: string // 현재 상황에 대한 요약
  legalEvaluation?: string // 법적 평가
  legalBasis: LegalBasisDetail[] // 법적 근거 리스트
}

/**
 * 문서 타입에 따른 라벨 반환
 */
function getDocTypeLabel(docType: string): string {
  const labels: Record<string, string> = {
    law: '법령',
    manual: '매뉴얼',
    case: '판례',
    standard_contract: '표준취업규칙',
  }
  return labels[docType] || docType
}

/**
 * 상태에 따른 라벨 반환
 */
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    likely: '준수',
    unclear: '불명확',
    unlikely: '불충분',
    compliant: '준수',
    insufficient: '불충분',
  }
  return labels[status] || status
}

/**
 * 법적 근거 상세보기 모달
 */
export function LegalBasisModal({
  isOpen,
  onClose,
  issueTitle,
  issueStatus,
  detailSummary,
  legalEvaluation,
  legalBasis,
}: LegalBasisModalProps) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set([0])) // 첫 번째 항목은 기본으로 열림

  const toggleItem = (index: number) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedItems(newExpanded)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-bold text-slate-900">
              {issueTitle} – 법적 근거 상세보기
            </DialogTitle>
            <button
              onClick={onClose}
              className="rounded-sm opacity-70 hover:opacity-100 transition-opacity"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* 요약 블록 */}
          {(detailSummary || legalEvaluation) && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              {detailSummary && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">현재 상황에 대한 요약</h4>
                  <p className="text-sm text-slate-700 leading-relaxed">{detailSummary}</p>
                </div>
              )}
              {legalEvaluation && (
                <div>
                  <h4 className="font-semibold text-slate-900 mb-2">법적 평가</h4>
                  <p className="text-sm text-slate-700 leading-relaxed">{legalEvaluation}</p>
                </div>
              )}
            </div>
          )}

          {/* 법적 근거 리스트 */}
          <div className="space-y-4">
            <h4 className="font-semibold text-slate-900 text-lg">법적 근거</h4>
            {legalBasis.length === 0 ? (
              <p className="text-sm text-slate-500 italic">법적 근거 정보가 없습니다.</p>
            ) : (
              legalBasis.map((basis, index) => {
                const isExpanded = expandedItems.has(index)
                return (
                  <div
                    key={basis.docId + index}
                    className="border border-slate-200 rounded-lg overflow-hidden"
                  >
                    {/* 헤더 (항상 표시) */}
                    <button
                      onClick={() => toggleItem(index)}
                      className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                            [{getDocTypeLabel(basis.docType)}]
                          </span>
                          <span className="font-semibold text-slate-900">{basis.docTitle}</span>
                        </div>
                        {basis.article && (
                          <p className="text-sm text-slate-600">{basis.article}</p>
                        )}
                        {basis.chunkIndex !== undefined && (
                          <p className="text-xs text-slate-500 mt-1">
                            참조 청크 #{basis.chunkIndex}
                            {basis.similarityScore !== undefined && (
                              <span className="ml-2">(유사도 {basis.similarityScore.toFixed(2)})</span>
                            )}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {basis.fileUrl && (
                          <a
                            href={basis.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 hover:bg-slate-200 rounded transition-colors"
                            title="원문 보기"
                          >
                            <ExternalLink className="w-4 h-4 text-slate-600" />
                          </a>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-slate-500" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                    </button>

                    {/* 본문 (접기/펼치기) */}
                    {isExpanded && (
                      <div className="p-4 bg-white space-y-4 border-t border-slate-200">
                        {/* 원문 발췌 */}
                        <div>
                          <h5 className="font-semibold text-slate-900 mb-2 text-sm">원문 발췌</h5>
                          <div className="bg-slate-50 border border-slate-200 rounded p-3">
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                              {basis.snippetHighlight ? (
                                <>
                                  {basis.snippet.split(basis.snippetHighlight)[0]}
                                  <mark className="bg-yellow-200 px-1 rounded">
                                    {basis.snippetHighlight}
                                  </mark>
                                  {basis.snippet.split(basis.snippetHighlight)[1]}
                                </>
                              ) : (
                                basis.snippet
                              )}
                            </p>
                          </div>
                        </div>

                        {/* 조항 요약 */}
                        {basis.article && (
                          <div>
                            <h5 className="font-semibold text-slate-900 mb-2 text-sm">조항 요약</h5>
                            <p className="text-sm text-slate-700 leading-relaxed">
                              이 조항은 {basis.article}에 관한 내용을 규정하고 있습니다.
                            </p>
                          </div>
                        )}

                        {/* 이 청크를 근거로 쓴 이유 */}
                        {(basis.reason || basis.explanation) && (
                          <div>
                            <h5 className="font-semibold text-slate-900 mb-2 text-sm">
                              이 청크를 근거로 쓴 이유
                            </h5>
                            <div className="space-y-2">
                              {basis.reason && (
                                <div>
                                  <p className="text-xs font-medium text-slate-600 mb-1">적용 이유</p>
                                  <p className="text-sm text-slate-700 leading-relaxed">{basis.reason}</p>
                                </div>
                              )}
                              {basis.explanation && (
                                <div>
                                  <p className="text-xs font-medium text-slate-600 mb-1">추가 설명</p>
                                  <p className="text-sm text-slate-700 leading-relaxed">{basis.explanation}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* 피드백 버튼 (하단) */}
          <div className="pt-4 border-t border-slate-200">
            <button className="text-sm text-slate-600 hover:text-slate-900 hover:underline transition-colors">
              이 법적 근거가 실제 상황과 맞지 않나요? 피드백 보내기
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

