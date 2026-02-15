'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Filter, AlertTriangle, CheckCircle2, FileText, BookOpen, Scale, Calendar, BarChart3, TrendingUp, Shield, MessageSquare, ExternalLink, Download } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { AnalysisIssueCard } from './AnalysisIssueCard'
import { AmendmentModal } from './AmendmentModal'
import { ClauseList } from './ClauseList'
import { SEVERITY_COLORS, SEVERITY_LABELS, getSeverityFromScore, FOCUS_STYLE } from './contract-design-tokens'
import type { LegalIssue, LegalCategory, Severity, LegalBasisItem } from '../../types/legal'
import { ChevronDown } from 'lucide-react'

// 간단한 className 유틸리티
const classNames = (...classes: (string | false | null | undefined)[]) =>
  classes.filter(Boolean).join(' ')

interface Clause {
  id: string
  title: string
  content: string
  articleNumber?: number
  category?: string
}

interface AnalysisPanelProps {
  issues: LegalIssue[]
  totalIssues: number
  highRiskCount: number
  mediumRiskCount: number
  lowRiskCount: number
  selectedIssueId?: string
  onIssueSelect: (issueId: string) => void
  onAskAboutIssue?: (issueId: string, prefilledText?: string) => void
  onCategoryClick?: (category: LegalCategory) => void
  riskScore?: number
  contractText?: string
  clauses?: Clause[]
  selectedClauseId?: string
  onClauseClick?: (clauseId: string) => void
  // 새로운 독소조항 탐지 필드
  oneLineSummary?: string
  riskTrafficLight?: string
  top3ActionPoints?: string[]
  riskSummaryTable?: Array<{
    item: string
    riskLevel: 'low' | 'medium' | 'high'
    problemPoint: string
    simpleExplanation: string
    revisionKeyword: string
  }>
  toxicClauses?: Array<{
    clauseLocation: string
    contentSummary: string
    whyRisky: string
    realWorldProblems: string
    suggestedRevisionLight: string
    suggestedRevisionFormal: string
  }>
  negotiationQuestions?: string[]
  retrievedContexts?: Array<{
    sourceType?: string
    title?: string
    snippet?: string
    filePath?: string
    externalId?: string
    chunkIndex?: number
  }>
}

