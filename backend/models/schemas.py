# backend/models/schemas.py

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Union
from datetime import datetime
from enum import Enum


class AnnouncementAnalysis(BaseModel):
    """공고 분석 결과"""
    project_name: str = Field(description="프로젝트명")
    budget_range: str = Field(description="예산 범위")
    duration: str = Field(description="수행 기간")
    essential_skills: List[str] = Field(description="필수 기술")
    preferred_skills: List[str] = Field(default=[], description="우대 기술")
    submission_docs: List[str] = Field(default=[], description="제출 서류")
    summary: str = Field(description="요약")
    deadline: Optional[str] = Field(default=None, description="입찰 마감일")


class TeamProfile(BaseModel):
    """팀 프로필"""
    team_id: str
    name: str
    skills: List[str]
    experience_years: int
    rating: float
    location: str
    projects: List[str]
    description: str


class MatchedTeam(BaseModel):
    """매칭된 팀 정보"""
    team_id: str
    name: str
    match_score: float
    rationale: str
    estimated_cost: Optional[str] = None


class EstimateRequest(BaseModel):
    """견적 생성 요청"""
    announcement_id: str
    team_id: str


class APIResponse(BaseModel):
    """API 응답 공통 형식"""
    status: str
    message: Optional[str] = None
    data: Optional[dict] = None


# ========== Legal RAG 스키마 ==========

class LegalIssue(BaseModel):
    """법적 이슈"""
    name: str = Field(..., description="법적 이슈명 (예: 부당해고, 초과근로 수당 미지급) 또는 issue_id")
    description: str
    severity: str = Field(..., description="low | medium | high 등급")
    legal_basis: List[str] = Field(default_factory=list, description="관련 법 조항/근거")
    start_index: Optional[int] = Field(None, description="계약서 텍스트 내 시작 인덱스")
    end_index: Optional[int] = Field(None, description="계약서 텍스트 내 종료 인덱스")
    suggested_text: Optional[str] = Field(None, description="권장 수정 문구")
    rationale: Optional[str] = Field(None, description="수정 이유/근거")
    suggested_questions: List[str] = Field(default_factory=list, description="협상/질문 스크립트")
    original_text: Optional[str] = Field(None, description="계약서 원문에서 해당 위험 조항의 실제 텍스트")
    clause_id: Optional[str] = Field(None, description="연결된 clause ID (새 파이프라인)")
    category: Optional[str] = Field(None, description="이슈 카테고리 (wage, working_hours, job_stability, dismissal 등)")
    summary: Optional[str] = Field(None, description="이슈 요약 (새 스키마)")
    toxic_clause_detail: Optional["ToxicClauseDetail"] = Field(None, description="독소조항 상세 정보")


class LegalRecommendation(BaseModel):
    """법적 권고사항"""
    title: str
    description: str
    steps: List[str] = Field(default_factory=list)


class LegalGroundingChunk(BaseModel):
    """RAG 검색 결과 청크"""
    source_id: str
    source_type: str  # "law" | "manual" | "case" | "standard_contract"
    title: str
    snippet: str
    score: float
    file_path: Optional[str] = None  # 원본 파일 경로
    external_id: Optional[str] = None  # legal_chunks.external_id
    chunk_index: Optional[int] = None  # legal_chunks.chunk_index
    file_url: Optional[str] = None  # 스토리지 Signed URL
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="메타데이터 (JSONB)")


