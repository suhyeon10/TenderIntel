/**
 * 법률 분석 관련 타입 정의
 */

export type LegalCategory = 
  | 'working_hours' 
  | 'wage' 
  | 'probation' 
  | 'stock_option' 
  | 'ip' 
  | 'harassment'
  | 'job_stability'  // 고용안정
  | 'dismissal'      // 해고·해지
  | 'payment'        // 보수·수당 (wage와 유사하지만 별도)
  | 'non_compete'    // 경업금지
  | 'liability'      // 손해배상
  | 'dispute'        // 분쟁해결
  | 'nda'            // 비밀유지
  | 'other'

export type Severity = 'low' | 'medium' | 'high'
export type Priority = 'low' | 'medium' | 'high'

export interface LegalIssueLocation {
  page?: number
  clauseNumber?: string
  startIndex?: number
  endIndex?: number
  lineNumber?: number
}

export interface LegalIssueMetrics {
  legalRisk: number // 0-5
  ambiguity: number // 0-5
  negotiability: number // 0-5
  priority: Priority
}

// 법적 근거 항목 (구조화된 형식) - RAG Citation 객체
export interface LegalBasisItem {
  sourceType: 'law' | 'manual' | 'case' | 'standard_contract' | string
  title: string             // legal_chunks.title (문서 이름)
  snippet: string           // legal_chunks.content 일부 (참조한 텍스트)
  filePath: string          // 스토리지 object key (예: "law/xxx.pdf")
  externalId?: string       // legal_chunks.external_id
  chunkIndex?: number       // legal_chunks.chunk_index
  similarityScore?: number  // (선택) 벡터 유사도
  reason?: string           // 이 이슈에 이 근거를 붙인 이유 (LLM 한 줄 설명)
  status?: string           // "likely" | "unclear" | "unlikely" (레거시 호환)
}

export interface LegalIssue {
  id: string
  category: LegalCategory
  severity: Severity
  summary: string
  location: LegalIssueLocation
  metrics: LegalIssueMetrics
  originalText: string
  suggestedText?: string
  rationale?: string
  suggestedQuestions?: string[]
  legalBasis?: string[] | LegalBasisItem[]  // string[] 또는 구조화된 형식 지원
}

export interface ContractAnalysisResult {
  contractText: string // 전체 계약서 텍스트
  issues: LegalIssue[]
  summary: string
  riskScore: number
  totalIssues: number
  highRiskCount: number
  mediumRiskCount: number
  lowRiskCount: number
}

// 상황 기반 진단 타입
export type SituationCategory = 
  | 'harassment'      // 직장 내 괴롭힘 / 모욕
  | 'unpaid_wage'     // 임금체불 / 수당 미지급 / 무급 야근
  | 'unfair_dismissal' // 부당해고 / 계약해지
  | 'overtime'        // 근로시간 / 야근 / 휴게시간 문제
  | 'probation'       // 수습·인턴 관련 문제
  | 'freelancer'      // 프리랜서/용역 관련 문제
  | 'stock_option'    // 스톡옵션/성과급 관련 문제
  | 'other'           // 기타/복합 상황
  | 'unknown'         // 잘 모르겠음 (기본값)

export type EmploymentType = 
  | 'regular'        // 정규직
  | 'contract'       // 계약직
  | 'intern'         // 인턴
  | 'freelancer'     // 프리랜서
  | 'part_time'      // 알바
  | 'other'          // 기타

export type WorkPeriod = 
  | 'under_3_months'  // 3개월 미만
  | '3_12_months'    // 3~12개월
  | '1_3_years'       // 1~3년
  | 'over_3_years'    // 3년 이상

export type SocialInsurance = 
  | 'all'            // 모두 가입
  | 'partial'        // 일부만
  | 'none'           // 전혀 없음
  | 'unknown'        // 모름

export interface SituationAnalysisRequest {
  categoryHint: SituationCategory
  summary: string // 한 줄 요약
  details?: string // 자세한 설명 (선택)
  employmentType?: EmploymentType
  workPeriod?: WorkPeriod
  weeklyHours?: number
  isProbation?: boolean
  socialInsurance?: SocialInsurance
  situationText: string // summary + details를 합친 전체 텍스트 (백엔드 호환성)
}

