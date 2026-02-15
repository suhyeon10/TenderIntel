'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Search, 
  BookOpen, 
  ChevronRight, 
  X, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileWarning,
  Scale,
  TrendingUp,
  MessageSquare,
  ArrowRight,
  Filter,
  Sparkles
} from 'lucide-react'
import { searchLegalCases } from '@/apis/legal.service'
import { cn } from '@/lib/utils'
import type { LegalCasePreview } from '@/apis/legal.service'

type CategoryFilter = 'all' | 'intern' | 'wage' | 'stock' | 'freelancer' | 'harassment'
type SortOption = 'recommended' | 'recent' | 'severity'

interface CaseCard extends LegalCasePreview {
  category?: CategoryFilter
  severity?: 'low' | 'medium' | 'high'
  keywords?: string[]
  legalIssues?: string[]
  learnings?: string[]
  actions?: string[]
}

// Mock 데이터 (실제로는 API에서 가져옴)
const MOCK_CASES: CaseCard[] = [
  {
    id: 'case_01_intern_termination',
    title: '수습 3개월 만에 "내일부터 나오지 마" 통보 받은 인턴',
    situation: '정규직 전환을 기대하며 인턴을 시작했지만, 별도 서면 통보 없이 구두로 계약 해지 통보를 받은 사례입니다.',
    main_issues: ['수습해고', '부당해고', '인턴'],
    category: 'intern',
    severity: 'high',
    keywords: ['#수습해고', '#부당해고', '#인턴'],
    legalIssues: [
      '근로기준법 제27조: 수습·해고 관련 규정',
      '서면통지 의무 위반 가능성',
      '실질 근로자성 인정 여부'
    ],
    learnings: [
      '수습 기간에도 근로기준법이 적용된다',
      '해고·계약해지는 가능하면 서면 통지 요구',
      '구두 통보만으로는 법적 효력이 약할 수 있다'
    ],
    actions: [
      '계약서·카톡·메일 등 증거 정리',
      'HR/대표와의 1차 대화 준비',
      '공공 상담기관(노무사·노동상담센터 등) 문의 고려'
    ]
  },
  {
    id: 'case_02_unpaid_overtime',
    title: '야근·주말 근무인데 초과수당 0원, "연봉에 다 포함"이라고 말하는 회사',
    situation: '주 52시간을 초과하여 근무하는데도 연장근로 수당이 지급되지 않고, 회사는 "연봉에 모두 포함되어 있다"고 주장하는 사례입니다.',
    main_issues: ['임금체불', '초과근무', '가산수당'],
    category: 'wage',
    severity: 'high',
    keywords: ['#임금체불', '#초과근무', '#가산수당'],
    legalIssues: [
      '근로기준법 제56조: 연장근로 가산수당 지급 의무',
      '"연봉에 포함"이라는 말만으로는 가산수당을 대체할 수 없음',
      '주 52시간 초과 근무 시 가산수당 필수'
    ],
    learnings: [
      '"연봉에 다 포함"이라는 말만으로 초과수당을 대체할 수 없다',
      '주 52시간 초과 시 50% 가산수당 필수',
      '출퇴근 기록을 반드시 보관해야 함'
    ],
    actions: [
      '출퇴근 기록, 근무 시간 증거 수집',
      '회사에 연장근로 수당 지급 요청 (서면)',
      '고용노동부 1350 상담센터 신고 고려'
    ]
  },
  {
    id: 'case_03_stock_option',
    title: '스톡옵션 계약서에 행사 조건이 모호하게 적혀있어요',
    situation: '스톡옵션 부여 조건과 행사 조건이 불명확하게 기재되어 있어, 실제 행사 시 문제가 발생할 가능성이 있는 사례입니다.',
    main_issues: ['스톡옵션', '계약조항', 'IP'],
    category: 'stock',
    severity: 'medium',
    keywords: ['#스톡옵션', '#계약조항', '#IP'],
    legalIssues: [
      '스톡옵션 행사 조건 명시 의무',
      '부여 시점과 행사 시점의 주가 차이',
      '퇴사 시 행사 권리 소멸 여부'
    ],
    learnings: [
      '스톡옵션 행사 조건은 반드시 명확히 기재되어야 함',
      '부여 시점과 행사 시점을 구분해야 함',
      '퇴사 시 행사 권리 소멸 여부 확인 필요'
    ],
    actions: [
      '계약서의 스톡옵션 조항 재검토',
      '회사에 행사 조건 명확화 요청',
      '변호사 상담 고려 (복잡한 경우)'
    ]
  },
  {
    id: 'case_04_freelancer_payment',
    title: '프리랜서 프로젝트 완료했는데 대금이 3개월째 안 들어와요',
    situation: '프로젝트를 완료하고 납품했지만, 계약서에 명시된 대금 지급일로부터 3개월이 지나도 대금이 지급되지 않는 사례입니다.',
    main_issues: ['프리랜서', '대금미지급', '용역계약'],
    category: 'freelancer',
    severity: 'high',
    keywords: ['#프리랜서', '#대금미지급', '#용역계약'],
    legalIssues: [
      '용역계약상 대금 지급 의무',
      '지연 손해금 청구 가능성',
      '실질 근로자성 인정 여부 (4대보험)'
    ],
    learnings: [
      '용역계약서에 대금 지급일을 명확히 기재해야 함',
      '지연 시 지연 손해금 청구 가능',
      '실질적으로 근로자에 가까우면 4대보험 가입 가능'
    ],
    actions: [
      '계약서, 납품 증거, 대화 기록 수집',
      '회사에 대금 지급 최고장 발송',
      '소액사건심판 또는 변호사 상담 고려'
    ]
  },
  {
    id: 'case_05_harassment',
    title: '팀장이 단톡방에서 반복적으로 모욕적인 말을 해요',
    situation: '팀장이 단체 채팅방에서 특정 직원을 지목하여 반복적으로 모욕적이고 인격 모독적인 발언을 하는 사례입니다.',
    main_issues: ['직장내괴롭힘', '모욕', '인격모독'],
    category: 'harassment',
    severity: 'high',
    keywords: ['#직장내괴롭힘', '#모욕', '#인격모독'],
    legalIssues: [
      '직장 내 괴롭힘 방지 및 근로자 보호에 관한 법률',
      '반복성과 지속성 판단 기준',
      '업무상 적정 범위를 벗어난 행위'
    ],
    learnings: [
      '직장 내 괴롭힘은 반복성과 지속성이 중요',
      '단톡방, 이메일 등 모든 증거를 보관해야 함',
      '회사에 신고하고 대응을 요구할 권리가 있음'
    ],
    actions: [
      '단톡방 캡처, 녹음 등 모든 증거 수집',
      '회사 인사팀 또는 상급자에게 신고',
      '고용노동부 직장 내 괴롭힘 신고 고려'
    ]
  }
]

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: '전체',
  intern: '인턴/수습',
  wage: '근로시간·임금',
  stock: '스톡옵션',
  freelancer: '프리랜서',
  harassment: '직장 내 괴롭힘',
}