class LegalAnalysisResult(BaseModel):
    """법률 리스크 분석 결과"""
    risk_score: int = Field(..., ge=0, le=100)
    risk_level: str  # "low" | "medium" | "high"
    summary: str
    contract_text: Optional[str] = Field(None, description="전체 계약서 텍스트")
    issues: List[LegalIssue] = Field(default_factory=list)
    recommendations: List[LegalRecommendation] = Field(default_factory=list)
    grounding: List[LegalGroundingChunk] = Field(
        default_factory=list,
        description="RAG로 가져온 근거 텍스트 목록",
    )
    # 새로운 독소조항 탐지 필드
    one_line_summary: Optional[str] = Field(None, description="한 줄 총평")
    risk_traffic_light: Optional[str] = Field(None, description="리스크 신호등: 🟢 | 🟡 | 🔴")
    top3_action_points: Optional[List[str]] = Field(None, description="지금 당장 확인하거나 물어봐야 할 포인트 3개")
    risk_summary_table: Optional[List["RiskSummaryItem"]] = Field(None, description="리스크 요약 테이블")
    toxic_clauses: Optional[List["ToxicClauseDetail"]] = Field(None, description="독소조항 상세 목록")
    negotiation_questions: Optional[List[str]] = Field(None, description="협상 시 질문 리스트")


class LegalAnalyzeContractRequest(BaseModel):
    """계약서 분석 요청 (JSON용)"""
    description: Optional[str] = Field(
        None,
        description="사용자가 설명한 법적 상황/걱정 포인트",
    )
    # 새로운 사용자 입력 파라미터
    contract_type: Optional[str] = Field(
        None,
        description="계약 종류: freelancer | part_time | regular | service | other",
    )
    user_role: Optional[str] = Field(
        None,
        description="역할: worker (을/프리랜서/근로자) | employer (갑/발주사/고용주)",
    )
    field: Optional[str] = Field(
        None,
        description="분야: it_dev | design | marketing | other",
    )
    concerns: Optional[str] = Field(
        None,
        description="우선 확인하고 싶은 고민 (예: '대금 미지급이 걱정', '야근/추가근로', '경업금지')",
    )


class LegalAnalyzeSituationRequest(BaseModel):
    """상황 분석 요청"""
    text: str = Field(
        ...,
        description="현재 겪고 있는 법적 상황 설명",
        min_length=10,
    )


class LegalCasePreview(BaseModel):
    """법률 케이스 프리뷰"""
    id: str
    title: str
    situation: str
    main_issues: List[str]


class LegalSearchResponse(BaseModel):
    """케이스 검색 응답"""
    query: str
    cases: List[LegalCasePreview] = Field(default_factory=list)


class LegalChatRequest(BaseModel):
    """법률 상담 챗 요청"""
    query: str = Field(..., description="사용자 질문")
    doc_ids: List[str] = Field(default_factory=list, description="계약서 문서 ID 목록")
    selected_issue_id: Optional[str] = Field(None, description="선택된 이슈 ID")
    selected_issue: Optional[dict] = Field(None, description="선택된 이슈 정보")
    analysis_summary: Optional[str] = Field(None, description="분석 요약")
    risk_score: Optional[int] = Field(None, description="위험도 점수")
    total_issues: Optional[int] = Field(None, description="총 이슈 개수")
    top_k: int = Field(8, description="RAG 검색 결과 개수")


class LegalChatResponse(BaseModel):
    """법률 상담 챗 응답"""
    answer: str = Field(..., description="AI 답변 (마크다운 형식)")
    markdown: Optional[str] = Field(None, description="마크다운 형식 답변")
    query: str = Field(..., description="원본 질문")
    used_chunks: List[dict] = Field(default_factory=list, description="사용된 RAG 청크")


# ========== 상황 기반 진단 스키마 ==========

class SituationAnalysisRequest(BaseModel):
    """상황 기반 진단 요청"""
    category_hint: str = Field(..., description="상황 카테고리 힌트 (harassment, unpaid_wage, unfair_dismissal, overtime, probation, unknown)")
    summary: Optional[str] = Field(None, description="한 줄 요약")
    details: Optional[str] = Field(None, description="자세한 설명 (선택)")
    employment_type: Optional[str] = Field(None, description="고용 형태 (regular, contract, intern, freelancer, part_time, other)")
    work_period: Optional[str] = Field(None, description="근무 기간 (under_3_months, 3_12_months, 1_3_years, over_3_years)")
    weekly_hours: Optional[int] = Field(None, description="주당 근로시간")
    is_probation: Optional[bool] = Field(None, description="수습 여부")
    social_insurance: Optional[str] = Field(None, description="4대보험 (all, partial, none, unknown)")
    situation_text: str = Field(..., description="상황 상세 설명 (summary + details 또는 전체 텍스트)")


