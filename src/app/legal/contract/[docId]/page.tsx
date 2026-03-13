'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, AlertCircle, MessageSquare, FileText, X, ChevronDown, Download, ExternalLink } from 'lucide-react'
import { ContractViewer } from '@/components/contract/ContractViewer'
import { AnalysisPanel } from '@/components/contract/AnalysisPanel'
import { ContractChat } from '@/components/contract/ContractChat'
import { ClauseList } from '@/components/contract/ClauseList'
import { cn } from '@/lib/utils'
import type { LegalIssue, ContractAnalysisResult } from '@/types/legal'

export default function ContractDetailPage() {
  const params = useParams()
  const docId = params.docId as string

  const [loading, setLoading] = useState(true)
  const [analysisResult, setAnalysisResult] = useState<ContractAnalysisResult | null>(null)
  const [selectedIssueId, setSelectedIssueId] = useState<string | undefined>()
  const [selectedClauseId, setSelectedClauseId] = useState<string | undefined>()  // ✨ 추가
  const [error, setError] = useState<string | null>(null)
  const [chatIssueId, setChatIssueId] = useState<string | undefined>()
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [prefilledQuestion, setPrefilledQuestion] = useState<string | undefined>()
  const [chatLoading, setChatLoading] = useState(false)
  const [messageCount, setMessageCount] = useState(0)
  const [externalMessage, setExternalMessage] = useState<string>('')
  const [clauses, setClauses] = useState<any[]>([])  // ✨ 추가
  const [highlightedTexts, setHighlightedTexts] = useState<any[]>([])  // ✨ 추가
  // 새로운 독소조항 탐지 필드
  const [oneLineSummary, setOneLineSummary] = useState<string | undefined>()
  const [riskTrafficLight, setRiskTrafficLight] = useState<string | undefined>()
  const [top3ActionPoints, setTop3ActionPoints] = useState<string[]>([])
  const [riskSummaryTable, setRiskSummaryTable] = useState<any[]>([])
  const [toxicClauses, setToxicClauses] = useState<any[]>([])
  const [negotiationQuestions, setNegotiationQuestions] = useState<string[]>([])
  const [retrievedContexts, setRetrievedContexts] = useState<any[]>([])
  const [fileUrl, setFileUrl] = useState<string | null>(null)  // 원본 파일 URL
  /** 추출 메타 (ocr_used, source_type, page_count) - 개발자 확인용 */
  const [extractionMetadata, setExtractionMetadata] = useState<{ ocr_used?: boolean; source_type?: string; page_count?: number | null } | null>(null)
  
  // 스와이프 제스처 상태
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null)
  
  // 스와이프 최소 거리 (px)
  const minSwipeDistance = 50

  // 스크롤 동기화를 위한 ref
  const contractViewerScrollRef = useRef<HTMLDivElement>(null)
  const analysisPanelScrollRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)

  // 분석 결과 로드
  useEffect(() => {
    const loadAnalysis = async () => {
      if (!docId) return

      setLoading(true)
      setError(null)

      try {
        // 임시 ID인 경우 로컬 스토리지만 사용
        const isTempId = docId.startsWith('temp-')
        
        let v2Data: any = null
        let storedData: string | null = null
        let localData: any = null
        
        if (isTempId) {
          console.log('[Frontend] 임시 ID 감지, 로컬 스토리지만 사용:', docId)
          storedData = localStorage.getItem(`contract_analysis_${docId}`)
          localData = storedData ? JSON.parse(storedData) : null
          
          // 상세 로그 출력
          console.log('[Frontend] 로컬 스토리지 원본 데이터:', storedData ? storedData.substring(0, 500) : '(없음)')
          console.log('[Frontend] 로컬 스토리지 파싱된 데이터:', {
            hasData: !!localData,
            hasContractText: !!localData?.contractText,
            hasContract_text: !!localData?.contract_text,
            contractTextLength: localData?.contractText?.length || 0,
            contract_textLength: localData?.contract_text?.length || 0,
            contractTextPreview: localData?.contractText?.substring(0, 100) || '(없음)',
            contract_textPreview: localData?.contract_text?.substring(0, 100) || '(없음)',
            keys: localData ? Object.keys(localData) : [],
            fullData: localData // 전체 데이터도 출력
          })
        } else {
          // v2 API로 분석 결과 가져오기
          const { getContractAnalysisV2 } = await import('@/apis/legal.service')
          
          try {
            v2Data = await getContractAnalysisV2(docId)
            console.log('[Frontend] v2 API에서 분석 결과 조회 성공:', docId)
          } catch (apiError: any) {
            console.warn('[Frontend] v2 API 조회 실패, 로컬 스토리지 확인:', apiError)
            // 404는 정상적인 경우 (DB에 없을 수 있음)
            if (apiError.message?.includes('404')) {
              console.log('[Frontend] 분석 결과를 찾을 수 없음, 로컬 스토리지 확인:', docId)
            }
          }

          // Fallback: 로컬 스토리지에서 분석 결과 가져오기
          storedData = localStorage.getItem(`contract_analysis_${docId}`)
          localData = storedData ? JSON.parse(storedData) : null
        }
        
        // v2 데이터를 로컬 형식으로 변환
        // temp-ID인 경우: 로컬 스토리지만 신뢰
        // uuid인 경우: v2 API 응답을 우선, 로컬 스토리지는 fallback
        const normalizedData = isTempId ? {
          // temp-ID: 로컬 스토리지만 사용
          ...localData,
          contractText: localData?.contractText || localData?.contract_text || '',
          contract_text: localData?.contract_text || localData?.contractText || '',
          issues: localData?.issues || localData?.risks || [],
          risk_score: localData?.risk_score || localData?.riskScore || 0,
          summary: localData?.summary || '',
          // 새로운 독소조항 탐지 필드
          oneLineSummary: localData?.oneLineSummary,
          riskTrafficLight: localData?.riskTrafficLight,
          top3ActionPoints: localData?.top3ActionPoints,
          riskSummaryTable: localData?.riskSummaryTable,
          toxicClauses: localData?.toxicClauses,
          negotiationQuestions: localData?.negotiationQuestions,
          retrievedContexts: localData?.retrievedContexts || localData?.retrieved_contexts || [],
          metadata: localData?.metadata ?? undefined,
        } : (v2Data ? {
          // uuid + v2Data 있음: v2 API 응답 우선 사용
          risk_score: v2Data.riskScore,
          summary: v2Data.summary || '',
          contractText: v2Data.contractText || '',
          contract_text: v2Data.contractText || '', // 호환성을 위해 둘 다 설정
          issues: v2Data.issues || [], // v2 형식의 issues 배열 확실히 포함
          clauses: v2Data.clauses || [], // ✨ 조항 목록
          highlightedTexts: v2Data.highlightedTexts || [], // ✨ 하이라이트된 텍스트
          recommendations: [],
          createdAt: v2Data.createdAt,
          fileUrl: v2Data.fileUrl || null,
          // 새로운 독소조항 탐지 필드
          oneLineSummary: v2Data.oneLineSummary,
          riskTrafficLight: v2Data.riskTrafficLight,
          top3ActionPoints: v2Data.top3ActionPoints,
          riskSummaryTable: v2Data.riskSummaryTable,
          toxicClauses: v2Data.toxicClauses,
          negotiationQuestions: v2Data.negotiationQuestions,
          retrievedContexts: v2Data.retrievedContexts || [],
          metadata: v2Data.metadata ?? undefined,
        } : {
          // uuid + v2Data 없음: 로컬 스토리지 fallback
          ...localData,
          contractText: localData?.contractText || localData?.contract_text || '',
          contract_text: localData?.contract_text || localData?.contractText || '',
          issues: localData?.issues || localData?.risks || [],
          // 새로운 독소조항 탐지 필드
          oneLineSummary: localData?.oneLineSummary,
          riskTrafficLight: localData?.riskTrafficLight,
          top3ActionPoints: localData?.top3ActionPoints,
          riskSummaryTable: localData?.riskSummaryTable,
          toxicClauses: localData?.toxicClauses,
          negotiationQuestions: localData?.negotiationQuestions,
          metadata: localData?.metadata ?? undefined,
        })
        
        if (normalizedData) {
          // 백엔드 응답을 새로운 형식으로 변환
          // v2 형식: issues 배열에 id, category, severity, summary, explanation 등이 있음
          // v1 형식: name, description 필드가 있음
          // "분석 실패" 같은 에러 이슈는 필터링
          const validIssues = (normalizedData.issues || []).filter((issue: any) => {
            // v2 형식: summary 또는 v1 형식: name
            const nameOrSummary = (issue.summary || issue.name || '').toLowerCase()
            // v2 형식: explanation 또는 v1 형식: description
            const descOrExplanation = (issue.explanation || issue.description || '')
            
            // 에러 메시지 필터링
            if (nameOrSummary.includes('분석 실패') || 
                nameOrSummary.includes('llm 분석') || 
                nameOrSummary.includes('비활성화')) {
              return false
            }
            
            // v2 형식: summary가 있으면 유효, v1 형식: name과 description이 모두 있어야 유효
            if (issue.summary) {
              // v2 형식: summary만 있어도 유효
              return true
            } else if (issue.name && issue.description) {
              // v1 형식: name과 description이 모두 있어야 유효
              return true
            }
            
            return false
          })
          
          const issues: LegalIssue[] = validIssues.map((issue: any, index: number) => {
            // v2 API 응답 형식 처리
            // v2: summary, explanation, category, severity, originalText, suggestedRevision, legalBasis
            // v1: name, description, risk_level, clause, related_law
            const issueText = (issue.summary || issue.name || issue.description || '').toLowerCase()
            const issueDesc = (issue.explanation || issue.description || '').toLowerCase()
            const searchText = `${issueText} ${issueDesc}`

            // 카테고리 매핑 (v2의 category 필드 우선 사용)
            let category: string = issue.category || 'other'
            // v2 category는 이미 정규화되어 있을 수 있음 (예: "일자리_괴롭힘_방지_및_보호")
            // 언더스코어를 제거하고 매핑 시도
            const normalizedCategory = category.replace(/_/g, '').toLowerCase()
            if (!category || category === 'other' || normalizedCategory === 'other') {
              // category가 없으면 텍스트 기반으로 추론
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
              } else if (searchText.includes('괴롭힘') || searchText.includes('성희롱') || normalizedCategory.includes('괴롭힘') || normalizedCategory.includes('harassment')) {
                category = 'harassment'
              } else if (normalizedCategory.includes('차등') || normalizedCategory.includes('discrimination')) {
                category = 'harassment' // 차등 금지도 harassment 카테고리로
              } else {
                category = 'other'
              }
            }

            // 위치 정보 추출 (v2에서는 originalText에서 조항 번호 찾기)
            const originalText = issue.originalText || issue.description || issue.summary || ''
            const clauseMatch = originalText.match(/제\s*(\d+)\s*조/)
            const location = {
              clauseNumber: clauseMatch ? clauseMatch[1] : undefined,
              startIndex: issue.start_index ?? issue.startIndex,
              endIndex: issue.end_index ?? issue.endIndex,
            }

            // 메트릭 생성 (severity 기반, v2는 severity, v1은 risk_level)
            const severity = (issue.severity || issue.risk_level || 'medium').toLowerCase() as 'low' | 'medium' | 'high'
            const metrics = {
              legalRisk: severity === 'high' ? 5 : severity === 'medium' ? 3 : 1,
              ambiguity: severity === 'high' ? 4 : severity === 'medium' ? 2 : 1,
              negotiability: severity === 'high' ? 5 : severity === 'medium' ? 3 : 2,
              priority: (severity === 'high' ? 'high' : severity === 'medium' ? 'medium' : 'low') as 'high' | 'medium' | 'low',
            }

            return {
              id: issue.id || `issue-${index + 1}`,
              category: category as any,
              severity: severity,
              summary: issue.summary || issue.name || originalText.substring(0, 100) || '문제 조항 발견',
              location,
              metrics,
              originalText: originalText,
              suggestedText: issue.suggestedRevision || issue.suggested_text || issue.suggestedText || '',
              rationale: issue.explanation || issue.rationale || issue.description || '',
              legalBasis: (() => {
                // legalBasis 추출
                const basis = Array.isArray(issue.legalBasis) ? issue.legalBasis : 
                         (Array.isArray(issue.legal_basis) ? issue.legal_basis : 
                             (Array.isArray(issue.related_law) ? issue.related_law : []));
                
                // JSON 문자열인 경우 파싱
                return basis.map((item: any) => {
                  if (typeof item === 'string') {
                    // JSON 문자열인지 확인
                    if (item.trim().startsWith('{') && item.trim().endsWith('}')) {
                      try {
                        return JSON.parse(item);
                      } catch (e) {
                        // 파싱 실패하면 문자열 그대로 반환
                        return item;
                      }
                    }
                    return item;
                  }
                  return item;
                });
              })(),
              suggestedQuestions: [],
            } as LegalIssue
          })
          
          // 이슈가 없는 경우 처리
          if (issues.length === 0) {
            console.warn('분석된 이슈가 없습니다. 백엔드 응답:', {
              normalizedDataIssues: normalizedData.issues,
              normalizedDataIssuesLength: normalizedData.issues?.length || 0,
              validIssuesLength: validIssues.length,
              v2DataIssues: v2Data?.issues,
              v2DataIssuesLength: v2Data?.issues?.length || 0,
              localDataIssues: localData?.issues,
              localDataRisks: localData?.risks,
              isTempId,
              docId,
            })
          } else {
            console.log(`✅ [Frontend] ${issues.length}개의 이슈를 성공적으로 로드했습니다.`, {
              issues: issues.map(i => ({ id: i.id, category: i.category, severity: i.severity, summary: i.summary.substring(0, 50) })),
            })
          }
          
          // DB 데이터를 로컬 스토리지에 캐싱 (다음 접근 시 빠른 로드)
          // v2Data가 있고 로컬 스토리지에 없으면 캐싱
          if (v2Data && !storedData) {
            localStorage.setItem(`contract_analysis_${docId}`, JSON.stringify(normalizedData))
          }

          // 계약서 텍스트 생성 (백엔드에서 제공된 텍스트 사용)
          // contractText가 비어있으면 경고 로그 출력
          const contractText = normalizedData.contractText || normalizedData.contract_text || ''
          
          console.log('[Frontend] 계약서 텍스트 확인:', {
            contractTextLength: contractText.length,
            contractTextPreview: contractText.substring(0, 100) || '(없음)',
            hasContractText: !!normalizedData.contractText,
            hasContract_text: !!normalizedData.contract_text,
            normalizedDataContractText: normalizedData.contractText?.substring(0, 50) || '(없음)',
            normalizedDataContract_text: normalizedData.contract_text?.substring(0, 50) || '(없음)',
            normalizedDataKeys: Object.keys(normalizedData),
            isTempId,
            v2DataHasContractText: v2Data ? !!v2Data.contractText : false,
            v2DataContractTextLength: v2Data?.contractText?.length || 0,
            localDataHasContractText: localData ? !!(localData.contractText || localData.contract_text) : false,
            localDataContractTextLength: localData ? (localData.contractText || localData.contract_text)?.length || 0 : 0,
            normalizedDataFull: normalizedData // 전체 데이터도 출력
          })
          
          // contractText가 없을 때는 "요약만 표시 모드"로 처리 (에러가 아님)
          if (!contractText || contractText.trim().length === 0) {
            console.warn('[Frontend] ⚠️ 계약서 본문 없음, 요약/메타데이터만 표시합니다.', {
              docId,
              isTempId,
              hasSummary: !!normalizedData.summary,
              hasIssues: (normalizedData.issues || []).length > 0,
              v2Data: v2Data ? { 
                hasContractText: !!v2Data.contractText,
                contractTextLength: v2Data.contractText?.length || 0,
                keys: Object.keys(v2Data)
              } : null,
              localData: localData ? { 
                hasContractText: !!(localData.contractText || localData.contract_text),
                contractTextLength: (localData.contractText || localData.contract_text)?.length || 0,
                keys: Object.keys(localData)
              } : null,
            })
            
            // 요약만 있는 상태도 유효한 상태로 처리 (에러가 아님)
            // UI에서는 요약 카드와 "계약서 전체 텍스트 분석은 준비 중입니다" 안내 표시
          }

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

          // ✨ clauses와 highlightedTexts 저장
          const clausesData = normalizedData.clauses || []
          console.log('[Frontend] clauses 데이터 확인:', {
            clausesLength: clausesData.length,
            clauses: clausesData,
            v2DataClauses: v2Data?.clauses,
            v2DataClausesLength: v2Data?.clauses?.length || 0,
            normalizedDataClauses: normalizedData.clauses,
          })
          setClauses(clausesData)
          setHighlightedTexts(normalizedData.highlightedTexts || [])
          
          // 새로운 독소조항 탐지 필드 저장
          setOneLineSummary(normalizedData.oneLineSummary || v2Data?.oneLineSummary)
          setRiskTrafficLight(normalizedData.riskTrafficLight || v2Data?.riskTrafficLight)
          setTop3ActionPoints(normalizedData.top3ActionPoints || v2Data?.top3ActionPoints || [])
          setRiskSummaryTable(normalizedData.riskSummaryTable || v2Data?.riskSummaryTable || [])
          setToxicClauses(normalizedData.toxicClauses || v2Data?.toxicClauses || [])
          setNegotiationQuestions(normalizedData.negotiationQuestions || v2Data?.negotiationQuestions || [])
          setRetrievedContexts(normalizedData.retrievedContexts || normalizedData.retrieved_contexts || v2Data?.retrievedContexts || [])
          setExtractionMetadata(normalizedData.metadata ?? null)

          setAnalysisResult(result)
        } else {
          setError('분석 결과를 찾을 수 없습니다.')
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

  // 채팅 로딩 시 body에 cursor-wait 적용
  useEffect(() => {
    if (chatLoading) {
      document.body.classList.add('cursor-wait')
    } else {
      document.body.classList.remove('cursor-wait')
    }
    return () => {
      document.body.classList.remove('cursor-wait')
    }
  }, [chatLoading])

  // ESC 키로 채팅 닫기
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isChatOpen) {
        setIsChatOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isChatOpen])

  // 스크롤 동기화
  useEffect(() => {
    const contractViewer = contractViewerScrollRef.current
    const analysisPanel = analysisPanelScrollRef.current

    if (!contractViewer || !analysisPanel || !analysisResult) return

    const syncScroll = (source: HTMLDivElement, target: HTMLDivElement) => {
      if (isScrollingRef.current) return
      
      isScrollingRef.current = true
      
      const sourceScrollTop = source.scrollTop
      const sourceScrollHeight = source.scrollHeight - source.clientHeight
      const targetScrollHeight = target.scrollHeight - target.clientHeight
      
      if (sourceScrollHeight > 0 && targetScrollHeight > 0) {
        const scrollRatio = sourceScrollTop / sourceScrollHeight
        const targetScrollTop = scrollRatio * targetScrollHeight
        target.scrollTop = targetScrollTop
      }
      
      requestAnimationFrame(() => {
        isScrollingRef.current = false
      })
    }

    const handleContractViewerScroll = () => {
      if (!isScrollingRef.current && analysisPanel) {
        syncScroll(contractViewer, analysisPanel)
      }
    }

    const handleAnalysisPanelScroll = () => {
      if (!isScrollingRef.current && contractViewer) {
        syncScroll(analysisPanel, contractViewer)
      }
    }

    contractViewer.addEventListener('scroll', handleContractViewerScroll, { passive: true })
    analysisPanel.addEventListener('scroll', handleAnalysisPanelScroll, { passive: true })

    return () => {
      contractViewer.removeEventListener('scroll', handleContractViewerScroll)
      analysisPanel.removeEventListener('scroll', handleAnalysisPanelScroll)
    }
  }, [analysisResult])

  // 스와이프 제스처 처리
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    })
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    })
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distanceX = touchStart.x - touchEnd.x
    const distanceY = Math.abs(touchStart.y - touchEnd.y)
    
    // 수직 스크롤이 수평 스와이프보다 크면 무시
    if (distanceY > Math.abs(distanceX)) {
      setTouchStart(null)
      setTouchEnd(null)
      return
    }
    
    const isLeftSwipe = distanceX > minSwipeDistance

    // 오른쪽에서 왼쪽으로 스와이프 (채팅 닫기)
    if (isLeftSwipe && isChatOpen) {
      setIsChatOpen(false)
    }
    
    // 초기화
    setTouchStart(null)
    setTouchEnd(null)
  }

  // 분석 전 상태
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
        <div className="text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-full blur-3xl opacity-30 animate-pulse"></div>
            <div className="relative">
              <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto" />
            </div>
          </div>
          <p className="text-lg font-semibold text-slate-900 mb-2">계약 조항 분석 중...</p>
          <p className="text-sm text-slate-600">근로시간/보수/수습/스톡옵션 항목별로 조항을 분석하는 중입니다</p>
        </div>
      </div>
    )
  }

  // 에러 상태 (요약이 없는 경우에만 에러로 처리)
  if (error && (!analysisResult || !analysisResult.summary)) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-red-50/20 to-slate-50">
        <div className="text-center max-w-md px-6">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-red-200 rounded-full blur-2xl opacity-20"></div>
            <AlertCircle className="relative w-20 h-20 text-red-500 mx-auto" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">분석 결과를 불러올 수 없습니다</h2>
          <p className="text-slate-600 mb-6">{error || '알 수 없는 오류가 발생했습니다.'}</p>
        </div>
      </div>
    )
  }

  // analysisResult가 없으면 에러 표시
  if (!analysisResult) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-red-50/20 to-slate-50">
        <div className="text-center max-w-md px-6">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-red-200 rounded-full blur-2xl opacity-20"></div>
            <AlertCircle className="relative w-20 h-20 text-red-500 mx-auto" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">분석 결과를 불러올 수 없습니다</h2>
          <p className="text-slate-600 mb-6">분석 결과가 없습니다.</p>
        </div>
      </div>
    )
  }
  
  // 요약만 있는 상태 (contractText가 없지만 summary는 있음)
  const isSummaryOnly = !analysisResult.contractText || analysisResult.contractText.trim().length === 0

  // 분석 완료 상태 - 2-컬럼 레이아웃
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50 relative">
      {/* 메인 컨텐츠 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* 상단: 2-컬럼 레이아웃 (계약서 + 분석 결과) */}
        <div className="flex flex-col lg:flex-row overflow-hidden flex-1">
          {/* 왼쪽: 계약서 뷰어 또는 AI 법률챗 */}
          <div className={cn(
            "w-full flex-shrink-0 bg-white border-r border-slate-200/60 shadow-sm transition-all duration-300 flex flex-col relative",
            isChatOpen ? "lg:w-1/2" : "lg:w-1/2"
          )}>
            {/* AI 법률챗 패널 (계약서를 가림) */}
            {isChatOpen && (
              <div className="absolute inset-0 bg-white z-10 flex flex-col">
                {/* 채팅 헤더 */}
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-900">AI 법률 상담</h2>
                      <p className="text-xs text-slate-600">계약서에 대해 질문하세요</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsChatOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    aria-label="채팅 닫기"
                  >
                    <X className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
                
                {/* 채팅 컨텐츠 */}
                <div 
                  id="contract-chat" 
                  className="flex-1 overflow-hidden"
                >
                  <ContractChat
                    docId={docId}
                    analysisResult={analysisResult}
                    selectedIssueId={chatIssueId || selectedIssueId}
                    selectedClauseId={selectedClauseId}
                    prefilledQuestion={prefilledQuestion}
                    onQuestionPrefilled={() => setPrefilledQuestion(undefined)}
                    externalMessage={externalMessage}
                    onExternalMessageSent={() => setExternalMessage('')}
                    onLoadingChange={setChatLoading}
                    onMessageCountChange={setMessageCount}
                  />
                </div>
              </div>
            )}
            
            {/* 계약서 뷰어 (채팅이 열리면 가려짐) */}
            {!isChatOpen && (
              <>
            {/* 파일 다운로드 버튼 (파일 URL이 있는 경우) */}
            {fileUrl && (
              <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <FileText className="w-4 h-4" />
                  <span className="font-medium">원본 파일</span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1.5"
                    title="새 탭에서 열기"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    열기
                  </a>
                  <a
                    href={fileUrl}
                    download
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                    title="파일 다운로드"
                  >
                    <Download className="w-3.5 h-3.5" />
                    다운로드
                  </a>
                </div>
              </div>
            )}
            {/* 개발자 확인용: 추출 메타 (ocr_used, source_type, page_count) */}
            {extractionMetadata && (
              <div className="px-4 py-2 border-b border-slate-200 bg-slate-50/80 flex items-center gap-4 text-xs text-slate-600">
                <span className="font-medium text-slate-500">추출 메타:</span>
                <span>OCR={String(extractionMetadata.ocr_used ?? '—')}</span>
                <span>source_type={extractionMetadata.source_type ?? '—'}</span>
                <span>page_count={extractionMetadata.page_count ?? '—'}</span>
              </div>
            )}
            <div 
              ref={contractViewerScrollRef}
              className="flex-1 overflow-y-auto min-h-0"
            >
              {isSummaryOnly ? (
                <div className="h-full flex items-center justify-center p-8">
                <div className="text-center max-w-md">
                  <div className="p-4 bg-amber-50 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <FileText className="w-10 h-10 text-amber-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">계약서 전문 분석 준비 중</h3>
                  <p className="text-sm text-slate-600 mb-4">
                    현재는 요약 정보만 제공됩니다. 계약서 전문 텍스트 분석 기능은 곧 제공될 예정입니다.
                  </p>
                  {analysisResult.summary && (
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs font-medium text-blue-900 mb-2">📋 분석 요약</p>
                      <p className="text-sm text-blue-800 leading-relaxed">{analysisResult.summary}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <ContractViewer
                contractText={analysisResult.contractText}
                issues={analysisResult.issues}
                selectedIssueId={selectedIssueId}
                selectedClauseId={selectedClauseId}
                onIssueClick={setSelectedIssueId}
                highlightedTexts={highlightedTexts}
                clauses={clauses}  // ✨ 조항 목록 전달
                scrollContainerRef={contractViewerScrollRef}
              />
            )}
            </div>
              </>
            )}
          </div>

          {/* 오른쪽: 분석 결과 패널 */}
          <div className="w-full lg:w-1/2 lg:flex-shrink-0 overflow-hidden bg-white shadow-sm flex flex-col">
            <div 
              ref={analysisPanelScrollRef}
              className="flex-1 overflow-y-auto min-h-0"
            >
              <AnalysisPanel
                issues={analysisResult.issues}
                totalIssues={analysisResult.totalIssues}
                highRiskCount={analysisResult.highRiskCount}
                mediumRiskCount={analysisResult.mediumRiskCount}
                lowRiskCount={analysisResult.lowRiskCount}
                selectedIssueId={selectedIssueId}
                onIssueSelect={setSelectedIssueId}
                riskScore={analysisResult.riskScore}
                contractText={analysisResult.contractText}
                clauses={clauses}
                selectedClauseId={selectedClauseId}
                onClauseClick={(clauseId) => {
                  setSelectedClauseId(clauseId)
                }}
                onCategoryClick={(category) => {
                  const categoryIssue = analysisResult.issues.find(i => i.category === category)
                  if (categoryIssue) {
                    setSelectedIssueId(categoryIssue.id)
                  }
                }}
                onAskAboutIssue={(issueId, prefilledText) => {
                  setChatIssueId(issueId)
                  setSelectedIssueId(issueId)
                  setIsChatOpen(true) // 채팅 열기
                  
                  // 자동 프리필 질문 설정
                  if (prefilledText) {
                    setPrefilledQuestion(prefilledText)
                  } else {
                    const issue = analysisResult.issues.find(i => i.id === issueId)
                    if (issue) {
                      const prefilled = `다음 조항이 왜 위험한지와 현실적으로 어떤 협상 포인트를 잡을 수 있을지 알려줘.\n\n[문제 조항]\n${issue.originalText || issue.summary}`
                      setPrefilledQuestion(prefilled)
                    }
                  }
                  
                  // 채팅 영역으로 스크롤
                  setTimeout(() => {
                    const chatElement = document.getElementById('contract-chat')
                    if (chatElement) {
                      chatElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  }, 100)
                }}
                oneLineSummary={oneLineSummary}
                riskTrafficLight={riskTrafficLight}
                top3ActionPoints={top3ActionPoints}
                riskSummaryTable={riskSummaryTable}
                toxicClauses={toxicClauses}
                negotiationQuestions={negotiationQuestions}
                retrievedContexts={retrievedContexts}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 채팅 열기 버튼 (왼쪽 하단 고정, 원모양) */}
      {!isChatOpen && (
        <button
          onClick={() => setIsChatOpen(true)}
          disabled={chatLoading}
          aria-busy={chatLoading}
          data-unread={messageCount > 0 ? 'true' : 'false'}
          className={cn(
            "fixed bottom-6 left-6 z-30",
            "bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600",
            "hover:from-blue-700 hover:via-blue-600 hover:to-indigo-700",
            "text-white rounded-full w-14 h-14 shadow-xl shadow-blue-500/30",
            "transition-all duration-200 hover:scale-110 hover:shadow-2xl hover:shadow-blue-500/40",
            "flex items-center justify-center",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          aria-label="AI 법률 상담 열기"
        >
          <MessageSquare className="w-6 h-6" />
          {messageCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-gradient-to-br from-red-500 to-rose-600 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-md">
              {messageCount}
            </span>
          )}
        </button>
      )}
    </div>
  )
}
