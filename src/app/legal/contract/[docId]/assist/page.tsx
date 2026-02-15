'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, AlertCircle, ArrowLeft, MessageSquare, FileText, Copy, Phone } from 'lucide-react'
import { ContractChat } from '@/components/contract/ContractChat'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LegalIssue, ContractAnalysisResult } from '@/types/legal'

// 위험도 아이콘
const getSeverityIcon = (severity: 'low' | 'medium' | 'high') => {
  switch (severity) {
    case 'high':
      return '🔴'
    case 'medium':
      return '🟡'
    case 'low':
      return '⚪'
    default:
      return '⚪'
  }
}

// 위험도 라벨
const getSeverityLabel = (severity: 'low' | 'medium' | 'high') => {
  switch (severity) {
    case 'high':
      return '고위험'
    case 'medium':
      return '주의'
    case 'low':
      return '중립'
    default:
      return '중립'
  }
}

export default function ContractAssistPage() {
  const params = useParams()
  const router = useRouter()
  const docId = params.docId as string

  const [loading, setLoading] = useState(true)
  const [analysisResult, setAnalysisResult] = useState<ContractAnalysisResult | null>(null)
  const [selectedIssueId, setSelectedIssueId] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [prefilledQuestion, setPrefilledQuestion] = useState<string | undefined>()
  const [chatLoading, setChatLoading] = useState(false)
  const [messageCount, setMessageCount] = useState(0)

  // 분석 결과 로드
  useEffect(() => {
    const loadAnalysis = async () => {
      if (!docId) return

      setLoading(true)
      setError(null)

      try {
        // DB에서 분석 결과 가져오기 시도
        let dbData: any = null
        try {
          const response = await fetch(`/api/legal/contract-analysis/${docId}`)
          if (response.ok) {
            dbData = await response.json()
          }
        } catch (dbError) {
          console.warn('DB 조회 실패, 로컬 스토리지 확인:', dbError)
        }

        // 로컬 스토리지에서 분석 결과 가져오기
        const storedData = localStorage.getItem(`contract_analysis_${docId}`)
        const localData = storedData ? JSON.parse(storedData) : null
        
        const normalizedData = dbData || localData
        
        if (normalizedData) {
          const validIssues = (normalizedData.issues || []).filter((issue: any) => {
            const name = (issue.name || '').toLowerCase()
            return !name.includes('분석 실패') && 
                   !name.includes('llm 분석') && 
                   !name.includes('비활성화') &&
                   issue.name && 
                   issue.description
          })
          
          const issues: LegalIssue[] = validIssues.map((issue: any, index: number) => {
            const issueName = (issue.name || '').toLowerCase()
            const issueDesc = (issue.description || '').toLowerCase()
            const searchText = `${issueName} ${issueDesc}`

            let category: string = 'other'
            if (searchText.includes('근로시간') || searchText.includes('근무시간') || searchText.includes('휴게')) {
              category = 'working_hours'
            } else if (searchText.includes('보수') || searchText.includes('수당') || searchText.includes('임금') || searchText.includes('퇴직')) {
              category = 'wage'
            } else if (searchText.includes('수습') || searchText.includes('해지') || searchText.includes('해고')) {
              category = 'probation'
            } else if (searchText.includes('스톡옵션')) {
              category = 'stock_option'
            } else if (searchText.includes('ip') || searchText.includes('지적재산') || searchText.includes('저작권')) {
              category = 'ip'
            } else if (searchText.includes('괴롭힘') || searchText.includes('성희롱')) {
              category = 'harassment'
            }

            const clauseMatch = issue.description?.match(/제\s*(\d+)\s*조/)
            const location = {
              clauseNumber: clauseMatch ? clauseMatch[1] : undefined,
              startIndex: issue.start_index ?? issue.startIndex,
              endIndex: issue.end_index ?? issue.endIndex,
            }

            const severity = (issue.severity || 'medium').toLowerCase()
            const metrics = {
              legalRisk: severity === 'high' ? 5 : severity === 'medium' ? 3 : 1,
              ambiguity: severity === 'high' ? 4 : severity === 'medium' ? 2 : 1,
              negotiability: severity === 'high' ? 5 : severity === 'medium' ? 3 : 2,
              priority: (severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low') as 'high' | 'medium' | 'low',
            }

            const relatedRec = (normalizedData.recommendations || []).find((rec: any) => {
              const recTitle = (rec.title || '').toLowerCase()
              return recTitle.includes(issueName) || issueName.includes(recTitle)
            })

            return {
              id: `issue-${index}`,
              category: category as any,
              severity: (issue.severity || 'medium').toLowerCase() as 'low' | 'medium' | 'high',
              summary: issue.name || issue.description?.substring(0, 100) || '문제 조항 발견',
              location,
              metrics,
              originalText: issue.description || issue.name || '',
              suggestedText: issue.suggested_text ?? issue.suggestedText ?? relatedRec?.description,
              rationale: issue.rationale ?? relatedRec?.description,
              legalBasis: Array.isArray(issue.legal_basis) ? issue.legal_basis : [],
              suggestedQuestions: issue.suggested_questions ?? issue.suggestedQuestions ?? relatedRec?.steps ?? [],
            } as LegalIssue
          })

          const contractText = normalizedData.contractText || normalizedData.contract_text || '계약서 텍스트를 불러올 수 없습니다.'

          const result: ContractAnalysisResult = {
            contractText,
            issues,
            summary: normalizedData.summary || '',
            riskScore: normalizedData.risk_score || 0,
            totalIssues: issues.length,
            highRiskCount: issues.filter(i => i.severity === 'high').length,
            mediumRiskCount: issues.filter(i => i.severity === 'medium').length,
            lowRiskCount: issues.filter(i => i.severity === 'low').length,
          }

          setAnalysisResult(result)
        } else {
          setError('분석 결과를 찾을 수 없습니다. 먼저 계약서를 분석해주세요.')
        }
      } catch (err: any) {
        console.error('분석 결과 로드 실패:', err)
        setError(err.message || '분석 결과를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    loadAnalysis()
  }, [docId])

  const handleIssueClick = (issue: LegalIssue) => {
    setSelectedIssueId(issue.id)
    const prefilled = `다음 조항이 왜 위험한지와 현실적으로 어떤 협상 포인트를 잡을 수 있을지 알려줘.\n\n[문제 조항]\n${issue.originalText || issue.summary}`
    setPrefilledQuestion(prefilled)
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-lg font-semibold text-slate-900 mb-2">계약서 분석 결과 로드 중...</p>
        </div>
      </div>
    )
  }

  if (error || !analysisResult) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-red-50/20 to-slate-50">
        <div className="text-center max-w-md px-6">
          <AlertCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 mb-3">분석 결과를 불러올 수 없습니다</h2>
          <p className="text-slate-600 mb-6">{error || '알 수 없는 오류가 발생했습니다.'}</p>
          <Button
            onClick={() => router.push(`/legal/contract/${docId}`)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
          >
            계약서 상세 페이지로 이동
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* 헤더 */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-sm">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={() => router.push(`/legal/contract/${docId}`)}
                className="text-slate-600 hover:text-slate-900"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                계약서 상세로
              </Button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">문서 기반 상담</h1>
                <p className="text-xs text-slate-600">Contract-Aware Talk</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messageCount > 0 && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  {messageCount}개 대화
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 - 2컬럼 레이아웃 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 좌측: 문제 조항 리스트 */}
        <div className="w-full lg:w-1/2 flex-shrink-0 overflow-y-auto bg-white border-r border-slate-200/60">
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-2">문제 조항 리스트</h2>
              <p className="text-sm text-slate-600">
                조항을 클릭하면 우측 상담창에서 해당 조항에 대해 질문할 수 있습니다.
              </p>
            </div>

            {analysisResult.issues.length === 0 ? (
              <Card className="border-2 border-slate-200">
                <CardContent className="p-8 text-center">
                  <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">분석된 문제 조항이 없습니다.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {analysisResult.issues.map((issue) => {
                  const isSelected = selectedIssueId === issue.id
                  return (
                    <Card
                      key={issue.id}
                      className={cn(
                        "border-2 cursor-pointer transition-all hover:shadow-md",
                        isSelected
                          ? "border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg"
                          : "border-slate-200 hover:border-blue-300"
                      )}
                      onClick={() => handleIssueClick(issue)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            <span className="text-2xl">
                              {getSeverityIcon(issue.severity)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold text-slate-500">
                                {getSeverityLabel(issue.severity)}
                              </span>
                              {issue.location.clauseNumber && (
                                <span className="text-xs font-semibold text-blue-600">
                                  제{issue.location.clauseNumber}조
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm font-bold text-slate-900 mb-1 line-clamp-2">
                              {issue.summary}
                            </h3>
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {issue.originalText.substring(0, 100)}
                              {issue.originalText.length > 100 ? '...' : ''}
                            </p>
                            {issue.suggestedText && (
                              <div className="mt-2 pt-2 border-t border-slate-200">
                                <p className="text-xs text-emerald-700 font-medium">
                                  💡 수정 제안: {issue.suggestedText.substring(0, 80)}
                                  {issue.suggestedText.length > 80 ? '...' : ''}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 우측: 상담 챗봇 */}
        <div className="w-full lg:w-1/2 flex-shrink-0 overflow-hidden bg-white">
          <div className="h-full flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-2">AI 법률 상담</h2>
              <p className="text-sm text-slate-600">
                문제 조항에 대해 구체적으로 질문하시면 이해하기 쉽게 설명해드립니다.
              </p>
            </div>
            <div className="flex-1 overflow-hidden">
              <ContractChat
                docId={docId}
                analysisResult={analysisResult}
                selectedIssueId={selectedIssueId}
                prefilledQuestion={prefilledQuestion}
                onQuestionPrefilled={() => setPrefilledQuestion(undefined)}
                onLoadingChange={setChatLoading}
                onMessageCountChange={setMessageCount}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