class CriteriaItem(BaseModel):
    """판단 기준 항목 (RAG 검색 결과 기반)"""
    documentTitle: str = Field(..., description="법적 근거로 사용한 문서의 제목(파일명)")
    fileUrl: Optional[str] = Field(None, description="해당 문서를 바로 열 수 있는 파일 URL")
    sourceType: str = Field(..., description="문서의 종류를 나타내는 타입 값 (예: standard_contract, statute, internal_regulation 등)")
    similarityScore: float = Field(..., description="현재 상황/쟁점과 이 문서 내용이 얼마나 유사한지 나타내는 점수(0~1 사이 실수)")
    snippet: str = Field(..., description="실제로 참고한 문서의 일부분(조항/문단) 발췌 텍스트")
    usageReason: str = Field(..., description="이 문서를 어떤 기준·비교·판단 목적으로 사용했는지에 대한 자연어 설명")


class FindingSource(BaseModel):
    """Finding의 참고 문서 정보"""
    documentTitle: str = Field(..., description="참고 문서의 제목")
    fileUrl: Optional[str] = Field(None, description="참고 문서를 열람할 수 있는 스토리지 URL")
    sourceType: str = Field(..., description="참고 문서의 유형 (예: guideline, standard_contract, statute 등)")
    refinedSnippet: str = Field(..., description="RAG로 찾은 원문 청크를 문장 부호·띄어쓰기·어색한 표현을 다듬어 사람이 읽기 쉽게 정리한 문장")
    similarityScore: float = Field(..., description="사용자 상황/질문과 이 문서 조각의 의미적 유사도 점수 (0~1)")


class Finding(BaseModel):
    """법적 쟁점 발견 항목"""
    id: Union[int, str] = Field(..., description="각 항목을 구분하기 위한 숫자 또는 문자열 ID")
    title: str = Field(..., description="사용자에게 보여줄 법적 쟁점/카테고리 이름 (예: '직장 내 괴롭힘', '모욕적인 말')")
    statusLabel: str = Field(..., description="해당 쟁점이 현재 상황에 얼마나 해당하는지에 대한 한글 라벨 (예: '충족', '부분 해당', '추가 확인 필요')")
    basisText: str = Field(..., description="사용자의 실제 상황 설명과 참고 문서 내용을 종합해서 만든 근거 문장")
    source: FindingSource = Field(..., description="이 finding을 판단할 때 참고한 문서와 관련 문장 정보")


class ActionStep(BaseModel):
    """행동 가이드 단계"""
    title: str = Field(..., description="단계 제목")
    items: List[str] = Field(..., description="항목 목록")


class ActionPlan(BaseModel):
    """행동 가이드"""
    steps: List[ActionStep] = Field(..., description="단계 목록")


class EmailTemplate(BaseModel):
    """이메일 템플릿 (제목 + 본문)"""
    subject: str = Field(..., description="이메일 제목")
    body: str = Field(..., description="이메일 본문 (마크다운 또는 일반 텍스트)")


class Scripts(BaseModel):
    """스크립트/템플릿"""
    to_company: Optional[EmailTemplate] = Field(None, description="회사에 보낼 이메일 템플릿")
    to_advisor: Optional[EmailTemplate] = Field(None, description="노무사/기관에 보낼 이메일 템플릿")


class RelatedCase(BaseModel):
    """유사 사례"""
    id: str = Field(..., description="케이스 ID")
    title: str = Field(..., description="케이스 제목")
    summary: str = Field(..., description="케이스 요약")