export interface LegalBasisItem {
  docId: string
  docTitle: string
  docType: 'law' | 'manual' | 'case' | 'standard_contract'
  chunkIndex?: number
  article?: string // 조항 제목 (예: "제7조(임금지급시기)")
  snippet: string
  snippetHighlight?: string
  reason?: string
  explanation?: string
  similarityScore?: number
  fileUrl?: string
  externalId?: string
}

export interface CriteriaItem {
  name: string
  status: 'likely' | 'unclear' | 'unlikely'
  reason: string
  legalBasis?: LegalBasisItem[] // 법적 근거 배열 (선택적)
}

export interface ActionStep {
  title: string
  items: string[]
}

export interface ActionPlan {
  steps: ActionStep[]
}

export interface EmailTemplate {
  subject: string  // 이메일 제목
  body: string     // 이메일 본문 (마크다운 또는 일반 텍스트)
}

export interface Scripts {
  toCompany?: EmailTemplate  // 회사에 보낼 이메일 템플릿
  toAdvisor?: EmailTemplate  // 노무사/기관에 보낼 이메일 템플릿
}

export interface SnippetAnalyzed {
  core_clause: string  // 핵심 조항 번호나 제목
  easy_summary: string  // 초등학생도 이해할 수 있는 2~3문장의 친절한 설명
  action_tip?: string  // 사용자가 주의해야 할 점 1줄 (선택사항)
}

export interface RelatedCaseSnippet {
  snippet: string  // 벡터 검색에서 가져온 원문 일부(청크 텍스트)
  similarityScore: number  // 이 청크가 현재 상황/질문과 얼마나 유사한지 점수
  usageReason: string  // 왜 이 청크를 근거로 사용했는지의 설명
}

export interface RelatedCase {
  documentTitle: string  // 해당 문서의 파일명 또는 제목
  fileUrl?: string  // Supabase Storage 등에 저장된 원문 파일 다운로드/뷰어 URL
  sourceType: string  // 문서 유형 구분값 (예: standard_contract, labor_law, case_law)
  externalId: string  // 백엔드/DB에서 이 문서를 식별하는 키
  overallSimilarity: number  // 이 문서가 이번 상황분석과 전반적으로 얼마나 관련 있는지 나타내는 대표 점수
  summary: string  // 이 문서가 어떤 문서인지 한 줄로 설명하는 짧은 요약
  snippets: RelatedCaseSnippet[]  // 이 문서에서 이번 분석에 실제로 사용된 청크 목록
}

export interface SourceItem {
  sourceId: string
  sourceType: 'law' | 'manual' | 'case' | 'standard_contract'
  title: string
  snippet: string  // 원본 snippet (하위 호환성)
  snippetAnalyzed?: SnippetAnalyzed  // 분석된 결과
  score: number
  externalId?: string  // 파일 ID (스토리지 경로 생성용)
  fileUrl?: string  // 스토리지 Signed URL (파일 다운로드용)
}

export interface OrganizationInfo {
  id: string
  name: string
  description: string
  capabilities: string[]
  requiredDocs: string[]
  legalBasis?: string
  website?: string
  phone?: string
}

// CriteriaItemV2 타입 정의 (RAG 기반 구조) - 레거시 호환성 유지
export interface CriteriaItemV2 {
  documentTitle: string; // 문서 제목
  fileUrl?: string | null; // 문서 파일 URL (Signed URL)
  sourceType: string; // 출처 타입 (law, manual, case, standard_contract)
  similarityScore: number; // 유사도 점수 (0.0 ~ 1.0)
  snippet: string; // 관련 내용 스니펫
  usageReason: string; // 사용 이유 설명
  legalBasis?: LegalBasisItem[]; // 법적 근거 배열 (API 응답 구조 지원)
  // 하위 호환성을 위한 레거시 필드
  name?: string; // 레거시: documentTitle 대체
  status?: 'likely' | 'unclear' | 'unlikely'; // 레거시: 판단 상태
  reason?: string; // 레거시: usageReason 대체
}

