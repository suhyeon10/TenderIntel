'use client'

import { useState } from 'react'
import { Copy, X, Sparkles, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { rewriteClauseV2 } from '@/apis/legal.service'
import type { LegalIssue, LegalBasisItem } from '@/types/legal'
import { cn } from '@/lib/utils'

interface AmendmentModalProps {
  issue: LegalIssue
  isOpen: boolean
  onClose: () => void
}

// 카테고리별 제목 생성
const getCategoryTitle = (category: string, summary: string): string => {
  const categoryLabels: Record<string, string> = {
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
    other: '위험한',
  }
  const label = categoryLabels[category] || '위험한'
  return `${label} 조항, 이렇게 고쳐보세요`
}

// 위험 키워드 추출 (간단한 추출 로직)
const extractRiskKeywords = (rationale: string, summary: string): string[] => {
  const keywords: string[] = []
  const text = `${rationale} ${summary}`.toLowerCase()
  
  if (text.includes('위약') || text.includes('위약금') || text.includes('위약벌')) {
    keywords.push('위약금 수준')
  }
  if (text.includes('손해') && text.includes('입증')) {
    keywords.push('손해 입증 책임')
  }
  if (text.includes('과도') || text.includes('3배') || text.includes('배상')) {
    keywords.push('과도한 배상')
  }
  if (text.includes('무조건') || text.includes('일방')) {
    keywords.push('일방적 불리')
  }
  if (text.includes('연차') || text.includes('휴가')) {
    keywords.push('연차 부여 의무')
  }
  if (text.includes('임금') || text.includes('수당')) {
    keywords.push('임금 구성')
  }
  
  return keywords.length > 0 ? keywords : ['법적 위험']
}

export function AmendmentModal({ issue, isOpen, onClose }: AmendmentModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [rewritten, setRewritten] = useState<any>(null)
  
  if (!isOpen) return null

  const handleCopy = async (text: string, description?: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: '복사 완료',
        description: description || '클립보드에 복사되었습니다.',
      })
    } catch (error) {
      toast({
        title: '복사 실패',
        description: '클립보드에 복사할 수 없습니다.',
        variant: 'destructive',
      })
    }
  }

  // 전문가 상담용 설명문 생성
  const generateConsultationText = (): string => {
    const parts: string[] = []
    
    if (issue.summary) {
      parts.push(`[문제 조항 요약]\n${issue.summary}`)
    }
    
    if (issue.originalText) {
      parts.push(`\n[현재 계약서 문구]\n${issue.originalText}`)
    }
    
    if (issue.rationale) {
      parts.push(`\n[위험 분석]\n${issue.rationale}`)
    }
    
    if (issue.legalBasis && issue.legalBasis.length > 0) {
      const legalBasisTexts = issue.legalBasis.map(basis => {
        // 구조화된 형식인지 확인
        if (typeof basis === 'object' && basis !== null && 'title' in basis) {
          const basisItem = basis as LegalBasisItem;
          return `${basisItem.title}${basisItem.snippet ? `: ${basisItem.snippet.substring(0, 100)}...` : ''}`;
        } else {
          return typeof basis === 'string' ? basis : JSON.stringify(basis);
        }
      });
      parts.push(`\n[관련 법령]\n${legalBasisTexts.join('\n')}`)
    }
    
    parts.push('\n이 조항이 법적으로 적절한지 검토 부탁드립니다.')
    
    return parts.join('\n\n')
  }

  const handleRewrite = async () => {
    if (!issue.originalText) return
    
    setLoading(true)
    try {
      // legalBasis가 LegalBasisItem[]인 경우 string[]로 변환
      const legalBasisArray = Array.isArray(issue.legalBasis) 
        ? issue.legalBasis.map(item => 
            typeof item === 'string' ? item : item.title || item.snippet || ''
          )
        : []
      
      const result = await rewriteClauseV2(
        issue.id, 
        issue.originalText, 
        issue.id,
        legalBasisArray
      )
      setRewritten(result)
      toast({
        title: '심화 수정안 생성 완료',
        description: 'AI가 상황에 맞춘 상세한 수정안을 생성했습니다.',
      })
    } catch (error: any) {
      console.error('리라이트 실패:', error)
      toast({
        variant: 'destructive',
        title: '심화 수정안 생성 실패',
        description: error.message || '조항 수정안을 생성하는 중 오류가 발생했습니다.',
      })
    } finally {
      setLoading(false)
    }
  }

  // 조항 제목 제거 헬퍼
  const removeClauseTitle = (text: string): string => {
    if (!text) return text
    return text
      .replace(/^\d+\.\s*[^\n]+\n?/gm, '')
      .replace(/^제\s*\d+\s*조[^\n]*\n?/gm, '')
      .trim() || text
  }

  const riskKeywords = extractRiskKeywords(issue.rationale || '', issue.summary || '')
  const modalTitle = getCategoryTitle(issue.category, issue.summary || '')
  const consultationText = generateConsultationText()

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* 헤더 */}
        <div className="sticky top-0 bg-gradient-to-r from-white to-slate-50 border-b border-slate-200 p-5 flex items-start justify-between z-10">
          <div className="flex-1">
            <h3 className="text-xl font-extrabold text-slate-900 mb-2">
              {modalTitle}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {issue.rationale || issue.summary || '이 조항은 법적으로 위험할 수 있습니다. 아래 수정안을 참고해 협상해 보세요.'}
            </p>
            {/* 위험 키워드 태그 */}
            {riskKeywords.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {riskKeywords.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full border border-amber-300"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors ml-4"
            aria-label="닫기"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6 space-y-6">
          {/* 1. 현재 계약서 문구 */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              현재 계약서 문구
            </h4>
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <p className="text-sm text-slate-900 whitespace-pre-wrap leading-relaxed font-medium">
                {issue.originalText || '조항 내용이 없습니다.'}
              </p>
            </div>
          </div>

          {/* 2. 위험 분석 & 법적 근거 */}
          <div className="space-y-4">
            {/* 위험 분석 */}
            {issue.rationale && (
              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3">이 조항이 위험한 이유</h4>
                <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {issue.rationale}
                  </p>
                </div>
              </div>
            )}

            {/* 법적 근거 */}
            {issue.legalBasis && issue.legalBasis.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3">관련 법·가이드 (요약)</h4>
                <div className="space-y-2">
                  {issue.legalBasis.slice(0, 3).map((basis, idx) => {
                    // 구조화된 형식인지 확인
                    const isStructured = typeof basis === 'object' && basis !== null && 'title' in basis;
                    
                    if (isStructured) {
                      const basisItem = basis as LegalBasisItem;
                      return (
                        <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-800">
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
                                  className="text-xs text-blue-700 hover:text-blue-800 hover:underline"
                                  title="파일 열기"
                                >
                                  열기
                                </a>
                              )}
                            </div>
                          </div>
                          <p className="font-semibold text-slate-800 mb-1">{basisItem.title}</p>
                          <p className="text-sm text-slate-700 leading-relaxed">{basisItem.snippet}</p>
                          {basisItem.reason && (
                            <p className="text-xs text-slate-600 mt-2 italic">💡 {basisItem.reason}</p>
                          )}
                        </div>
                      );
                    } else {
                      // 단순 문자열 형식 (레거시 호환)
                      const basisText = typeof basis === 'string' ? basis : JSON.stringify(basis);
                      return (
                        <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-slate-700 leading-relaxed">{basisText}</p>
                        </div>
                      );
                    }
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3. 빠른 수정안 */}
          {issue.suggestedText && (
            <div className="pt-4 border-t-2 border-slate-200">
              <div className="mb-4">
                <h4 className="text-base font-extrabold text-slate-900 mb-1">빠른 수정안 (미리 생성된 기본 예시)</h4>
                <p className="text-xs text-slate-600">
                  바로 복사해서 계약서에 제안할 수 있는 수정안입니다.
                </p>
              </div>
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-300 rounded-lg p-5 shadow-sm">
                <p className="text-sm text-slate-900 whitespace-pre-wrap leading-relaxed font-medium mb-4">
                  {removeClauseTitle(issue.suggestedText)}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(removeClauseTitle(issue.suggestedText!), '수정안 전체가 클립보드에 복사되었습니다.')}
                  className="border-emerald-400 hover:bg-emerald-100 text-emerald-700 font-semibold"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  수정안 전체 복사
                </Button>
              </div>
            </div>
          )}

          {/* 4. AI 심화 수정안 */}
          <div className="pt-4 border-t-2 border-slate-200">
            <div className="mb-4">
              <h4 className="text-base font-extrabold text-slate-900 mb-2">심화 수정안 (AI 재작성)</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                내 상황(연봉, 계약기간, 프리랜서/근로자 여부 등)에 맞춘 보다 상세한 수정안과 협상용 설명이 필요하다면, 아래 버튼을 눌러 AI 재작성을 요청할 수 있습니다.
                <span className="font-medium text-amber-600"> 조금 시간이 걸릴 수 있어요.</span>
              </p>
            </div>

            {!rewritten ? (
              <Button
                onClick={handleRewrite}
                disabled={loading || !issue.originalText}
                className="w-full h-12 text-base font-semibold"
                size="lg"
                variant="outline"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    AI가 이 조항의 위험도와 법적 근거를 분석하고 있어요...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    AI에게 상황 반영해서 다시 써 달라고 하기
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-4">
                {/* AI가 제안한 심화 수정안 */}
                <div>
                  <h5 className="text-sm font-bold text-green-700 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    AI가 제안한 심화 수정안
                  </h5>
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-5 shadow-sm">
                    <p className="text-sm text-slate-900 whitespace-pre-wrap leading-relaxed font-medium mb-4">
                      {removeClauseTitle(rewritten.rewrittenText || '')}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(removeClauseTitle(rewritten.rewrittenText || ''), '심화 수정안이 클립보드에 복사되었습니다.')}
                      className="border-green-400 hover:bg-green-100 text-green-700 font-semibold"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      수정안 전체 복사
                    </Button>
                  </div>
                </div>

                {/* 협상용 설명 */}
                {rewritten.explanation && (
                  <div>
                    <h5 className="text-sm font-bold text-slate-700 mb-3">이렇게 설명하면서 협상해 보세요</h5>
                    <div className="bg-slate-50 border-2 border-slate-200 rounded-lg p-4">
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {typeof rewritten.explanation === 'string' 
                          ? rewritten.explanation 
                          : Array.isArray(rewritten.explanation)
                            ? rewritten.explanation.join('\n')
                            : String(rewritten.explanation)}
                      </p>
                    </div>
                  </div>
                )}

                {/* 추가 법적 근거 */}
                {rewritten.legalBasis && rewritten.legalBasis.length > 0 && (
                  <div>
                    <h5 className="text-sm font-bold text-slate-700 mb-3">추가 법적 근거</h5>
                    <div className="space-y-2">
                      {rewritten.legalBasis.map((basis: string, idx: number) => (
                        <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-slate-700 leading-relaxed">{basis}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5. 전문가 상담용 문구 */}
          <div className="pt-4 border-t-2 border-slate-200">
            <div className="mb-3">
              <h4 className="text-sm font-bold text-slate-700 mb-1">전문가에게 보낼 설명문</h4>
              <p className="text-xs text-slate-500">
                아래 문구를 복사해서 노무사·변호사 상담 시 그대로 붙여넣을 수 있습니다.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => handleCopy(consultationText, '상담용 설명문이 클립보드에 복사되었습니다.')}
              className="w-full border-slate-300 hover:bg-slate-100"
            >
              <Copy className="w-4 h-4 mr-2" />
              상담용 설명문 복사
            </Button>
          </div>

          {/* 디스클레이머 */}
          <div className="pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500 leading-relaxed text-center">
              ※ 본 서비스는 법률 자문이 아닌 정보 제공용입니다. 실제 분쟁 가능성이 있거나 금액이 크다면, 반드시 노무사·변호사 등 전문가와 추가로 상담하세요.
            </p>
          </div>

          {/* 닫기 버튼 */}
          <div className="pt-2">
            <Button
              onClick={onClose}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              size="lg"
            >
              닫기
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