class SituationAnalysisResponse(BaseModel):
    """상황 기반 진단 응답"""
    classified_type: str = Field(..., description="최종 분류된 유형")
    risk_score: int = Field(..., ge=0, le=100, description="위험도 점수 (0~100)")
    summary: str = Field(..., description="한 줄 요약")
    criteria: List[CriteriaItem] = Field(..., description="법적 판단 기준")
    action_plan: ActionPlan = Field(..., description="행동 가이드")
    scripts: Scripts = Field(..., description="스크립트/템플릿")
    related_cases: List[RelatedCase] = Field(default_factory=list, description="유사 사례")


# ========== API v2 스키마 (가이드 스펙) ==========

class LegalSearchResult(BaseModel):
    """법률 검색 결과 (v2)"""
    legal_document_id: str
    section_title: Optional[str] = None
    text: str
    score: float
    source: Optional[str] = None
    doc_type: Optional[str] = None
    title: Optional[str] = None


class LegalSearchResponseV2(BaseModel):
    """법률 검색 응답 (v2)"""
    results: List[LegalSearchResult]
    count: int
    query: str


class SituationRequestV2(BaseModel):
    """상황 분석 요청 (v2)"""
    situation: str
    category: Optional[str] = None
    employmentType: Optional[str] = None
    companySize: Optional[str] = None
    workPeriod: Optional[str] = None
    hasWrittenContract: Optional[bool] = None
    socialInsurance: Optional[List[str]] = None


class LegalBasisItem(BaseModel):
    """법적 근거 항목"""
    title: str
    snippet: str
    sourceType: str
    status: Optional[str] = Field(None, description="판단 기준 충족 여부: likely|unclear|unlikely")


class SituationAnalysisV2(BaseModel):
    """상황 분석 결과 (v2)"""
    summary: str
    legalBasis: List[LegalBasisItem] = Field(default_factory=list, description="법적 근거 (더 이상 사용하지 않음, 호환성을 위해 유지)")
    recommendations: List[str] = Field(default_factory=list, description="권고사항 (더 이상 사용하지 않음, 호환성을 위해 유지)")


class SnippetAnalyzed(BaseModel):
    """snippet 분석 결과"""
    core_clause: str = Field(..., description="핵심 조항 번호나 제목")
    easy_summary: str = Field(..., description="초등학생도 이해할 수 있는 2~3문장의 친절한 설명")
    action_tip: Optional[str] = Field(None, description="사용자가 주의해야 할 점 1줄 (선택사항)")


class RelatedCaseSnippet(BaseModel):
    """관련 사례의 스니펫 (청크 단위)"""
    snippet: str = Field(..., description="벡터 검색에서 가져온 원문 일부(청크 텍스트)")
    similarityScore: float = Field(..., description="이 청크가 현재 상황/질문과 얼마나 유사한지 점수")
    usageReason: str = Field(..., description="왜 이 청크를 근거로 사용했는지의 설명")


class RelatedCaseV2(BaseModel):
    """유사 사례 (v2) - 문서 단위 그룹핑"""
    documentTitle: str = Field(..., description="해당 문서의 파일명 또는 제목")
    fileUrl: Optional[str] = Field(None, description="Supabase Storage 등에 저장된 원문 파일 다운로드/뷰어 URL")
    sourceType: str = Field(..., description="문서 유형 구분값 (예: standard_contract, labor_law, case_law)")
    externalId: str = Field(..., description="백엔드/DB에서 이 문서를 식별하는 키")
    overallSimilarity: float = Field(..., description="이 문서가 이번 상황분석과 전반적으로 얼마나 관련 있는지 나타내는 대표 점수")
    summary: str = Field(..., description="이 문서가 어떤 문서인지 한 줄로 설명하는 짧은 요약")
    snippets: List[RelatedCaseSnippet] = Field(default_factory=list, description="이 문서에서 이번 분석에 실제로 사용된 청크 목록")


