"""
상황분석 LangGraph 워크플로우
단일 스텝 → 멀티 스텝 모듈형 그래프 기반 실행
"""

from typing import TypedDict, List, Optional, Dict, Any
import asyncio
import logging
import json
import re
import warnings

# langchain-community의 Ollama Deprecated 경고 무시
warnings.filterwarnings("ignore", category=DeprecationWarning, module="langchain")

logger = logging.getLogger(__name__)

try:
    from langgraph.graph import StateGraph, END
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    logger.warning("LangGraph가 설치되지 않았습니다. pip install langgraph를 실행하세요.")

from models.schemas import LegalGroundingChunk, LegalCasePreview
from core.supabase_vector_store import SupabaseVectorStore
from core.generator_v2 import LLMGenerator
from core.prompts import (
    build_situation_classify_prompt,
    build_situation_action_guide_prompt,
    build_situation_summary_prompt,
    build_situation_findings_prompt,
    build_situation_scripts_prompt,
    build_situation_organizations_prompt,
)

logger = logging.getLogger(__name__)


# ============================================================================
# State 모델 정의
# ============================================================================

class SituationWorkflowState(TypedDict):
    """상황분석 워크플로우 상태"""
    # 입력 데이터
    situation_text: str
    category_hint: Optional[str]
    summary: Optional[str]
    details: Optional[str]
    employment_type: Optional[str]
    work_period: Optional[str]
    weekly_hours: Optional[int]
    is_probation: Optional[bool]
    social_insurance: Optional[str]
    
    # 중간 결과
    query_text: Optional[str]  # summary + details 또는 situation_text
    query_embedding: Optional[List[float]]  # 임베딩 벡터
    
    # 분류 결과
    classification: Optional[Dict[str, Any]]  # {classified_type, risk_score, categories}
    
    # 규정 필터링 결과
    filtered_categories: Optional[List[str]]  # 검색할 카테고리 목록
    
    # RAG 검색 결과
    grounding_chunks: Optional[List[LegalGroundingChunk]]  # 법령/매뉴얼
    related_cases: Optional[List[LegalCasePreview]]  # 케이스
    legal_basis: Optional[List[Dict[str, Any]]]  # 법적 근거 구조 (criteria 가공용)
    
    # 액션 가이드 생성 결과 (병렬 생성)
    action_plan: Optional[Dict[str, Any]]  # {steps: [...]}
    scripts: Optional[Dict[str, str]]  # {to_company, to_advisor}
    criteria: Optional[List[Dict[str, Any]]]  # 법적 판단 기준
    findings: Optional[List[Dict[str, Any]]]  # 법적 쟁점 발견 항목
    organizations: Optional[List[Dict[str, Any]]]  # 추천 기관 목록
    
    # 최종 결과
    summary_report: Optional[str]  # 마크다운 형식 리포트
    final_output: Optional[Dict[str, Any]]  # 최종 JSON 출력


# ============================================================================
# 워크플로우 노드 정의
# ============================================================================

