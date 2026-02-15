'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Loader2, AlertTriangle, CheckCircle2, Copy, FileText, Sparkles, Info, ChevronDown, ChevronUp, Scale, Clock, DollarSign, Users, Briefcase, TrendingUp, Zap, MessageSquare, XCircle, ExternalLink, Phone, Globe, BookOpen, Download } from 'lucide-react'
import { analyzeSituationV2, type SituationRequestV2, type SituationResponseV2, getSituationAnalysisByIdV2 } from '@/apis/legal.service'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { MarkdownRenderer } from '@/components/rag/MarkdownRenderer'
import { RAGHighlightedMarkdown, RAGHighlightedText } from '@/components/legal/RAGHighlightedText'
import { SituationChat } from '@/components/legal/SituationChat'
import { LegalReportCard } from '@/components/legal/LegalReportCard'
import { ActionDashboard } from '@/components/legal/ActionDashboard'
import type { 
  SituationCategory, 
  EmploymentType, 
  WorkPeriod, 
  SocialInsurance,
  SituationAnalysisRequest,
  SituationAnalysisResponse,
  RelatedCase
} from '@/types/legal'

const SITUATION_CATEGORIES: { value: SituationCategory; label: string }[] = [
  { value: 'probation', label: '인턴/수습 해고' },
  { value: 'unfair_dismissal', label: '정규직 해고·계약해지' },
  { value: 'unpaid_wage', label: '임금 체불·무급 야근' },
  { value: 'harassment', label: '직장 내 괴롭힘' },
  { value: 'freelancer', label: '프리랜서/용역' },
  { value: 'stock_option', label: '스톡옵션/성과급' },
  { value: 'other', label: '기타/복합 상황' },
]

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: 'regular', label: '정규직' },
  { value: 'contract', label: '계약직' },
  { value: 'intern', label: '인턴' },
  { value: 'freelancer', label: '프리랜서' },
  { value: 'part_time', label: '알바' },
  { value: 'other', label: '기타' },
]

const WORK_PERIODS: { value: WorkPeriod; label: string }[] = [
  { value: 'under_3_months', label: '3개월 미만' },
  { value: '3_12_months', label: '3~12개월' },
  { value: '1_3_years', label: '1~3년' },
  { value: 'over_3_years', label: '3년 이상' },
]

const SOCIAL_INSURANCE_OPTIONS: { value: SocialInsurance; label: string }[] = [
  { value: 'all', label: '모두 가입' },
  { value: 'partial', label: '일부만' },
  { value: 'none', label: '전혀 없음' },
  { value: 'unknown', label: '모름' },
]

// 기관 정보 상수
interface OrganizationInfo {
  id: string
  name: string
  description: string
  capabilities: string[]
  requiredDocs: string[]
  legalBasis?: string
  website?: string
  phone?: string
  icon: React.ComponentType<{ className?: string }>
}

const ORGANIZATIONS: OrganizationInfo[] = [
  {
    id: 'moel',
    name: '노동청',
    description: '체불임금 조사 및 시정 명령, 근로기준법 위반 조사',
    capabilities: ['체불임금 조사', '시정 명령', '근로기준법 위반 조사'],
    requiredDocs: ['근로계약서', '출퇴근 기록', '급여명세서'],
    legalBasis: '근로기준법 제110조: 근로감독관의 권한',
    website: 'https://www.moel.go.kr',
    phone: '1350',
    icon: Scale,
  },
  {
    id: 'labor_attorney',
    name: '노무사',
    description: '상담 및 소송 대리, 근로 분쟁 해결 전문',
    capabilities: ['상담', '소송 대리', '근로 분쟁 해결'],
    requiredDocs: ['근로계약서', '문자/카톡 대화', '기타 증거 자료'],
    legalBasis: '노무사법: 근로 분쟁 전문 법률 서비스',
    icon: Briefcase,
  },
  {
    id: 'comwel',
    name: '근로복지공단',
    description: '연차수당, 휴일수당, 실업급여 상담',
    capabilities: ['연차수당 상담', '휴일수당 상담', '실업급여 안내'],
    requiredDocs: ['근로계약서', '출퇴근 기록', '급여명세서'],
    legalBasis: '근로기준법 제60조: 연차 유급휴가',
    website: 'https://www.comwel.or.kr',
    phone: '1588-0075',
    icon: Users,
  },
  {
    id: 'moel_complaint',
    name: '고용노동부 고객상담센터',
    description: '직장 내 괴롭힘, 차별 상담 및 조사, 고용·노동 전반 상담',
    capabilities: ['직장 내 괴롭힘 상담', '차별 상담', '조사 지원', '고용·노동 전반 상담'],
    requiredDocs: ['증거 자료', '문자/카톡 대화', '녹음 파일'],
    legalBasis: '직장 내 괴롭힘 방지법 제13조: 고충 처리',
    website: 'https://1350.moel.go.kr/home/hp/main/hpmain.do',
    phone: '1350',
    icon: AlertTriangle,
  },
  {
    id: 'human_rights',
    name: '국가인권위원회',
    description: '인권 침해 상담 및 조사, 차별 구제',
    capabilities: ['인권 침해 상담', '차별 구제', '조사 및 구제'],
    requiredDocs: ['증거 자료', '차별 사례 기록'],
    legalBasis: '국가인권위원회법: 인권 침해 구제',
    website: 'https://www.humanrights.go.kr',
    phone: '1331',
    icon: Scale,
  },
]

// 상황 유형별 추천 기관 매핑
const getRecommendedOrganizations = (category: SituationCategory): OrganizationInfo[] => {
  const recommendations: Record<SituationCategory, string[]> = {
    unpaid_wage: ['moel', 'labor_attorney', 'comwel'],
    harassment: ['moel_complaint', 'human_rights', 'labor_attorney'],
    unfair_dismissal: ['moel', 'labor_attorney', 'comwel'],
    overtime: ['moel', 'labor_attorney', 'comwel'],
    probation: ['moel', 'labor_attorney', 'comwel'],
    freelancer: ['labor_attorney', 'moel', 'comwel'],
    stock_option: ['labor_attorney', 'moel', 'comwel'],
    other: ['labor_attorney', 'moel', 'comwel'],
    unknown: ['labor_attorney', 'moel', 'comwel'],
  }
  
  const orgIds = recommendations[category] || recommendations.unknown
  return orgIds.map(id => ORGANIZATIONS.find(org => org.id === id)!).filter(Boolean)
}

// 증거 자료 목록
const EVIDENCE_DOCS = [
  '근로계약서',
  '출퇴근 기록',
  '급여명세서',
  '문자/카톡 대화',
  '이메일',
  '녹음 파일',
  '사진/동영상',
  '증인 정보',
]