class EmailTemplateV2(BaseModel):
    """이메일 템플릿 (제목 + 본문) (v2)"""
    subject: str = Field(..., description="이메일 제목")
    body: str = Field(..., description="이메일 본문 (마크다운 또는 일반 텍스트)")


class ScriptsV2(BaseModel):
    """스크립트/템플릿 (v2)"""
    toCompany: Optional[EmailTemplateV2] = Field(None, description="회사에 보낼 이메일 템플릿")
    toAdvisor: Optional[EmailTemplateV2] = Field(None, description="노무사/기관에 보낼 이메일 템플릿")


class SourceItemV2(BaseModel):
    """RAG 검색 출처 항목 (v2)"""
    sourceId: str
    sourceType: str  # "law" | "manual" | "case"
    title: str
    snippet: str  # 원본 snippet (하위 호환성)
    snippetAnalyzed: Optional[SnippetAnalyzed] = Field(None, description="분석된 결과")
    score: float
    externalId: Optional[str] = Field(None, description="파일 ID (스토리지 경로 생성용)")
    fileUrl: Optional[str] = Field(None, description="스토리지 Signed URL (파일 다운로드용)")


class OrganizationInfoV2(BaseModel):
    """추천 기관 정보"""
    id: str = Field(..., description="기관 ID")
    name: str = Field(..., description="기관명")
    description: str = Field(..., description="기관 설명")
    capabilities: List[str] = Field(default_factory=list, description="기관이 제공하는 서비스 목록")
    requiredDocs: List[str] = Field(default_factory=list, description="필요한 증거 자료 목록")
    legalBasis: Optional[str] = Field(None, description="법적 근거")
    website: Optional[str] = Field(None, description="웹사이트 URL")
    phone: Optional[str] = Field(None, description="전화번호")


class SituationResponseV2(BaseModel):
    """상황 분석 응답 (v2)"""
    id: Optional[str] = Field(None, description="상황 분석 ID (situation_analyses 테이블의 id)")
    riskScore: float
    riskLevel: str  # "low" | "medium" | "high"
    tags: List[str]
    analysis: SituationAnalysisV2
    checklist: List[str]
    scripts: Optional[ScriptsV2] = None
    relatedCases: List[RelatedCaseV2]
    sources: List[SourceItemV2] = Field(default_factory=list, description="RAG 검색 출처 (법령/가이드라인)")
    criteria: Optional[List[CriteriaItem]] = Field(default_factory=list, description="법적 판단 기준")
    findings: Optional[List[Finding]] = Field(default_factory=list, description="법적 쟁점 발견 항목")
    actionPlan: Optional[ActionPlan] = Field(None, description="행동 계획")
    organizations: Optional[List[OrganizationInfoV2]] = Field(default_factory=list, description="추천 기관 목록")


class ConversationRequestV2(BaseModel):
    """대화 메시지 저장 요청 (v2) - 레거시 호환성"""
    report_id: str = Field(..., description="리포트 ID (situation_analyses의 id)")
    message: str = Field(..., description="메시지 내용")
    sender_type: str = Field(..., description="발신자 타입 ('user' 또는 'assistant')")
    sequence_number: int = Field(..., description="메시지 순서")
    metadata: Optional[Dict[str, Any]] = Field(None, description="추가 메타데이터")


class CreateChatSessionRequest(BaseModel):
    """챗 세션 생성 요청"""
    initial_context_type: Optional[str] = Field('none', description="초기 컨텍스트 타입: 'none' | 'situation' | 'contract'")
    initial_context_id: Optional[str] = Field(None, description="초기 컨텍스트 ID")
    title: Optional[str] = Field(None, description="세션 제목")

class ChatMessageRequest(BaseModel):
    """챗 메시지 저장 요청 (새 통합 챗 시스템)"""
    sender_type: str = Field(..., description="발신자 타입: 'user' | 'assistant'")
    message: str = Field(..., description="메시지 내용")
    sequence_number: int = Field(..., description="메시지 순서")
    context_type: Optional[str] = Field('none', description="컨텍스트 타입: 'none' | 'situation' | 'contract'")
    context_id: Optional[str] = Field(None, description="컨텍스트 ID")