export function AnalysisPanel({
  issues,
  totalIssues,
  highRiskCount,
  mediumRiskCount,
  lowRiskCount,
  selectedIssueId,
  onIssueSelect,
  onAskAboutIssue,
  onCategoryClick,
  riskScore = 0,
  contractText = '',
  clauses = [],
  selectedClauseId,
  onClauseClick,
  oneLineSummary,
  riskTrafficLight,
  top3ActionPoints = [],
  riskSummaryTable = [],
  toxicClauses = [],
  negotiationQuestions = [],
  retrievedContexts = [],
}: AnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState('summary')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<Set<LegalCategory>>(new Set())
  const [selectedSeverities, setSelectedSeverities] = useState<Set<Severity>>(new Set())
  const [sortBy, setSortBy] = useState<'severity' | 'order'>('severity')
  const [amendmentIssueId, setAmendmentIssueId] = useState<string | null>(null)
  
  // 선택된 이슈로 스크롤
  const selectedIssueRef = React.useRef<HTMLDivElement>(null)
  
  React.useEffect(() => {
    if (selectedIssueId && selectedIssueRef.current) {
      selectedIssueRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [selectedIssueId])

  // 카테고리 클릭 시 조항별 탭으로 전환
  useEffect(() => {
    if (onCategoryClick && activeTab !== 'issues') {
      // 카테고리 클릭은 외부에서 처리
    }
  }, [activeTab, onCategoryClick])

  const categories: LegalCategory[] = [
    'working_hours',
    'wage',
    'probation',
    'stock_option',
    'ip',
    'harassment',
    'job_stability',
    'dismissal',
    'payment',
    'non_compete',
    'liability',
    'dispute',
    'nda',
    'other',
  ]

  const categoryLabels: Record<LegalCategory, string> = {
    working_hours: '근로시간·휴게',
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

  // 카테고리별 이슈 그룹화
  const issuesByCategory = useMemo(() => {
    const grouped: Record<LegalCategory, LegalIssue[]> = {
      working_hours: [],
      wage: [],
      probation: [],
      stock_option: [],
      ip: [],
      harassment: [],
      job_stability: [],
      dismissal: [],
      payment: [],
      non_compete: [],
      liability: [],
      dispute: [],
      nda: [],
      other: [],
    }
    issues.forEach(issue => {
      // 카테고리가 정의된 키에 있는지 확인, 없으면 'other'에 추가
      const validCategories: LegalCategory[] = [
        'working_hours', 'wage', 'probation', 'stock_option', 'ip', 'harassment',
        'job_stability', 'dismissal', 'payment', 'non_compete', 'liability', 'dispute', 'nda', 'other'
      ]
      const category: LegalCategory = validCategories.includes(issue.category) ? issue.category : 'other'
      grouped[category].push(issue)
    })
    return grouped
  }, [issues])

  // 필터링 및 정렬
  const filteredAndSortedIssues = useMemo(() => {
    let filtered = issues

    // 카테고리 필터
    if (selectedCategories.size > 0) {
      filtered = filtered.filter(issue => selectedCategories.has(issue.category))
    }

    // 위험도 필터
    if (selectedSeverities.size > 0) {
      filtered = filtered.filter(issue => selectedSeverities.has(issue.severity))
    }

    // 정렬
    if (sortBy === 'severity') {
      const severityOrder = { high: 3, medium: 2, low: 1 }
      filtered = [...filtered].sort(
        (a, b) => severityOrder[b.severity] - severityOrder[a.severity]
      )
    } else {
      // 계약서 순서대로
      filtered = [...filtered].sort(
        (a, b) => (a.location.startIndex ?? 0) - (b.location.startIndex ?? 0)
      )
    }

    return filtered
  }, [issues, selectedCategories, selectedSeverities, sortBy])

  const toggleCategory = (category: LegalCategory) => {
    const newSet = new Set(selectedCategories)
    if (newSet.has(category)) {
      newSet.delete(category)
    } else {
      newSet.add(category)
    }
    setSelectedCategories(newSet)
  }

  const toggleSeverity = (severity: Severity) => {
    const newSet = new Set(selectedSeverities)
    if (newSet.has(severity)) {
      newSet.delete(severity)
    } else {
      newSet.add(severity)
    }
    setSelectedSeverities(newSet)
  }

  const handleCategoryFocus = (category: LegalCategory) => {
    setActiveTab('issues')
    setSelectedCategories(new Set([category]))
    onCategoryClick?.(category)
  }

  const handleCategoryCardClick = (category: LegalCategory) => {
    handleCategoryFocus(category)
  }

  const selectedIssue = issues.find(i => i.id === amendmentIssueId)

  // 위험도에 따른 색상 및 라벨
  const getRiskInfo = (score: number) => {
    const severity = getSeverityFromScore(score)
    const colors = SEVERITY_COLORS[severity]
    return {
      gradient: colors.gradient,
      bgColor: colors.bg,
      borderColor: colors.border,
      textColor: colors.text,
      label: SEVERITY_LABELS[severity],
      labelColor: colors.textDark,
      icon: severity === 'high' ? AlertTriangle : severity === 'medium' ? AlertTriangle : CheckCircle2,
    }
  }

  const riskInfo = getRiskInfo(riskScore)
  const RiskIcon = riskInfo.icon

  // 카테고리별 이슈 개수 계산
  const categoryCounts = issues.reduce((acc, issue) => {
    const category = issue.category
    if (!acc[category]) {
      acc[category] = { total: 0, high: 0, medium: 0, low: 0 }
    }
    acc[category].total++
    if (issue.severity === 'high') acc[category].high++
    else if (issue.severity === 'medium') acc[category].medium++
    else acc[category].low++
    return acc
  }, {} as Record<LegalCategory, { total: number; high: number; medium: number; low: number }>)

  // 주요 카테고리만 표시 (이슈가 있는 것만)
  const mainCategories: LegalCategory[] = ['working_hours', 'wage', 'probation', 'stock_option']
  const displayedCategories = mainCategories.filter(cat => categoryCounts[cat]?.total > 0)

  // 계약 유형 추정
  const contractType = useMemo(() => {
    if (categoryCounts.probation?.total > 0) return '인턴/수습 근로계약'
    if (categoryCounts.stock_option?.total > 0) return '정규직 근로계약'
    if (categoryCounts.wage?.total > 0) return '근로계약'
    return '근로계약'
  }, [categoryCounts])

  // 조항 수 추정
  const clauseCount = useMemo(() => {
    const clauseMatches = contractText.match(/제\s*\d+\s*조/g)
    return clauseMatches ? clauseMatches.length : 0
  }, [contractText])

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <div className="h-full flex flex-col bg-white" role="complementary" aria-label="분석 결과">
        {/* 통합 헤더 - 계약 요약 카드 (sticky) */}
        <div className="p-3 bg-white border-b border-slate-200 flex-shrink-0 overflow-x-hidden sticky top-0 z-20">
        {/* 상단: 계약명 + 점수/주의 배지 */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate flex-1">{contractType}</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-br from-slate-100 to-slate-200 rounded-md border border-slate-300 shadow-sm">
              <BarChart3 className="w-3 h-3 text-slate-700" />
              <span className="font-semibold text-slate-900 text-xs">{riskScore}</span>
              <span className="text-slate-500 text-[10px]">/100</span>
            </span>
            <div className={classNames(
              "px-2.5 py-1.5 rounded-lg border-2 text-xs font-semibold flex items-center gap-1.5 shadow-md transition-all duration-200 hover:scale-105",
              riskInfo.bgColor,
              riskInfo.borderColor,
              riskInfo.textColor
            )}>
              <RiskIcon className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">{riskInfo.label}</span>
            </div>
          </div>
        </div>

        {/* 중간: 총 조항 분석 결과 + High/Med/Safe 통계 */}
        <div className="mb-3">
          <p className="text-xs font-semibold text-slate-700 mb-2">총 {totalIssues}개 조항 분석 결과</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border-2 border-red-300 shadow-sm">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-600 font-medium truncate">법적 위험 HIGH</p>
                <p className="text-sm font-bold text-red-700">{highRiskCount}개</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border-2 border-amber-300 shadow-sm">
              <TrendingUp className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-600 font-medium truncate">조정 권장 MED 이상</p>
                <p className="text-sm font-bold text-amber-700">{mediumRiskCount + highRiskCount}개</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white p-2 rounded-lg border-2 border-green-300 shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-600 font-medium truncate">상대적으로 안전</p>
                <p className="text-sm font-bold text-green-700">{lowRiskCount}개</p>
              </div>
            </div>
          </div>
        </div>

        {/* 카테고리별 요약 뱃지 */}
        {displayedCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {displayedCategories.map(category => {
              const count = categoryCounts[category]
              if (!count || count.total === 0) return null

              const hasHigh = count.high > 0
              const hasMedium = count.medium > 0
              
              const badgeConfig = hasHigh
                ? {
                    bg: 'bg-gradient-to-br from-red-50 via-rose-50 to-red-100',
                    border: 'border-2 border-red-400',
                    text: 'text-red-800',
                    shadow: 'shadow-md shadow-red-200/50',
                    label: `${count.high}개`,
                    icon: AlertTriangle,
                  }
                : hasMedium
                ? {
                    bg: 'bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100',
                    border: 'border-2 border-amber-400',
                    text: 'text-amber-800',
                    shadow: 'shadow-md shadow-amber-200/50',
                    label: `${count.medium}개`,
                    icon: TrendingUp,
                  }
                : {
                    bg: 'bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-100',
                    border: 'border-2 border-blue-400',
                    text: 'text-blue-800',
                    shadow: 'shadow-md shadow-blue-200/50',
                    label: `${count.low}개`,
                    icon: Shield,
                  }

              const BadgeIcon = badgeConfig.icon

              return (
                <button
                  key={category}
                  onClick={() => handleCategoryFocus(category)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleCategoryFocus(category)
                    }
                  }}
                  aria-label={`${categoryLabels[category]} 카테고리, ${badgeConfig.label} 이슈 발견`}
                  className={classNames(
                    "px-2 py-1 rounded-md border text-[10px] font-semibold",
                    "transition-all duration-200 hover:scale-105 hover:shadow-lg",
                    "flex items-center gap-1.5",
                    FOCUS_STYLE,
                    "cursor-pointer",
                    badgeConfig.bg,
                    badgeConfig.border,
                    badgeConfig.text,
                    badgeConfig.shadow
                  )}
                >
                  <BadgeIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">{categoryLabels[category]}</span>
                    <span className="opacity-50">·</span>
                    <span>{badgeConfig.label}</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* 하단: 탭 네비게이션 + 필터 버튼 */}
        <div className="flex items-center justify-between gap-2">
          <TabsList className="flex-1 grid grid-cols-3 bg-slate-100/90 p-1 rounded-lg border-2 border-slate-200 shadow-inner" role="tablist" aria-label="분석 결과 탭">
            <TabsTrigger 
              value="summary" 
              className="flex items-center justify-center font-semibold text-xs transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-md data-[state=active]:scale-105 rounded-md py-1.5"
              aria-label="분석 요약 보기"
            >
              <span className="hidden sm:inline">요약</span>
              <span className="sm:hidden">요약</span>
            </TabsTrigger>
            <TabsTrigger 
              value="issues" 
              className="flex items-center justify-center font-semibold text-xs transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-amber-700 data-[state=active]:shadow-md data-[state=active]:scale-105 rounded-md py-1.5"
              aria-label="조항별 분석 보기"
            >
              <span className="hidden sm:inline">조항별</span>
              <span className="sm:hidden">조항별</span>
            </TabsTrigger>
            <TabsTrigger 
              value="legal" 
              className="flex items-center justify-center font-semibold text-xs transition-all duration-200 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-md data-[state=active]:scale-105 rounded-md py-1.5"
              aria-label="법령 및 표준계약서 비교 보기"
            >
              <span className="hidden sm:inline">법령·표준</span>
              <span className="sm:hidden">법령·표준</span>
            </TabsTrigger>
          </TabsList>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            aria-controls="filter-panel"
            className={classNames(
              "flex-shrink-0 transition-all duration-200 border-2 px-2.5 py-1.5 rounded-lg bg-white text-slate-800 flex items-center gap-1.5 shadow-sm hover:shadow-md hover:scale-105",
              showFilters ? "border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50" : "border-slate-300 hover:border-blue-400"
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs font-semibold">필터</span>
            {(selectedCategories.size > 0 || selectedSeverities.size > 0 || sortBy === 'order') && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-4.5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-[10px] font-semibold text-white px-1 shadow-md">
                {selectedCategories.size + selectedSeverities.size + (sortBy === 'order' ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

      </div>

      {/* 필터 적용 중 미니 뱃지 */}
      {!showFilters && (selectedCategories.size > 0 || selectedSeverities.size > 0) && (
        <div className="px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-200 text-xs text-slate-700 flex items-center gap-2 shadow-sm">
          <span className="font-semibold text-blue-800">필터 적용 중</span>
          {selectedCategories.size > 0 && (
            <span className="px-2 py-0.5 bg-white rounded border border-blue-200 shadow-sm">카테고리 {selectedCategories.size}개</span>
          )}
          {selectedSeverities.size > 0 && (
            <span className="px-2 py-0.5 bg-white rounded border border-blue-200 shadow-sm">위험도 {Array.from(selectedSeverities).map(s => s === 'high' ? 'High' : s === 'medium' ? 'Medium' : 'Low').join(', ')}</span>
          )}
          <button
            onClick={() => {
              setSelectedCategories(new Set())
              setSelectedSeverities(new Set())
              setSortBy('severity')
            }}
            className="ml-auto px-2 py-1 text-xs font-semibold text-blue-700 hover:text-blue-800 hover:bg-white rounded transition-colors cursor-pointer"
          >
            초기화
          </button>
        </div>
      )}

      {/* 필터 바 */}
      {showFilters && (
        <div id="filter-panel" className="border-b border-blue-200 p-3 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 shadow-sm">
          {/* 카테고리 필터 */}
          <div className="mb-3">
            <p className="text-[10px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Filter className="w-3 h-3" />
              카테고리
            </p>
            <div className="flex flex-wrap gap-1.5">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={classNames(
                    "px-2 py-1 text-[10px] rounded-md border-2 transition-all duration-200 font-semibold shadow-sm hover:scale-105",
                    selectedCategories.has(category)
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 border-blue-600 text-white shadow-md'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-blue-50 hover:border-blue-300'
                  )}
                >
                  {categoryLabels[category]}
                </button>
              ))}
            </div>
          </div>

          {/* 위험도 필터 */}
          <div className="mb-3">
            <p className="text-[10px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" />
              위험도
            </p>
            <div className="flex gap-1.5">
              {(['high', 'medium', 'low'] as Severity[]).map(severity => {
                const severityConfig = severity === 'high' 
                  ? { bg: 'from-red-500 to-rose-600', border: 'border-red-600', text: 'text-white' }
                  : severity === 'medium'
                  ? { bg: 'from-amber-500 to-orange-600', border: 'border-amber-600', text: 'text-white' }
                  : { bg: 'from-green-500 to-emerald-600', border: 'border-green-600', text: 'text-white' }
                
                return (
                  <button
                    key={severity}
                    onClick={() => toggleSeverity(severity)}
                    className={classNames(
                      "px-2 py-1 text-[10px] rounded-md border-2 transition-all duration-200 font-semibold shadow-sm hover:scale-105",
                      selectedSeverities.has(severity)
                        ? `bg-gradient-to-br ${severityConfig.bg} ${severityConfig.border} ${severityConfig.text} shadow-md`
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    {severity === 'high' ? 'High만' :
                     severity === 'medium' ? 'Medium만' :
                     'Low만'}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 정렬 옵션 */}
          <div>
            <p className="text-[10px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <BarChart3 className="w-3 h-3" />
              정렬
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setSortBy('severity')}
                className={classNames(
                  "px-2 py-1 text-[10px] rounded-md border-2 transition-all duration-200 font-semibold shadow-sm hover:scale-105",
                  sortBy === 'severity'
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 border-blue-600 text-white shadow-md'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-blue-50 hover:border-blue-300'
                )}
              >
                위험도 높은 순
              </button>
              <button
                onClick={() => setSortBy('order')}
                className={classNames(
                  "px-2 py-1 text-[10px] rounded-md border-2 transition-all duration-200 font-semibold shadow-sm hover:scale-105",
                  sortBy === 'order'
                    ? 'bg-gradient-to-br from-blue-500 to-indigo-600 border-blue-600 text-white shadow-md'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-blue-50 hover:border-blue-300'
                )}
              >
                계약서 순서대로
              </button>
            </div>
          </div>
        </div>
      )}

        {/* 탭 컨텐츠 */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
          {/* 요약 보기 탭 */}
          <TabsContent value="summary" className="px-3 sm:px-4 py-3 sm:py-4 mt-0 overflow-x-hidden">
            <div className="space-y-3 max-w-4xl mx-auto w-full px-2">
              {/* 한 줄 총평 */}
              {oneLineSummary && (
                <div className="w-full bg-amber-50 border border-amber-300 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <div className="p-1.5 bg-amber-600 rounded-lg flex-shrink-0">
                      <AlertTriangle className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xs font-semibold text-amber-900 mb-1.5">한 줄 총평</h3>
                      <p className="text-xs text-amber-900 leading-relaxed">{oneLineSummary}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 리스크 신호등 + 지금 당장 확인해야 할 포인트 */}
              {(riskTrafficLight || top3ActionPoints.length > 0) && (
                <div className="w-full bg-white border border-slate-200 rounded-lg p-3">
                  {riskTrafficLight && (
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-200">
                      <span className="text-xl">{riskTrafficLight}</span>
                      <div>
                        <span className="text-xs font-semibold text-slate-900 block">리스크 수준</span>
                        <span className="text-[10px] text-slate-600 mt-0.5">
                          {riskTrafficLight === '🔴' ? '높음 - 즉시 검토 필요' :
                           riskTrafficLight === '🟡' ? '보통 - 주의 깊게 확인' :
                           '낮음 - 일반적인 수준'}
                        </span>
                      </div>
                    </div>
                  )}
                  {top3ActionPoints.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-slate-900 mb-2">지금 당장 확인하거나 물어봐야 할 포인트</h3>
                      <ul className="space-y-1.5">
                        {top3ActionPoints.map((point, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-slate-800 bg-blue-50 p-2 rounded-lg border border-blue-200">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-semibold">
                              {idx + 1}
                            </span>
                            <span className="flex-1 pt-0.5 leading-relaxed">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* 리스크 요약 테이블 */}
              {riskSummaryTable.length > 0 && (
                <div className="w-full bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
                    <h3 className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                      리스크 요약
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gradient-to-r from-slate-100 to-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-[10px] font-extrabold text-slate-800 border-b-2 border-slate-300 uppercase tracking-wide">항목</th>
                          <th className="px-3 py-2 text-left text-[10px] font-extrabold text-slate-800 border-b-2 border-slate-300 uppercase tracking-wide">리스크 수준</th>
                          <th className="px-3 py-2 text-left text-[10px] font-extrabold text-slate-800 border-b-2 border-slate-300 uppercase tracking-wide">문제 포인트</th>
                          <th className="px-3 py-2 text-left text-[10px] font-extrabold text-slate-800 border-b-2 border-slate-300 uppercase tracking-wide">간단 설명</th>
                          <th className="px-3 py-2 text-left text-[10px] font-extrabold text-slate-800 border-b-2 border-slate-300 uppercase tracking-wide">수정 제안</th>
                        </tr>
                      </thead>
                      <tbody>
                        {riskSummaryTable.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-200 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-all duration-200">
                            <td className="px-3 py-2 font-semibold text-slate-900">{item.item}</td>
                            <td className="px-3 py-2">
                              <span className={classNames(
                                "px-2 py-1 rounded-md text-[10px] font-semibold shadow-sm border",
                                item.riskLevel === 'high' ? 'bg-gradient-to-br from-red-100 to-red-200 text-red-800 border-red-400' :
                                item.riskLevel === 'medium' ? 'bg-gradient-to-br from-amber-100 to-amber-200 text-amber-800 border-amber-400' :
                                'bg-gradient-to-br from-green-100 to-green-200 text-green-800 border-green-400'
                              )}>
                                {item.riskLevel === 'high' ? '🔴 높음' :
                                 item.riskLevel === 'medium' ? '🟡 보통' :
                                 '🟢 낮음'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-800 font-medium text-xs">{item.problemPoint}</td>
                            <td className="px-3 py-2 text-slate-700 text-xs">{item.simpleExplanation}</td>
                            <td className="px-3 py-2">
                              <span className="text-blue-700 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-[10px]">
                                {item.revisionKeyword}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 독소조항 상세 */}
              {toxicClauses.length > 0 && (
                <div className="w-full bg-red-50 border border-red-300 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-200">
                    <div className="p-1.5 bg-red-600 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xs font-semibold text-red-900">독소조항 상세</h3>
                      <p className="text-[10px] text-red-700 mt-0.5">즉시 수정이 필요한 위험한 조항들</p>
                    </div>
                    <span className="text-[10px] font-semibold bg-red-600 text-white px-1.5 py-0.5 rounded">
                      {toxicClauses.length}개
                    </span>
                  </div>
                  <div className="space-y-3">
                    {toxicClauses.map((toxic, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-3 border-2 border-red-300 shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.01]">
                        <div className="mb-3 pb-3 border-b-2 border-red-200">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center text-[10px] font-semibold shadow-md">
                              {idx + 1}
                            </span>
                            <h4 className="text-sm font-bold text-red-900">{toxic.clauseLocation}</h4>
                          </div>
                          <p className="text-xs text-red-800 bg-red-50/50 p-2 rounded-lg border border-red-200">{toxic.contentSummary}</p>
                        </div>
                        <div className="space-y-2 text-xs">
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <span className="font-semibold text-slate-900 block mb-1">왜 위험한지</span>
                            <span className="text-slate-800 leading-relaxed">{toxic.whyRisky}</span>
                          </div>
                          <div className="bg-amber-50 p-2 rounded-lg border border-amber-200">
                            <span className="font-semibold text-slate-900 block mb-1">현실에서 생길 수 있는 문제</span>
                            <span className="text-slate-800 leading-relaxed">{toxic.realWorldProblems}</span>
                          </div>
                          <div className="mt-2 pt-2 border-t border-slate-200 space-y-1.5">
                            <div>
                              <p className="text-[10px] font-medium text-blue-700 mb-0.5">수정 제안 (라이트 버전)</p>
                              <p className="text-xs text-slate-800 bg-blue-50 p-2 rounded border border-blue-200 leading-relaxed">
                                {toxic.suggestedRevisionLight}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium text-slate-700 mb-0.5">수정 제안 (포멀 버전)</p>
                              <p className="text-xs text-slate-800 bg-slate-50 p-2 rounded border border-slate-200 leading-relaxed">
                                {toxic.suggestedRevisionFormal}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 협상 질문 리스트 */}
              {negotiationQuestions.length > 0 && (
                <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-200">
                    <div className="p-1.5 bg-blue-600 rounded-lg">
                      <MessageSquare className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xs font-semibold text-blue-900">협상 시 질문 리스트</h3>
                      <p className="text-[10px] text-blue-700 mt-0.5">계약서 검토 시 활용하세요</p>
                    </div>
                  </div>
                  <ul className="space-y-1.5">
                    {negotiationQuestions.map((question, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs text-blue-900 bg-white p-2 rounded-lg border border-blue-200">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-semibold mt-0.5">
                          Q{idx + 1}
                        </span>
                        <span className="flex-1 pt-0.5 leading-relaxed">{question}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 조항 목록 (있는 경우) - 접을 수 있는 섹션 */}
              {clauses.length > 0 && (
                <div className="w-full max-w-full box-border bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-lg overflow-hidden">
                  <details className="group">
                    <summary className="px-4 py-3 cursor-pointer hover:bg-slate-100/50 transition-colors flex items-center justify-between list-none">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-semibold text-slate-900">
                          조항 목록
                        </span>
                        <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                          {clauses.length}개
                        </span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" />
                    </summary>
                    <div className="px-4 pb-4 max-h-[300px] overflow-y-auto border-t border-slate-200/60">
                      <ClauseList
                        clauses={clauses}
                        selectedClauseId={selectedClauseId}
                        onClauseClick={onClauseClick}
                      />
                    </div>
                  </details>
                </div>
              )}
              

              {/* 카테고리별 카드 */}
              {categories.map(category => {
                const categoryIssues = issuesByCategory[category]
                if (categoryIssues.length === 0) return null

                const highCount = categoryIssues.filter(i => i.severity === 'high').length
                const mediumCount = categoryIssues.filter(i => i.severity === 'medium').length
                const lowCount = categoryIssues.filter(i => i.severity === 'low').length

                const getSeverityLabel = () => {
                  if (highCount > 0) return { label: `위험 ${highCount}건`, color: 'bg-red-50 border-red-300 text-red-700 shadow-sm' }
                  if (mediumCount > 0) return { label: `경고 ${mediumCount}건`, color: 'bg-yellow-50 border-yellow-300 text-yellow-700 shadow-sm' }
                  return { label: `주의 ${lowCount}건`, color: 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm' }
                }

                const severityInfo = getSeverityLabel()
                const topIssue = categoryIssues[0]

                return (
                  <button
                    key={category}
                    onClick={() => handleCategoryCardClick(category)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleCategoryCardClick(category)
                      }
                    }}
                    aria-label={`${categoryLabels[category]} 카테고리 상세 보기, ${severityInfo.label}`}
                    className="w-full max-w-full text-left p-3 bg-white border-2 border-slate-300 rounded-lg hover:border-blue-500 hover:shadow-lg hover:bg-gradient-to-br hover:from-blue-50/70 hover:to-indigo-50/70 transition-all duration-300 group focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 hover:scale-[1.01] active:scale-[0.99] box-border"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-blue-700 transition-colors">{categoryLabels[category]}</span>
                      <span className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg border-2 shadow-sm ${severityInfo.color} group-hover:scale-105 transition-transform`}>
                        {severityInfo.label}
                      </span>
                    </div>
                    {topIssue && (
                      <p className="text-xs sm:text-sm text-slate-700 line-clamp-2 leading-relaxed group-hover:text-slate-900 transition-colors">{topIssue.summary}</p>
                    )}
                  </button>
                )
              })}
            </div>
          </TabsContent>

          {/* 조항별 분석 탭 */}
          <TabsContent value="issues" className="px-3 sm:px-4 py-3 sm:py-4 mt-0 overflow-x-hidden">
            {filteredAndSortedIssues.length === 0 ? (
              <div className="text-center py-6 text-slate-500">
                <p className="text-xs">필터 조건에 맞는 이슈가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-2 px-2">
                {filteredAndSortedIssues.map(issue => (
                  <div
                    key={issue.id}
                    ref={issue.id === selectedIssueId ? selectedIssueRef : null}
                  >
                    <AnalysisIssueCard
                      issue={issue}
                      isSelected={issue.id === selectedIssueId}
                      onSelect={() => onIssueSelect(issue.id)}
                      onShowAmendment={() => setAmendmentIssueId(issue.id)}
                      onAskAboutIssue={onAskAboutIssue}
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* 법령·표준계약 비교 탭 */}
          <TabsContent value="legal" className="px-3 sm:px-4 py-3 sm:py-4 mt-0 overflow-x-hidden">
            <div className="space-y-6 px-2 sm:px-4">
              <p className="text-xs text-slate-500">
                각 위험 조항과 연결된 근로기준법·표준계약서 내용을 모아 보여줍니다.
              </p>
              
              {/* 검색된 법령/표준계약서 전체 목록 (retrievedContexts) */}
              {retrievedContexts && retrievedContexts.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    검색된 법령·표준계약서 전체 ({retrievedContexts.length}개)
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {retrievedContexts.map((ctx, idx) => {
                      const sourceType = ctx.sourceType || 'law'
                      const sourceTypeLabel = 
                        sourceType === 'law' ? '법령' :
                        sourceType === 'manual' ? '가이드라인' :
                        sourceType === 'case' ? '판례' :
                        sourceType === 'standard_contract' ? '표준계약서' :
                        '참고자료'
                      
                      const sourceTypeColor = 
                        sourceType === 'law' ? 'from-blue-100 to-blue-50 border-blue-300 text-blue-900' :
                        sourceType === 'manual' ? 'from-indigo-100 to-indigo-50 border-indigo-300 text-indigo-900' :
                        sourceType === 'case' ? 'from-purple-100 to-purple-50 border-purple-300 text-purple-900' :
                        sourceType === 'standard_contract' ? 'from-green-100 to-green-50 border-green-300 text-green-900' :
                        'from-slate-100 to-slate-50 border-slate-300 text-slate-900'

                      return (
                        <div 
                          key={idx}
                          className={classNames(
                            "bg-gradient-to-br border-2 rounded-lg p-3 shadow-sm hover:shadow-md transition-all",
                            sourceTypeColor
                          )}
                        >
                          <div className="flex items-start justify-between gap-1.5 mb-1.5">
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-white/80 border border-current/30">
                                  {sourceTypeLabel}
                                </span>
                              </div>
                              <h4 className="font-semibold text-xs mb-1.5 leading-tight line-clamp-2">
                                {ctx.title || '제목 없음'}
                              </h4>
                            </div>
                            <Scale className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                          </div>
                          <div className="bg-white/60 rounded-lg p-1.5 border border-current/20 mb-2">
                            <p className="text-[10px] text-slate-800 leading-relaxed line-clamp-3">
                              {ctx.snippet || '내용 없음'}
                            </p>
                          </div>
                          {/* 파일 링크 (있는 경우) */}
                          {ctx.filePath && (
                            <div className="flex items-center gap-1.5 pt-1.5 border-t border-current/20">
                              <FileText className="w-2.5 h-2.5 opacity-60" />
                              <span className="text-[10px] text-slate-600 flex-1 truncate" title={ctx.title || ctx.filePath}>
                                {ctx.title || ctx.filePath.split('/').pop() || ctx.filePath}
                              </span>
                              <a
                                href={`${process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000'}/api/v2/legal/file?path=${encodeURIComponent(ctx.filePath)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-blue-700 hover:text-blue-800 hover:underline flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors"
                                title="원본 파일 보기"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                                열기
                              </a>
                              <a
                                href={`${process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000'}/api/v2/legal/file?path=${encodeURIComponent(ctx.filePath)}&download=true`}
                                download
                                className="text-[10px] text-blue-700 hover:text-blue-800 hover:underline flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors"
                                title="파일 다운로드"
                              >
                                <Download className="w-2.5 h-2.5" />
                                다운로드
                              </a>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              
              {/* 이슈별 법적 근거 */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  이슈별 법적 근거
                </h3>
                {/* 법적 근거 아코디언 */}
                {issues.map((issue, index) => {
                  if (!issue.legalBasis || issue.legalBasis.length === 0) return null

                // legalBasis가 구조화된 형식인지 확인 (JSON 문자열 파싱 포함)
                const parseLegalBasis = (basis: any): any => {
                  if (typeof basis === 'string') {
                    // JSON 문자열인지 확인
                    if (basis.trim().startsWith('{') && basis.trim().endsWith('}')) {
                      try {
                        return JSON.parse(basis);
                      } catch (e) {
                        return basis;
                      }
                    }
                    return basis;
                  }
                  return basis;
                };
                
                  const parsedLegalBasis = issue.legalBasis.map(parseLegalBasis);
                  const isStructured = parsedLegalBasis.length > 0 && 
                    typeof parsedLegalBasis[0] === 'object' && 
                    parsedLegalBasis[0] !== null &&
                    'title' in parsedLegalBasis[0]

                  return (
                    <details
                      key={issue.id}
                      className="w-full max-w-full box-border bg-white border-2 border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                    >
                      <summary 
                        className="p-3 cursor-pointer hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 transition-colors flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        aria-label={`${issue.summary} 법적 근거 보기`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="font-semibold text-slate-900 text-xs">{issue.summary}</span>
                            <span className={classNames(
                              "px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
                              issue.severity === 'high' ? 'bg-red-100 text-red-700 border border-red-300' :
                              issue.severity === 'medium' ? 'bg-amber-100 text-amber-700 border border-amber-300' :
                              'bg-blue-100 text-blue-700 border border-blue-300'
                            )}>
                              {issue.severity === 'high' ? '높음' : issue.severity === 'medium' ? '보통' : '낮음'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {categoryLabels[issue.category]} · {issue.legalBasis.length}개 근거
                          </span>
                        </div>
                        <BookOpen className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2" />
                      </summary>
                      <div className="p-3 border-t-2 border-slate-200 space-y-3 bg-gradient-to-b from-slate-50/30 to-white">
                        {isStructured ? (
                          // 구조화된 형식 (LegalBasisItem[])
                          (parsedLegalBasis as LegalBasisItem[]).map((basis, idx) => {
                            const sourceType = basis.sourceType || 'law'
                            const sourceTypeLabel = 
                              sourceType === 'law' ? '법령' :
                              sourceType === 'manual' ? '가이드라인' :
                              sourceType === 'case' ? '판례' :
                              sourceType === 'standard_contract' ? '표준계약서' :
                              '참고자료'
                            
                            const sourceTypeColor = 
                              sourceType === 'law' ? 'from-blue-100 to-blue-50 border-blue-300 text-blue-900' :
                              sourceType === 'manual' ? 'from-indigo-100 to-indigo-50 border-indigo-300 text-indigo-900' :
                              sourceType === 'case' ? 'from-purple-100 to-purple-50 border-purple-300 text-purple-900' :
                              sourceType === 'standard_contract' ? 'from-green-100 to-green-50 border-green-300 text-green-900' :
                              'from-slate-100 to-slate-50 border-slate-300 text-slate-900'

                            return (
                              <div 
                                key={idx} 
                                className={classNames(
                                  "bg-gradient-to-br border-2 rounded-lg p-3 shadow-sm hover:shadow-md transition-all",
                                  sourceTypeColor
                                )}
                              >
                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-white/80 border border-current/30">
                                        {sourceTypeLabel}
                                      </span>
                                      {basis.status && (
                                        <span className="text-[10px] text-slate-600">
                                          {basis.status === 'likely' ? '✓ 해당 가능성 높음' :
                                           basis.status === 'unclear' ? '? 불명확' :
                                           basis.status === 'unlikely' ? '✗ 해당 가능성 낮음' :
                                           basis.status}
                                        </span>
                                      )}
                                    </div>
                                    <h4 className="font-semibold text-xs mb-1.5 leading-tight">
                                      {basis.title}
                                    </h4>
                                  </div>
                                  <Scale className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
                                </div>
                                <div className="bg-white/60 rounded-lg p-2 border border-current/20">
                                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                                    {basis.snippet}
                                  </p>
                                </div>
                                {/* 파일 링크 (있는 경우) */}
                                {basis.filePath && (
                                  <div className="mt-2 pt-2 border-t border-current/20 flex items-center gap-1.5">
                                    <FileText className="w-3 h-3 opacity-60" />
                                    <span className="text-[10px] text-slate-600 flex-1 truncate" title={basis.title || basis.filePath}>
                                      {basis.title || basis.filePath.split('/').pop() || basis.filePath}
                                    </span>
                                    <a
                                      href={`${process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000'}/api/v2/legal/file?path=${encodeURIComponent(basis.filePath)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] text-blue-700 hover:text-blue-800 hover:underline flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors"
                                      title="원본 파일 보기"
                                    >
                                      <ExternalLink className="w-2.5 h-2.5" />
                                      열기
                                    </a>
                                    <a
                                      href={`${process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000'}/api/v2/legal/file?path=${encodeURIComponent(basis.filePath)}&download=true`}
                                      download
                                      className="text-[10px] text-blue-700 hover:text-blue-800 hover:underline flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors"
                                      title="파일 다운로드"
                                    >
                                      <Download className="w-2.5 h-2.5" />
                                      다운로드
                                    </a>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        ) : (
                          // 단순 문자열 형식 (string[])
                          parsedLegalBasis.map((basis, idx) => {
                            const basisText = typeof basis === 'string' ? basis : JSON.stringify(basis);
                            return (
                              <div 
                                key={idx} 
                                className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-3 shadow-sm hover:shadow-md transition-all"
                              >
                                <div className="flex items-start gap-2 mb-1.5">
                                  <BookOpen className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-300 mb-1.5 inline-block">
                                      법적 근거
                                    </span>
                                    <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                                      {basisText}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )
                          })
                        )}
                        {onAskAboutIssue && (
                          <button
                            type="button"
                            onClick={() => {
                              onAskAboutIssue(issue.id)
                              setActiveTab('issues')
                            }}
                            className="w-full ai-button border-2 hover:border-blue-400 hover:bg-blue-50 transition-all px-2.5 py-1.5 rounded-md bg-white text-slate-800 flex items-center justify-center text-xs font-medium"
                          >
                            이 근거로 다시 설명 듣기
                          </button>
                        )}
                      </div>
                    </details>
                  )
                })}

              {issues.filter(i => i.legalBasis && i.legalBasis.length > 0).length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <div className="bg-slate-50 rounded-lg p-4 border-2 border-slate-200">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-xs font-medium text-slate-600">법적 근거 정보가 없습니다.</p>
                    <p className="text-[10px] text-slate-500 mt-1.5">
                      각 위험 조항에 대한 법적 근거는 분석 결과에 따라 자동으로 표시됩니다.
                    </p>
                  </div>
                </div>
              )}
              </div>
            </div>
          </TabsContent>
        </div>

        {/* 수정안 모달 */}
        {selectedIssue && (
          <AmendmentModal
            issue={selectedIssue}
            isOpen={amendmentIssueId !== null}
            onClose={() => setAmendmentIssueId(null)}
          />
        )}
      </div>
    </Tabs>
  )
}