// 상황 템플릿 (5-6개로 확장)
const SITUATION_TEMPLATES = [
  {
    title: '인턴/수습 해고 통보',
    icon: Briefcase,
    category: 'probation' as SituationCategory,
    employmentType: 'intern' as EmploymentType,
    workPeriod: 'under_3_months' as WorkPeriod,
    summary: '수습 인턴인데, 해고 통보를 받았어요',
    description: '수습 기간 중 갑작스러운 해고 통보를 받은 경우',
    details: `[언제부터]
예: 2025년 1월부터, 수습 인턴으로 근무 중입니다.

[어떤 일이 반복되나요]
예: 최근 2주 동안, 팀장님이...

[내가 느끼는 문제점]
예: 수습이라서 언제든 내보낼 수 있다고 반복적으로 말하며...`,
  },
  {
    title: '무급 야근·추가 근무',
    icon: Clock,
    category: 'unpaid_wage' as SituationCategory,
    employmentType: 'regular' as EmploymentType,
    summary: '야근은 매일인데 수당은 없어요',
    description: '연장근로 수당 없이 야근이나 추가 근무를 요구받는 경우',
    details: `[언제부터]
예: 2024년 10월쯤부터, 거의 매주 회의 때마다...

[어떤 일이 반복되나요]
예: 매일 밤 10시 이후까지 근무하는데, 연장근로 수당은 전혀 지급되지 않습니다.

[내가 느끼는 문제점]
예: 법적으로 받아야 할 수당을 받지 못하고 있어서...`,
  },
  {
    title: '임금 체불·수당 미지급',
    icon: DollarSign,
    category: 'unpaid_wage' as SituationCategory,
    summary: '3개월째 월급이 매번 일주일 이상 늦게 들어와요',
    description: '월급이나 수당이 지급되지 않거나 지연되는 경우',
    details: `[언제부터]
예: 2024년 9월부터 월급 지급이 불규칙해지기 시작했습니다.

[어떤 일이 반복되나요]
예: 계약서에는 매월 25일 지급이라고 되어 있는데, 실제로는 다음 달 초에야 들어옵니다.

[내가 느끼는 문제점]
예: 생활비 계획을 세우기 어려워서...`,
  },
  {
    title: '직장 내 괴롭힘·모욕 발언',
    icon: Users,
    category: 'harassment' as SituationCategory,
    summary: '단톡방/회의에서 모욕적인 말을 들어요',
    description: '상사나 동료로부터 모욕적 발언이나 괴롭힘을 당하는 경우',
    details: `[언제부터]
예: 2024년 10월쯤부터, 거의 매주 회의 때마다...

[누가, 누구에게, 어떤 상황에서 그런 말을/행동을 하나요]
예: 팀장 A가, 팀원들 다 있는 자리에서 특정 사람을 지목해...

[내가 느끼기에 어떤 점이 가장 힘들었나요]
예: 인격을 부정당하는 느낌이라 정신적으로 버티기 힘듦...`,
  },
  {
    title: '프리랜서/용역 대금 미지급',
    icon: FileText,
    category: 'freelancer' as SituationCategory,
    employmentType: 'freelancer' as EmploymentType,
    summary: '프리랜서인데, 대금이 계속 밀려요',
    description: '프리랜서나 용역 계약에서 대금이 지급되지 않는 경우',
    details: `[언제부터]
예: 2024년 11월부터, 프로젝트 완료 후 대금 지급이 계속 지연되고 있습니다.

[어떤 일이 반복되나요]
예: 계약서에는 "프로젝트 완료 후 7일 이내 지급"이라고 되어 있는데, 3개월째 미지급 상태입니다.

[내가 느끼는 문제점]
예: 생활비를 충당하기 어려워서...`,
  },
  {
    title: '스톡옵션/성과급 관련 문제',
    icon: TrendingUp,
    category: 'stock_option' as SituationCategory,
    summary: '스톡옵션이나 성과급이 약속과 다르게 지급되지 않아요',
    description: '스톡옵션이나 성과급 관련 약속이 지켜지지 않는 경우',
    details: `[언제부터]
예: 입사 시 스톡옵션을 받기로 약속받았는데...

[어떤 일이 반복되나요]
예: 계약서에는 명시되어 있지 않고, 구두로만 약속받았습니다.

[내가 느끼는 문제점]
예: 퇴사 시 스톡옵션을 받을 수 있을지 불확실해서...`,
  },
]

// 상황 유형별 placeholder
const getSummaryPlaceholder = (category: SituationCategory): string => {
  switch (category) {
    case 'harassment':
      return '예: 팀장이 단톡방에서 반복적으로 모욕적인 말을 합니다'
    case 'unpaid_wage':
      return '예: 3개월째 월급이 매번 일주일 이상 늦게 들어와요'
    case 'unfair_dismissal':
      return '예: 수습 중인데 갑자기 해고 통보만 받았어요'
    case 'overtime':
      return '예: 인턴인데 야근은 매일인데 수당이 전혀 없어요'
    case 'probation':
      return '예: 수습 기간 중인데 계약 해지 통보를 받았어요'
    default:
      return '예: 인턴인데 야근은 매일인데 수당이 전혀 없어요'
  }
}