class ClauseV2(BaseModel):
    """계약서 조항 (v2)"""
    id: str
    title: str  # "제1조 (목적)"
    content: str  # 조항 본문
    articleNumber: Optional[int] = None  # 조 번호
    startIndex: int = 0  # 원문에서 시작 위치
    endIndex: int = 0  # 원문에서 종료 위치
    category: Optional[str] = None  # "working_hours", "wage" 등


class HighlightedTextV2(BaseModel):
    """하이라이트된 텍스트"""
    text: str
    startIndex: int
    endIndex: int
    severity: str  # "low" | "medium" | "high"
    issueId: str  # 연결된 issue ID


class ToxicClauseDetail(BaseModel):
    """독소조항 상세 정보"""
    clauseLocation: str = Field(..., description="조항 위치 (예: '제○조(손해배상)')")
    contentSummary: str = Field(..., description="내용 요약")
    whyRisky: str = Field(..., description="왜 위험한지")
    realWorldProblems: str = Field(..., description="현실에서 생길 수 있는 문제")
    suggestedRevisionLight: str = Field(..., description="라이트 버전 수정 제안 (일반인 말투)")
    suggestedRevisionFormal: str = Field(..., description="포멀 버전 수정 제안 (로펌/변호사용)")

class RiskSummaryItem(BaseModel):
    """리스크 요약 테이블 항목"""
    item: str = Field(..., description="항목명 (예: '대금 지급')")
    riskLevel: str = Field(..., description="리스크 수준: low | medium | high")
    problemPoint: str = Field(..., description="문제 포인트")
    simpleExplanation: str = Field(..., description="간단 설명")
    revisionKeyword: str = Field(..., description="수정 제안 키워드")

class LegalBasisItemV2(BaseModel):
    """법적 근거 항목 (구조화된 형식) - RAG Citation 객체"""
    title: str  # 문서 이름 (legal_chunks.title)
    snippet: str  # 참고한 content (legal_chunks.content 일부)
    sourceType: Optional[str] = "law"  # "law" | "manual" | "case" | "standard_contract"
    status: Optional[str] = None  # "likely" | "unclear" | "unlikely"
    filePath: Optional[str] = None  # 스토리지 키 (예: "standard_contract/xxx.pdf")
    similarityScore: Optional[float] = None  # 벡터 유사도 (RAG 근거용)
    chunkIndex: Optional[int] = None  # 몇 번째 청크인지 (legal_chunks.chunk_index)
    externalId: Optional[str] = None  # legal_chunks.external_id (디버그/관리용)
    reason: Optional[str] = None  # "왜 이 이슈에 이 근거가 붙었는지" LLM 한 줄 설명

class ContractIssueV2(BaseModel):
    """계약서 이슈 (v2)"""
    id: str
    category: str
    severity: str  # "low" | "medium" | "high"
    summary: str
    originalText: str
    legalBasis: Union[List[str], List[LegalBasisItemV2]]  # string[] 또는 구조화된 형식 지원
    explanation: str
    suggestedRevision: str
    clauseId: Optional[str] = None  # 연결된 조항 ID
    startIndex: Optional[int] = None  # 원문에서 시작 위치
    endIndex: Optional[int] = None  # 원문에서 종료 위치
    # 독소조항 관련 필드
    toxicClauseDetail: Optional[ToxicClauseDetail] = None  # 독소조항 상세 정보


