'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, Scale, ChevronRight, ExternalLink, BookOpen } from 'lucide-react'
import { RAGHighlightedMarkdown } from '@/components/legal/RAGHighlightedText'
import { EvidenceDrawer } from '@/components/legal/LegalEvidenceSection'
import { LegalBasisModal, type LegalBasisDetail } from '@/components/legal/LegalBasisModal'
import { parseSummary, findSectionByEmoji, removeEmojiFromTitle } from '@/utils/parseSummary'
import type { SituationAnalysisResponse } from '@/types/legal'

interface LegalReportCardProps {
  analysisResult: SituationAnalysisResponse
  onCopy?: (text: string, description: string) => void
}

export function LegalReportCard({ analysisResult, onCopy }: LegalReportCardProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedCriterionIndex, setSelectedCriterionIndex] = useState<number | null>(null)
  const [isSourcesExpanded, setIsSourcesExpanded] = useState(false)
  
  // summary를 섹션별로 파싱
  const summaryText = analysisResult.summary || ''
  const sections = parseSummary(summaryText)
  
  // 디버깅: 파싱된 섹션 확인
  if (summaryText && sections.length === 0) {
    console.warn('[LegalReportCard] summary가 있지만 파싱된 섹션이 없습니다:', summaryText.substring(0, 200))
  }
  
  // 각 섹션 추출 (제목에서 ** 제거)
  const cleanSectionTitle = (title: string) => title.replace(/\*\*/g, '').trim()
  
  // 이모지 추출 헬퍼 함수
  const getEmojiFromTitle = (title: string | undefined, fallback: string): string => {
    if (!title) return fallback
    const firstChar = title.charAt(0)
    const codePoint = firstChar.codePointAt(0) || 0
    // 이모지 유니코드 범위 체크
    if (
      (codePoint >= 0x1F300 && codePoint <= 0x1F9FF) ||
      (codePoint >= 0x2600 && codePoint <= 0x26FF) ||
      (codePoint >= 0x2700 && codePoint <= 0x27BF) ||
      (codePoint >= 0x1F600 && codePoint <= 0x1F64F) ||
      (codePoint >= 0x1F900 && codePoint <= 0x1F9FF)
    ) {
      return firstChar
    }
    return fallback
  }
  
  const situationAnalysisSection = findSectionByEmoji(sections, '📊') || 
                                   sections.find(s => s.title.includes('상황 분석'))
  const legalJudgmentSection = findSectionByEmoji(sections, '⚖️') || 
                               sections.find(s => s.title.includes('법적 판단') || s.title.includes('법적 관점'))
  const scenarioSection = findSectionByEmoji(sections, '🔮') || 
                         sections.find(s => s.title.includes('예상 시나리오') || s.title.includes('시나리오'))
  const warningSection = findSectionByEmoji(sections, '💡') || 
                        sections.find(s => s.title.includes('주의사항') || s.title.includes('주의'))
  
  const situationAnalysisContent = situationAnalysisSection?.content || ''
  const legalJudgmentContent = legalJudgmentSection?.content || ''
  const scenarioContent = scenarioSection?.content || ''
  const warningContent = warningSection?.content || ''
  
  // 디버깅: 각 섹션 내용 확인
  if (summaryText) {
    console.log('[LegalReportCard] 파싱 결과:', {
      summaryLength: summaryText.length,
      sectionsCount: sections.length,
      situationAnalysis: !!situationAnalysisContent,
      legalJudgment: !!legalJudgmentContent,
      scenario: !!scenarioContent,
      warning: !!warningContent,
    })
  }

  // 근거 자료 변환 (중복 제거 없이 모든 항목 표시)
  const evidenceSources = analysisResult.sources?.map((source) => ({
    sourceId: source.sourceId,
    title: source.title,
    snippet: source.snippet,
    snippetAnalyzed: source.snippetAnalyzed,  // 분석된 결과 포함
    score: source.score,
    fileUrl: source.fileUrl || null,
    sourceType: (source.sourceType || 'law') as 'law' | 'standard_contract' | 'manual' | 'case',
    externalId: source.externalId || null,
  })) || []

  /**
   * SourceItem을 LegalBasisDetail로 변환
   */
  const convertSourcesToLegalBasis = (sources: typeof evidenceSources): LegalBasisDetail[] => {
    return sources.map((source) => ({
      docId: source.sourceId,
      docTitle: source.title,
      docType: source.sourceType,
      snippet: source.snippet,
      similarityScore: source.score,
      fileUrl: source.fileUrl || undefined,
      externalId: source.externalId || undefined,
    }))
  }

  /**
   * 각 finding에 대한 legalBasis 가져오기
   * finding의 source를 LegalBasisDetail 형식으로 변환
   */
  const getLegalBasisForFinding = (findingIndex: number): LegalBasisDetail[] => {
    const finding = analysisResult.findings?.[findingIndex]
    if (!finding || !finding.source) {
      return []
    }
    
    const source = finding.source
    return [{
      docId: '',
      docTitle: source.documentTitle || '',
      docType: (source.sourceType || 'law') as 'law' | 'manual' | 'case' | 'standard_contract',
      chunkIndex: undefined,
      article: undefined,
      snippet: source.refinedSnippet || '',
      snippetHighlight: undefined,
      reason: finding.basisText || '',
      explanation: undefined,
      similarityScore: source.similarityScore || 0,
      fileUrl: source.fileUrl,
      externalId: undefined,
    }]
  }

  return (
    <Card className="border border-gray-100 shadow-lg bg-white">
      <CardHeader className="pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <span>AI 법률 진단 리포트</span>
          </CardTitle>
          {/* 헤더 우측: 근거 자료 전체 보기 버튼 */}
          {evidenceSources.length > 0 && (
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="text-sm text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 transition-colors"
            >
              <span>근거 자료 전체 보기 ({evidenceSources.length}건)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </CardHeader>
      
       <CardContent className="p-6 space-y-3">
         {/* 섹션 1: 상황 분석 */}
         {situationAnalysisContent && (
           <div className="group relative rounded-lg border border-blue-200/60 bg-blue-50/30 p-4 transition-all hover:border-blue-300 hover:bg-blue-50/50">
             <div className="flex items-start gap-3">
               <div className="flex-shrink-0 pt-0.5">
                 <span className="text-xl">{getEmojiFromTitle(situationAnalysisSection?.title, '📊')}</span>
               </div>
               <div className="flex-1 min-w-0">
                 <h3 className="text-base font-semibold text-slate-900 mb-2">
                   {situationAnalysisSection ? removeEmojiFromTitle(cleanSectionTitle(situationAnalysisSection.title)) : '상황 분석'}
                 </h3>
                 <div className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-700">
                   <RAGHighlightedMarkdown 
                     content={situationAnalysisContent}
                     sources={analysisResult.sources || []}
                   />
                 </div>
               </div>
             </div>
           </div>
         )}

         {/* 섹션 2: 법적 판단 */}
         {legalJudgmentContent && (() => {
           // 기본값 텍스트 필터링
           const isDefaultText = legalJudgmentContent === '해당 섹션 내용을 확인하는 중입니다.' || 
                                 legalJudgmentContent === '관련 법령을 확인하여 현재 상황을 법적으로 평가해야 합니다.'
           
           if (isDefaultText) return null
           
           // 법적 판단 결론 배지 결정 로직
           const getJudgmentBadge = () => {
             // findings의 statusLabel 확인
             if (analysisResult.findings && analysisResult.findings.length > 0) {
               const firstFinding = analysisResult.findings[0]
               const statusLabel = firstFinding.statusLabel || ''
               
               if (statusLabel.includes('충족') || statusLabel.includes('해당') || statusLabel.includes('위반')) {
                 return {
                   text: '위반 소지 높음',
                   color: 'bg-red-500 text-white border-red-600',
                   icon: '🚨'
                 }
               } else if (statusLabel.includes('부분') || statusLabel.includes('추가') || statusLabel.includes('주의')) {
                 return {
                   text: '주의 필요',
                   color: 'bg-amber-500 text-white border-amber-600',
                   icon: '⚠️'
                 }
               }
             }
             
             // 텍스트에서 키워드 확인
             const contentLower = legalJudgmentContent.toLowerCase()
             if (contentLower.includes('위반') || contentLower.includes('부당') || contentLower.includes('불법')) {
               return {
                 text: '위반 소지 높음',
                 color: 'bg-red-500 text-white border-red-600',
                 icon: '🚨'
               }
             } else if (contentLower.includes('주의') || contentLower.includes('검토') || contentLower.includes('확인')) {
               return {
                 text: '주의 필요',
                 color: 'bg-amber-500 text-white border-amber-600',
                 icon: '⚠️'
               }
             }
             
             return null
           }
           
           const judgmentBadge = getJudgmentBadge()
           
           return (
             <div className="group relative rounded-lg border border-amber-200/60 bg-amber-50/30 p-4 transition-all hover:border-amber-300 hover:bg-amber-50/50">
               <div className="flex items-start gap-3">
                 <div className="flex-shrink-0 pt-0.5">
                   <span className="text-xl">{getEmojiFromTitle(legalJudgmentSection?.title, '⚖️')}</span>
                 </div>
                 <div className="flex-1 min-w-0">
                   <div className="flex items-center justify-between mb-2">
                     <h3 className="text-base font-semibold text-slate-900">
                       {legalJudgmentSection ? removeEmojiFromTitle(cleanSectionTitle(legalJudgmentSection.title)) : '법적 판단'}
                     </h3>
                     {judgmentBadge && (
                       <span className={`px-3 py-1 rounded-lg text-xs font-bold border shadow-sm flex items-center gap-1.5 flex-shrink-0 ${judgmentBadge.color}`}>
                         <span>{judgmentBadge.icon}</span>
                         <span>{judgmentBadge.text}</span>
                       </span>
                     )}
                   </div>
                   <div className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-700">
                     <RAGHighlightedMarkdown 
                       content={legalJudgmentContent}
                       sources={analysisResult.sources || []}
                     />
                   </div>
                 </div>
               </div>
             </div>
           )
         })()}

         {/* 섹션 3: 예상 시나리오 */}
         {scenarioContent && (
           <div className="group relative rounded-lg border border-purple-200/60 bg-purple-50/30 p-4 transition-all hover:border-purple-300 hover:bg-purple-50/50">
             <div className="flex items-start gap-3">
               <div className="flex-shrink-0 pt-0.5">
                 <span className="text-xl">{getEmojiFromTitle(scenarioSection?.title, '🔮')}</span>
               </div>
               <div className="flex-1 min-w-0">
                 <h3 className="text-base font-semibold text-slate-900 mb-2">
                   {scenarioSection ? removeEmojiFromTitle(cleanSectionTitle(scenarioSection.title)) : '예상 시나리오'}
                 </h3>
                 <div className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-700">
                   <RAGHighlightedMarkdown 
                     content={scenarioContent}
                     sources={analysisResult.sources || []}
                   />
                 </div>
               </div>
             </div>
           </div>
         )}

         {/* 섹션 4: 주의사항 */}
         {warningContent && (
           <div className="group relative rounded-lg border border-red-200/60 bg-red-50/30 p-4 transition-all hover:border-red-300 hover:bg-red-50/50">
             <div className="flex items-start gap-3">
               <div className="flex-shrink-0 pt-0.5">
                 <span className="text-xl">{getEmojiFromTitle(warningSection?.title, '💡')}</span>
               </div>
               <div className="flex-1 min-w-0">
                 <h3 className="text-base font-semibold text-slate-900 mb-2">
                   {warningSection ? removeEmojiFromTitle(cleanSectionTitle(warningSection.title)) : '주의사항'}
                 </h3>
                 <div className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-700">
                   <RAGHighlightedMarkdown 
                     content={warningContent}
                     sources={analysisResult.sources || []}
                   />
                 </div>
               </div>
             </div>
           </div>
         )}

        {/* 섹션 5: 법적 판단 기준 (findings API 형식) */}
        {(() => {
          // 디버깅: findings 데이터 확인
          console.log('[LegalReportCard] findings 확인:', {
            'analysisResult.findings': analysisResult.findings,
            'findings 존재': !!analysisResult.findings,
            'findings.length': analysisResult.findings?.length,
            '조건 만족': analysisResult.findings && analysisResult.findings.length > 0
          })
          
          if (!analysisResult.findings || analysisResult.findings.length === 0) {
            return null
          }
          
          const findings = analysisResult.findings
          
          // sourceType에 따른 라벨 및 아이콘
          const getSourceTypeLabel = (type: string) => {
            switch (type) {
              case 'standard_contract':
                return '표준 계약서'
              case 'statute':
                return '법령'
              case 'guideline':
              case 'manual':
                return '가이드라인'
              case 'case':
                return '판례'
              case 'law':
                return '법령'
              default:
                return type
            }
          }
          
          const getSourceTypeColor = (type: string) => {
            switch (type) {
              case 'standard_contract':
                return 'bg-blue-100 text-blue-800 border-blue-300'
              case 'statute':
              case 'law':
                return 'bg-purple-100 text-purple-800 border-purple-300'
              case 'guideline':
              case 'manual':
                return 'bg-green-100 text-green-800 border-green-300'
              case 'case':
                return 'bg-orange-100 text-orange-800 border-orange-300'
              default:
                return 'bg-slate-100 text-slate-800 border-slate-300'
            }
          }
          
          const getStatusLabelColor = (statusLabel: string) => {
            if (statusLabel.includes('충족') || statusLabel.includes('해당')) {
              return 'bg-red-100 text-red-800 border-red-300'
            } else if (statusLabel.includes('부분') || statusLabel.includes('추가')) {
              return 'bg-yellow-100 text-yellow-800 border-yellow-300'
            } else {
              return 'bg-slate-100 text-slate-800 border-slate-300'
            }
          }
          
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Scale className="w-5 h-5 text-amber-600" />
                <h3 className="text-lg font-bold text-slate-900">법적 판단 기준</h3>
              </div>
              <div className="space-y-3">
                {findings.map((finding: any, idx: number) => {
                    const source = finding.source || {}
                    const documentTitle = source.documentTitle || '문서 제목 없음'
                    const fileUrl = source.fileUrl || null
                    const sourceType = source.sourceType || 'law'
                    const similarityScore = source.similarityScore || 0
                    const refinedSnippet = source.refinedSnippet || ''
                    const title = finding.title || ''
                    const statusLabel = finding.statusLabel || ''
                    const basisText = finding.basisText || ''
                    
                    return (
                      <div key={finding.id || idx} className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-start gap-3">
                          {/* 번호 뱃지 */}
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-600 text-white font-bold text-sm flex items-center justify-center">
                            {idx + 1}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            {/* 쟁점 제목 + 상태 라벨 */}
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h4 className="font-semibold text-slate-900 flex-1 min-w-0 break-words">
                                {title}
                              </h4>
                              {statusLabel && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${getStatusLabelColor(statusLabel)}`}>
                                  {statusLabel}
                                </span>
                              )}
                            </div>
                            
                            {/* 근거 설명 (basisText) */}
                            {basisText && basisText.trim() ? (
                              <div className="mb-3">
                                <p className="text-xs font-semibold text-slate-600 mb-1">판단 근거:</p>
                                <p className="text-sm text-slate-700 leading-relaxed">
                                  {basisText}
                                </p>
                              </div>
                            ) : null}
                            
                            {/* 참고 문서 정보 */}
                            <div className="mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-xs font-semibold text-slate-600">참고 문서:</p>
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${getSourceTypeColor(sourceType)}`}>
                                    {getSourceTypeLabel(sourceType)}
                                  </span>
                                  {similarityScore > 0 && (
                                    <span className="text-xs text-slate-500 flex-shrink-0">
                                      유사도: {(similarityScore * 100).toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                                {/* 문서보기 버튼 */}
                                {fileUrl && fileUrl.trim() && (
                                  <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all hover:shadow-md flex-shrink-0"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>문서보기</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                              <p className="text-sm font-medium text-slate-900 mb-2">{documentTitle}</p>
                              
                              {/* 관련 조항 (refinedSnippet) */}
                              {refinedSnippet && refinedSnippet.trim() ? (
                                <div className="mt-2 pt-2 border-t border-slate-200">
                                  <p className="text-xs font-semibold text-slate-600 mb-1">관련 조항:</p>
                                  <p className="text-sm text-slate-700 leading-relaxed">
                                    {refinedSnippet}
                                  </p>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
              <hr className="border-gray-200" />
            </div>
          )
        })()}

        {/* 섹션 6: 참고 문헌 및 관련 사례 */}
        {((analysisResult.relatedCases && analysisResult.relatedCases.length > 0) || evidenceSources.length > 0) && (
          <div className="space-y-4">
            {(() => {
              return null
            })()}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-bold text-slate-900">참고 문헌 및 관련 사례</h3>
              </div>
              {evidenceSources.length > 0 && (
                <button
                  onClick={() => setIsSourcesExpanded(!isSourcesExpanded)}
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 transition-colors"
                >
                  <span>출처 문서 더보기</span>
                  <ChevronRight className={`w-4 h-4 transition-transform ${isSourcesExpanded ? 'rotate-90' : ''}`} />
                </button>
              )}
            </div>

            {/* 대표 근거 케이스 3개 (1*3 그리드) */}
            {analysisResult.relatedCases && analysisResult.relatedCases.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {analysisResult.relatedCases.slice(0, 3).map((relatedCase, idx) => {
                  return (
                    <div key={idx} className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-purple-600 text-white text-xs font-semibold rounded">
                          대표 근거 케이스
                        </span>
                        {relatedCase.overallSimilarity > 0 && (
                          <span className="text-xs text-purple-600">
                            관련도: {(relatedCase.overallSimilarity * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <h4 className="font-semibold text-slate-900 mb-2 text-sm line-clamp-2">{relatedCase.documentTitle}</h4>
                      
                      {/* summary 표시 */}
                      <p className="text-xs text-slate-700 mb-3 line-clamp-2">{relatedCase.summary}</p>
                      
                      {/* snippets 표시 */}
                      {relatedCase.snippets && relatedCase.snippets.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {relatedCase.snippets.slice(0, 2).map((snippet: any, snippetIdx: number) => (
                            <div key={snippetIdx} className="bg-white rounded p-2 border border-purple-100">
                              <p className="text-xs text-slate-600 mb-1 line-clamp-2">{snippet.snippet}</p>
                              {snippet.usageReason && (
                                <p className="text-xs text-purple-600 italic">{snippet.usageReason}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {relatedCase.fileUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => relatedCase.fileUrl && window.open(relatedCase.fileUrl, '_blank')}
                          className="w-full text-xs"
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          문서 보기
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* sources 리스트 (토글로 표시) */}
            {evidenceSources.length > 0 && isSourcesExpanded && (
              <div className="space-y-3 mt-4">
                <h4 className="font-semibold text-slate-900 mb-3">관련 법령 및 가이드라인</h4>
                {evidenceSources.map((source, idx) => {
                  const sourceTypeLabels = {
                    law: '법령',
                    manual: '매뉴얼',
                    standard_contract: '표준계약서',
                    case: '사례',
                  }
                  const sourceTypeColors = {
                    law: 'bg-blue-100 text-blue-800 border-blue-300',
                    manual: 'bg-green-100 text-green-800 border-green-300',
                    standard_contract: 'bg-orange-100 text-orange-800 border-orange-300',
                    case: 'bg-purple-100 text-purple-800 border-purple-300',
                  }
                  
                  return (
                    <div key={idx} className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold border ${sourceTypeColors[source.sourceType] || sourceTypeColors.law}`}>
                          {sourceTypeLabels[source.sourceType] || '법령'}
                        </span>
                        <div className="flex-1">
                          <h5 className="font-semibold text-slate-900 mb-1">{source.title}</h5>
                          
                          {/* 분석된 결과가 있으면 표시, 없으면 원본 snippet */}
                          {source.snippetAnalyzed ? (
                            <div className="space-y-2 mb-2">
                              {source.snippetAnalyzed.core_clause && (
                                <div className="text-xs font-semibold text-blue-700">
                                  📌 {source.snippetAnalyzed.core_clause}
                                </div>
                              )}
                              <p className="text-sm text-slate-700 leading-relaxed">
                                {source.snippetAnalyzed.easy_summary}
                              </p>
                              {source.snippetAnalyzed.action_tip && (
                                <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                                  💡 {source.snippetAnalyzed.action_tip}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-600 line-clamp-2 mb-2">{source.snippet}</p>
                          )}
                          
                          {source.fileUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => source.fileUrl && window.open(source.fileUrl, '_blank')}
                              className="h-7 text-xs"
                            >
                              <ExternalLink className="w-3 h-3 mr-1" />
                              문서 보기
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 하단 안내 */}
        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs text-slate-500 italic">
            ⚠️ 실제 법률 자문이 아닌, 공개된 가이드와 사례를 바탕으로 한 1차 정보입니다.
          </p>
        </div>
      </CardContent>

      {/* 근거 자료 Drawer */}
      {evidenceSources.length > 0 && (
        <EvidenceDrawer
          sources={evidenceSources}
          isOpen={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
        />
      )}

      {/* 법적 근거 모달 */}
      {selectedCriterionIndex !== null && analysisResult.findings && analysisResult.findings[selectedCriterionIndex] && (() => {
        const finding = analysisResult.findings![selectedCriterionIndex]
        // statusLabel을 issueStatus 타입으로 변환
        const statusLabel = finding.statusLabel || ''
        let issueStatus: 'likely' | 'unclear' | 'unlikely' = 'unclear'
        if (statusLabel.includes('충족') || statusLabel.includes('해당')) {
          issueStatus = 'likely'
        } else if (statusLabel.includes('부분') || statusLabel.includes('추가')) {
          issueStatus = 'unclear'
        } else {
          issueStatus = 'unclear'
        }
        
        return (
          <LegalBasisModal
            isOpen={selectedCriterionIndex !== null}
            onClose={() => setSelectedCriterionIndex(null)}
            issueTitle={finding.title}
            issueStatus={issueStatus}
            detailSummary={finding.basisText}
            legalBasis={getLegalBasisForFinding(selectedCriterionIndex)}
          />
        )
      })()}
    </Card>
  )
}