class SituationWorkflow:
    """상황분석 LangGraph 워크플로우"""
    
    def __init__(self):
        if not LANGGRAPH_AVAILABLE:
            raise ImportError("LangGraph가 필요합니다. pip install langgraph를 실행하세요.")
        self.vector_store = SupabaseVectorStore()
        self.generator = LLMGenerator()
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        """워크플로우 그래프 구성 (병렬 실행 구조)"""
        workflow = StateGraph(SituationWorkflowState)
        
        # 노드 추가
        workflow.add_node("prepare_query", self.prepare_query_node)
        workflow.add_node("classify_situation", self.classify_situation_node)
        workflow.add_node("filter_rules", self.filter_rules_node)
        workflow.add_node("retrieve_guides", self.retrieve_guides_node)
        
        # 병렬 실행 노드 (retrieve_guides 이후 모든 필드를 병렬로 생성)
        workflow.add_node("generate_all_fields", self.generate_all_fields_node)
        
        workflow.add_node("merge_output", self.merge_output_node)
        
        # 엣지 정의
        workflow.set_entry_point("prepare_query")
        workflow.add_edge("prepare_query", "classify_situation")
        workflow.add_edge("classify_situation", "filter_rules")
        workflow.add_edge("filter_rules", "retrieve_guides")
        workflow.add_edge("retrieve_guides", "generate_all_fields")
        workflow.add_edge("generate_all_fields", "merge_output")
        workflow.add_edge("merge_output", END)
        
        return workflow.compile()
    
    # ==================== 노드 함수들 ====================
    
    async def prepare_query_node(self, state: SituationWorkflowState) -> SituationWorkflowState:
        """1. 쿼리 텍스트 준비 및 임베딩 생성"""
        logger.info("[워크플로우] prepare_query_node 시작")
        
        # 쿼리 텍스트 구성
        query_text = state.get("situation_text", "")
        if state.get("summary"):
            query_text = state["summary"]
            if state.get("details"):
                query_text = f"{state['summary']}\n\n{state['details']}"
        
        # 임베딩 생성
        query_embedding = await self._get_embedding(query_text)
        
        return {
            **state,
            "query_text": query_text,
            "query_embedding": query_embedding,
        }
    
    async def classify_situation_node(self, state: SituationWorkflowState) -> SituationWorkflowState:
        """2. 상황 분류 (카테고리 + 위험도)"""
        logger.info("[워크플로우] classify_situation_node 시작")
        
        query_text = state.get("query_text", "")
        category_hint = state.get("category_hint")
        
        # LLM으로 분류 수행
        classification = await self._llm_classify(
            situation_text=query_text,
            category_hint=category_hint,
            employment_type=state.get("employment_type"),
            work_period=state.get("work_period"),
            weekly_hours=state.get("weekly_hours"),
            is_probation=state.get("is_probation"),
            social_insurance=state.get("social_insurance"),
        )
        
        return {
            **state,
            "classification": classification,
        }
    
    async def filter_rules_node(self, state: SituationWorkflowState) -> SituationWorkflowState:
        """3. 분류 결과 기반 규정 필터링"""
        logger.info("[워크플로우] filter_rules_node 시작")
        
        classification = state.get("classification", {})
        classified_type = classification.get("classified_type", "unknown")
        
        # 카테고리 기반 필터링 규칙 생성
        filtered_categories = await self._filter_rules_by_classification(
            classified_type=classified_type,
            classification=classification,
        )
        
        return {
            **state,
            "filtered_categories": filtered_categories,
        }
    
    async def retrieve_guides_node(self, state: SituationWorkflowState) -> SituationWorkflowState:
        """4. RAG 검색 (필터링된 카테고리만) + legalBasis 추출"""
        logger.info("[워크플로우] retrieve_guides_node 시작")
        
        query_embedding = state.get("query_embedding")
        filtered_categories = state.get("filtered_categories", [])
        
        if not query_embedding:
            logger.warning("[워크플로우] query_embedding이 없습니다. 빈 결과 반환")
            return {
                **state,
                "grounding_chunks": [],
                "related_cases": [],
                "legal_basis": [],
            }
        
        # 병렬 검색
        grounding_chunks, related_cases = await asyncio.gather(
            self._search_legal_with_filter(
                query_embedding=query_embedding,
                categories=filtered_categories,
                top_k=8,
            ),
            self._search_cases_with_embedding(
                query_embedding=query_embedding,
                top_k=3,
            ),
            return_exceptions=False
        )
        
        # RAG 검색 결과 로깅
        logger.info(f"[워크플로우] RAG 검색 완료: 법령/가이드 {len(grounding_chunks)}개, 케이스 {len(related_cases)}개")
        if grounding_chunks:
            logger.info(f"[워크플로우] 검색된 법령/가이드 목록:")
            for idx, chunk in enumerate(grounding_chunks[:5], 1):  # 상위 5개만 로깅
                logger.info(f"  {idx}. [{chunk.source_type}] {chunk.title} (score: {chunk.score:.3f})")
                logger.info(f"     내용: {chunk.snippet[:100]}...")
        
        # legalBasis 구조 추출 (criteria 가공용)
        legal_basis = self._extract_legal_basis(grounding_chunks)
        
        return {
            **state,
            "grounding_chunks": grounding_chunks,
            "related_cases": related_cases[:3],  # 최대 3개만
            "legal_basis": legal_basis,
        }
    
    async def generate_all_fields_node(self, state: SituationWorkflowState) -> SituationWorkflowState:
        """5. 모든 필드 병렬 생성 (summary, findings, scripts, organizations)"""
        logger.info("[워크플로우] generate_all_fields_node 시작 - 병렬 실행")
        
        classification = state.get("classification", {})
        grounding_chunks = state.get("grounding_chunks", [])
        legal_basis = state.get("legal_basis", [])
        query_text = state.get("query_text", "")
        
        logger.info(f"[워크플로우] 입력 데이터 확인 - classification: {bool(classification)}, grounding_chunks: {len(grounding_chunks)}개, legal_basis: {len(legal_basis)}개, query_text 길이: {len(query_text)}자")
        
        # legal_basis가 빈 배열일 때 fallback
        if not legal_basis:
            logger.warning("[워크플로우] legal_basis가 비어있습니다. 기본 criteria 생성")
            legal_basis = [{
                "title": "법적 근거 확인 필요",
                "snippet": "관련 법령 정보를 확인하는 중입니다.",
                "source_type": "unknown",
            }]
        
        # 병렬로 모든 필드 생성
        logger.info("[워크플로우] 병렬 LLM 호출 시작 (summary, findings, scripts, organizations)...")
        start_time = asyncio.get_event_loop().time()
        
        summary_result, findings_result, scripts_result, organizations_result = await asyncio.gather(
            self._llm_generate_summary(
                situation_text=query_text,
                classification=classification,
                grounding_chunks=grounding_chunks,
                legal_basis=legal_basis,
                employment_type=state.get("employment_type"),
                work_period=state.get("work_period"),
                weekly_hours=state.get("weekly_hours"),
                is_probation=state.get("is_probation"),
                social_insurance=state.get("social_insurance"),
            ),
            self._llm_generate_findings(
                situation_text=query_text,
                classification=classification,
                grounding_chunks=grounding_chunks,
                legal_basis=legal_basis,
                employment_type=state.get("employment_type"),
                work_period=state.get("work_period"),
                weekly_hours=state.get("weekly_hours"),
                is_probation=state.get("is_probation"),
                social_insurance=state.get("social_insurance"),
            ),
            self._llm_generate_scripts(
                situation_text=query_text,
                classification=classification,
                grounding_chunks=grounding_chunks,
                legal_basis=legal_basis,
                employment_type=state.get("employment_type"),
                work_period=state.get("work_period"),
                weekly_hours=state.get("weekly_hours"),
                is_probation=state.get("is_probation"),
                social_insurance=state.get("social_insurance"),
            ),
            self._llm_generate_organizations(
                situation_text=query_text,
                classification=classification,
            ),
            return_exceptions=True
        )
        
        elapsed_time = asyncio.get_event_loop().time() - start_time
        logger.info(f"[워크플로우] 병렬 LLM 호출 완료 - 소요 시간: {elapsed_time:.2f}초")
        
        # 예외 처리
        if isinstance(summary_result, Exception):
            logger.error(f"[워크플로우] summary 생성 실패: {summary_result}", exc_info=summary_result)
            # 기본 summary 반환 (4개 섹션 구조 유지)
            summary_result = "## 📊 상황 분석의 결과\n\n상황을 분석했습니다. 아래 법적 관점과 행동 가이드를 참고하세요.\n\n## ⚖️ 법적 관점에서 본 현재 상황\n\n관련 법령을 확인하는 중입니다.\n\n## 🎯 지금 당장 할 수 있는 행동\n\n- 상황을 다시 확인해주세요\n- 잠시 후 다시 시도해주세요\n\n## 💬 이렇게 말해보세요\n\n상담 기관에 문의하시기 바랍니다."
        elif not summary_result or (isinstance(summary_result, str) and len(summary_result.strip()) == 0):
            logger.warning("[워크플로우] summary가 비어있음, 기본값 사용")
            summary_result = "## 📊 상황 분석의 결과\n\n상황을 분석했습니다. 아래 법적 관점과 행동 가이드를 참고하세요.\n\n## ⚖️ 법적 관점에서 본 현재 상황\n\n관련 법령을 확인하는 중입니다.\n\n## 🎯 지금 당장 할 수 있는 행동\n\n- 상황을 다시 확인해주세요\n- 잠시 후 다시 시도해주세요\n\n## 💬 이렇게 말해보세요\n\n상담 기관에 문의하시기 바랍니다."
        
        if isinstance(findings_result, Exception):
            logger.error(f"[워크플로우] findings 생성 실패: {findings_result}", exc_info=findings_result)
            findings_result = []
        if isinstance(scripts_result, Exception):
            logger.error(f"[워크플로우] scripts 생성 실패: {scripts_result}", exc_info=scripts_result)
            scripts_result = {}
        if isinstance(organizations_result, Exception):
            logger.error(f"[워크플로우] organizations 생성 실패: {organizations_result}", exc_info=organizations_result)
            organizations_result = []
        
        # findings 생성 후 chunk 기반으로 source 정보 매핑
        if isinstance(findings_result, list) and findings_result and grounding_chunks:
            logger.info(f"[워크플로우] findings에 chunk 기반 source 정보 매핑 시작: {len(findings_result)}개")
            findings_result = self._map_findings_to_chunks(findings_result, grounding_chunks)
            logger.info(f"[워크플로우] findings source 정보 매핑 완료")
        
        return {
            **state,
            "summary_report": summary_result if isinstance(summary_result, str) else "",
            "scripts": scripts_result if isinstance(scripts_result, dict) else {},
            "findings": findings_result if isinstance(findings_result, list) else [],
            "organizations": organizations_result if isinstance(organizations_result, list) else [],
        }
    
    # 기존 함수는 주석 처리 (레거시 호환성 유지)
    async def generate_action_guide_node_OLD(self, state: SituationWorkflowState) -> SituationWorkflowState:
        """5. 행동 가이드 생성 (summary, criteria, actionPlan, scripts 모두 생성)"""
        logger.info("[워크플로우] generate_action_guide_node 시작")
        
        classification = state.get("classification", {})
        grounding_chunks = state.get("grounding_chunks", [])
        legal_basis = state.get("legal_basis", [])
        query_text = state.get("query_text", "")
        
        logger.info(f"[워크플로우] 입력 데이터 확인 - classification: {bool(classification)}, grounding_chunks: {len(grounding_chunks)}개, legal_basis: {len(legal_basis)}개, query_text 길이: {len(query_text)}자")
        
        # legal_basis가 빈 배열일 때 fallback
        if not legal_basis:
            logger.warning("[워크플로우] legal_basis가 비어있습니다. 기본 criteria 생성")
            legal_basis = [{
                "title": "법적 근거 확인 필요",
                "snippet": "관련 법령 정보를 확인하는 중입니다.",
                "source_type": "unknown",
            }]
        
        # 액션 가이드 생성 (summary 포함)
        logger.info("[워크플로우] _llm_generate_action_guide 호출 시작...")
        action_result = await self._llm_generate_action_guide(
            situation_text=query_text,
            classification=classification,
            grounding_chunks=grounding_chunks,
            legal_basis=legal_basis,
            employment_type=state.get("employment_type"),
            work_period=state.get("work_period"),
            weekly_hours=state.get("weekly_hours"),
            is_probation=state.get("is_probation"),
            social_insurance=state.get("social_insurance"),
        )
        
        # 결과 검증 및 정규화
        logger.info(f"[워크플로우] _reformat_action_result 호출 전 action_result: summary 길이={len(action_result.get('summary', ''))}, criteria 개수={len(action_result.get('criteria', []))}")
        normalized_result = self._reformat_action_result(action_result, legal_basis)
        
        # action_plan 안전하게 처리
        action_plan_safe = normalized_result.get('action_plan', {})
        if isinstance(action_plan_safe, dict):
            action_plan_steps_count = len(action_plan_safe.get('steps', []))
        else:
            action_plan_steps_count = 0
        
        logger.info(f"[워크플로우] _reformat_action_result 호출 후 normalized_result: summary 길이={len(normalized_result.get('summary', ''))}, criteria 개수={len(normalized_result.get('criteria', []))}, action_plan steps={action_plan_steps_count}")
        
        return {
            **state,
            "summary_report": normalized_result.get("summary", ""),  # 4개 섹션 마크다운
            "action_plan": normalized_result.get("action_plan", {"steps": []}),  # steps 구조
            "scripts": normalized_result.get("scripts", {}),  # toCompany, toAdvisor
            "criteria": normalized_result.get("criteria", []),  # name, status, reason
            "findings": normalized_result.get("findings", []),  # 법적 쟁점 발견 항목
            "organizations": normalized_result.get("organizations", []),  # 추천 기관 목록
        }
    
    
    async def merge_output_node(self, state: SituationWorkflowState) -> SituationWorkflowState:
        """7. 최종 출력 병합"""
        logger.info("[워크플로우] merge_output_node 시작")
        
        classification = state.get("classification", {})
        related_cases = state.get("related_cases", [])
        action_plan = state.get("action_plan", {})
        scripts = state.get("scripts", {})
        # criteria가 None일 수 있으므로 명시적으로 체크
        criteria_raw = state.get("criteria")
        criteria = criteria_raw if criteria_raw is not None and isinstance(criteria_raw, list) else []
        findings = state.get("findings", [])  # 법적 쟁점 발견 항목
        organizations = state.get("organizations", [])  # 추천 기관 목록
        summary_report = state.get("summary_report", "")  # generate_action_guide에서 생성됨
        legal_basis = state.get("legal_basis", [])  # legal_basis 정보 가져오기
        
        # grounding_chunks 가져오기
        grounding_chunks = state.get("grounding_chunks", [])
        
        # 최종 JSON 출력 구성
        # related_cases는 이미 retrieve_guides에서 최대 3개로 제한됨
        # related_cases는 dict 형태로 반환되므로 dict 접근 방식 사용
        formatted_related_cases = []
        for case in related_cases[:3]:  # 최대 3개만 (이중 안전장치)
            if isinstance(case, dict):
                case_id = case.get("id", "")
                case_title = case.get("title", "")
                case_situation = case.get("situation", "")
                case_source_type = case.get("source_type")
            else:
                # 객체인 경우 (Legacy 지원)
                case_id = getattr(case, "id", "")
                case_title = getattr(case, "title", "")
                case_situation = getattr(case, "situation", "")
                case_source_type = getattr(case, "source_type", None)
            
            formatted_related_cases.append({
                "id": case_id,  # external_id
                "title": case_title,
                "summary": case_situation[:200] if len(case_situation) > 200 else case_situation,
                "source_type": case_source_type,  # source_type 정보 추가
            })
        
        # grounding_chunks를 sources 형식으로 변환
        formatted_sources = [
            {
                "source_id": chunk.source_id,
                "source_type": chunk.source_type,
                "title": chunk.title,
                "snippet": chunk.snippet,
                "score": chunk.score,
                "external_id": getattr(chunk, 'external_id', None),
                "file_url": getattr(chunk, 'file_url', None),
            }
            for chunk in grounding_chunks[:8]  # 최대 8개
        ]
        
        # criteria를 grounding_chunks에서 직접 생성 (새로운 RAG 기반 구조)
        # grounding_chunks를 criteria 형식으로 변환
        from core.file_utils import get_document_file_url
        
        criteria_items = []
        for chunk in grounding_chunks[:8]:  # 최대 8개
            external_id = getattr(chunk, 'external_id', None)
            source_type = chunk.source_type
            file_url = getattr(chunk, 'file_url', None)
            
            # file_url이 없으면 생성 (external_id가 있는 경우)
            if not file_url and external_id:
                try:
                    file_url = get_document_file_url(
                        external_id=external_id,
                        source_type=source_type,
                        expires_in=3600
                    )
                except Exception as e:
                    logger.warning(f"[워크플로우] fileUrl 생성 실패 (external_id={external_id}, source_type={source_type}): {str(e)}")
                    file_url = None
            
            # usageReason 생성 (우선순위: LLM criteria reason > snippet 기반 구체적 생성 > 기본 메시지)
            usage_reason = ""
            chunk_snippet_prefix = chunk.snippet[:50].strip() if chunk.snippet else ""
            chunk_snippet = chunk.snippet[:200].strip() if chunk.snippet else ""
            
            # 1. LLM이 생성한 criteria에서 해당 문서와 관련된 reason 찾기
            for criterion in criteria:
                if isinstance(criterion, dict):
                    criterion_name = criterion.get("name", "")
                    criterion_reason = criterion.get("reason", "")
                    criterion_legal_basis = criterion.get("legalBasis", [])
                    
                    # 문서 제목 매칭
                    if chunk.title in criterion_name or criterion_name in chunk.title:
                        # reason이 너무 길면 (snippet 전체가 들어간 경우) 다음 단계로
                        if len(criterion_reason) > 200:
                            break
                        # 일반적인 템플릿 문장인지 확인 ("현재 상황과 관련하여", "법적 판단 기준으로 사용했습니다" 등)
                        elif "현재 상황과 관련하여" in criterion_reason and "법적 판단 기준으로 사용했습니다" in criterion_reason:
                            # 일반적인 문장이면 snippet 기반으로 구체적 생성 시도
                            break
                        else:
                            usage_reason = criterion_reason
                            break
                    
                    # legalBasis에서 snippet 매칭 시도
                    if criterion_legal_basis and isinstance(criterion_legal_basis, list):
                        for basis in criterion_legal_basis:
                            if isinstance(basis, dict):
                                basis_snippet = basis.get("snippet", "")
                                if chunk_snippet_prefix and basis_snippet:
                                    if chunk_snippet_prefix[:30] in basis_snippet[:100] or basis_snippet[:30] in chunk_snippet_prefix[:100]:
                                        # 일반적인 템플릿 문장인지 확인
                                        if "현재 상황과 관련하여" in criterion_reason and "법적 판단 기준으로 사용했습니다" in criterion_reason:
                                            break
                                        else:
                                            usage_reason = criterion_reason if len(criterion_reason) <= 200 else ""
                                            break
                        if usage_reason:
                            break
                else:
                    criterion_name = getattr(criterion, "name", "")
                    criterion_reason = getattr(criterion, "reason", "")
                    if chunk.title in criterion_name or criterion_name in chunk.title:
                        # 일반적인 템플릿 문장인지 확인
                        if "현재 상황과 관련하여" in criterion_reason and "법적 판단 기준으로 사용했습니다" in criterion_reason:
                            break
                        usage_reason = criterion_reason if len(criterion_reason) <= 200 else ""
                        if usage_reason:
                            break
            
            # 2. snippet 기반으로 구체적인 usageReason 생성 (LLM reason이 없거나 일반적인 경우)
            if not usage_reason and chunk_snippet:
                # snippet에서 핵심 쟁점 키워드 추출
                issue_keywords = []
                if any(kw in chunk_snippet for kw in ["행사기간", "행사 기간", "행사기한"]):
                    issue_keywords.append("행사기간")
                if any(kw in chunk_snippet for kw in ["재직", "재임", "근무기간"]):
                    issue_keywords.append("재직요건")
                if any(kw in chunk_snippet for kw in ["해고", "계약해지", "해지"]):
                    issue_keywords.append("해고 예고")
                if any(kw in chunk_snippet for kw in ["선급금", "선금", "계약금"]):
                    issue_keywords.append("선급금")
                if any(kw in chunk_snippet for kw in ["지연", "배상", "이자"]):
                    issue_keywords.append("지연배상")
                if any(kw in chunk_snippet for kw in ["임금", "급여", "지급일"]):
                    issue_keywords.append("임금지급일")
                if any(kw in chunk_snippet for kw in ["수습", "수습기간"]):
                    issue_keywords.append("수습기간")
                if any(kw in chunk_snippet for kw in ["연장근로", "야간근로", "휴일근로"]):
                    issue_keywords.append("연장근로수당")
                
                # snippet 핵심 내용 요약 (첫 100자)
                snippet_summary = chunk_snippet[:100].replace("\n", " ").strip()
                
                # 문서 타입에 따른 판단 포인트
                if issue_keywords:
                    issue_text = ", ".join(issue_keywords[:2])  # 최대 2개만
                    if "표준" in chunk.title and "계약" in chunk.title:
                        usage_reason = f"이 조항은 {issue_text}에 대한 규정을 포함하고 있어, 현재 사용자 계약서의 해당 조항이 불명확하거나 과도하게 설정되어 있는지 비교·판단하는 기준으로 사용했습니다."
                    elif "법" in chunk.title or "규칙" in chunk.title:
                        usage_reason = f"이 조항은 {issue_text}에 대한 법적 요건을 규정하고 있어, 현재 상황에서 해당 요건이 충족되었는지 판단하는 근거로 활용했습니다."
                    else:
                        usage_reason = f"이 조항은 {issue_text}에 대한 내용을 다루고 있어, 현재 사용자 상황/계약서에서 해당 부분을 평가하는 기준으로 사용했습니다."
                else:
                    # 키워드가 없으면 snippet 요약 기반으로 생성
                    if "표준" in chunk.title and "계약" in chunk.title:
                        usage_reason = f"이 조항은 '{snippet_summary}...'의 내용을 규정하고 있어, 현재 계약서의 관련 조항과 비교하여 적절성을 판단하는 기준으로 사용했습니다."
                    elif "법" in chunk.title or "규칙" in chunk.title:
                        usage_reason = f"이 조항은 '{snippet_summary}...'의 법적 요건을 명시하고 있어, 현재 상황에서 해당 요건 충족 여부를 판단하는 근거로 활용했습니다."
                    else:
                        usage_reason = f"이 조항은 '{snippet_summary}...'의 내용을 포함하고 있어, 현재 사용자 상황과 비교하여 평가하는 기준으로 사용했습니다."
            
            # 3. usageReason이 없으면 기본 메시지 생성 (최후의 수단)
            if not usage_reason:
                if "표준" in chunk.title and "계약" in chunk.title:
                    usage_reason = f"현재 계약서의 관련 조항이 불명확한 부분이 있어, {chunk.title}의 규정을 비교 기준으로 사용했습니다."
                elif "법" in chunk.title or "규칙" in chunk.title:
                    usage_reason = f"현재 상황과 관련하여 {chunk.title}의 법령 조항을 판단 기준으로 사용했습니다."
                else:
                    usage_reason = f"현재 상황과 관련하여 {chunk.title}의 내용을 법적 판단 기준으로 사용했습니다."
            
            criteria_item = {
                "documentTitle": chunk.title,
                "fileUrl": file_url,
                "sourceType": source_type,
                "similarityScore": float(chunk.score),
                "snippet": chunk.snippet,
                "usageReason": usage_reason,
            }
            criteria_items.append(criteria_item)
        
        # findings는 이미 generate_all_fields_node에서 chunk 기반으로 source 정보가 매핑되어 있음
        # 여기서는 그대로 사용 (추가 처리 불필요)
        findings_processed = findings if findings else []
        
        if findings_processed:
            logger.info(f"[워크플로우] findings 사용 (이미 source 정보 매핑됨): {len(findings_processed)}개")
        else:
            logger.warning("[워크플로우] findings가 비어있거나 None입니다.")
        
        final_output = {
            "classified_type": classification.get("classified_type", "unknown"),
            "risk_score": classification.get("risk_score", 50),
            "summary": summary_report,  # generate_action_guide에서 생성된 4개 섹션 마크다운
            "criteria": criteria_items,  # RAG 검색 결과 기반 (새로운 구조)
            "findings": findings_processed,  # 법적 쟁점 발견 항목
            "action_plan": action_plan,  # steps 구조
            "scripts": scripts,  # toCompany, toAdvisor
            "related_cases": formatted_related_cases,
            "grounding_chunks": formatted_sources,  # sources 형식으로 변환
            "organizations": organizations,  # 추천 기관 목록
        }
        
        return {
            **state,
            "final_output": final_output,
        }
    
    # ==================== 내부 헬퍼 함수들 ====================
    
    def _map_findings_to_chunks(
        self,
        findings: List[Dict[str, Any]],
        grounding_chunks: List[Any]
    ) -> List[Dict[str, Any]]:
        """findings를 grounding_chunks와 매핑하여 source 정보 추가"""
        from core.file_utils import get_document_file_url
        
        findings_mapped = []
        for finding in findings:
            if not isinstance(finding, dict):
                findings_mapped.append(finding)
                continue
            
            document_title = finding.get("documentTitle", "").strip()
            refined_snippet = finding.get("refinedSnippet", "").strip()  # LLM이 생성한 refinedSnippet
            
            if not document_title:
                logger.warning(f"[워크플로우] finding에 documentTitle이 없음: {finding.get('title', 'unknown')}")
                findings_mapped.append(finding)
                continue
            
            # grounding_chunks에서 매칭되는 chunk 찾기
            matched_chunk = None
            best_match_score = 0.0
            
            for chunk in grounding_chunks:
                chunk_title = getattr(chunk, 'title', '').strip() if hasattr(chunk, 'title') else ''
                
                # 정확한 제목 매칭
                if chunk_title == document_title:
                    matched_chunk = chunk
                    break
                
                # 부분 제목 매칭 (양방향) - 더 유연한 매칭
                if document_title in chunk_title or chunk_title in document_title:
                    match_score = min(len(document_title), len(chunk_title)) / max(len(document_title), len(chunk_title))
                    if match_score > best_match_score:
                        best_match_score = match_score
                        matched_chunk = chunk
                
                # 핵심 키워드 매칭 (제목에서 핵심 단어 추출)
                # 예: "직장 내 괴롭힘 판단 및 예방 대응 매뉴얼.pdf" -> "직장 내 괴롭힘", "매뉴얼"
                doc_keywords = self._extract_title_keywords(document_title)
                chunk_keywords = self._extract_title_keywords(chunk_title)
                
                if doc_keywords and chunk_keywords:
                    # 공통 키워드가 2개 이상이면 매칭
                    common_keywords = set(doc_keywords) & set(chunk_keywords)
                    if len(common_keywords) >= 2:
                        keyword_match_score = len(common_keywords) / max(len(doc_keywords), len(chunk_keywords))
                        if keyword_match_score > best_match_score:
                            best_match_score = keyword_match_score
                            matched_chunk = chunk
            
            # chunk에서 source 정보 가져오기
            external_id = None
            source_type = 'law'
            chunk_score = 0.0
            chunk_snippet = ''
            
            if matched_chunk:
                external_id = getattr(matched_chunk, 'external_id', None)
                source_type = getattr(matched_chunk, 'source_type', 'law')
                chunk_score = float(getattr(matched_chunk, 'score', 0.0))
                chunk_snippet = getattr(matched_chunk, 'snippet', '')
                chunk_title_attr = getattr(matched_chunk, 'title', '')
                logger.info(f"[워크플로우] finding '{finding.get('title', 'unknown')}' chunk 매칭 성공: documentTitle='{document_title}', chunkTitle='{chunk_title_attr}'")
            else:
                # 매칭 실패 시 DB에서 title로 검색
                logger.warning(f"[워크플로우] finding '{finding.get('title', 'unknown')}' chunk 매칭 실패, DB에서 검색 시도: documentTitle='{document_title}'")
                try:
                    db_chunk = self.vector_store.get_legal_chunk_by_title(document_title)
                    if db_chunk:
                        external_id = db_chunk.get('external_id')
                        source_type = db_chunk.get('source_type', 'law')
                        logger.info(f"[워크플로우] DB에서 문서 찾음: external_id={external_id}, source_type={source_type}, title='{db_chunk.get('title', '')}'")
                    else:
                        logger.warning(f"[워크플로우] DB에서도 문서를 찾지 못함: documentTitle='{document_title}'")
                except Exception as e:
                    logger.error(f"[워크플로우] DB 조회 실패: {str(e)}", exc_info=True)
            
            # fileUrl 생성
            file_url = None
            if matched_chunk:
                chunk_file_url = getattr(matched_chunk, 'file_url', None)
                if chunk_file_url and chunk_file_url.strip():
                    file_url = chunk_file_url
                    logger.debug(f"[워크플로우] finding fileUrl을 chunk.file_url에서 가져옴: {file_url[:50]}...")
            
            if not file_url and external_id:
                try:
                    file_url = get_document_file_url(
                        external_id=external_id,
                        source_type=source_type,
                        expires_in=3600
                    )
                    if file_url:
                        logger.info(f"[워크플로우] finding fileUrl 생성 성공: external_id={external_id}, source_type={source_type}")
                    else:
                        logger.warning(f"[워크플로우] finding fileUrl 생성 결과 None: external_id={external_id}, source_type={source_type}")
                except Exception as e:
                    logger.warning(f"[워크플로우] finding fileUrl 생성 실패 (external_id={external_id}): {str(e)}")
            
            # sourceType 매핑 (guideline -> manual, statute -> law)
            mapped_source_type = source_type
            if source_type == "guideline":
                mapped_source_type = "manual"
            elif source_type == "statute":
                mapped_source_type = "law"
            
            # refinedSnippet: LLM이 생성한 것을 우선 사용, 없으면 chunk의 snippet 사용
            final_refined_snippet = refined_snippet if refined_snippet else chunk_snippet
            
            # source 정보 추가
            finding["source"] = {
                "documentTitle": document_title,
                "fileUrl": file_url or "",
                "sourceType": mapped_source_type,
                "refinedSnippet": final_refined_snippet,  # LLM이 생성한 refinedSnippet 우선 사용
                "similarityScore": chunk_score,
            }
            
            file_url_status = '있음' if file_url else '없음'
            logger.info(f"[워크플로우] finding '{finding.get('title', 'unknown')}' source 정보 설정 완료: fileUrl={file_url_status}, sourceType={mapped_source_type}, similarityScore={chunk_score}")
            
            findings_mapped.append(finding)
        
        return findings_mapped
    
    def _extract_title_keywords(self, title: str) -> List[str]:
        """제목에서 핵심 키워드 추출 (매칭용)"""
        if not title:
            return []
        
        # 제목 정리 (확장자 제거, 특수문자 제거)
        import re
        title_clean = re.sub(r'\.(pdf|hwp|hwpx|docx?)$', '', title, flags=re.IGNORECASE)
        title_clean = re.sub(r'[^\w\s가-힣]', ' ', title_clean)
        
        # 불용어 제거
        stopwords = ['및', '의', '과', '와', '을', '를', '에', '에서', '로', '으로', '가', '이', '은', '는', '도', '만', '까지', '부터']
        
        # 단어 추출 (2글자 이상)
        words = [w.strip() for w in title_clean.split() if len(w.strip()) >= 2 and w.strip() not in stopwords]
        
        # 핵심 키워드만 선택 (긴 단어 우선)
        keywords = sorted(set(words), key=lambda x: -len(x))[:5]  # 최대 5개
        
        return keywords
    
    async def _get_embedding(self, text: str) -> List[float]:
        """임베딩 생성 (캐싱 지원)"""
        # legal_rag_service의 _get_embedding과 동일한 로직
        # 여기서는 간단히 generator 사용
        return await asyncio.to_thread(self.generator.embed_one, text)
    
    async def _llm_classify(
        self,
        situation_text: str,
        category_hint: Optional[str] = None,
        employment_type: Optional[str] = None,
        work_period: Optional[str] = None,
        weekly_hours: Optional[int] = None,
        is_probation: Optional[bool] = None,
        social_insurance: Optional[str] = None,
    ) -> Dict[str, Any]:
        """LLM으로 상황 분류"""
        # 프롬프트 생성 (새로 만들어야 함)
        prompt = build_situation_classify_prompt(
            situation_text=situation_text,
            category_hint=category_hint,
            employment_type=employment_type,
            work_period=work_period,
            weekly_hours=weekly_hours,
            is_probation=is_probation,
            social_insurance=social_insurance,
        )
        
        # LLM 호출
        response = await self._call_llm(prompt)
        
        # JSON 파싱
        import json
        import re
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            classification = json.loads(json_match.group())
            
            # classified_type 정규화: 파이프로 구분된 값이 있으면 첫 번째 값만 사용
            classified_type = classification.get("classified_type", category_hint or "unknown")
            if isinstance(classified_type, str) and "|" in classified_type:
                # 파이프로 구분된 경우 첫 번째 값만 사용
                classified_type = classified_type.split("|")[0].strip()
                logger.warning(f"[워크플로우] classified_type에 여러 값이 포함됨, 첫 번째 값만 사용: {classification.get('classified_type')} -> {classified_type}")
            
            # 유효한 분류 유형인지 확인
            valid_types = ["harassment", "unpaid_wage", "unfair_dismissal", "overtime", "probation", "freelancer", "stock_option", "other", "unknown"]
            if classified_type not in valid_types:
                logger.warning(f"[워크플로우] 유효하지 않은 classified_type: {classified_type}, 기본값으로 변경")
                classified_type = category_hint or "unknown"
            
            classification["classified_type"] = classified_type
            return classification
        
        # 파싱 실패 시 기본값
        return {
            "classified_type": category_hint or "unknown",
            "risk_score": 50,
            "categories": [],
        }
    
    async def _filter_rules_by_classification(
        self,
        classified_type: str,
        classification: Dict[str, Any],
    ) -> List[str]:
        """분류 결과 기반 규정 필터링"""
        # classification에서 categories 추출 (LLM이 반환한 경우)
        llm_categories = classification.get("categories", [])
        
        # 카테고리 매핑 (fallback)
        category_mapping = {
            "harassment": ["직장내괴롭힘", "모욕", "인격권"],
            "unpaid_wage": ["임금체불", "최저임금", "임금지급", "연장근로수당", "무급야근"],
            "unfair_dismissal": ["부당해고", "계약해지", "해고통지"],
            "overtime": ["연장근로", "야간근로", "휴일근로", "근로시간"],
            "probation": ["수습", "인턴", "계약기간"],
            "freelancer": ["프리랜서", "용역", "대금미지급", "계약위반"],
            "stock_option": ["스톡옵션", "성과급", "인센티브", "지분"],
            "other": [],
            "unknown": [],
        }
        
        # LLM이 반환한 카테고리가 있으면 우선 사용, 없으면 매핑 사용
        if llm_categories:
            return llm_categories
        
        return category_mapping.get(classified_type, [])
    
    async def _search_legal_with_filter(
        self,
        query_embedding: List[float],
        categories: List[str],
        top_k: int = 8,
    ) -> List[LegalGroundingChunk]:
        """카테고리 필터링된 법령 검색"""
        # 필터 구성
        filters = None
        if categories:
            # metadata에 category 필드가 있다고 가정
            # 실제 구현은 벡터스토어 구조에 따라 다름
            filters = {"category": categories}
        
        rows = self.vector_store.search_similar_legal_chunks(
            query_embedding=query_embedding,
            top_k=top_k,
            filters=filters,
        )
        
        results: List[LegalGroundingChunk] = []
        for r in rows:
            source_type = r.get("source_type", "law")
            title = r.get("title", "제목 없음")
            content = r.get("content", "")
            score = r.get("score", 0.0)
            file_path = r.get("file_path", None)
            external_id = r.get("external_id", None)
            chunk_index = r.get("chunk_index", None)
            
            # file_path가 없으면 external_id로 생성
            if not file_path and external_id:
                from core.legal_rag_service import LegalRAGService
                service = LegalRAGService()
                file_path = service._build_file_path(source_type, external_id)
            
            # 스토리지 파일 URL 생성
            file_url = None
            if external_id:
                try:
                    file_url = self.vector_store.get_storage_file_url(
                        external_id=external_id,
                        source_type=source_type,
                        expires_in=3600  # 1시간
                    )
                except Exception as e:
                    logger.warning(f"[워크플로우] 스토리지 URL 생성 실패 (external_id={external_id}, source_type={source_type}): {str(e)}")
            
            results.append(
                LegalGroundingChunk(
                    source_id=r.get("id", ""),
                    source_type=source_type,
                    title=title,
                    snippet=content[:300],
                    score=score,
                    file_path=file_path,
                    external_id=external_id,
                    chunk_index=chunk_index,
                    file_url=file_url,  # 파일 URL 추가
                )
            )
        return results
    
    async def _search_cases_with_embedding(
        self,
        query_embedding: List[float],
        top_k: int = 3,
    ) -> List[Dict[str, Any]]:
        """
        케이스 검색 (case 또는 standard_contract 타입)
        source_type 정보를 포함하여 반환
        """
        # case와 standard_contract 모두 검색 (필터 제거)
        rows = self.vector_store.search_similar_legal_chunks(
            query_embedding=query_embedding,
            top_k=top_k * 2,  # 더 많이 가져와서 필터링
        )
        
        cases: List[Dict[str, Any]] = []
        for row in rows:
            source_type = row.get("source_type", "case")
            # case 또는 standard_contract만 포함
            if source_type not in ["case", "standard_contract"]:
                continue
            
            external_id = row.get("external_id", "")
            title = row.get("title", "제목 없음")
            content = row.get("content", "")
            metadata = row.get("metadata", {})
            
            cases.append({
                "id": external_id,
                "title": title,
                "situation": metadata.get("situation", content[:200]),
                "main_issues": metadata.get("issues", []),
                "source_type": source_type,  # source_type 정보 포함
            })
            
            if len(cases) >= top_k:
                break
        
        return cases
    
    def _extract_legal_basis(self, grounding_chunks: List[LegalGroundingChunk]) -> List[Dict[str, Any]]:
        """RAG 검색 결과에서 legalBasis 구조 추출"""
        legal_basis = []
        for chunk in grounding_chunks[:5]:  # 상위 5개만 사용
            legal_basis.append({
                "title": chunk.title,
                "snippet": chunk.snippet,
                "source_type": chunk.source_type,
                "source_id": chunk.source_id,
            })
        return legal_basis
    
    async def _llm_generate_action_guide(
        self,
        situation_text: str,
        classification: Dict[str, Any],
        grounding_chunks: List[LegalGroundingChunk],
        legal_basis: List[Dict[str, Any]],
        employment_type: Optional[str] = None,
        work_period: Optional[str] = None,
        weekly_hours: Optional[int] = None,
        is_probation: Optional[bool] = None,
        social_insurance: Optional[str] = None,
    ) -> Dict[str, Any]:
        """행동 가이드 생성 (summary, criteria, actionPlan, scripts 모두)"""
        logger.info("[워크플로우] _llm_generate_action_guide 시작 - 프롬프트 생성 중...")
        prompt = build_situation_action_guide_prompt(
            situation_text=situation_text,
            classification=classification,
            grounding_chunks=grounding_chunks,
            legal_basis=legal_basis,
            employment_type=employment_type,
            work_period=work_period,
            weekly_hours=weekly_hours,
            is_probation=is_probation,
            social_insurance=social_insurance,
        )
        logger.info(f"[워크플로우] 프롬프트 생성 완료 - 길이: {len(prompt)}자, grounding_chunks: {len(grounding_chunks)}개, legal_basis: {len(legal_basis)}개")
        
        logger.info("[워크플로우] LLM 호출 시작 (행동 가이드 생성)...")
        response = await self._call_llm(prompt)
        logger.info("[워크플로우] LLM 응답 수신 완료 - JSON 파싱 시작...")
        
        # JSON 파싱
        import json
        import re
        
        # 응답 로깅 (디버깅용) - 강화
        logger.info(f"[워크플로우] LLM raw 응답 길이: {len(response)}자")
        logger.info(f"[워크플로우] LLM raw 응답 (처음 1500자): {response[:1500]}")
        if len(response) > 1500:
            logger.info(f"[워크플로우] LLM raw 응답 (마지막 500자): {response[-500:]}")
        
        # 코드 블록 제거
        response_clean = response.strip()
        if response_clean.startswith("```json"):
            response_clean = response_clean[7:]
        elif response_clean.startswith("```"):
            response_clean = response_clean[3:]
        if response_clean.endswith("```"):
            response_clean = response_clean[:-3]
        response_clean = response_clean.strip()
        
        # JSON 객체 추출 (더 robust한 파싱)
        json_match = re.search(r'\{.*\}', response_clean, re.DOTALL)
        if not json_match:
            logger.error(f"[워크플로우] JSON 객체를 찾을 수 없습니다. response_clean (처음 500자): {response_clean[:500]}")
        
        if json_match:
            try:
                logger.debug(f"[워크플로우] JSON 파싱 시도, response_clean 길이: {len(response_clean)}")
                # 중괄호 매칭으로 유효한 JSON 추출
                json_str = json_match.group()
                brace_count = 0
                last_valid_pos = -1
                for i, char in enumerate(json_str):
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            last_valid_pos = i + 1
                            break
                
                if last_valid_pos > 0:
                    json_str = json_str[:last_valid_pos]
                
                # summary 필드의 제어 문자 이스케이프 처리
                # JSON 문자열 내에서 제어 문자(개행, 탭 등)를 이스케이프
                def escape_control_chars_in_json_string(json_str: str) -> str:
                    """JSON 문자열 내의 제어 문자를 이스케이프 처리"""
                    # summary 필드 찾기
                    summary_pattern = r'"summary"\s*:\s*"([^"]*(?:\\.[^"]*)*)"'
                    
                    def escape_summary(match):
                        field_name = match.group(0).split(':')[0]  # "summary"
                        value = match.group(1)  # 실제 값
                        
                        # 이미 이스케이프된 문자는 유지하면서 제어 문자 이스케이프
                        # 개행 문자 처리
                        value = value.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')
                        # 따옴표 이스케이프 (이미 이스케이프된 것은 제외)
                        value = re.sub(r'(?<!\\)"', '\\"', value)
                        
                        return f'{field_name}: "{value}"'
                    
                    # summary 필드만 처리
                    json_str = re.sub(summary_pattern, escape_summary, json_str, flags=re.DOTALL)
                    return json_str
                
                # summary 필드의 제어 문자 처리 (legal_rag_service와 동일한 로직)
                def clean_summary_field_in_json(json_str: str) -> str:
                    """summary 필드 내부의 제어 문자를 JSON 이스케이프로 변환"""
                    try:
                        # summary 필드의 시작 위치 찾기
                        summary_start = json_str.find('"summary"')
                        if summary_start == -1:
                            return json_str
                        
                        # summary 필드의 값 시작 위치 찾기 (콜론과 따옴표 이후)
                        value_start = json_str.find('"', summary_start + 9)  # "summary" 길이 + 1
                        if value_start == -1:
                            return json_str
                        
                        value_start += 1  # 따옴표 다음부터
                        
                        # 문자열 끝 찾기 (이스케이프된 따옴표 고려)
                        value_end = value_start
                        while value_end < len(json_str):
                            char = json_str[value_end]
                            
                            # 이스케이프된 문자 건너뛰기
                            if char == '\\' and value_end + 1 < len(json_str):
                                value_end += 2
                                continue
                            
                            # 따옴표 처리
                            if char == '"':
                                # 앞의 백슬래시 개수 세기
                                backslash_count = 0
                                i = value_end - 1
                                while i >= value_start and json_str[i] == '\\':
                                    backslash_count += 1
                                    i -= 1
                                # 홀수 개의 백슬래시면 이스케이프된 따옴표, 짝수 개면 문자열 끝
                                if backslash_count % 2 == 0:
                                    break
                            
                            value_end += 1
                        
                        if value_end >= len(json_str):
                            # 문자열 끝을 찾지 못한 경우, 다음 큰따옴표까지 찾기
                            next_quote = json_str.find('"', value_start)
                            if next_quote > value_start:
                                value_end = next_quote
                            else:
                                return json_str
                        
                        # summary 필드 내용 추출
                        content = json_str[value_start:value_end]
                        
                        # 이스케이프된 문자를 실제 문자로 변환 (일시적)
                        content_decoded = content.replace('\\n', '\n').replace('\\r', '\r').replace('\\t', '\t').replace('\\"', '"').replace('\\\\', '\\')
                        
                        # 마크다운 코드 블록 제거
                        content_decoded = re.sub(r'```markdown\s*', '', content_decoded, flags=re.IGNORECASE)
                        content_decoded = re.sub(r'```\s*', '', content_decoded, flags=re.MULTILINE)
                        
                        # 제어 문자를 JSON 이스케이프로 변환
                        result = []
                        for char in content_decoded:
                            if char == '\n':
                                result.append('\\n')
                            elif char == '\r':
                                result.append('\\r')
                            elif char == '\t':
                                result.append('\\t')
                            elif char == '"':
                                result.append('\\"')
                            elif char == '\\':
                                result.append('\\\\')
                            elif ord(char) < 32:  # 제어 문자
                                result.append(f'\\u{ord(char):04x}')
                            else:
                                result.append(char)
                        
                        # summary 필드 교체
                        cleaned_content = ''.join(result)
                        return json_str[:value_start] + cleaned_content + json_str[value_end:]
                    except Exception as e:
                        logger.warning(f"[워크플로우] summary 필드 정리 중 오류 발생: {str(e)}, 원본 JSON 사용")
                        return json_str
                
                # summary 필드 정리
                json_str_cleaned = clean_summary_field_in_json(json_str)
                
                # JSON 파싱
                result = json.loads(json_str_cleaned)
                
                # summary 필드에서 마크다운 코드 블록 제거 (있는 경우)
                if "summary" in result and isinstance(result["summary"], str):
                    summary = result["summary"]
                    # ```markdown ... ``` 제거
                    summary = re.sub(r'```markdown\s*', '', summary, flags=re.IGNORECASE)
                    summary = re.sub(r'```\s*$', '', summary, flags=re.MULTILINE)
                    # 따옴표 escape 처리 (JSON 내부에서 이미 처리됨)
                    
                    # 한자/일본어 문자를 한글로 변환 또는 제거
                    def remove_cjk_japanese(text: str) -> str:
                        """한자, 일본어 문자를 제거하거나 한글로 변환"""
                        import unicodedata
                        
                        # 일반적인 한자-한글 매핑
                        hanja_to_hangul = {
                            '最近': '최근',
                            '典型': '전형',
                            '典型적인': '전형적인',
                        }
                        
                        # 매핑된 한자 변환
                        for hanja, hangul in hanja_to_hangul.items():
                            text = text.replace(hanja, hangul)
                        
                        # 한자 범위 (CJK 통합 한자: U+4E00–U+9FFF, 한자 보충: U+3400–U+4DBF)
                        # 일본어 히라가나: U+3040–U+309F, 가타카나: U+30A0–U+30FF
                        result = []
                        for char in text:
                            code = ord(char)
                            # 한자 범위 체크
                            is_hanja = (0x4E00 <= code <= 0x9FFF) or (0x3400 <= code <= 0x4DBF)
                            # 일본어 범위 체크
                            is_japanese = (0x3040 <= code <= 0x309F) or (0x30A0 <= code <= 0x30FF)
                            
                            if is_hanja or is_japanese:
                                # 한자/일본어 문자는 제거
                                logger.debug(f"[워크플로우] 한자/일본어 문자 제거: {char} (U+{code:04X})")
                                continue
                            result.append(char)
                        
                        return ''.join(result)
                    
                    summary = remove_cjk_japanese(summary)
                    
                    result["summary"] = summary.strip()
                
                # action_plan이 딕셔너리인지 리스트인지 확인
                action_plan = result.get('action_plan', {})
                if isinstance(action_plan, dict):
                    action_plan_steps = len(action_plan.get('steps', []))
                elif isinstance(action_plan, list):
                    action_plan_steps = len(action_plan)
                else:
                    action_plan_steps = 0
                
                logger.info(f"[워크플로우] JSON 파싱 성공 - summary 길이: {len(result.get('summary', ''))}자, criteria 개수: {len(result.get('criteria', []))}개, action_plan steps: {action_plan_steps}개")
                
                # action_plan 안전하게 처리
                action_plan_safe = result.get('action_plan', {})
                if isinstance(action_plan_safe, dict):
                    action_plan_steps_count = len(action_plan_safe.get('steps', []))
                else:
                    action_plan_steps_count = 0
                
                logger.info(f"[워크플로우] 파싱된 action_result: summary 길이={len(result.get('summary', ''))}, criteria 개수={len(result.get('criteria', []))}, findings 개수={len(result.get('findings', []))}, action_plan steps={action_plan_steps_count}")
                return result
            except json.JSONDecodeError as e:
                logger.error(f"[워크플로우] JSON 파싱 실패: {str(e)}")
                if hasattr(e, 'lineno') and hasattr(e, 'colno'):
                    logger.error(f"[워크플로우] 에러 위치: line {e.lineno}, column {e.colno}")
                logger.error(f"[워크플로우] 응답 원문 (처음 1000자): {response_clean[:1000]}")
                if 'json_str_cleaned' in locals():
                    logger.error(f"[워크플로우] json_str_cleaned 길이: {len(json_str_cleaned)}")
                    logger.error(f"[워크플로우] json_str_cleaned (처음 500자): {json_str_cleaned[:500]}")
                
                # JSON 파싱 실패 시에도 부분적으로 파싱 시도
                try:
                    # summary, criteria, action_plan, scripts 필드 추출 시도
                    json_to_search = json_str_cleaned if 'json_str_cleaned' in locals() else (json_str if 'json_str' in locals() else response_clean)
                    
                    # 여러 패턴으로 summary 필드 찾기
                    summary_patterns = [
                        r'"summary"\s*:\s*"((?:[^"\\]|\\.)*)"',  # 일반적인 JSON 문자열
                        r'"summary"\s*:\s*"([^"]*)"',  # 간단한 패턴
                        r'summary["\s]*:["\s]*([^",}]+)',  # 더 유연한 패턴
                    ]
                    
                    summary_text = None
                    for pattern in summary_patterns:
                        summary_match = re.search(pattern, json_to_search, re.DOTALL | re.IGNORECASE)
                        if summary_match:
                            summary_text = summary_match.group(1)
                            # 이스케이프 제거
                            summary_text = summary_text.replace('\\n', '\n').replace('\\r', '\r').replace('\\t', '\t').replace('\\"', '"')
                            logger.warning(f"[워크플로우] summary 필드 추출 성공 (패턴: {pattern[:30]}...)")
                            break
                    
                    # criteria 필드 추출 시도
                    criteria_list = []
                    try:
                        # criteria 배열 패턴 찾기 (더 강력한 패턴)
                        # 먼저 criteria 배열의 시작과 끝을 찾기
                        criteria_start = json_to_search.find('"criteria"')
                        if criteria_start != -1:
                            # criteria 다음의 [ 찾기
                            bracket_start = json_to_search.find('[', criteria_start)
                            if bracket_start != -1:
                                # 중첩된 중괄호와 대괄호를 고려하여 배열 끝 찾기
                                bracket_count = 0
                                bracket_end = bracket_start
                                in_string = False
                                escape_next = False
                                
                                for i in range(bracket_start, len(json_to_search)):
                                    char = json_to_search[i]
                                    
                                    if escape_next:
                                        escape_next = False
                                        continue
                                    
                                    if char == '\\':
                                        escape_next = True
                                        continue
                                    
                                    if char == '"' and not escape_next:
                                        in_string = not in_string
                                        continue
                                    
                                    if not in_string:
                                        if char == '[':
                                            bracket_count += 1
                                        elif char == ']':
                                            bracket_count -= 1
                                            if bracket_count == 0:
                                                bracket_end = i + 1
                                                break
                                
                                if bracket_end > bracket_start:
                                    criteria_array_str = json_to_search[bracket_start:bracket_end]
                                    # 각 객체 추출 (간단한 패턴)
                                    # { "name": "...", "status": "...", "reason": "..." }
                                    item_pattern = r'\{\s*"name"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"status"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,\s*"reason"\s*:\s*"((?:[^"\\]|\\.)*)"'
                                    items = re.findall(item_pattern, criteria_array_str, re.DOTALL)
                                    for name, status, reason in items:
                                        # 이스케이프 제거
                                        name = name.replace('\\"', '"').replace('\\n', '\n').replace('\\r', '\r').replace('\\t', '\t')
                                        status = status.replace('\\"', '"').replace('\\n', '\n').replace('\\r', '\r').replace('\\t', '\t')
                                        reason = reason.replace('\\"', '"').replace('\\n', '\n').replace('\\r', '\r').replace('\\t', '\t')
                                        criteria_list.append({
                                            "name": name,
                                            "status": status,
                                            "reason": reason,
                                        })
                                    if criteria_list:
                                        logger.warning(f"[워크플로우] criteria 필드 추출 성공: {len(criteria_list)}개")
                    except Exception as criteria_error:
                        logger.warning(f"[워크플로우] criteria 추출 실패: {str(criteria_error)}")
                    
                    if summary_text:
                        # 부분 파싱 결과 반환 (criteria 포함)
                        return {
                            "summary": summary_text.strip(),
                            "action_plan": {"steps": []},
                            "scripts": {},
                            "criteria": criteria_list,  # 추출된 criteria 사용
                        }
                    else:
                        logger.warning("[워크플로우] summary 필드도 추출 실패")
                except Exception as partial_error:
                    logger.warning(f"[워크플로우] 부분 파싱도 실패: {str(partial_error)}", exc_info=True)
        
        # 기본값 (4개 섹션 구조 유지)
        logger.warning("[워크플로우] JSON 파싱 실패, 기본값 반환")
        if 'response_clean' in locals():
            logger.warning(f"[워크플로우] response_clean (처음 500자): {response_clean[:500]}")
        return {
            "summary": "## 상황 분석의 결과\n\n분석 중 오류가 발생했습니다.\n\n## 법적 관점에서 본 현재상황\n\n법적 근거를 확인하는 중 오류가 발생했습니다.\n\n## 지금 당장 할 수 있는 행동\n\n- 상황을 다시 입력해 주세요\n- 잠시 후 다시 시도해 주세요\n\n## 이렇게 말해보세요\n\n상담 기관에 문의하시기 바랍니다.",
            "action_plan": {"steps": []},
            "scripts": {},
            "criteria": [],
        }
    
    def _reconstruct_summary_sections(self, summary: str, section_patterns: List[Dict[str, Any]], classified_type: str = "unknown") -> Optional[str]:
        """LLM이 생성한 summary를 파싱하여 올바른 섹션 형식으로 재구성"""
        try:
            # summary를 줄 단위로 분할
            lines = summary.split('\n')
            reconstructed_parts = []
            
            # 각 섹션별로 내용 추출
            section_contents = {}
            current_section_key = None
            
            for i, line in enumerate(lines):
                line_stripped = line.strip()
                
                # 섹션 헤더 찾기 (이모지 + 키워드 기반)
                for section_info in section_patterns:
                    # 먼저 정확한 헤더 형식 확인 (새로운 형식: 이모지 + 굵은 제목)
                    if section_info["title"] in line_stripped:
                        current_section_key = section_info["title"]
                        if current_section_key not in section_contents:
                            section_contents[current_section_key] = []
                        break
                    
                    # 이모지로 확인
                    emoji = section_info.get("emoji")
                    if emoji and emoji in line_stripped:
                        # 이모지 뒤에 키워드가 있는지 확인
                        for keyword in section_info["keywords"]:
                            if keyword != emoji and keyword in line_stripped:
                                current_section_key = section_info["title"]
                                if current_section_key not in section_contents:
                                    section_contents[current_section_key] = []
                                break
                        if current_section_key:
                            break
                    
                    # 키워드로 확인 (레거시 형식 지원)
                    for keyword in section_info["keywords"]:
                        if keyword == emoji:
                            continue  # 이미 이모지로 확인했으므로 스킵
                        # 헤더 형식 확인 (## 키워드, # 키워드, 또는 키워드만) - 더 유연한 매칭
                        keyword_in_line = keyword.lower() in line_stripped.lower()
                        is_header_format = re.match(r'^##?\s*', line_stripped) is not None
                        is_short_line = len(line_stripped) < 80  # 더 긴 줄도 허용
                        
                        if keyword_in_line and (is_header_format or is_short_line):
                            current_section_key = section_info["title"]
                            if current_section_key not in section_contents:
                                section_contents[current_section_key] = []
                            break
                    if current_section_key:
                        break
                
                # 현재 섹션에 내용 추가
                if current_section_key:
                    # 헤더 라인이 아니면 내용으로 추가 - 더 유연한 헤더 감지
                    is_header = False
                    for section_info in section_patterns:
                        # 정확한 헤더 형식 확인
                        if section_info["title"] in line_stripped:
                            is_header = True
                            break
                        
                        # 이모지로 확인
                        emoji = section_info.get("emoji")
                        if emoji and emoji in line_stripped:
                            # 이모지 뒤에 키워드가 있는지 확인
                            for keyword in section_info["keywords"]:
                                if keyword != emoji and keyword in line_stripped:
                                    is_header = True
                                    break
                            if is_header:
                                break
                        
                        # 키워드로 확인 (레거시 형식 지원)
                        for keyword in section_info["keywords"]:
                            if keyword == emoji:
                                continue
                            keyword_in_line = keyword.lower() in line_stripped.lower()
                            is_header_format = re.match(r'^##?\s*', line_stripped) is not None
                            is_short_line = len(line_stripped) < 80
                            # 키워드가 포함되고 헤더 형식이거나 짧은 줄이면 헤더로 인식
                            if keyword_in_line and (is_header_format or is_short_line):
                                is_header = True
                                break
                        if is_header:
                            break
                    
                    if not is_header:
                        section_contents[current_section_key].append(line)
                else:
                    # 섹션이 없으면 첫 번째 섹션으로 간주
                    if not section_contents:
                        first_section = section_patterns[0]["title"]
                        section_contents[first_section] = [line]
            
            # 재구성된 summary 생성
            for section_info in section_patterns:
                title = section_info["title"]
                if title in section_contents and section_contents[title]:
                    reconstructed_parts.append(title)
                    reconstructed_parts.append("")
                    reconstructed_parts.extend(section_contents[title])
                    reconstructed_parts.append("")
                else:
                    # 섹션이 없으면 카테고리별 기본 메시지 추가
                    section_key = section_info.get("keywords", [""])[0] if section_info.get("keywords") else ""
                    
                    default_content_by_type = {
                        "unpaid_wage": {
                            "법적 관점": "임금체불은 근로기준법 제43조(임금지급), 제36조(임금의 지급)와 관련된 사안입니다. 사용자는 근로자에게 임금을 정기적으로 지급할 의무가 있으며, 이를 위반할 경우 형사처벌과 민사상 손해배상 책임을 질 수 있습니다.",
                            "지금 당장 할 수 있는 행동": "- 근로계약서와 급여명세서를 확인하세요\n- 출퇴근 기록과 근무시간을 정리하세요\n- 임금 지급 내역을 문서로 보관하세요",
                            "이렇게 말해보세요": "회사에 정중하게 임금 지급을 요청하는 문구를 작성하세요."
                        },
                        "harassment": {
                            "법적 관점": "직장 내 괴롭힘은 직장 내 괴롭힘 방지 및 근로자 보호 등에 관한 법률에 따라 금지되어 있습니다. 업무상 지위나 관계를 이용하여 근로자에게 신체적·정신적 고통을 주는 행위는 법적 처벌 대상이 될 수 있습니다.",
                            "지금 당장 할 수 있는 행동": "- 괴롭힘 관련 증거 자료를 수집하세요\n- 대화 내용과 일시를 기록하세요\n- 상황을 객관적으로 정리하세요",
                            "이렇게 말해보세요": "회사에 괴롭힘 상황을 정중하게 알리는 문구를 작성하세요."
                        },
                        "unfair_dismissal": {
                            "법적 관점": "부당해고는 근로기준법 제23조(해고의 제한)에 따라 제한되어 있습니다. 정당한 사유 없이 해고하는 경우 복직 청구나 손해배상 청구가 가능합니다.",
                            "지금 당장 할 수 있는 행동": "- 해고 통지서와 관련 문서를 보관하세요\n- 근무 기간과 성과를 정리하세요\n- 회사와의 대화 내용을 기록하세요",
                            "이렇게 말해보세요": "회사에 해고 사유에 대한 설명을 요청하는 문구를 작성하세요."
                        },
                        "overtime": {
                            "법적 관점": "근로시간은 근로기준법 제50조(근로시간), 제53조(연장근로)에 따라 규제됩니다. 법정 근로시간을 초과하는 연장근로에 대해서는 가산임금을 지급해야 합니다.",
                            "지금 당장 할 수 있는 행동": "- 근무시간 기록을 확인하세요\n- 연장근로 시간을 계산하세요\n- 휴게시간 준수 여부를 확인하세요",
                            "이렇게 말해보세요": "회사에 근로시간과 가산임금에 대해 문의하는 문구를 작성하세요."
                        },
                        "probation": {
                            "법적 관점": "수습기간은 근로기준법에 따라 합리적인 범위 내에서만 인정됩니다. 수습기간 중에도 근로기준법상 보호를 받으며, 부당한 해고는 제한됩니다.",
                            "지금 당장 할 수 있는 행동": "- 수습 기간과 조건을 확인하세요\n- 근로계약서의 수습 조항을 검토하세요\n- 수습 기간 중 평가 내용을 정리하세요",
                            "이렇게 말해보세요": "회사에 수습기간과 평가 기준에 대해 문의하는 문구를 작성하세요."
                        },
                        "freelancer": {
                            "법적 관점": "프리랜서/용역 계약에서 대금 미지급은 민법상 채무불이행에 해당할 수 있습니다. 계약서에 명시된 지급 조건과 실제 지급 여부를 확인해야 합니다.",
                            "지금 당장 할 수 있는 행동": "- 용역 계약서와 대금 지급 약정을 확인하세요\n- 작업 완료 증빙 자료를 정리하세요\n- 대금 지급 내역과 미지급 내역을 문서로 보관하세요",
                            "이렇게 말해보세요": "발주사에 대금 지급을 요청하는 정중한 문구를 작성하세요."
                        },
                        "stock_option": {
                            "법적 관점": "스톡옵션이나 성과급은 계약서나 약정서에 명시된 조건에 따라 지급되어야 합니다. 구두 약속만으로는 법적 구속력이 약할 수 있으므로 문서화가 중요합니다.",
                            "지금 당장 할 수 있는 행동": "- 스톡옵션/성과급 약정 내용을 확인하세요\n- 계약서나 약정서를 보관하세요\n- 지급 조건과 시기를 정리하세요",
                            "이렇게 말해보세요": "회사에 스톡옵션/성과급 지급 조건과 시기에 대해 문의하는 문구를 작성하세요."
                        },
                        "other": {
                            "법적 관점": "관련 법령을 확인하여 현재 상황을 법적으로 평가해야 합니다.",
                            "지금 당장 할 수 있는 행동": "- 상황을 객관적으로 정리하세요\n- 관련 문서를 보관하세요\n- 증거 자료를 수집하세요",
                            "이렇게 말해보세요": "회사나 상담 기관에 상황을 설명할 수 있는 문구를 작성하세요."
                        },
                    }
                    
                    default_content = default_content_by_type.get(classified_type, {
                        "법적 관점": "관련 법령을 확인하여 현재 상황을 법적으로 평가해야 합니다.",
                        "지금 당장 할 수 있는 행동": "- 상황을 객관적으로 정리하세요\n- 관련 문서를 보관하세요\n- 증거 자료를 수집하세요",
                        "이렇게 말해보세요": "회사나 상담 기관에 상황을 설명할 수 있는 문구를 작성하세요."
                    })
                    
                    # 섹션 키워드로 매칭
                    section_key_matched = None
                    for key in default_content.keys():
                        if any(keyword in section_key for keyword in section_info.get("keywords", [])):
                            section_key_matched = key
                            break
                    
                    default_text = default_content.get(section_key_matched or section_key, "해당 섹션 내용을 확인하는 중입니다.")
                    # 기본값 텍스트인 경우 섹션을 추가하지 않음
                    if default_text and default_text != "관련 법령을 확인하여 현재 상황을 법적으로 평가해야 합니다." and default_text != "해당 섹션 내용을 확인하는 중입니다.":
                        reconstructed_parts.append(title)
                        reconstructed_parts.append("")
                        reconstructed_parts.append(default_text)
                        reconstructed_parts.append("")
            
            return '\n'.join(reconstructed_parts).strip()
        except Exception as e:
            logger.warning(f"[워크플로우] summary 섹션 재구성 실패: {str(e)}")
            return None
    
    def _remove_cjk_japanese(self, text: str) -> str:
        """한자, 일본어 문자를 제거하거나 한글로 변환 (재사용 가능한 함수)"""
        if not isinstance(text, str):
            return text
        
        # 일반적인 한자-한글 매핑
        hanja_to_hangul = {
            '最近': '최근',
            '典型': '전형',
            '典型적인': '전형적인',
        }
        
        # 매핑된 한자 변환
        for hanja, hangul in hanja_to_hangul.items():
            text = text.replace(hanja, hangul)
        
        # 한자 범위 (CJK 통합 한자: U+4E00–U+9FFF, 한자 보충: U+3400–U+4DBF)
        # 일본어 히라가나: U+3040–U+309F, 가타카나: U+30A0–U+30FF
        result = []
        for char in text:
            code = ord(char)
            # 한자 범위 체크
            is_hanja = (0x4E00 <= code <= 0x9FFF) or (0x3400 <= code <= 0x4DBF)
            # 일본어 범위 체크
            is_japanese = (0x3040 <= code <= 0x309F) or (0x30A0 <= code <= 0x30FF)
            
            if is_hanja or is_japanese:
                # 한자/일본어 문자는 제거
                logger.debug(f"[워크플로우] 한자/일본어 문자 제거: {char} (U+{code:04X})")
                continue
            result.append(char)
        
        return ''.join(result)
    
    def _reformat_action_result(self, action_result: Dict[str, Any], legal_basis: List[Dict[str, Any]] = None) -> Dict[str, Any]:
        """액션 결과 정규화 및 검증"""
        import json
        import re
        
        result = action_result.copy()
        
        # 1. criteria 검증 및 fallback
        criteria = result.get("criteria", [])
        if not criteria or len(criteria) == 0:
            logger.warning("[워크플로우] criteria가 비어있습니다. legal_basis 기반 fallback 시도")
            # legal_basis 기반 fallback
            if legal_basis and len(legal_basis) > 0:
                criteria = []
                for basis in legal_basis[:3]:
                    criteria.append({
                        "name": basis.get("title", "법적 근거"),
                        "status": "unclear",
                        "reason": basis.get("snippet", "")[:300] if basis.get("snippet") else "관련 법령 정보를 확인하는 중입니다.",
                    })
                logger.info(f"[워크플로우] legal_basis 기반 criteria 생성: {len(criteria)}개")
            else:
                criteria = [{
                    "name": "법적 근거 확인 필요",
                    "status": "unclear",
                    "reason": "관련 법령 정보를 확인하는 중입니다."
                }]
        else:
            # criteria 구조 검증 및 필터링
            validated_criteria = []
            for item in criteria:
                if not isinstance(item, dict):
                    continue
                
                name = item.get("name", "").strip()
                status = item.get("status", "unclear")
                reason = item.get("reason", "").strip()
                
                # 완전히 비어있는 항목은 제외
                if not name and not reason:
                    logger.debug(f"[워크플로우] 비어있는 criteria 항목 제외: {item}")
                    continue
                
                # name이나 reason이 비어있으면 기본값으로 채우기
                validated_criteria.append({
                    "name": name or "법적 근거 확인 필요",
                    "status": status or "unclear",
                    "reason": reason or "관련 법령 정보를 확인하는 중입니다.",
                })
            
            # validated_criteria가 비어있으면 legal_basis 기반 fallback
            if not validated_criteria and legal_basis and len(legal_basis) > 0:
                logger.warning("[워크플로우] 모든 criteria가 비어있습니다. legal_basis 기반 fallback 시도")
                for basis in legal_basis[:3]:
                    validated_criteria.append({
                        "name": basis.get("title", "법적 근거"),
                        "status": "unclear",
                        "reason": basis.get("snippet", "")[:300] if basis.get("snippet") else "관련 법령 정보를 확인하는 중입니다.",
                    })
            
            criteria = validated_criteria if validated_criteria else [{
                "name": "법적 근거 확인 필요",
                "status": "unclear",
                "reason": "관련 법령 정보를 확인하는 중입니다."
            }]
        
        # 2. action_plan 검증 및 정규화
        action_plan = result.get("action_plan", {})
        if not isinstance(action_plan, dict):
            action_plan = {"steps": []}
        
        steps = action_plan.get("steps", [])
        if not isinstance(steps, list):
            steps = []
        
        # 각 step 검증
        validated_steps = []
        for step in steps:
            if not isinstance(step, dict):
                continue
            
            title = step.get("title", "")
            items = step.get("items", [])
            
            # items가 배열이 아니면 변환 시도
            if not isinstance(items, list):
                if isinstance(items, str):
                    # 문자열을 배열로 변환 (줄바꿈 기준)
                    items = [item.strip() for item in items.split('\n') if item.strip()]
                elif isinstance(items, dict):
                    # 객체를 배열로 변환 (값만 추출)
                    items = [str(v) for v in items.values() if v]
                else:
                    items = []
            
            # items에서 마크다운 조각 제거 (예: "- " 제거) 및 중복 필터링
            # 신고/상담 관련 항목을 전부 삭제하지 않고, 하드 제외만 적용하고 나머지는 분리
            # 하드 제외: 전화번호 + 상담센터 같이 노골적인 것만
            hard_exclude_keywords = [
                r'\d+.*상담센터',  # 전화번호 + 상담센터
                r'청년노동센터',
            ]
            
            # 상담/신고 관련 키워드 (별도 분류용)
            consult_keywords = [
                r'노무사',
                r'노동청',
                r'고용노동부',
                r'상담',
                r'신고',
            ]
            
            normal_items = []
            consult_items = []
            
            for item in items:
                if isinstance(item, str):
                    # "- " 또는 "* " 제거
                    cleaned = re.sub(r'^[-*]\s+', '', item.strip())
                    if not cleaned:
                        continue
                    
                    # 하드 제외: 너무 노골적인 "기관 홍보/전화번호" 류만 완전 제외
                    should_hard_exclude = any(
                        re.search(pattern, cleaned, re.IGNORECASE)
                        for pattern in hard_exclude_keywords
                    )
                    if should_hard_exclude:
                        logger.debug(f"[워크플로우] 하드 제외: {cleaned}")
                        continue
                    
                    # 상담/신고 관련이면 따로 모아두기
                    is_consult = any(
                        re.search(pattern, cleaned, re.IGNORECASE)
                        for pattern in consult_keywords
                    )
                    
                    if is_consult:
                        consult_items.append(cleaned)
                    else:
                        normal_items.append(cleaned)
            
            # 우선 normal_items에서 최대 3개
            cleaned_items = normal_items[:3]
            
            # normal이 너무 적으면 상담 계열에서 1~2개까지 보충
            if len(cleaned_items) < 2 and consult_items:
                additional_count = min(2 - len(cleaned_items), len(consult_items))
                cleaned_items.extend(consult_items[:additional_count])
                logger.debug(f"[워크플로우] 상담 관련 항목 {additional_count}개 보충 (step: {title})")
            
            # 최대 3개 항목으로 제한 (각 step별)
            if len(cleaned_items) > 3:
                logger.debug(f"[워크플로우] 항목 수 제한: {len(cleaned_items)}개 → 3개 (step: {title})")
                cleaned_items = cleaned_items[:3]
            
            if title or cleaned_items:  # title이 없어도 items가 있으면 유지
                # cleaned_items가 비어있지 않은 경우만 추가
                if cleaned_items:
                    validated_steps.append({
                        "title": title or "기타",
                        "items": cleaned_items,
                    })
        
        # steps가 비어있거나 모든 step의 items가 비어있으면 기본값
        has_any_items = any(step.get("items", []) for step in validated_steps)
        if not validated_steps or not has_any_items:
            # classified_type에 따른 기본 action items
            classified_type = result.get("classified_type", "unknown")
            default_items_by_type = {
                "unpaid_wage": [
                    "근로계약서와 급여명세서를 확인하세요",
                    "출퇴근 기록과 근무시간을 정리하세요",
                    "임금 지급 내역을 문서로 보관하세요"
                ],
                "harassment": [
                    "괴롭힘 관련 증거 자료를 수집하세요",
                    "대화 내용과 일시를 기록하세요",
                    "상황을 객관적으로 정리하세요"
                ],
                "unfair_dismissal": [
                    "해고 통지서와 관련 문서를 보관하세요",
                    "근무 기간과 성과를 정리하세요",
                    "회사와의 대화 내용을 기록하세요"
                ],
                "overtime": [
                    "근무시간 기록을 확인하세요",
                    "연장근로 시간을 계산하세요",
                    "휴게시간 준수 여부를 확인하세요"
                ],
                "probation": [
                    "수습 기간과 조건을 확인하세요",
                    "근로계약서의 수습 조항을 검토하세요",
                    "수습 기간 중 평가 내용을 정리하세요"
                ],
                "freelancer": [
                    "용역 계약서와 대금 지급 약정을 확인하세요",
                    "작업 완료 증빙 자료를 정리하세요",
                    "대금 지급 내역과 미지급 내역을 문서로 보관하세요"
                ],
                "stock_option": [
                    "스톡옵션/성과급 약정 내용을 확인하세요",
                    "계약서나 약정서를 보관하세요",
                    "지급 조건과 시기를 정리하세요"
                ],
                "other": [
                    "상황을 객관적으로 정리하세요",
                    "관련 문서를 보관하세요",
                    "증거 자료를 수집하세요"
                ],
            }
            default_items = default_items_by_type.get(classified_type, [
                "상황을 객관적으로 정리하세요",
                "관련 문서를 보관하세요",
                "증거 자료를 수집하세요"
            ])
            
            validated_steps = [{
                "title": "즉시 조치",
                "items": default_items[:3]
            }]
            logger.info(f"[워크플로우] 기본 action_plan 생성 (classified_type: {classified_type})")
        
        action_plan = {"steps": validated_steps}
        
        # 3. scripts 검증 (이메일 템플릿 구조: {subject, body})
        scripts = result.get("scripts", {})
        if not isinstance(scripts, dict):
            scripts = {}
        
        # to_company 검증
        to_company_raw = scripts.get("to_company", {})
        if isinstance(to_company_raw, str):
            # 레거시 형식 (문자열)인 경우 기본 구조로 변환
            to_company = {
                "subject": "근로계약 관련 확인 요청",
                "body": to_company_raw[:200] if len(to_company_raw) > 200 else to_company_raw
            }
        elif isinstance(to_company_raw, dict):
            to_company = {
                "subject": to_company_raw.get("subject", "근로계약 관련 확인 요청"),
                "body": to_company_raw.get("body", "")[:200] if len(to_company_raw.get("body", "")) > 200 else to_company_raw.get("body", "")
            }
        else:
            to_company = {
                "subject": "근로계약 관련 확인 요청",
                "body": ""
            }
        
        # to_advisor 검증
        to_advisor_raw = scripts.get("to_advisor", {})
        if isinstance(to_advisor_raw, str):
            # 레거시 형식 (문자열)인 경우 기본 구조로 변환
            to_advisor = {
                "subject": "노무 상담 요청",
                "body": to_advisor_raw[:200] if len(to_advisor_raw) > 200 else to_advisor_raw
            }
        elif isinstance(to_advisor_raw, dict):
            to_advisor = {
                "subject": to_advisor_raw.get("subject", "노무 상담 요청"),
                "body": to_advisor_raw.get("body", "")[:200] if len(to_advisor_raw.get("body", "")) > 200 else to_advisor_raw.get("body", "")
            }
        else:
            to_advisor = {
                "subject": "노무 상담 요청",
                "body": ""
            }
        
        validated_scripts = {
            "to_company": to_company,
            "to_advisor": to_advisor,
        }
        
        result["criteria"] = criteria
        result["action_plan"] = action_plan
        result["scripts"] = validated_scripts
        
        # 3. findings 검증 및 정규화
        findings = result.get("findings", [])
        logger.info(f"[워크플로우] findings 원본 개수: {len(findings) if isinstance(findings, list) else 0}")
        if findings and isinstance(findings, list):
            validated_findings = []
            for idx, finding in enumerate(findings):
                if not isinstance(finding, dict):
                    logger.debug(f"[워크플로우] finding[{idx}]이 dict가 아님: {type(finding)}")
                    continue
                
                # 필수 필드 검증
                id_val = finding.get("id")
                title = finding.get("title", "").strip()
                status_label = finding.get("statusLabel", "").strip()
                basis_text = finding.get("basisText", "").strip()
                source = finding.get("source", {})
                
                logger.debug(f"[워크플로우] finding[{idx}] 검증 시작: title={title[:30] if title else '(없음)'}, statusLabel={status_label}, basisText 길이={len(basis_text)}")
                
                # source 검증 (basisText 보완을 위해 먼저 확인)
                if not isinstance(source, dict):
                    logger.debug(f"[워크플로우] finding[{idx}] source가 dict가 아님: {type(source)}")
                    source = {}
                
                # source 필수 필드 검증
                document_title = source.get("documentTitle", "").strip()
                source_type = source.get("sourceType", "law").strip()
                refined_snippet = source.get("refinedSnippet", "").strip()
                # refinedSnippet이 없으면 snippet을 사용 (fallback)
                if not refined_snippet:
                    refined_snippet = source.get("snippet", "").strip()
                similarity_score = source.get("similarityScore", 0.0)
                
                logger.debug(f"[워크플로우] finding[{idx}] source 필드: documentTitle={document_title[:30] if document_title else '(없음)'}, refinedSnippet 길이={len(refined_snippet)}")
                
                # documentTitle이 없으면 title을 사용 (fallback)
                if not document_title:
                    document_title = source.get("title", "").strip()
                
                # source 필수 필드가 없으면 제외
                if not document_title or not refined_snippet:
                    logger.warning(f"[워크플로우] finding[{idx}] source 필수 필드 누락으로 제외: documentTitle={bool(document_title)}, refinedSnippet={bool(refined_snippet)}, finding={finding}")
                    continue
                
                # basisText에 "{documentTitle}에 따르면" 포함 여부 확인 및 보완
                if document_title:
                    # "에 따르면" 패턴 확인
                    if "에 따르면" not in basis_text:
                        # basisText 시작 부분에 "{documentTitle}에 따르면" 추가
                        if basis_text:
                            basis_text = f"{document_title}에 따르면, {basis_text}"
                        else:
                            basis_text = f"{document_title}에 따르면, 관련 법적 기준에 부합할 수 있습니다."
                        logger.debug(f"[워크플로우] basisText에 '{document_title}에 따르면' 추가: {basis_text[:100]}...")
                    # "{documentTitle}에 따르면"이 있지만 documentTitle이 포함되지 않은 경우 보완
                    elif document_title not in basis_text:
                        # 기존 "에 따르면" 앞에 documentTitle 추가
                        basis_text = basis_text.replace("에 따르면", f"{document_title}에 따르면", 1)
                        logger.debug(f"[워크플로우] basisText에 documentTitle 추가: {basis_text[:100]}...")
                
                # 필수 필드가 없으면 제외
                if not title or not status_label or not basis_text:
                    logger.debug(f"[워크플로우] 필수 필드가 없는 finding 제외: {finding}")
                    continue
                
                validated_findings.append({
                    "id": id_val if id_val is not None else len(validated_findings) + 1,
                    "title": title,
                    "statusLabel": status_label,
                    "basisText": basis_text,
                    "source": {
                        "documentTitle": document_title,
                        "fileUrl": source.get("fileUrl"),  # 선택적 필드
                        "sourceType": source_type,
                        "refinedSnippet": refined_snippet,
                        "similarityScore": float(similarity_score) if similarity_score else 0.0,
                    }
                })
            
            result["findings"] = validated_findings
            logger.info(f"[워크플로우] findings 검증 완료: {len(validated_findings)}개 (원본 {len(findings)}개 중)")
        else:
            result["findings"] = []
            logger.warning(f"[워크플로우] findings가 없거나 유효하지 않음: findings 타입={type(findings)}, 값={findings}")
        
        # 4. organizations 검증 및 정규화
        organizations = result.get("organizations", [])
        if not organizations or len(organizations) == 0:
            logger.warning("[워크플로우] organizations가 비어있습니다. 기본 organizations 생성")
            # classified_type에 따라 기본 기관 생성
            classified_type = result.get("classified_type", "unknown")
            default_orgs = {
                "unpaid_wage": ["moel", "labor_attorney", "comwel"],
                "harassment": ["moel_complaint", "human_rights", "labor_attorney"],
                "unfair_dismissal": ["moel", "labor_attorney", "comwel"],
                "overtime": ["moel", "labor_attorney", "comwel"],
                "probation": ["moel", "labor_attorney", "comwel"],
                "freelancer": ["labor_attorney", "moel", "comwel"],
                "stock_option": ["labor_attorney", "moel", "comwel"],
                "other": ["labor_attorney", "moel", "comwel"],
                "unknown": ["labor_attorney", "moel", "comwel"],
            }
            org_ids = default_orgs.get(classified_type, default_orgs["unknown"])
            # 기본 기관 정보
            org_map = {
                "moel": {
                    "id": "moel",
                    "name": "노동청",
                    "description": "체불임금 조사 및 시정 명령, 근로기준법 위반 조사",
                    "capabilities": ["체불임금 조사", "시정 명령", "근로기준법 위반 조사"],
                    "requiredDocs": ["근로계약서", "출퇴근 기록", "급여명세서"],
                    "legalBasis": "근로기준법 제110조: 근로감독관의 권한",
                    "website": "https://www.moel.go.kr",
                    "phone": "1350"
                },
                "labor_attorney": {
                    "id": "labor_attorney",
                    "name": "노무사",
                    "description": "상담 및 소송 대리, 근로 분쟁 해결 전문",
                    "capabilities": ["상담", "소송 대리", "근로 분쟁 해결"],
                    "requiredDocs": ["근로계약서", "문자/카톡 대화", "기타 증거 자료"],
                    "legalBasis": "노무사법: 근로 분쟁 전문 법률 서비스"
                },
                "comwel": {
                    "id": "comwel",
                    "name": "근로복지공단",
                    "description": "연차수당, 휴일수당, 실업급여 상담",
                    "capabilities": ["연차수당 상담", "휴일수당 상담", "실업급여 안내"],
                    "requiredDocs": ["근로계약서", "출퇴근 기록", "급여명세서"],
                    "legalBasis": "근로기준법 제60조: 연차 유급휴가",
                    "website": "https://www.comwel.or.kr",
                    "phone": "1588-0075"
                },
                "moel_complaint": {
                    "id": "moel_complaint",
                    "name": "고용노동부 고객상담센터",
                    "description": "직장 내 괴롭힘, 차별 상담 및 조사, 고용·노동 전반 상담",
                    "capabilities": ["직장 내 괴롭힘 상담", "차별 상담", "조사 지원", "고용·노동 전반 상담"],
                    "requiredDocs": ["증거 자료", "문자/카톡 대화", "녹음 파일"],
                    "legalBasis": "직장 내 괴롭힘 방지법 제13조: 고충 처리",
                    "website": "https://1350.moel.go.kr/home/hp/main/hpmain.do",
                    "phone": "1350"
                },
                "human_rights": {
                    "id": "human_rights",
                    "name": "국가인권위원회",
                    "description": "인권 침해 상담 및 조사, 차별 구제",
                    "capabilities": ["인권 침해 상담", "차별 구제", "조사 및 구제"],
                    "requiredDocs": ["증거 자료", "차별 사례 기록"],
                    "legalBasis": "국가인권위원회법: 인권 침해 구제",
                    "website": "https://www.humanrights.go.kr",
                    "phone": "1331"
                }
            }
            organizations = [org_map.get(org_id, {}) for org_id in org_ids if org_id in org_map]
        else:
            # organizations 구조 검증
            validated_orgs = []
            for org in organizations:
                if isinstance(org, dict):
                    validated_orgs.append({
                        "id": org.get("id", ""),
                        "name": org.get("name", ""),
                        "description": org.get("description", ""),
                        "capabilities": org.get("capabilities", []),
                        "requiredDocs": org.get("requiredDocs", []),
                        "legalBasis": org.get("legalBasis"),
                        "website": org.get("website"),
                        "phone": org.get("phone"),
                    })
            organizations = validated_orgs
        
        result["organizations"] = organizations
        
        # 4. summary 검증 (4개 섹션 확인)
        summary = result.get("summary", "")
        if not isinstance(summary, str):
            summary = ""
        
        # summary에 4개 섹션이 모두 있는지 확인 (유연한 매칭)
        # 새로운 형식: 📊 상황 분석, ⚖️ 법적 판단, 🔮 예상 시나리오, 💡 주의사항
        section_patterns = [
            {
                "title": "📊 **상황 분석**:",
                "keywords": ["📊", "상황 분석", "상황 분석의 결과"],
                "emoji": "📊"
            },
            {
                "title": "⚖️ **법적 판단**:",
                "keywords": ["⚖️", "법적 판단", "법적 관점", "법적 관점에서 본 현재상황"],
                "emoji": "⚖️"
            },
            {
                "title": "🔮 **예상 시나리오**:",
                "keywords": ["🔮", "예상 시나리오", "예상", "시나리오"],
                "emoji": "🔮"
            },
            {
                "title": "💡 **주의사항**:",
                "keywords": ["💡", "주의사항", "주의", "이렇게 말해보세요", "지금 당장 할 수 있는 행동"],
                "emoji": "💡"
            },
        ]
        
        # 섹션 존재 여부 확인 (유연한 매칭)
        found_sections = []
        missing_sections = []
        
        for section_info in section_patterns:
            found = False
            # 정확한 헤더 형식 확인 (새로운 형식: 이모지 + 굵은 제목)
            if section_info["title"] in summary:
                found = True
            else:
                # 이모지로 먼저 확인
                emoji = section_info.get("emoji")
                if emoji and emoji in summary:
                    # 이모지 주변 컨텍스트 확인
                    emoji_pos = summary.find(emoji)
                    start = max(0, emoji_pos - 20)
                    end = min(len(summary), emoji_pos + 50)
                    context = summary[start:end]
                    
                    # 이모지 뒤에 "상황 분석", "법적 판단" 등의 키워드가 있는지 확인
                    for keyword in section_info["keywords"]:
                        if keyword in context and keyword != emoji:
                            found = True
                            break
                
                # 이모지로 찾지 못한 경우 키워드로 확인 (레거시 형식 지원)
                if not found:
                    for keyword in section_info["keywords"]:
                        if keyword == emoji:
                            continue  # 이미 이모지로 확인했으므로 스킵
                        keyword_lower = keyword.lower()
                        summary_lower = summary.lower()
                        
                        # 키워드가 포함되어 있는지 확인
                        if keyword_lower in summary_lower:
                            # 키워드 주변의 컨텍스트 확인 (헤더 형식인지)
                            keyword_pos = summary_lower.find(keyword_lower)
                            # 키워드 앞뒤로 최대 100자 확인
                            start = max(0, keyword_pos - 50)
                            end = min(len(summary), keyword_pos + len(keyword) + 50)
                            context = summary[start:end]
                            
                            # 헤더 형식(## 또는 #)이 있거나, 키워드가 줄의 시작 부분에 있으면 섹션으로 인식
                            has_header_marker = re.search(r'##?\s*', context, re.IGNORECASE) is not None
                            is_line_start = keyword_pos == 0 or summary[keyword_pos - 1] == '\n'
                            
                            if has_header_marker or is_line_start:
                                found = True
                                break
            
            if found:
                found_sections.append(section_info["title"])
            else:
                missing_sections.append(section_info)
        
        if missing_sections:
            logger.warning(f"[워크플로우] summary에 누락된 섹션: {[s['title'] for s in missing_sections]}")
            
            # LLM이 생성한 내용을 파싱하여 섹션 재구성 시도
            classified_type = result.get("classified_type", "unknown")
            summary_reconstructed = self._reconstruct_summary_sections(summary, section_patterns, classified_type)
            if summary_reconstructed:
                summary = summary_reconstructed
                logger.info("[워크플로우] summary 섹션 재구성 완료")
            else:
                # 재구성 실패 시 누락된 섹션 추가 (카테고리별 기본값 제공)
                classified_type = result.get("classified_type", "unknown")
                default_content_by_type = {
                    "unpaid_wage": {
                        "법적 관점": "임금체불은 근로기준법 제43조(임금지급), 제36조(임금의 지급)와 관련된 사안입니다. 사용자는 근로자에게 임금을 정기적으로 지급할 의무가 있으며, 이를 위반할 경우 형사처벌과 민사상 손해배상 책임을 질 수 있습니다. 무급 야근도 연장근로 수당 미지급에 해당합니다.",
                        "지금 당장 할 수 있는 행동": "- 근로계약서와 급여명세서를 확인하세요\n- 출퇴근 기록과 근무시간을 정리하세요\n- 임금 지급 내역을 문서로 보관하세요",
                        "이렇게 말해보세요": "회사에 정중하게 임금 지급을 요청하는 문구를 작성하세요."
                    },
                    "harassment": {
                        "법적 관점": "직장 내 괴롭힘은 직장 내 괴롭힘 방지 및 근로자 보호 등에 관한 법률에 따라 금지되어 있습니다. 업무상 지위나 관계를 이용하여 근로자에게 신체적·정신적 고통을 주는 행위는 법적 처벌 대상이 될 수 있습니다.",
                        "지금 당장 할 수 있는 행동": "- 괴롭힘 관련 증거 자료를 수집하세요\n- 대화 내용과 일시를 기록하세요\n- 상황을 객관적으로 정리하세요",
                        "이렇게 말해보세요": "회사에 괴롭힘 상황을 정중하게 알리는 문구를 작성하세요."
                    },
                    "unfair_dismissal": {
                        "법적 관점": "부당해고는 근로기준법 제23조(해고의 제한)에 따라 제한되어 있습니다. 정당한 사유 없이 해고하는 경우 복직 청구나 손해배상 청구가 가능합니다.",
                        "지금 당장 할 수 있는 행동": "- 해고 통지서와 관련 문서를 보관하세요\n- 근무 기간과 성과를 정리하세요\n- 회사와의 대화 내용을 기록하세요",
                        "이렇게 말해보세요": "회사에 해고 사유에 대한 설명을 요청하는 문구를 작성하세요."
                    },
                    "overtime": {
                        "법적 관점": "근로시간은 근로기준법 제50조(근로시간), 제53조(연장근로)에 따라 규제됩니다. 법정 근로시간을 초과하는 연장근로에 대해서는 가산임금을 지급해야 합니다.",
                        "지금 당장 할 수 있는 행동": "- 근무시간 기록을 확인하세요\n- 연장근로 시간을 계산하세요\n- 휴게시간 준수 여부를 확인하세요",
                        "이렇게 말해보세요": "회사에 근로시간과 가산임금에 대해 문의하는 문구를 작성하세요."
                    },
                    "probation": {
                        "법적 관점": "수습기간은 근로기준법에 따라 합리적인 범위 내에서만 인정됩니다. 수습기간 중에도 근로기준법상 보호를 받으며, 부당한 해고는 제한됩니다.",
                        "지금 당장 할 수 있는 행동": "- 수습 기간과 조건을 확인하세요\n- 근로계약서의 수습 조항을 검토하세요\n- 수습 기간 중 평가 내용을 정리하세요",
                        "이렇게 말해보세요": "회사에 수습기간과 평가 기준에 대해 문의하는 문구를 작성하세요."
                    },
                    "freelancer": {
                        "법적 관점": "프리랜서/용역 계약에서 대금 미지급은 민법상 채무불이행에 해당할 수 있습니다. 계약서에 명시된 지급 조건과 실제 지급 여부를 확인해야 합니다.",
                        "지금 당장 할 수 있는 행동": "- 용역 계약서와 대금 지급 약정을 확인하세요\n- 작업 완료 증빙 자료를 정리하세요\n- 대금 지급 내역과 미지급 내역을 문서로 보관하세요",
                        "이렇게 말해보세요": "발주사에 대금 지급을 요청하는 정중한 문구를 작성하세요."
                    },
                    "stock_option": {
                        "법적 관점": "스톡옵션이나 성과급은 계약서나 약정서에 명시된 조건에 따라 지급되어야 합니다. 구두 약속만으로는 법적 구속력이 약할 수 있으므로 문서화가 중요합니다.",
                        "지금 당장 할 수 있는 행동": "- 스톡옵션/성과급 약정 내용을 확인하세요\n- 계약서나 약정서를 보관하세요\n- 지급 조건과 시기를 정리하세요",
                        "이렇게 말해보세요": "회사에 스톡옵션/성과급 지급 조건과 시기에 대해 문의하는 문구를 작성하세요."
                    },
                    "other": {
                        "법적 관점": "관련 법령을 확인하여 현재 상황을 법적으로 평가해야 합니다.",
                        "지금 당장 할 수 있는 행동": "- 상황을 객관적으로 정리하세요\n- 관련 문서를 보관하세요\n- 증거 자료를 수집하세요",
                        "이렇게 말해보세요": "회사나 상담 기관에 상황을 설명할 수 있는 문구를 작성하세요."
                    },
                }
                
                default_content = default_content_by_type.get(classified_type, {
                    "법적 관점": "관련 법령을 확인하여 현재 상황을 법적으로 평가해야 합니다.",
                    "지금 당장 할 수 있는 행동": "- 상황을 객관적으로 정리하세요\n- 관련 문서를 보관하세요\n- 증거 자료를 수집하세요",
                    "이렇게 말해보세요": "회사나 상담 기관에 상황을 설명할 수 있는 문구를 작성하세요."
                })
                
                # 누락된 섹션 추가
                for section_info in missing_sections:
                    section_key = section_info.get("keywords", [""])[0] if section_info.get("keywords") else ""
                    
                    # 섹션 키워드로 매칭
                    section_key_matched = None
                    for key in default_content.keys():
                        if any(keyword in section_key for keyword in section_info.get("keywords", [])):
                            section_key_matched = key
                            break
                    
                    default_text = default_content.get(section_key_matched or section_key, "해당 섹션 내용을 확인하는 중입니다.")
                    # 기본값 텍스트인 경우 섹션을 추가하지 않음
                    if default_text and default_text != "관련 법령을 확인하여 현재 상황을 법적으로 평가해야 합니다." and default_text != "해당 섹션 내용을 확인하는 중입니다.":
                        summary += f"\n\n{section_info['title']}\n\n{default_text}"
        
        return {
            "summary": summary,
            "criteria": criteria,
            "action_plan": action_plan,
            "scripts": validated_scripts,
            "organizations": organizations,
        }
    
    async def _llm_generate_summary(
        self,
        situation_text: str,
        classification: Dict[str, Any],
        grounding_chunks: List[LegalGroundingChunk],
        legal_basis: List[Dict[str, Any]],
        employment_type: Optional[str] = None,
        work_period: Optional[str] = None,
        weekly_hours: Optional[int] = None,
        is_probation: Optional[bool] = None,
        social_insurance: Optional[str] = None,
    ) -> str:
        """summary만 생성 (분리된 프롬프트 사용)"""
        logger.info("[워크플로우] _llm_generate_summary 시작")
        prompt = build_situation_summary_prompt(
            situation_text=situation_text,
            classification=classification,
            grounding_chunks=grounding_chunks,
            legal_basis=legal_basis,
            employment_type=employment_type,
            work_period=work_period,
            weekly_hours=weekly_hours,
            is_probation=is_probation,
            social_insurance=social_insurance,
        )
        
        try:
            response = await self._call_llm(prompt)
            
            # 프롬프트는 마크다운 텍스트만 반환하도록 지시하므로, JSON 파싱 없이 응답을 그대로 사용
            if response:
                # 코드 블록 제거 (```markdown, ``` 등)
                import re
                response_clean = response.strip()
                
                # 마크다운 코드 블록 제거
                if response_clean.startswith("```markdown"):
                    response_clean = response_clean[11:]  # ```markdown 제거
                elif response_clean.startswith("```"):
                    response_clean = response_clean[3:]  # ``` 제거
                
                if response_clean.endswith("```"):
                    response_clean = response_clean[:-3]  # 끝의 ``` 제거
                
                response_clean = response_clean.strip()
                
                # JSON 형식으로 잘못 반환된 경우 처리 (혹시 모를 경우 대비)
                json_match = re.search(r'\{.*"summary".*\}', response_clean, re.DOTALL)
                if json_match:
                    try:
                        import json
                        result = json.loads(json_match.group())
                        summary = result.get('summary', '')
                        if summary:
                            logger.info(f"[워크플로우] summary JSON에서 추출 성공 - 길이: {len(summary)}자")
                            return summary
                    except json.JSONDecodeError:
                        # JSON 파싱 실패 시 원본 응답 사용
                        pass
                
                # 마크다운 텍스트로 반환 (기본 케이스)
                if response_clean:
                    # 4개 섹션이 모두 있는지 확인
                    has_situation = "📊" in response_clean or "상황 분석" in response_clean
                    has_legal = "⚖️" in response_clean or "법적 판단" in response_clean or "법적 관점" in response_clean
                    has_scenario = "🔮" in response_clean or "예상 시나리오" in response_clean
                    has_warning = "💡" in response_clean or "주의사항" in response_clean
                    
                    if has_situation and has_legal and (has_scenario or has_warning):
                        logger.info(f"[워크플로우] summary 생성 성공 (마크다운) - 길이: {len(response_clean)}자")
                        return response_clean
                    else:
                        logger.warning(f"[워크플로우] summary에 필수 섹션이 누락됨 - 상황: {has_situation}, 법적: {has_legal}, 시나리오: {has_scenario}, 주의: {has_warning}")
                        logger.warning(f"[워크플로우] 응답 (처음 500자): {response_clean[:500]}")
                else:
                    logger.warning("[워크플로우] summary 응답이 비어있음")
            else:
                logger.warning("[워크플로우] LLM 응답이 None")
                
        except Exception as e:
            logger.error(f"[워크플로우] summary LLM 호출 실패: {e}", exc_info=True)
            # LLM 호출 실패 시 기본 summary 반환 (4개 섹션 구조 유지)
            return "## 📊 상황 분석의 결과\n\n상황을 분석했습니다. 아래 법적 관점과 행동 가이드를 참고하세요.\n\n## ⚖️ 법적 관점에서 본 현재 상황\n\n관련 법령을 확인하는 중입니다.\n\n## 🎯 지금 당장 할 수 있는 행동\n\n- 상황을 다시 확인해주세요\n- 잠시 후 다시 시도해주세요\n\n## 💬 이렇게 말해보세요\n\n상담 기관에 문의하시기 바랍니다."
        
        # 파싱 실패 시 기본 summary 반환
        logger.warning("[워크플로우] summary 생성 실패, 기본값 반환")
        return "## 📊 상황 분석의 결과\n\n상황을 분석했습니다. 아래 법적 관점과 행동 가이드를 참고하세요.\n\n## ⚖️ 법적 관점에서 본 현재 상황\n\n관련 법령을 확인하는 중입니다.\n\n## 🎯 지금 당장 할 수 있는 행동\n\n- 상황을 다시 확인해주세요\n- 잠시 후 다시 시도해주세요\n\n## 💬 이렇게 말해보세요\n\n상담 기관에 문의하시기 바랍니다."
    
    async def _llm_generate_findings(
        self,
        situation_text: str,
        classification: Dict[str, Any],
        grounding_chunks: List[LegalGroundingChunk],
        legal_basis: List[Dict[str, Any]],
        employment_type: Optional[str] = None,
        work_period: Optional[str] = None,
        weekly_hours: Optional[int] = None,
        is_probation: Optional[bool] = None,
        social_insurance: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """findings만 생성 (분리된 프롬프트 사용)"""
        logger.info("[워크플로우] _llm_generate_findings 시작")
        prompt = build_situation_findings_prompt(
            situation_text=situation_text,
            classification=classification,
            grounding_chunks=grounding_chunks,
            legal_basis=legal_basis,
            employment_type=employment_type,
            work_period=work_period,
            weekly_hours=weekly_hours,
            is_probation=is_probation,
            social_insurance=social_insurance,
        )
        response = await self._call_llm(prompt)
        logger.info(f"[워크플로우] findings LLM 응답 길이: {len(response)}자")
        logger.debug(f"[워크플로우] findings LLM 응답 (처음 500자): {response[:500]}")
        
        try:
            import json
            import re
            # JSON 블록 추출 (```json ... ``` 또는 {...} 패턴)
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', response, re.DOTALL)
            if not json_match:
                json_match = re.search(r'\{.*\}', response, re.DOTALL)
            
            if json_match:
                json_str = json_match.group(1) if json_match.lastindex else json_match.group()
                # JSON 문자열 정리
                json_str = json_str.strip()
                result = json.loads(json_str)
                findings = result.get('findings', [])
                logger.info(f"[워크플로우] findings 파싱 성공: {len(findings)}개")
                if findings:
                    logger.debug(f"[워크플로우] 첫 번째 finding 예시: {findings[0] if len(findings) > 0 else '없음'}")
                    # documentTitle 확인 (source 없이 생성되었는지 확인)
                    for idx, finding in enumerate(findings):
                        if isinstance(finding, dict) and "documentTitle" not in finding:
                            logger.warning(f"[워크플로우] finding[{idx}]에 documentTitle이 없음: {finding.get('title', 'unknown')}")
                return findings
            else:
                logger.warning(f"[워크플로우] findings JSON 패턴을 찾을 수 없음. 응답: {response[:200]}")
        except json.JSONDecodeError as e:
            logger.error(f"[워크플로우] findings JSON 파싱 실패: {e}, 응답 (처음 500자): {response[:500]}")
        except Exception as e:
            logger.error(f"[워크플로우] findings 생성 중 예외 발생: {e}", exc_info=True)
        return []
    
    async def _llm_generate_scripts(
        self,
        situation_text: str,
        classification: Dict[str, Any],
        grounding_chunks: List[LegalGroundingChunk],
        legal_basis: List[Dict[str, Any]],
        employment_type: Optional[str] = None,
        work_period: Optional[str] = None,
        weekly_hours: Optional[int] = None,
        is_probation: Optional[bool] = None,
        social_insurance: Optional[str] = None,
    ) -> Dict[str, Any]:
        """scripts만 생성 (분리된 프롬프트 사용)"""
        logger.info("[워크플로우] _llm_generate_scripts 시작")
        prompt = build_situation_scripts_prompt(
            situation_text=situation_text,
            classification=classification,
            grounding_chunks=grounding_chunks,
            legal_basis=legal_basis,
            employment_type=employment_type,
            work_period=work_period,
            weekly_hours=weekly_hours,
            is_probation=is_probation,
            social_insurance=social_insurance,
        )
        response = await self._call_llm(prompt)
        try:
            import json
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                return result.get('scripts', {})
        except Exception as e:
            logger.error(f"[워크플로우] scripts JSON 파싱 실패: {e}")
        return {}
    
    async def _llm_generate_organizations(
        self,
        situation_text: str,
        classification: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """organizations만 생성 (분리된 프롬프트 사용)"""
        logger.info("[워크플로우] _llm_generate_organizations 시작")
        prompt = build_situation_organizations_prompt(
            situation_text=situation_text,
            classification=classification,
        )
        response = await self._call_llm(prompt)
        try:
            import json
            import re
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group())
                return result.get('organizations', [])
        except Exception as e:
            logger.error(f"[워크플로우] organizations JSON 파싱 실패: {e}")
        return []
    
    async def _call_llm(self, prompt: str) -> str:
        """LLM 호출 (Groq/Ollama) - 타임아웃 및 로깅 포함"""
        from config import settings
        
        # 프롬프트 정보 로깅
        prompt_length = len(prompt)
        logger.info(f"[워크플로우] LLM 호출 시작 - 프롬프트 길이: {prompt_length}자")
        
        if settings.use_groq:
            logger.info(f"[워크플로우] Groq 사용 (모델: {settings.groq_model})")
            from llm_api import ask_groq_with_messages
            messages = [
                {"role": "system", "content": "너는 유능한 법률 AI야. 한국어로만 답변해주세요."},
                {"role": "user", "content": prompt}
            ]
            try:
                # Groq는 일반적으로 빠르므로 타임아웃 2분
                response = await asyncio.wait_for(
                    asyncio.to_thread(
                        ask_groq_with_messages,
                        messages=messages,
                        temperature=settings.llm_temperature,
                        model=settings.groq_model
                    ),
                    timeout=120.0  # 2분 타임아웃
                )
                logger.info(f"[워크플로우] Groq 응답 완료 - 응답 길이: {len(response)}자")
                return response
            except asyncio.TimeoutError:
                logger.error("[워크플로우] Groq 호출 타임아웃 (2분 초과)")
                raise TimeoutError("Groq LLM 호출이 타임아웃되었습니다 (2분 초과)")
        elif settings.use_ollama:
            logger.info(f"[워크플로우] Ollama 사용 (모델: {settings.ollama_model}, URL: {settings.ollama_base_url})")
            
            # Ollama 모델 존재 여부 확인 (비동기로 실행)
            async def check_ollama_model():
                """Ollama 모델 존재 여부 확인"""
                try:
                    import httpx
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        response = await client.get(f"{settings.ollama_base_url}/api/tags")
                        if response.status_code == 200:
                            models_data = response.json()
                            available_models = [model.get("name", "") for model in models_data.get("models", [])]
                            # 모델 이름에서 태그 제거 (예: "mistral:latest" -> "mistral")
                            available_model_names = [name.split(":")[0] for name in available_models]
                            
                            if settings.ollama_model not in available_model_names:
                                error_msg = (
                                    f"Ollama 모델 '{settings.ollama_model}'이 설치되지 않았습니다.\n"
                                    f"설치된 모델: {', '.join(available_model_names) if available_model_names else '(없음)'}\n"
                                    f"모델을 다운로드하려면 다음 명령을 실행하세요:\n"
                                    f"  ollama pull {settings.ollama_model}\n"
                                    f"또는 다른 모델을 사용하려면 .env 파일에서 OLLAMA_MODEL을 변경하세요."
                                )
                                logger.error(f"[워크플로우] {error_msg}")
                                raise ValueError(error_msg)
                            else:
                                logger.info(f"[워크플로우] Ollama 모델 확인 완료: {settings.ollama_model}")
                        else:
                            logger.warning(f"[워크플로우] Ollama 모델 목록 조회 실패 (HTTP {response.status_code}), 계속 진행합니다...")
                except ImportError:
                    # httpx가 없으면 requests로 시도
                    try:
                        import requests
                        response = requests.get(f"{settings.ollama_base_url}/api/tags", timeout=5.0)
                        if response.status_code == 200:
                            models_data = response.json()
                            available_models = [model.get("name", "") for model in models_data.get("models", [])]
                            available_model_names = [name.split(":")[0] for name in available_models]
                            
                            if settings.ollama_model not in available_model_names:
                                error_msg = (
                                    f"Ollama 모델 '{settings.ollama_model}'이 설치되지 않았습니다.\n"
                                    f"설치된 모델: {', '.join(available_model_names) if available_model_names else '(없음)'}\n"
                                    f"모델을 다운로드하려면 다음 명령을 실행하세요:\n"
                                    f"  ollama pull {settings.ollama_model}\n"
                                    f"또는 다른 모델을 사용하려면 .env 파일에서 OLLAMA_MODEL을 변경하세요."
                                )
                                logger.error(f"[워크플로우] {error_msg}")
                                raise ValueError(error_msg)
                            else:
                                logger.info(f"[워크플로우] Ollama 모델 확인 완료: {settings.ollama_model}")
                        else:
                            logger.warning(f"[워크플로우] Ollama 모델 목록 조회 실패 (HTTP {response.status_code}), 계속 진행합니다...")
                    except ImportError:
                        logger.warning("[워크플로우] httpx/requests가 설치되지 않아 모델 확인을 건너뜁니다.")
                except Exception as e:
                    logger.warning(f"[워크플로우] 모델 확인 중 오류 발생: {str(e)}, 계속 진행합니다...")
            
            # 모델 확인 실행 (타임아웃 5초)
            try:
                await asyncio.wait_for(check_ollama_model(), timeout=5.0)
            except asyncio.TimeoutError:
                logger.warning("[워크플로우] 모델 확인 타임아웃 (5초), 계속 진행합니다...")
            except ValueError:
                # 모델이 없으면 에러를 다시 발생시켜서 중단
                raise
            except Exception as e:
                logger.warning(f"[워크플로우] 모델 확인 실패: {str(e)}, 계속 진행합니다...")
            
            # Ollama 사용 - 비동기 처리 및 타임아웃 추가
            # langchain-community를 우선 사용 (think 파라미터 에러 방지)
            try:
                from langchain_community.llms import Ollama
                llm = Ollama(
                    base_url=settings.ollama_base_url,
                    model=settings.ollama_model
                )
            except ImportError:
                # 대안: langchain-ollama 사용 (think 파라미터 에러 가능)
                try:
                    from langchain_ollama import OllamaLLM
                    llm = OllamaLLM(
                        base_url=settings.ollama_base_url,
                        model=settings.ollama_model
                    )
                except Exception as e:
                    if "think" in str(e).lower():
                        logger.warning("[워크플로우] langchain-ollama에서 think 파라미터 에러 발생. langchain-community로 재시도...")
                        from langchain_community.llms import Ollama
                        llm = Ollama(
                            base_url=settings.ollama_base_url,
                            model=settings.ollama_model
                        )
                    else:
                        raise
            
            # 진행 상황 로깅을 위한 백그라운드 태스크
            async def log_progress():
                """주기적으로 진행 상황 로깅"""
                elapsed = 0
                while elapsed < 600:  # 최대 10분까지
                    await asyncio.sleep(30)  # 30초마다
                    elapsed += 30
                    logger.info(f"[워크플로우] Ollama 응답 대기 중... ({elapsed}초 경과)")
            
            progress_task = asyncio.create_task(log_progress())
            
            try:
                # Ollama 호출을 비동기로 처리하고 타임아웃 설정 (10분)
                logger.info("[워크플로우] Ollama LLM 호출 시작...")
                # 대략적인 입력 토큰 추정 (한국어 기준: 1토큰 ≈ 2-3자)
                estimated_input_tokens = len(prompt) // 2.5
                logger.info(f"[토큰 사용량] 입력 추정: 약 {int(estimated_input_tokens)}토큰 (프롬프트 길이: {len(prompt)}자)")
                
                response_text = await asyncio.wait_for(
                    asyncio.to_thread(llm.invoke, prompt),
                    timeout=600.0  # 10분 타임아웃
                )
                progress_task.cancel()  # 성공 시 진행 로깅 중지
                
                # 대략적인 출력 토큰 추정
                estimated_output_tokens = len(response_text) // 2.5
                estimated_total_tokens = int(estimated_input_tokens) + int(estimated_output_tokens)
                logger.info(f"[워크플로우] Ollama 응답 완료 - 응답 길이: {len(response_text)}자")
                logger.info(f"[토큰 사용량] 출력 추정: 약 {int(estimated_output_tokens)}토큰, 총 추정: 약 {estimated_total_tokens}토큰 (모델: {settings.ollama_model})")
                return response_text
            except asyncio.TimeoutError:
                progress_task.cancel()
                logger.error("[워크플로우] Ollama 호출 타임아웃 (10분 초과)")
                raise TimeoutError("Ollama LLM 호출이 타임아웃되었습니다 (10분 초과). 모델이 응답을 생성하는 데 시간이 너무 오래 걸립니다.")
            except Exception as e:
                progress_task.cancel()
                logger.error(f"[워크플로우] Ollama 호출 실패: {str(e)}", exc_info=True)
                raise
        else:
            # Groq와 Ollama 모두 사용 안 함
            raise ValueError("LLM이 설정되지 않았습니다. LLM_PROVIDER 환경변수를 'groq' 또는 'ollama'로 설정하세요.")
    
    # ==================== 공개 메서드 ====================
    
    async def run(self, initial_state: Dict[str, Any]) -> Dict[str, Any]:
        """워크플로우 실행"""
        logger.info("[워크플로우] 실행 시작")
        
        # State로 변환
        state: SituationWorkflowState = {
            "situation_text": initial_state.get("situation_text", ""),
            "category_hint": initial_state.get("category_hint"),
            "summary": initial_state.get("summary"),
            "details": initial_state.get("details"),
            "employment_type": initial_state.get("employment_type"),
            "work_period": initial_state.get("work_period"),
            "weekly_hours": initial_state.get("weekly_hours"),
            "is_probation": initial_state.get("is_probation"),
            "social_insurance": initial_state.get("social_insurance"),
            "query_text": None,
            "query_embedding": None,
            "classification": None,
            "filtered_categories": None,
            "grounding_chunks": None,
            "related_cases": None,
            "legal_basis": None,
            "action_plan": None,
            "scripts": None,
            "criteria": None,
            "summary_report": None,
            "final_output": None,
        }
        
        # 그래프 실행
        final_state = await self.graph.ainvoke(state)
        
        # 최종 출력 반환
        return final_state.get("final_output", {})