class ContractAnalysisResponseV2(BaseModel):
    """계약서 분석 응답 (v2)"""
    docId: str
    title: str
    riskScore: float
    riskLevel: str  # "low" | "medium" | "high"
    sections: dict  # {working_hours: 80, wage: 70, ...}
    issues: List[ContractIssueV2]
    summary: str
    retrievedContexts: List[dict]
    contractText: str = ""  # 계약서 원문 텍스트 (기본값: 빈 문자열, Optional 제거)
    clauses: List[ClauseV2] = []  # 조항 목록 (자동 분류)
    highlightedTexts: List[HighlightedTextV2] = []  # 하이라이트된 텍스트
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="추가 메타데이터")
    createdAt: str
    fileUrl: Optional[str] = None  # Supabase Storage에 저장된 원본 파일 URL
    # 새로운 독소조항 탐지 결과 필드
    oneLineSummary: Optional[str] = Field(None, description="한 줄 총평")
    riskTrafficLight: Optional[str] = Field(None, description="리스크 신호등: 🟢 | 🟡 | 🔴")
    top3ActionPoints: Optional[List[str]] = Field(None, description="지금 당장 확인하거나 물어봐야 할 포인트 3개")
    riskSummaryTable: Optional[List[RiskSummaryItem]] = Field(None, description="리스크 요약 테이블")
    toxicClauses: Optional[List[ToxicClauseDetail]] = Field(None, description="독소조항 상세 목록")
    negotiationQuestions: Optional[List[str]] = Field(None, description="협상 시 질문 리스트")


class ContractComparisonRequestV2(BaseModel):
    """계약서 비교 요청 (v2)"""
    oldContractId: str  # 이전 계약서 docId
    newContractId: str  # 새 계약서 docId


class ContractComparisonResponseV2(BaseModel):
    """계약서 비교 응답 (v2)"""
    oldContract: ContractAnalysisResponseV2
    newContract: ContractAnalysisResponseV2
    changedClauses: List[dict]  # 변경된 조항
    riskChange: dict  # 위험도 변화
    summary: str  # 비교 요약


class ClauseRewriteRequestV2(BaseModel):
    """조항 리라이트 요청 (v2)"""
    clauseId: str
    originalText: str
    issueId: Optional[str] = None  # 관련 issue ID
    legalBasis: Optional[List[str]] = None  # 법적 근거 (있는 경우)


class ClauseRewriteResponseV2(BaseModel):
    """조항 리라이트 응답 (v2)"""
    originalText: str
    rewrittenText: str
    explanation: str  # 수정 이유
    legalBasis: List[str]  # 법적 근거


class LegalChatRequestV2(BaseModel):
    """법률 상담 챗 요청 (v2)"""
    query: str = Field(..., description="사용자 질문")
    docIds: List[str] = Field(default_factory=list, description="계약서 문서 ID 목록")
    selectedIssueId: Optional[str] = Field(None, description="선택된 이슈 ID")
    selectedIssue: Optional[dict] = Field(None, description="선택된 이슈 정보")
    analysisSummary: Optional[str] = Field(None, description="분석 요약")
    riskScore: Optional[int] = Field(None, description="위험도 점수")
    totalIssues: Optional[int] = Field(None, description="총 이슈 개수")
    topK: int = Field(8, description="RAG 검색 결과 개수")
    # 🔥 컨텍스트 타입 및 ID 추가
    contextType: Optional[str] = Field(None, description="컨텍스트 타입: 'none' | 'situation' | 'contract'")
    contextId: Optional[str] = Field(None, description="컨텍스트 ID (situation_analyses.id 또는 contract_analyses.id)")


class UsedChunkV2(BaseModel):
    """사용된 RAG 청크 (v2)"""
    id: Optional[str] = None
    source_type: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    score: Optional[float] = None


class UsedChunksV2(BaseModel):
    """사용된 RAG 청크 그룹 (v2)"""
    contract: List[UsedChunkV2] = Field(default_factory=list, description="계약서 내부 청크")
    legal: List[UsedChunkV2] = Field(default_factory=list, description="법령 청크")