// Finding Source 타입 정의 (새로운 API 구조)
export interface FindingSource {
  documentTitle: string; // 참고 문서의 제목
  fileUrl?: string; // 참고 문서를 열람할 수 있는 스토리지 URL
  sourceType: string; // 참고 문서의 유형 (guideline, standard_contract, statute 등)
  refinedSnippet: string; // 원문 청크를 다듬어 사람이 읽기 쉽게 정리한 문장
  similarityScore: number; // 의미적 유사도 점수 (0~1)
}

// Finding 타입 정의 (새로운 API 구조)
export interface Finding {
  id: number | string; // 각 항목을 구분하기 위한 ID
  title: string; // 사용자에게 보여줄 법적 쟁점/카테고리 이름
  statusLabel: string; // 해당 쟁점이 현재 상황에 얼마나 해당하는지에 대한 한글 라벨
  basisText: string; // 사용자의 실제 상황 설명과 참고 문서 내용을 종합해서 만든 '근거 문장'
  source: FindingSource; // 이 finding을 판단할 때 참고한 문서와 관련 문장 정보
}

export interface SituationAnalysisResponse {
  classifiedType: SituationCategory
  riskScore: number // 0~100
  summary: string
  findings?: Finding[] // 법적 판단 기준 (findings API 구조)
  actionPlan?: ActionPlan // 선택적 필드 (더 이상 사용하지 않음)
  scripts: Scripts
  relatedCases: RelatedCase[]
  sources?: SourceItem[] // RAG 검색 출처
  organizations?: OrganizationInfo[] // 추천 기관 목록
}

// ========== 상황 분석 결과 페이지용 타입 정의 ==========

/**
 * 법적 판단 기준 항목 (체크리스트)
 */
export interface LegalCriteria {
  id: string
  name: string
  status: 'fulfilled' | 'unclear' | 'not_fulfilled'
  description?: string
}

/**
 * RAG 근거 자료 (Paper UI용 - 논문 각주 스타일)
 */
export interface RAGReference {
  chunk_id: string
  title: string
  summary: string
  source_agency?: string // 예: "고용노동부"
  download_info?: {
    external_id: string
    source_type: 'law' | 'manual' | 'case'
  }
}

/**
 * 증거 아카이빙 항목 (파일 업로드 UI용)
 */
export interface EvidenceItem {
  key: string
  label: string
  status: 'missing' | 'secured' | 'pending'
  required: boolean
  file_url?: string // 업로드된 파일 URL
  file_name?: string // 파일명
  uploaded_at?: string // 업로드 일시
}

/**
 * 행동 가이드 항목
 */
export interface ActionGuide {
  id: string
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  completed?: boolean
}

/**
 * 관할 기관 정보
 */
export interface AgencyInfo {
  name: string
  address: string
  tel: string
  coordinates?: {
    lat: number
    lng: number
  }
  map_image_url?: string // 정적 지도 이미지 URL
}

/**
 * 실전 대응 대시보드 데이터
 */
export interface DashboardData {
  action_guides?: ActionGuide[] // 행동 가이드 체크리스트
  evidence_map: EvidenceItem[]
  agency_info: AgencyInfo
}

/**
 * 상황 분석 요약 정보
 */
export interface SituationSummary {
  category: string // 예: "직장 내 괴롭힘"
  summary_text: string // 요약 멘트
  risk_level: 'high' | 'medium' | 'low'
}

/**
 * situation_analyses.analysis JSONB 컬럼 구조
 * DB에 저장되는 전체 분석 결과 데이터
 */
export interface AnalysisJSON {
  // 기본 정보
  summary: string
  risk_score: number
  situation_summary?: SituationSummary
  
  // 좌측: 상황 분석
  legal_criteria?: LegalCriteria[] // 법적 판단 기준 체크리스트
  
  // 우측/하단: 근거 자료
  rag_references?: RAGReference[] // RAG Sources (논문 각주 스타일)
  
  // 실전 대응 대시보드
  dashboard_data?: DashboardData
  
  // 메타데이터
  analysis_date?: string
  report_id?: string
}

/**
 * 상황 분석 결과 전체 데이터 (DB에서 조회한 전체 레코드)
 */
export interface SituationAnalysisResult {
  id: string
  user_id?: string
  situation?: string
  category?: string
  risk_score?: number
  risk_level?: string
  analysis: AnalysisJSON
  created_at: string
  updated_at?: string
}