export default function SituationAnalysisPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  // 폼 상태
  const [categoryHint, setCategoryHint] = useState<SituationCategory>('unknown')
  const [summary, setSummary] = useState('') // 한 줄 요약
  const [details, setDetails] = useState('') // 자세한 설명
  const [showAdvanced, setShowAdvanced] = useState(false) // 고급 정보 표시 여부
  const [showDetailsGuide, setShowDetailsGuide] = useState(false) // 자세한 설명 안내 문구 표시 여부
  const [employmentType, setEmploymentType] = useState<EmploymentType | undefined>(undefined)
  const [workPeriod, setWorkPeriod] = useState<WorkPeriod | undefined>(undefined)
  const [weeklyHours, setWeeklyHours] = useState<number>(40)
  const [isProbation, setIsProbation] = useState<boolean | 'unknown'>('unknown')
  const [socialInsurance, setSocialInsurance] = useState<SocialInsurance | undefined>(undefined)

  // 분석 결과 상태
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<SituationAnalysisResponse | null>(null)
  const [analysisId, setAnalysisId] = useState<string | null>(null)  // situation_analyses의 ID 저장
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [checkedEvidence, setCheckedEvidence] = useState<Set<string>>(new Set())
  const [showSourcesList, setShowSourcesList] = useState(false)  // 참고 법령 리스트 표시 여부
  const [showSourcesPopover, setShowSourcesPopover] = useState(false)  // 참고 자료 Popover 표시 여부

  // 체크박스 상태를 localStorage에서 불러오기
  useEffect(() => {
    if (analysisId && typeof window !== 'undefined') {
      const saved = localStorage.getItem(`checked_items_${analysisId}`)
      if (saved) {
        try {
          setCheckedItems(new Set(JSON.parse(saved)))
        } catch (e) {
          // 체크박스 상태 불러오기 실패 (무시)
        }
      }
      
      // 증거 자료 체크 상태 불러오기
      const savedEvidence = localStorage.getItem(`checked_evidence_${analysisId}`)
      if (savedEvidence) {
        try {
          setCheckedEvidence(new Set(JSON.parse(savedEvidence)))
        } catch (e) {
          // 증거 자료 체크 상태 불러오기 실패 (무시)
        }
      }
    }
  }, [analysisId])

  // 체크박스 상태를 localStorage에 저장
  useEffect(() => {
    if (analysisId && typeof window !== 'undefined' && checkedItems.size > 0) {
      localStorage.setItem(`checked_items_${analysisId}`, JSON.stringify(Array.from(checkedItems)))
    }
  }, [checkedItems, analysisId])
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false)

  // analysisId로 분석 결과 불러오기
  const loadAnalysisById = useCallback(async (analysisId: string) => {
    try {
      setIsLoadingAnalysis(true)
      const { createSupabaseBrowserClient } = await import('@/supabase/supabase-client')
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id || null
      
      const analysis = await getSituationAnalysisByIdV2(analysisId, userId) as any
      
      if (!analysis) {
        toast({
          title: '분석 결과를 찾을 수 없습니다',
          description: '요청하신 분석 결과가 존재하지 않습니다.',
          variant: 'destructive',
        })
        return
      }
      
      // 분석 ID 저장
      setAnalysisId(analysisId)
      
      // v2 응답을 v1 형식으로 변환
      // analysis JSONB 필드에서 직접 데이터 추출
      const analysisData = analysis?.analysis || {}
      
      // 여러 경로에서 criteria 찾기 (우선순위: 최상위 > analysis.analysis > analysisData)
      const criteriaFromTop = analysis?.criteria
      const criteriaFromNestedAnalysis = analysis?.analysis?.criteria
      const criteriaFromAnalysis = analysisData?.criteria
      
      // 우선순위에 따라 criteria 선택
      let criteriaRaw = null
      if (criteriaFromTop && Array.isArray(criteriaFromTop) && criteriaFromTop.length > 0) {
        criteriaRaw = criteriaFromTop
      } else if (criteriaFromNestedAnalysis && Array.isArray(criteriaFromNestedAnalysis) && criteriaFromNestedAnalysis.length > 0) {
        criteriaRaw = criteriaFromNestedAnalysis
      } else if (criteriaFromAnalysis && Array.isArray(criteriaFromAnalysis) && criteriaFromAnalysis.length > 0) {
        criteriaRaw = criteriaFromAnalysis
      } else {
        criteriaRaw = []
      }
      
      // criteria가 배열이 아니거나 비어있으면 빈 배열로 설정
      const criteriaArray = Array.isArray(criteriaRaw) ? criteriaRaw : []
      
      const v1Format: SituationAnalysisResponse = {
        classifiedType: (analysis?.tags?.[0] || analysisData?.classifiedType || 'unknown') as SituationCategory,
        riskScore: analysis?.riskScore ?? analysis?.risk_score ?? analysisData?.riskScore ?? 0,
        summary: analysisData?.summary || analysis?.analysis?.summary || '',
        // criteria는 새로운 RAG 기반 구조 (CriteriaItemV2) 그대로 사용
        criteria: criteriaArray.map((criterion: any) => ({
          documentTitle: criterion?.documentTitle || criterion?.name || '',
          fileUrl: criterion?.fileUrl || null,
          sourceType: criterion?.sourceType || 'law',
          similarityScore: criterion?.similarityScore || 0,
          snippet: criterion?.snippet || '',
          usageReason: criterion?.usageReason || criterion?.reason || '',
        })),
        sources: (analysis?.sources || analysisData?.sources || []).map((source: any) => ({
          sourceId: source.sourceId || source.source_id || '',
          sourceType: (source.sourceType || source.source_type || 'law') as 'law' | 'manual' | 'case',
          title: source.title || '',
          snippet: source.snippet || '',
          score: source.score || 0,
          externalId: source.externalId || source.external_id,
          fileUrl: source.fileUrl || source.file_url,
        })),
        actionPlan: null,
        scripts: analysisData?.scripts || analysis?.scripts || {
          toCompany: undefined,
          toAdvisor: undefined,
        },
        relatedCases: (analysis?.relatedCases || []).map((c: any) => {
          // 새 구조 (documentTitle, fileUrl, sourceType, externalId, overallSimilarity, summary, snippets)
          if (c?.documentTitle && c?.snippets) {
            return {
              documentTitle: c.documentTitle,
              fileUrl: c.fileUrl,
              sourceType: c.sourceType || 'law',
              externalId: c.externalId || '',
              overallSimilarity: c.overallSimilarity || 0,
              summary: c.summary || '',
              snippets: c.snippets || [],
            };
          }
          // 레거시 구조 (id, title, summary) - 하위 호환성
          return {
            documentTitle: c?.title || c?.documentTitle || '',
            fileUrl: c?.fileUrl,
            sourceType: c?.sourceType || 'law',
            externalId: c?.externalId || c?.id || '',
            overallSimilarity: c?.overallSimilarity || 0,
            summary: c?.summary || '',
            snippets: [{
              snippet: c?.summary || '',
              similarityScore: 0,
              usageReason: '',
            }],
          };
        }),
        organizations: analysis?.organizations || analysisData?.organizations || [],
      }
      
      setAnalysisResult(v1Format)
      
      // 원본 상황 텍스트도 표시
      if (analysis.situation) {
        const situationParts = analysis.situation.split('\n\n')
        if (situationParts.length > 0) {
          setSummary(situationParts[0])
        }
        if (situationParts.length > 1) {
          setDetails(situationParts.slice(1).join('\n\n'))
        }
      }
      
      // 카테고리 설정
      if (analysis.category) {
        setCategoryHint(analysis.category as SituationCategory)
      }
      
      // 스크롤을 결과 영역으로 이동
      setTimeout(() => {
        const resultElement = document.getElementById('analysis-result')
        if (resultElement) {
          resultElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    } catch (error: any) {
      toast({
        title: '오류',
        description: error?.message || '분석 결과를 불러오는 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingAnalysis(false)
    }
  }, [toast])

  // analysisId 쿼리 파라미터가 있으면 해당 분석 불러오기
  useEffect(() => {
    const analysisId = searchParams.get('analysisId')
    if (analysisId) {
      loadAnalysisById(analysisId)
    }
  }, [searchParams, loadAnalysisById])

  // 템플릿 선택 핸들러 - 스크롤 및 하이라이트 효과 추가
  const handleTemplateSelect = (template: typeof SITUATION_TEMPLATES[0]) => {
    setCategoryHint(template.category)
    setSummary(template.summary)
    setDetails(template.details)
    if (template.employmentType) {
      setEmploymentType(template.employmentType)
    }
    if (template.workPeriod) {
      setWorkPeriod(template.workPeriod)
    }
    // 수습 관련 템플릿이면 자동으로 수습 여부 설정
    if (template.category === 'probation' || template.employmentType === 'intern') {
      setIsProbation(true)
    }
    
    // 입력 폼 영역으로 부드럽게 스크롤
    setTimeout(() => {
      const formSection = document.getElementById('situation-input-form')
      if (formSection) {
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
        
        // 하이라이트 효과를 위한 클래스 추가
        const summaryInput = document.getElementById('summary')
        const detailsTextarea = document.getElementById('details')
        
        if (summaryInput) {
          summaryInput.classList.add('ring-4', 'ring-blue-300', 'ring-offset-2')
          setTimeout(() => {
            summaryInput.classList.remove('ring-4', 'ring-blue-300', 'ring-offset-2')
          }, 2000)
        }
        
        if (detailsTextarea) {
          detailsTextarea.classList.add('ring-4', 'ring-blue-300', 'ring-offset-2')
          setTimeout(() => {
            detailsTextarea.classList.remove('ring-4', 'ring-blue-300', 'ring-offset-2')
          }, 2000)
        }
      }
    }, 100)
  }

  // 예시 텍스트 불러오기
  const loadExampleText = () => {
    const exampleTexts: Record<SituationCategory, string> = {
      harassment: `[언제부터]
예: 2024년 10월쯤부터, 거의 매주 회의 때마다...

[누가, 누구에게, 어떤 상황에서 그런 말을/행동을 하나요]
예: 팀장 A가, 팀원들 다 있는 자리에서 특정 사람을 지목해 모욕적인 발언을 합니다.

[내가 느끼기에 어떤 점이 가장 힘들었나요]
예: 인격을 부정당하는 느낌이라 정신적으로 버티기 힘듭니다.`,
      unpaid_wage: `[언제부터]
예: 2024년 9월부터 월급 지급이 불규칙해지기 시작했습니다.

[어떤 일이 반복되나요]
예: 계약서에는 매월 25일 지급이라고 되어 있는데, 실제로는 다음 달 초에야 들어옵니다.

[지금까지 어떤 대화를 나눴는지]
예: 인사팀에 문의했지만 "다음 달에 지급하겠다"는 답변만 반복됩니다.`,
      unfair_dismissal: `[언제부터]
예: 2025년 1월부터, 수습 인턴으로 근무 중입니다.

[어떤 일이 반복되나요]
예: 최근 2주 동안, 팀장님이 수습이라서 언제든 내보낼 수 있다고 반복적으로 말하며...

[해고 통보는 어떻게 받았는지]
예: 갑자기 이번 주까지만 나오라고 통보만 받았고, 구체적인 사유는 없었습니다.`,
      overtime: `[언제부터]
예: 2024년 10월쯤부터, 거의 매주 회의 때마다...

[어떤 일이 반복되나요]
예: 매일 밤 10시 이후까지 근무하는데, 연장근로 수당은 전혀 지급되지 않습니다.

[지금까지 어떤 대화를 나눴는지]
예: 수당 지급을 요청했지만 "회사 사정상 어렵다"는 답변만 받았습니다.`,
      probation: `[언제부터]
예: 2025년 1월부터, 수습 인턴으로 근무 중입니다.

[어떤 일이 반복되나요]
예: 최근 2주 동안, 팀장님이 수습이라서 언제든 내보낼 수 있다고 반복적으로 말하며...

[해고 통보는 어떻게 받았는지]
예: 갑자기 이번 주까지만 나오라고 통보만 받았고, 구체적인 사유는 없었습니다.`,
      unknown: `[언제부터]
예: 최근 몇 주 전부터 이런 문제가 시작되었습니다.

[어떤 일이 반복되나요]
예: 구체적으로 설명하면...

[내가 느끼는 문제점]
예: 이 상황이 법적으로 문제가 될 수 있는지 알고 싶습니다.`,
    }
    const example = exampleTexts[categoryHint] || exampleTexts.unknown
    setDetails(example)
  }

  const handleAnalyze = async () => {
    if (!summary.trim()) {
      toast({
        title: '한 줄 요약을 입력해주세요',
        description: '상황을 한 줄로 요약해주세요.',
        variant: 'destructive',
      })
      return
    }

    setIsAnalyzing(true)
    try {
      // v2 API 요청 형식
      const request: SituationRequestV2 = {
        situation: [summary, details].filter(Boolean).join('\n\n'),
        category: categoryHint,
        employmentType: employmentType || undefined,
        companySize: undefined, // 필요시 추가
        workPeriod: workPeriod || undefined,
        hasWrittenContract: undefined, // 필요시 추가
        socialInsurance: socialInsurance ? [socialInsurance] : undefined,
      }

      // 사용자 ID 가져오기
      const { createSupabaseBrowserClient } = await import('@/supabase/supabase-client')
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id || null
      
      const result = await analyzeSituationV2(request, userId)
      
      // 백엔드에서 criteria를 최상위 레벨에 반환하므로 result.criteria 사용
      const criteriaArray = (result?.criteria && Array.isArray(result.criteria) && result.criteria.length > 0)
        ? result.criteria
        : []
      
      // v2 응답을 v1 형식으로 변환 (기존 UI 호환성)
      // 안전성 검사: 모든 필드에 기본값 제공
      const v1Format: SituationAnalysisResponse = {
        classifiedType: (result?.tags?.[0] || 'unknown') as SituationCategory,
        riskScore: result?.riskScore ?? 0,
        summary: result?.analysis?.summary || '',
        // criteria는 새로운 RAG 기반 구조 (CriteriaItemV2) 그대로 사용
        criteria: criteriaArray.map((criterion: any) => ({
          documentTitle: criterion?.documentTitle || criterion?.name || '',
          fileUrl: criterion?.fileUrl || null,
          sourceType: criterion?.sourceType || 'law',
          similarityScore: criterion?.similarityScore || 0,
          snippet: criterion?.snippet || '',
          usageReason: criterion?.usageReason || criterion?.reason || '',
        })),
        actionPlan: null,
        scripts: {
          toCompany: result?.scripts?.toCompany 
            ? (typeof result.scripts.toCompany === 'string'
              ? { subject: '근로계약 관련 확인 요청', body: result.scripts.toCompany }
              : result.scripts.toCompany)
            : undefined,
          toAdvisor: result?.scripts?.toAdvisor
            ? (typeof result.scripts.toAdvisor === 'string'
              ? { subject: '노무 상담 요청', body: result.scripts.toAdvisor }
              : result.scripts.toAdvisor)
            : undefined,
        },
        relatedCases: (result?.relatedCases || []).map((c: any) => {
          // 새 구조 (documentTitle, fileUrl, sourceType, externalId, overallSimilarity, summary, snippets)
          if (c?.documentTitle && c?.snippets) {
            return {
              documentTitle: c.documentTitle,
              fileUrl: c.fileUrl,
              sourceType: c.sourceType || 'law',
              externalId: c.externalId || '',
              overallSimilarity: c.overallSimilarity || 0,
              summary: c.summary || '',
              snippets: c.snippets || [],
            };
          }
          // 레거시 구조 (id, title, summary) - 하위 호환성
          return {
            documentTitle: c?.title || c?.documentTitle || '',
            fileUrl: c?.fileUrl,
            sourceType: c?.sourceType || 'law',
            externalId: c?.externalId || c?.id || '',
            overallSimilarity: c?.overallSimilarity || 0,
            summary: c?.summary || '',
            snippets: [{
              snippet: c?.summary || '',
              similarityScore: 0,
              usageReason: '',
            }],
          };
        }),
        sources: (result?.sources || []).map((source: any) => ({
          sourceId: source.sourceId || source.source_id || '',
          sourceType: (source.sourceType || source.source_type || 'law') as 'law' | 'manual' | 'case' | 'standard_contract',
          title: source.title || '',
          snippet: source.snippet || '',
          score: source.score || 0,
          externalId: source.externalId || source.external_id,
          fileUrl: source.fileUrl || source.file_url,
        })),
        organizations: result?.organizations || [],
      }
      
      setAnalysisResult(v1Format)
      
      // 분석 결과 ID 저장
      const resultId = (result as any).id
      if (resultId) {
        setAnalysisId(resultId)
        
        // 분석 완료 시 ID 기반 페이지로 리다이렉트
        router.push(`/legal/situation/${resultId}`)
        return // 리다이렉트 후 함수 종료
      }
      
      // ID가 없는 경우 (예외 상황) - 기존 로직 유지
      // 분석 완료 시 자동으로 대화 세션 데이터 준비 (quick 페이지로 이동 시 사용)
      if (typeof window !== 'undefined') {
        const situationData = {
          analysisResult: v1Format,
          summary: summary,
          details: details,
          categoryHint: categoryHint,
          employmentType: employmentType,
          workPeriod: workPeriod,
          socialInsurance: socialInsurance,
          situationAnalysisId: resultId,  // situation_analyses의 ID (DB 저장용)
        }
        localStorage.setItem('legal_situation_for_quick', JSON.stringify(situationData))
      }
      
      // 리포트는 백엔드에서 자동으로 situation_analyses 테이블에 저장됨
      // 중복 저장 방지를 위해 프론트엔드에서는 저장하지 않음
    } catch (error: any) {
      toast({
        title: '분석 실패',
        description: error.message || '분석 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleCopy = (text: string, description: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: '복사 완료',
      description,
    })
  }

  const toggleCheckItem = (itemKey: string) => {
    const newSet = new Set(checkedItems)
    if (newSet.has(itemKey)) {
      newSet.delete(itemKey)
    } else {
      newSet.add(itemKey)
    }
    setCheckedItems(newSet)
  }

  const getRiskColor = (score: number) => {
    if (score <= 30) return 'bg-green-500'
    if (score <= 70) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getRiskLabel = (score: number) => {
    if (score <= 30) return '위험이 낮습니다'
    if (score <= 70) return '주의가 필요합니다'
    return '위험이 매우 높습니다'
  }

  const getCategoryLabel = (type: SituationCategory) => {
    return SITUATION_CATEGORIES.find(c => c.value === type)?.label || type
  }

  const getCategoryDescription = (type: SituationCategory) => {
    const descriptions: Record<SituationCategory, string> = {
      harassment: '직장 내 괴롭힘, 모욕적 발언, 차별 대우 등',
      unpaid_wage: '임금 체불, 연장근로 수당 미지급, 주휴수당 미지급, 무급 야근 등',
      unfair_dismissal: '부당 해고, 갑작스러운 계약 해지 등',
      overtime: '근로시간 위반, 휴게시간 미보장 등',
      probation: '수습/인턴 기간 중 부당 해고, 불공정 평가 등',
      freelancer: '프리랜서/용역 대금 미지급, 계약 위반 등',
      stock_option: '스톡옵션 미지급, 성과급 약속 불이행 등',
      other: '기타 법적 문제 상황',
      unknown: '잘 모르겠음',
    }
    return descriptions[type] || '법적 문제 상황'
  }

  const getCriteriaStatusIcon = (status: string) => {
    switch (status) {
      case 'likely':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />
      case 'unclear':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />
      case 'unlikely':
        return <XCircle className="w-5 h-5 text-red-600" />
      default:
        return null
    }
  }

  const getCriteriaStatusLabel = (status: string) => {
    switch (status) {
      case 'likely':
        return '✅ 충족'
      case 'unclear':
        return '⚠ 주의'
      case 'unlikely':
        return '❌ 불충분'
      default:
        return status
    }
  }

  const getCriteriaStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'likely':
        return 'bg-green-100 text-green-700 border-green-300'
      case 'unclear':
        return 'bg-amber-100 text-amber-700 border-amber-300'
      case 'unlikely':
        return 'bg-red-100 text-red-700 border-red-300'
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300'
    }
  }

  // 요약 키워드 강조를 위한 함수
  const highlightKeywords = (text: string) => {
    const keywords = ['반복적인', '팀장', '불리한 대우', '직장 내 괴롭힘', '임금 체불', '해고', '수습', '증거']
    let highlighted = text
    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword})`, 'gi')
      highlighted = highlighted.replace(regex, '<mark class="bg-yellow-200 font-semibold px-1 rounded">$1</mark>')
    })
    return highlighted
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-5xl">
        {/* Header */}
        <div className="mb-10">
          {/* Hero Section - 높이 최적화 */}
          <div className="text-center mb-6 sm:mb-8 relative">
            {/* 배경 장식 요소 */}
            <div className="absolute inset-0 -z-10 overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl"></div>
              <div className="absolute top-10 right-1/4 w-64 h-64 bg-indigo-200/20 rounded-full blur-2xl"></div>
            </div>
            
            
            
            {/* 메인 타이틀 - 행간 조정 */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 sm:mb-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 bg-clip-text text-transparent leading-tight animate-in fade-in slide-in-from-bottom-4 duration-700">
              지금 겪는 상황,<br className="sm:hidden" /> 먼저 말로 설명해 주세요
            </h1>
            
            {/* 서브 타이틀 - 행간 조정 */}
            <p className="text-base sm:text-lg md:text-xl text-slate-700 max-w-3xl mx-auto leading-snug font-medium animate-in fade-in slide-in-from-bottom-6 duration-700 delay-150">
              <span className="inline-block bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-1.5 rounded-full border border-blue-200/50 shadow-sm">
                3가지 정보만 적으면
              </span>
              <br className="hidden sm:block" />
              <span className="mt-1.5 inline-block">법적 관점 + 행동 가이드를 한 번에 정리해 드려요</span>
            </p>
          </div>
          
          {/* 3단계 인디케이터 - 개선된 디자인 */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-6 sm:mb-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            {/* 단계 1 */}
            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur opacity-30 group-hover:opacity-50 transition-opacity"></div>
              <div className="relative inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 text-sm font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
                <div className="flex items-center justify-center w-6 h-6 bg-white/20 rounded-full text-base font-extrabold">
                  1
                </div>
                <span>상황 유형 선택</span>
                <CheckCircle2 className="w-4 h-4 text-white/90" />
              </div>
            </div>
            
            {/* 연결선 */}
            <div className="hidden sm:block w-8 h-0.5 bg-gradient-to-r from-blue-300 to-indigo-300"></div>
            
            {/* 단계 2 */}
            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-slate-200 to-slate-300 rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="relative inline-flex items-center gap-2.5 rounded-full bg-white border-2 border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 shadow-md hover:shadow-lg hover:border-blue-400 transition-all transform hover:scale-105">
                <div className="flex items-center justify-center w-6 h-6 bg-slate-100 rounded-full text-base font-extrabold text-slate-600">
                  2
                </div>
                <span className="whitespace-nowrap">한 줄 요약 & 자세한 설명</span>
              </div>
            </div>
            
            {/* 연결선 */}
            <div className="hidden sm:block w-8 h-0.5 bg-gradient-to-r from-slate-300 to-slate-400"></div>
            
            {/* 단계 3 */}
            <div className="group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-slate-200 to-slate-300 rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="relative inline-flex items-center gap-2.5 rounded-full bg-white border-2 border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 shadow-md hover:shadow-lg hover:border-blue-400 transition-all transform hover:scale-105">
                <div className="flex items-center justify-center w-6 h-6 bg-slate-100 rounded-full text-base font-extrabold text-slate-600">
                  3
                </div>
                <span>AI 분석 결과 보기</span>
              </div>
            </div>
          </div>
          
          {/* 안내 문구 - 개선된 디자인 */}
          <div className="relative bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-200/80 rounded-2xl p-4 sm:p-5 mb-6 sm:mb-8 shadow-lg hover:shadow-xl transition-all animate-in fade-in slide-in-from-bottom-10 duration-700 delay-500">
            {/* 배경 패턴 */}
            <div className="absolute inset-0 rounded-2xl opacity-5">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,_rgba(0,0,0,0.15)_1px,_transparent_0)] bg-[length:20px_20px]"></div>
            </div>
            
            <div className="relative flex items-start gap-4">
              <div className="p-3 bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl flex-shrink-0 shadow-md ring-2 ring-amber-200/50">
                <Info className="w-6 h-6 text-amber-700" />
              </div>
              <div className="flex-1 text-sm text-amber-900">
                <p className="font-bold text-base mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  이 서비스는 법률 자문이 아닙니다
                </p>
                <p className="text-amber-800 leading-relaxed">
                  정보 안내와 가이드를 제공하는 것입니다. 개인정보(실명, 회사명)는 가급적 빼고 작성해주세요.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 입력 폼 */}
        {!analysisResult && (
          <div className="space-y-6">
            {/* 상황 템플릿 */}
            <Card className="border-2 border-slate-200 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">자주 있는 상황을 골라서 시작해볼 수도 있어요</CardTitle>
                    <CardDescription className="mt-1">
                      대표 시나리오 프리셋 · 클릭하면 아래 입력 폼에 자동으로 채워집니다
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {SITUATION_TEMPLATES.map((template, index) => {
                    const Icon = template.icon
                    const isSelected = categoryHint === template.category && summary === template.summary
                    return (
                      <button
                        key={index}
                        onClick={() => handleTemplateSelect(template)}
                        className={cn(
                          "p-5 text-left border-2 rounded-xl transition-all duration-200 bg-white group",
                          isSelected
                            ? "border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg ring-2 ring-blue-200 scale-[1.02]"
                            : "border-slate-200 hover:border-blue-400 hover:bg-gradient-to-br hover:from-blue-50/50 hover:to-indigo-50/50 hover:shadow-md"
                        )}
                      >
                        <div className="flex items-start gap-4">
                          <div className={cn(
                            "p-3 rounded-xl flex-shrink-0 transition-all shadow-sm",
                            isSelected 
                              ? "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md" 
                              : "bg-gradient-to-br from-slate-100 to-slate-200 group-hover:from-blue-100 group-hover:to-indigo-100"
                          )}>
                            <Icon className={cn(
                              "w-6 h-6 transition-colors",
                              isSelected ? "text-white" : "text-slate-600 group-hover:text-blue-600"
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-sm font-bold mb-1.5 transition-colors",
                              isSelected ? "text-blue-900" : "text-slate-900 group-hover:text-blue-700"
                            )}>
                              {template.title}
                            </p>
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {template.description}
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            <Card id="situation-input-form" className="border-2 border-slate-200 shadow-lg bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">상황 정보 입력</CardTitle>
                    <CardDescription className="mt-1">
                      3개만 하면 끝나는 간단한 폼입니다
                      {summary && (
                        <span className="ml-2 text-blue-600 font-medium">
                          · 자주 있는 상황을 선택하셨다면, 아래 내용이 자동으로 채워져요
                        </span>
                      )}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* 1. 상황 유형 선택 (칩 버튼) */}
                <div>
                  <div className="mb-2">
                    <Label className="text-base font-bold mb-1 block text-slate-900">
                      Q. 어떤 상황에 가까워 보이나요?
                    </Label>
                    <p className="text-xs text-slate-500">세부 카테고리 필터 · 위 프리셋과 별도로 선택 가능해요</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {SITUATION_CATEGORIES.map((category) => (
                      <button
                        key={category.value + category.label}
                        onClick={() => setCategoryHint(category.value)}
                        className={cn(
                          "px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-200 flex-shrink-0",
                          categoryHint === category.value
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg scale-105"
                            : "bg-white border-2 border-slate-300 text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:shadow-md"
                        )}
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. 한 줄 요약 */}
                <div>
                  <Label htmlFor="summary" className="text-base font-bold mb-3 block text-slate-900">
                    한 줄로 상황을 요약해 주세요 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder={getSummaryPlaceholder(categoryHint)}
                    className={cn(
                      "text-base h-12 border-2 transition-all",
                      summary.length >= 10
                        ? "border-green-300 focus:border-green-400 focus:ring-2 focus:ring-green-100"
                        : "border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    )}
                    required
                    minLength={10}
                  />
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      {summary.length < 10 ? (
                        <>
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          <span className="text-xs font-medium text-amber-600">최소 10자 이상 입력해주세요</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span className="text-xs font-medium text-green-600">✓ 입력 완료</span>
                        </>
                      )}
                    </div>
                    <p className={cn(
                      "text-xs font-semibold",
                      summary.length < 10 ? "text-slate-400" : "text-green-600"
                    )}>
                      {summary.length}자
                    </p>
                  </div>
                </div>

                {/* 3. 자세한 설명 (선택) */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label htmlFor="details" className="text-base font-bold block text-slate-900">
                      조금만 더 자세히 적어주시면, 진단이 더 정확해져요 <span className="text-slate-400 font-normal">(선택)</span>
                    </Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={loadExampleText}
                      className="text-xs h-8 border-blue-300 hover:bg-blue-50 hover:border-blue-400"
                    >
                      <Zap className="w-3.5 h-3.5 mr-1.5" />
                      예시 불러오기
                    </Button>
                  </div>
                  {/* 안내 문구 - 접기/펼치기 기능 */}
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => setShowDetailsGuide(!showDetailsGuide)}
                      className="w-full text-left bg-blue-50/50 border border-blue-200 rounded-lg p-3 hover:bg-blue-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Info className="w-4 h-4 text-blue-600" />
                          <p className="text-sm font-semibold text-blue-900">
                            가능하면 아래 사항을 포함해 주세요:
                          </p>
                        </div>
                        {showDetailsGuide ? (
                          <ChevronUp className="w-4 h-4 text-blue-600" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                    </button>
                    {showDetailsGuide && (
                      <div className="mt-2 bg-blue-50/30 border border-blue-200 rounded-lg p-4">
                        <ul className="text-xs text-blue-800 space-y-1.5 list-none">
                          <li className="flex items-start gap-2">
                            <span className="text-blue-600 mt-0.5">•</span>
                            <span>언제부터 이런 일이 발생했는지</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-600 mt-0.5">•</span>
                            <span>상대방(회사, 팀장, 클라이언트 등)이 누구인지</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-600 mt-0.5">•</span>
                            <span>지금까지 어떤 대화를 나눴는지</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-blue-600 mt-0.5">•</span>
                            <span>가지고 있는 증거(카톡, 메일, 녹취 등)가 있는지</span>
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>
                  <Textarea
                    id="details"
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder={`예시:
- 언제부터: 2024년 10월쯤부터, 거의 매주 회의 때마다...
- 누가: 팀장 A가, 팀원들 다 있는 자리에서 특정 사람을 지목해...
- 어떤 대화: 수당 지급을 요청했지만 "회사 사정상 어렵다"는 답변만 받았습니다.
- 증거: 카톡 대화 내용과 근무 시간 기록이 있습니다.`}
                    className="min-h-[220px] text-base border-2 border-slate-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-xl"
                  />
                </div>

                {/* 4. 고급 정보 (아코디언) - 부담 낮추기 */}
                <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-slate-50/50 shadow-sm">
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-indigo-50/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg transition-colors",
                        showAdvanced ? "bg-blue-100" : "bg-slate-200"
                      )}>
                        {showAdvanced ? (
                          <ChevronUp className="w-5 h-5 text-blue-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                      <div className="text-left">
                        <span className="font-bold text-slate-900 block">선택 입력 · 안 적어도 분석 가능해요</span>
                        <span className="text-xs text-slate-600 mt-0.5">근로조건까지 알려주시면 더 정확하게 판단해 드려요 (근로형태, 주당 근로시간, 수습 여부 정도만)</span>
                      </div>
                    </div>
                  </button>

                  {showAdvanced && (
                    <div className="px-5 pb-6 space-y-6 border-t-2 border-slate-200 pt-6 bg-gradient-to-br from-slate-50/80 to-blue-50/30">
                      {/* 고용 형태 - 카드형 버튼 */}
                      <div>
                        <Label className="text-sm font-semibold text-slate-700 mb-3 block">고용 형태</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {EMPLOYMENT_TYPES.map((type) => (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => setEmploymentType(type.value)}
                              className={cn(
                                "px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all",
                                employmentType === type.value
                                  ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm"
                                  : "bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50"
                              )}
                            >
                              {type.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 근무 기간 - 카드형 버튼 */}
                      <div>
                        <Label className="text-sm font-semibold text-slate-700 mb-3 block">재직 기간</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {WORK_PERIODS.map((period) => (
                            <button
                              key={period.value}
                              type="button"
                              onClick={() => setWorkPeriod(period.value)}
                              className={cn(
                                "px-3 py-2.5 rounded-lg border-2 text-xs font-medium transition-all",
                                workPeriod === period.value
                                  ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm"
                                  : "bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50"
                              )}
                            >
                              {period.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 주당 근로시간 - 선택형 */}
                      <div>
                        <Label className="text-sm font-semibold text-slate-700 mb-3 block">주당 근로시간</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {[
                            { label: '40시간 이하', value: 40 },
                            { label: '40~52시간', value: 50 },
                            { label: '52시간 초과 추정', value: 60 },
                            { label: '모름', value: 0 },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setWeeklyHours(option.value || 40)}
                              className={cn(
                                "px-3 py-2.5 rounded-lg border-2 text-xs font-medium transition-all",
                                weeklyHours === option.value || (option.value === 0 && weeklyHours === 40)
                                  ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm"
                                  : "bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50"
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 수습 여부 - 토글 */}
                      <div>
                        <Label className="text-sm font-semibold text-slate-700 mb-3 block">수습 여부</Label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setIsProbation(true)}
                            className={cn(
                              "flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all",
                              isProbation === true
                                ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm"
                                : "bg-white border-slate-200 text-slate-700 hover:border-blue-300"
                            )}
                          >
                            현재 수습/인턴 기간입니다
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsProbation(false)}
                            className={cn(
                              "flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all",
                              isProbation === false
                                ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm"
                                : "bg-white border-slate-200 text-slate-700 hover:border-blue-300"
                            )}
                          >
                            수습 아님
                          </button>
                        </div>
                        {isProbation === true && (
                          <p className="text-xs text-blue-600 mt-2">
                            💡 수습이라도 근로기준법상 보호 대상일 수 있어요.
                          </p>
                        )}
                      </div>

                      {/* 4대보험 - 칩 버튼 */}
                      <div>
                        <Label className="text-sm font-semibold text-slate-700 mb-3 block">4대보험 가입 여부</Label>
                        <div className="flex flex-wrap gap-2">
                          {SOCIAL_INSURANCE_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setSocialInsurance(option.value)}
                              className={cn(
                                "px-4 py-2 rounded-full border-2 text-sm font-medium transition-all",
                                socialInsurance === option.value
                                  ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm"
                                  : "bg-white border-slate-200 text-slate-700 hover:border-blue-300"
                              )}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 분석 버튼은 하단 고정 CTA로 이동 */}
              </CardContent>
            </Card>
          </div>
        )}

        {/* 하단 고정 CTA 바 - 개선된 디자인 */}
        {!analysisResult && (
          <div className="sticky bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t-2 border-slate-200 shadow-2xl z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 sm:py-5">
            <div className="container mx-auto max-w-5xl">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <p className="text-sm font-semibold text-slate-800 mb-0.5">
                    입력한 내용으로 상황을 분석하고,
                  </p>
                  <p className="text-sm text-slate-600">
                    법적 관점 + 대응 가이드를 생성합니다.
                  </p>
                </div>
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || summary.trim().length < 10}
                  className={cn(
                    "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-xl hover:shadow-2xl",
                    "min-w-[180px] h-12 text-base font-semibold",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-xl",
                    "transition-all duration-200"
                  )}
                  size="lg"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      분석 중...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      상황 분석 받기
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 로딩 상태 */}
        {isAnalyzing && !analysisResult && (
          <div className="space-y-4">
            <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse" style={{ width: '60%' }}></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-full"></div>
                      <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                      <div className="h-4 bg-slate-200 rounded w-4/6"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* 분석 결과 */}
        {isLoadingAnalysis && (
          <div className="space-y-4 py-12">
            <div className="flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-lg font-medium text-slate-700">분석 결과를 불러오는 중...</p>
            </div>
          </div>
        )}

        {analysisResult && !isLoadingAnalysis && (
          <div id="analysis-result" className="space-y-8">
            {/* 상황 분류 카드 */}
            <div className="mb-8">
              <div className="text-center mb-6">
                <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6">
                  사용자님의 상황 분석 결과입니다.
                </h2>
              </div>
              
              {/* 상황 분류 태그 (Badge 형태) */}
              <div className="flex flex-wrap gap-3 justify-center mb-8">
                {/* 메인 카테고리 태그 */}
                <div className="px-5 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl shadow-lg font-bold text-base flex items-center gap-2">
                  <span>🚨</span>
                  <span>{getCategoryLabel(analysisResult.classifiedType as SituationCategory)}</span>
                </div>
                
                {/* 위험도 태그 */}
                <div className={`px-5 py-3 rounded-xl shadow-lg font-bold text-base flex items-center gap-2 text-white ${getRiskColor(analysisResult.riskScore)}`}>
                  <span>{analysisResult.riskScore <= 30 ? '✅' : analysisResult.riskScore <= 70 ? '⚠️' : '🚨'}</span>
                  <span>위험도 {analysisResult.riskScore}</span>
                </div>
                
                {/* 추가 태그들 (분석 결과에서 추출) */}
                {analysisResult.criteria && analysisResult.criteria.length > 0 && (
                  <>
                    {analysisResult.criteria.slice(0, 3).map((criterion, idx) => {
                      // 새로운 구조: documentTitle 사용
                      const documentTitle = criterion.documentTitle || ''
                      const sourceType = criterion.sourceType || 'law'
                      
                      // sourceType에 따른 이모지
                      const sourceTypeEmoji = {
                        'law': '📜',
                        'manual': '📘',
                        'case': '⚖️',
                        'standard_contract': '📄',
                      }[sourceType] || '📋'
                      
                      // documentTitle에서 태그 텍스트 추출
                      const tagText = documentTitle.length > 20 
                        ? documentTitle.substring(0, 20) + '...' 
                        : documentTitle || '법적 근거'
                      
                      return (
                        <div key={idx} className="px-5 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl shadow-lg font-bold text-base flex items-center gap-2">
                          <span>{sourceTypeEmoji}</span>
                          <span>{tagText}</span>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            </div>

            {/* 🔴 섹션 1: AI 법률 진단 리포트 */}
            <LegalReportCard analysisResult={analysisResult} />

            {/* 카드 5: 이렇게 말해보세요 */}
            {analysisResult.scripts && (analysisResult.scripts.toCompany || analysisResult.scripts.toAdvisor) && (
              <Card className="border-2 border-indigo-300 shadow-xl bg-gradient-to-br from-indigo-50 to-purple-50">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg shadow-md">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold">이렇게 말해보세요</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {analysisResult.scripts.toCompany && (
                      <div className="bg-white border-2 border-indigo-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-bold text-indigo-900">회사에 보내는 메일</h3>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopy(analysisResult.scripts!.toCompany!.subject, '제목이 복사되었습니다')}
                              className="border-indigo-300 hover:bg-indigo-50 hover:border-indigo-400 text-indigo-700"
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              제목 복사
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopy(analysisResult.scripts!.toCompany!.body, '본문이 복사되었습니다')}
                              className="border-indigo-300 hover:bg-indigo-50 hover:border-indigo-400 text-indigo-700"
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              본문 복사
                            </Button>
                          </div>
                        </div>
                        <div className="mb-3 rounded-lg bg-blue-50 border border-blue-100 p-3">
                          <div className="text-xs font-semibold text-blue-700 mb-1">제목</div>
                          <div className="text-sm text-gray-900 font-medium">
                            {analysisResult.scripts.toCompany.subject}
                          </div>
                        </div>
                        <div className="prose prose-slate max-w-none text-sm">
                          <div className="text-xs font-semibold text-gray-700 mb-2">본문</div>
                          <RAGHighlightedMarkdown 
                            content={analysisResult.scripts.toCompany.body}
                            sources={analysisResult.sources || []}
                          />
                        </div>
                      </div>
                    )}
                    {analysisResult.scripts.toAdvisor && (
                      <div className="bg-white border-2 border-indigo-200 rounded-xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-lg font-bold text-indigo-900">노무사/상담 기관에 보내는 메일</h3>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopy(analysisResult.scripts!.toAdvisor!.subject, '제목이 복사되었습니다')}
                              className="border-indigo-300 hover:bg-indigo-50 hover:border-indigo-400 text-indigo-700"
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              제목 복사
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopy(analysisResult.scripts!.toAdvisor!.body, '본문이 복사되었습니다')}
                              className="border-indigo-300 hover:bg-indigo-50 hover:border-indigo-400 text-indigo-700"
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              본문 복사
                            </Button>
                          </div>
                        </div>
                        <div className="mb-3 rounded-lg bg-blue-50 border border-blue-100 p-3">
                          <div className="text-xs font-semibold text-blue-700 mb-1">제목</div>
                          <div className="text-sm text-gray-900 font-medium">
                            {analysisResult.scripts.toAdvisor.subject}
                          </div>
                        </div>
                        <div className="prose prose-slate max-w-none text-sm">
                          <div className="text-xs font-semibold text-gray-700 mb-2">본문</div>
                          <RAGHighlightedMarkdown 
                            content={analysisResult.scripts.toAdvisor.body}
                            sources={analysisResult.sources || []}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 🔴 섹션 2: 실전 대응 대시보드 */}
            <ActionDashboard 
              classifiedType={analysisResult.classifiedType as SituationCategory}
              analysisId={analysisId}
              onCopy={handleCopy}
              organizations={analysisResult.organizations}
            />

            {/* Section 4: AI 전담 노무사 채팅 카드 */}
            <Card className="border-2 border-purple-300 shadow-xl bg-gradient-to-br from-white to-purple-50/30">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg shadow-md">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold">AI 전담 노무사 채팅</span>
                </CardTitle>
                <CardDescription className="mt-2">
                  분석 결과를 바탕으로 궁금한 점을 물어보세요
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center py-12 space-y-6">
                  <div className="p-6 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-3xl shadow-lg">
                    <MessageSquare className="w-16 h-16 text-purple-600" />
                  </div>
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-bold text-slate-900">챗봇 대화 시작하기</h3>
                    <p className="text-slate-600 max-w-md">
                      이 분석 결과를 참고하여 AI와 대화를 시작하세요.<br />
                      법적 권리나 다음 단계에 대해 상세히 상담받을 수 있습니다.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      if (analysisId) {
                        router.push(`/legal/assist/quick?contextType=situation&contextId=${analysisId}`)
                      } else {
                        router.push('/legal/assist/quick')
                      }
                    }}
                    className={cn(
                      "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700",
                      "text-white shadow-xl hover:shadow-2xl",
                      "px-8 py-6 text-lg font-semibold",
                      "transition-all duration-200"
                    )}
                    size="lg"
                  >
                    <MessageSquare className="w-5 h-5 mr-2" />
                    챗봇 대화 시작하기
                  </Button>
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {[
                      '지금 그만두면 손해인가요?',
                      '신고 절차 알려줘',
                      '증거는 어떻게 모으나요?',
                      '사장님이 협박성 발언을 하는데 어떡하죠?'
                    ].map((question, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          if (analysisId) {
                            router.push(`/legal/assist/quick?contextType=situation&contextId=${analysisId}&question=${encodeURIComponent(question)}`)
                          } else {
                            router.push(`/legal/assist/quick?question=${encodeURIComponent(question)}`)
                          }
                        }}
                        className="px-4 py-2 text-sm bg-white border-2 border-purple-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-colors text-slate-700"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 5: 시연용 설명 (Footer) */}
            <Card className="border-2 border-slate-300 shadow-lg bg-slate-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 mb-2">💡 System Info</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">
                      본 서비스는 LangGraph 아키텍처를 기반으로 상황을 분류하고, RAG 검색을 통해 관련 법령 및 가이드라인을 찾아 분석 결과를 생성합니다. 
                      각 단계는 독립적으로 실행되며, 분기 조건에 따라 다른 경로로 진행될 수 있습니다.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 액션 버튼 */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button
                onClick={() => {
                  setAnalysisResult(null)
                  setCheckedItems(new Set())
                  setSummary('')
                  setDetails('')
                }}
                variant="outline"
                className="flex-1 h-12 border-2 border-slate-300 hover:bg-slate-50 hover:border-slate-400 font-semibold shadow-sm"
              >
                다시 분석하기
              </Button>
              <Button
                onClick={() => router.push('/legal')}
                className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl"
              >
                홈으로 돌아가기
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