class LegalChatResponseV2(BaseModel):
    """법률 상담 챗 응답 (v2)"""
    answer: str = Field(..., description="AI 답변 (마크다운 형식)")
    markdown: Optional[str] = Field(None, description="마크다운 형식 답변")
    query: str = Field(..., description="원본 질문")
    usedChunks: Optional[UsedChunksV2] = Field(None, description="사용된 RAG 청크 (Dual RAG)")


# ========== Agent 기반 통합 챗 API 스키마 ==========

class LegalChatMode(str, Enum):
    """법률 챗 모드"""
    plain = "plain"
    contract = "contract"
    situation = "situation"


class UsedReportMeta(BaseModel):
    """사용된 리포트 메타데이터"""
    type: str = Field(..., description="리포트 타입: 'contract' | 'situation'")
    analysisId: str = Field(..., description="분석 ID (UUID)")
    findingsIds: Optional[List[str]] = Field(None, description="발견된 이슈 ID 목록")


class UsedSourceMeta(BaseModel):
    """사용된 소스 메타데이터"""
    documentTitle: str = Field(..., description="문서 제목")
    fileUrl: Optional[str] = Field(None, description="파일 URL")
    sourceType: str = Field(..., description="소스 타입: 'law' | 'case' | 'standard_contract' | ...")
    similarityScore: Optional[float] = Field(None, description="유사도 점수")


class ContractAnalysisSummary(BaseModel):
    """계약서 분석 요약"""
    id: str = Field(..., description="분석 ID")
    title: Optional[str] = Field(None, description="계약서 제목")
    riskScore: Optional[int] = Field(None, description="위험도 점수")
    riskLevel: Optional[str] = Field(None, description="위험도 레벨")
    summary: Optional[str] = Field(None, description="요약")


class SituationAnalysisSummary(BaseModel):
    """상황 분석 요약"""
    id: str = Field(..., description="분석 ID")
    title: Optional[str] = Field(None, description="상황 제목")
    riskScore: Optional[int] = Field(None, description="위험도 점수")
    riskLevel: Optional[str] = Field(None, description="위험도 레벨")
    summary: Optional[str] = Field(None, description="요약")


class CaseCard(BaseModel):
    """케이스 카드 데이터 구조"""
    id: str = Field(..., description="케이스 ID")
    title: str = Field(..., description="케이스 제목")
    situation: str = Field(..., description="상황 설명")
    main_issues: List[str] = Field(default_factory=list, description="주요 이슈 목록")
    category: Optional[str] = Field(None, description="카테고리: all | intern | wage | stock | freelancer | harassment")
    severity: Optional[str] = Field(None, description="심각도: low | medium | high")
    keywords: Optional[List[str]] = Field(default_factory=list, description="키워드 목록")
    legalIssues: Optional[List[str]] = Field(default_factory=list, description="법적 쟁점 목록")
    learnings: Optional[List[str]] = Field(default_factory=list, description="배울 점 목록")
    actions: Optional[List[str]] = Field(default_factory=list, description="행동 가이드 목록")


class LegalChatAgentResponse(BaseModel):
    """Agent 기반 법률 챗 응답"""
    sessionId: str = Field(..., description="legal_chat_sessions.id")
    mode: LegalChatMode = Field(..., description="챗 모드")
    contractAnalysisId: Optional[str] = Field(None, description="계약서 분석 ID")
    situationAnalysisId: Optional[str] = Field(None, description="상황 분석 ID")
    answerMarkdown: str = Field(..., description="AI 답변 (마크다운)")
    usedReports: List[UsedReportMeta] = Field(default_factory=list, description="사용된 리포트 목록")
    usedSources: List[UsedSourceMeta] = Field(default_factory=list, description="사용된 소스 목록")
    contractAnalysis: Optional[ContractAnalysisSummary] = Field(None, description="계약서 분석 요약")
    situationAnalysis: Optional[SituationAnalysisSummary] = Field(None, description="상황 분석 요약")
    cases: Optional[List[CaseCard]] = Field(default_factory=list, description="유사 케이스 목록 (situation 모드 전용)")