const SEVERITY_LABELS: Record<string, { label: string; color: string }> = {
  low: { label: '주의', color: 'bg-green-100 text-green-700 border-green-300' },
  medium: { label: '경고', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  high: { label: '매우 위험', color: 'bg-red-100 text-red-700 border-red-300' },
}

export default function CasesPage() {
  const router = useRouter()
  
  // 상태
  const [cases, setCases] = useState<CaseCard[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [sortOption, setSortOption] = useState<SortOption>('recommended')
  const [selectedCase, setSelectedCase] = useState<CaseCard | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // 초기 데이터 로드
  useEffect(() => {
    const loadCases = async () => {
      setLoading(true)
      try {
        // 실제 API 호출 시도
        if (searchQuery.trim()) {
          const apiCases = await searchLegalCases(searchQuery, 20)
          const convertedCases: CaseCard[] = apiCases.map((apiCase) => ({
            ...apiCase,
            category: 'all' as CategoryFilter,
            severity: 'medium' as const,
            keywords: apiCase.main_issues.map(issue => `#${issue}`),
          }))
          setCases(convertedCases.length > 0 ? convertedCases : MOCK_CASES)
        } else {
          // 검색어가 없으면 mock 데이터 사용
          setCases(MOCK_CASES)
        }
      } catch (error) {
        console.error('케이스 로드 오류:', error)
        // API 실패 시 mock 데이터 사용
        setCases(MOCK_CASES)
      } finally {
        setLoading(false)
      }
    }

    loadCases()
  }, [searchQuery])

  // 필터링 및 정렬
  const filteredAndSortedCases = cases
    .filter(caseItem => {
      if (categoryFilter === 'all') return true
      return caseItem.category === categoryFilter
    })
    .filter(caseItem => {
      if (!searchQuery.trim()) return true
      const query = searchQuery.toLowerCase()
      return (
        caseItem.title.toLowerCase().includes(query) ||
        caseItem.situation.toLowerCase().includes(query) ||
        caseItem.main_issues.some(issue => issue.toLowerCase().includes(query))
      )
    })
    .sort((a, b) => {
      switch (sortOption) {
        case 'severity':
          const severityOrder = { high: 3, medium: 2, low: 1 }
          return (severityOrder[b.severity || 'medium'] || 0) - (severityOrder[a.severity || 'medium'] || 0)
        case 'recent':
          // 최근 추가 순 (임시로 ID 기준)
          return b.id.localeCompare(a.id)
        case 'recommended':
        default:
          return 0
      }
    })

  const handleCaseClick = (caseItem: CaseCard) => {
    setSelectedCase(caseItem)
    setIsModalOpen(true)
  }

  const handleAnalyzeClick = () => {
    setIsModalOpen(false)
    router.push('/legal/situation')
  }

  // 카테고리별 케이스 개수 계산
  const categoryCounts = cases.reduce((acc, caseItem) => {
    const cat = caseItem.category || 'all'
    acc[cat] = (acc[cat] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-7xl">
        {/* Header */}
        <div className="mb-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full mb-4 shadow-lg">
              <BookOpen className="w-5 h-5" />
              <span className="font-semibold">케이스 스터디룸</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              케이스로 배우는 청년 노동·계약 사례
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
              인턴 해고, 무급 야근, 스톡옵션 박탈, 프리랜서 대금 미지급까지
              <br />
              실제와 비슷한 시나리오를 기반으로, 법적 쟁점과 배울 점을 정리했어요.
            </p>
          </div>

          {/* 요약 통계/태그 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <div className="px-4 py-2 bg-white/80 backdrop-blur-sm border-2 border-slate-200 rounded-xl shadow-sm">
              <span className="text-sm font-semibold text-slate-700">총 </span>
              <span className="text-lg font-bold text-blue-600">{cases.length}개</span>
              <span className="text-sm font-semibold text-slate-700"> 케이스</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-center">
              {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).filter(cat => cat !== 'all' && categoryCounts[cat] > 0).map((category) => (
                <span
                  key={category}
                  className="inline-flex items-center px-2 py-1 rounded-full bg-slate-100 text-[11px] font-medium text-slate-700 border border-slate-200"
                >
                  {CATEGORY_LABELS[category]} {categoryCounts[category] || 0}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Filter / Search Area */}
        <Card className="mb-8 border-2 border-slate-200 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardContent className="p-5 space-y-5">
            {/* 검색바 */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // 검색 실행 (이미 searchQuery가 변경되면 자동으로 필터링됨)
                    }
                  }}
                  placeholder="예: 수습 후 바로 해고, 무급 야근, 프리랜서 대금 미지급"
                  className="pl-10 h-12 text-base border-2 border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <Button
                onClick={() => {
                  // 검색 실행 (이미 searchQuery가 변경되면 자동으로 필터링됨)
                }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg h-12 px-6"
              >
                <Search className="w-5 h-5 mr-2" />
                검색
              </Button>
            </div>

            {/* 필터 및 정렬 */}
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between pt-4 border-t border-slate-200">
              {/* 카테고리 필터 */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1 self-center">
                  <Filter className="w-4 h-4" />
                  카테고리:
                </span>
                {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((category) => (
                  <button
                    key={category}
                    onClick={() => setCategoryFilter(category)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200",
                      categoryFilter === category
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md scale-105"
                        : "bg-white border-2 border-slate-300 text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm"
                    )}
                  >
                    {CATEGORY_LABELS[category]}
                  </button>
                ))}
              </div>

              {/* 정렬 */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">정렬:</span>
                <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
                  <SelectTrigger className="w-[160px] h-9 border-2 border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recommended">추천순</SelectItem>
                    <SelectItem value="recent">최근 추가순</SelectItem>
                    <SelectItem value="severity">심각도 높은 순</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cases Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="animate-pulse rounded-2xl border-2 border-slate-200 bg-white shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-5 w-20 bg-slate-200 rounded-full" />
                    <div className="h-5 w-16 bg-slate-200 rounded-full" />
                  </div>
                  <div className="h-5 bg-slate-200 rounded mb-3" />
                  <div className="h-5 bg-slate-200 rounded w-4/5 mb-4" />
                  <div className="h-16 bg-slate-200 rounded mb-4" />
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-3" />
                  <div className="h-4 bg-slate-200 rounded w-2/3 mb-4" />
                  <div className="h-8 bg-slate-200 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredAndSortedCases.length === 0 ? (
          <Card className="text-center py-16 border-2 border-slate-200 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent>
              <div className="p-4 bg-slate-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <Search className="w-10 h-10 text-slate-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                해당 조건에 맞는 케이스를 찾지 못했어요
              </h3>
              <p className="text-slate-600 mb-6 max-w-md mx-auto leading-relaxed">
                그래도 상담이 필요하다면, 바로 내 상황을 직접 입력해서 분석 받아보세요.
              </p>
              <Button
                onClick={() => router.push('/legal/situation')}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg h-12 px-8"
                size="lg"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                내 상황 직접 분석 받기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAndSortedCases.map((caseItem) => (
              <Card
                key={caseItem.id}
                className="rounded-2xl border-2 border-slate-200 bg-white shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-200 group cursor-pointer"
                onClick={() => handleCaseClick(caseItem)}
              >
                <CardContent className="p-5">
                  {/* 상단 라벨 영역 */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] bg-slate-100 text-slate-700 rounded-full px-2 py-[2px] font-semibold">
                      {CATEGORY_LABELS[caseItem.category || 'all']}
                    </span>
                    {caseItem.severity && (
                      <span className={cn(
                        "text-[11px] rounded-full px-2.5 py-[2px] font-semibold border",
                        caseItem.severity === 'high'
                          ? "bg-red-100 text-red-700 border-red-300"
                          : caseItem.severity === 'medium'
                          ? "bg-amber-100 text-amber-700 border-amber-300"
                          : "bg-emerald-100 text-emerald-700 border-emerald-300"
                      )}>
                        {caseItem.severity === 'high' ? '심각도: 높음' : caseItem.severity === 'medium' ? '심각도: 중간' : '심각도: 낮음'}
                      </span>
                    )}
                  </div>

                  {/* 제목 */}
                  <h3 className="text-sm font-semibold text-slate-900 mb-2 line-clamp-1 group-hover:text-blue-700 transition-colors">
                    {caseItem.title}
                  </h3>

                  {/* 한 줄 설명 */}
                  <p className="text-xs text-slate-600 mb-4 line-clamp-2 leading-relaxed">
                    {caseItem.situation}
                  </p>

                  {/* 법적 쟁점 & 배울 점 미리보기 */}
                  <div className="space-y-3 mb-4">
                    {/* 법적 쟁점 미리보기 */}
                    {caseItem.legalIssues && caseItem.legalIssues.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">법적 쟁점</p>
                        <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                          {caseItem.legalIssues.slice(0, 2).join(', ')}
                          {caseItem.legalIssues.length > 2 && ' 등'}
                        </p>
                      </div>
                    )}

                    {/* 배울 점 미리보기 */}
                    {caseItem.learnings && caseItem.learnings.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">이 케이스에서 배울 점</p>
                        <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                          {caseItem.learnings[0]}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 카드 하단 액션 영역 */}
                  <div className="pt-4 border-t-2 border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] text-slate-500 line-clamp-1 flex-1">
                        키워드: {caseItem.main_issues.slice(0, 3).join(', ')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs border-slate-300 hover:bg-slate-50 hover:border-blue-300"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCaseClick(caseItem)
                        }}
                      >
                        자세히 보기
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 h-8 text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          // 케이스 정보를 localStorage에 저장하고 /legal/situation으로 이동
                          localStorage.setItem('lastCase', JSON.stringify({
                            id: caseItem.id,
                            title: caseItem.title,
                            situation: caseItem.situation,
                            category: caseItem.category
                          }))
                          router.push('/legal/situation?fromCase=' + caseItem.id)
                        }}
                      >
                        내 상황과 비교
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Case Detail Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-gradient-to-br from-white to-slate-50/50">
            {selectedCase && (
              <>
                <DialogHeader className="pb-4 border-b-2 border-slate-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <DialogTitle className="text-2xl font-extrabold text-slate-900 mb-3">
                        {selectedCase.title}
                      </DialogTitle>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs bg-slate-100 text-slate-700 rounded-full px-3 py-1.5 font-semibold">
                          {CATEGORY_LABELS[selectedCase.category || 'all']}
                        </span>
                        {selectedCase.severity && (
                          <span className={cn(
                            "text-xs rounded-full px-3 py-1.5 font-semibold border",
                            selectedCase.severity === 'high'
                              ? "bg-red-100 text-red-700 border-red-300"
                              : selectedCase.severity === 'medium'
                              ? "bg-amber-100 text-amber-700 border-amber-300"
                              : "bg-emerald-100 text-emerald-700 border-emerald-300"
                          )}>
                            심각도: {selectedCase.severity === 'high' ? '높음' : selectedCase.severity === 'medium' ? '중간' : '낮음'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          localStorage.setItem('lastCase', JSON.stringify({
                            id: selectedCase.id,
                            title: selectedCase.title,
                            situation: selectedCase.situation,
                            category: selectedCase.category
                          }))
                          setIsModalOpen(false)
                          router.push('/legal/situation?fromCase=' + selectedCase.id)
                        }}
                        className="h-9 border-blue-300 hover:bg-blue-50 hover:border-blue-400 text-blue-700"
                      >
                        <MessageSquare className="w-4 h-4 mr-1.5" />
                        내 상황으로 분석
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsModalOpen(false)}
                        className="h-9 w-9 p-0"
                      >
                        <X className="w-5 h-5" />
                      </Button>
                    </div>
                  </div>
                </DialogHeader>

                <div className="space-y-6 pt-6">
                  {/* [1] 상황 요약 */}
                  <div className="border-t-2 border-slate-200 pt-6">
                    <h3 className="text-xs font-semibold text-slate-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      상황 요약
                    </h3>
                    <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-xl p-5 border border-slate-200">
                      <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-line">
                        {selectedCase.situation}
                      </p>
                    </div>
                  </div>

                  {/* [2] 법적 쟁점 */}
                  {selectedCase.legalIssues && selectedCase.legalIssues.length > 0 && (
                    <div className="border-t-2 border-slate-200 pt-6">
                      <h3 className="text-xs font-semibold text-slate-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                        <Scale className="w-4 h-4 text-blue-600" />
                        법적 쟁점
                      </h3>
                      <ul className="space-y-2">
                        {selectedCase.legalIssues.map((issue, index) => (
                          <li key={index} className="flex items-start gap-2 text-xs leading-relaxed text-slate-700">
                            <span className="text-blue-600 mt-1 font-bold">·</span>
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* [3] AI 요약 & 배울 점 */}
                  {selectedCase.learnings && selectedCase.learnings.length > 0 && (
                    <div className="border-t-2 border-slate-200 pt-6">
                      <h3 className="text-xs font-semibold text-slate-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                        <TrendingUp className="w-4 h-4 text-blue-600" />
                        AI 요약 & 배울 점
                      </h3>
                      <div className="space-y-3">
                        {selectedCase.learnings.map((learning, index) => (
                          <div key={index} className="flex items-start gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs leading-relaxed text-slate-700 flex-1">{learning}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* [4] 행동 가이드 */}
                  {selectedCase.actions && selectedCase.actions.length > 0 && (
                    <div className="border-t-2 border-slate-200 pt-6">
                      <h3 className="text-xs font-semibold text-slate-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                        <FileWarning className="w-4 h-4 text-blue-600" />
                        비슷한 상황에서의 행동 가이드
                      </h3>
                      <ul className="space-y-2">
                        {selectedCase.actions.map((action, index) => (
                          <li key={index} className="flex items-start gap-2 text-xs leading-relaxed text-slate-700">
                            <span className="text-blue-600 mt-1 font-bold">·</span>
                            <span>{action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 하단 CTA */}
                  <div className="pt-6 border-t-2 border-slate-200">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <p className="text-[10px] text-amber-800 leading-relaxed flex-1">
                        * 실제 법률 자문이 아닌, 공개된 가이드와 사례를 바탕으로 한 교육용 요약입니다.
                      </p>
                      <Button
                        onClick={() => {
                          localStorage.setItem('lastCase', JSON.stringify({
                            id: selectedCase.id,
                            title: selectedCase.title,
                            situation: selectedCase.situation,
                            category: selectedCase.category
                          }))
                          setIsModalOpen(false)
                          router.push('/legal/situation?fromCase=' + selectedCase.id)
                        }}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg h-11 px-6"
                        size="lg"
                      >
                        <Sparkles className="w-5 h-5 mr-2" />
                        이 케이스 기반으로 내 상황 분석 받기
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
