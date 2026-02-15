"""
LLMExplanationTool - LLM 기반 설명 도구
위험 사유 자연어 설명, 법령 조문 인용, 수정 제안 문구 생성
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import logging
import re

from .base_tool import BaseTool
from ..generator_v2 import LLMGenerator

logger = logging.getLogger(__name__)


@dataclass
class ExplanationResult:
    """설명 결과"""
    explanation: str  # 위험 사유 설명
    legal_basis: List[str]  # 관련 법령 조문
    suggested_revision: str  # 수정 제안 문구
    rationale: str  # 수정 이유
    suggested_questions: List[str]  # 회사에 질문할 문구


class LLMExplanationTool(BaseTool):
    """LLM 기반 설명 도구 - 위험 사유 설명, 법령 인용, 수정 제안"""
    
    def __init__(self):
        """도구 초기화"""
        self.generator = LLMGenerator()
    
    @property
    def name(self) -> str:
        return "LLMExplanationTool"
    
    @property
    def description(self) -> str:
        return "위험 사유 자연어 설명, 법령 조문 인용, 수정 제안 문구 생성"
    
    async def execute(
        self,
        provision: Dict[str, Any],  # Provision 객체 (dict 형태)
        risk_score: float,
        legal_contexts: List[Dict[str, Any]],
        issue_type: str = "unknown",  # "missing" | "excessive" | "illegal" | "ambiguous" | "normal"
        contract_type: str = "employment",
        **kwargs
    ) -> Dict[str, Any]:
        """
        설명 생성 실행
        
        Args:
            provision: 분석할 조항 (dict 형태)
            risk_score: 위험도 점수 (0-100)
            legal_contexts: 관련 법령 검색 결과
            issue_type: 이슈 타입
            contract_type: 계약서 타입
            **kwargs: 추가 옵션
        
        Returns:
            {
                "explanation": str,
                "legal_basis": List[str],
                "suggested_revision": str,
                "rationale": str,
                "suggested_questions": List[str]
            }
        """
        self.log_execution(
            provision_title=provision.get("title", "")[:50],
            risk_score=risk_score,
            issue_type=issue_type
        )
        
        # 입력 검증
        self.validate_input(
            ["provision", "risk_score"],
            provision=provision,
            risk_score=risk_score
        )
        
        try:
            # LLM 비활성화 시 기본 응답
            if self.generator.disable_llm:
                return self._generate_default_explanation(
                    provision=provision,
                    risk_score=risk_score,
                    issue_type=issue_type,
                    legal_contexts=legal_contexts
                )
            
            # 1. 법령 조문 자동 추출
            legal_basis = self._extract_legal_basis(legal_contexts, provision)
            
            # 2. LLM 기반 설명 생성
            explanation_result = await self._generate_llm_explanation(
                provision=provision,
                risk_score=risk_score,
                legal_contexts=legal_contexts,
                legal_basis=legal_basis,
                issue_type=issue_type,
                contract_type=contract_type
            )
            
            # ExplanationResult를 dict로 변환
            if isinstance(explanation_result, ExplanationResult):
                result = {
                    "explanation": explanation_result.explanation,
                    "legal_basis": explanation_result.legal_basis,
                    "suggested_revision": explanation_result.suggested_revision,
                    "rationale": explanation_result.rationale,
                    "suggested_questions": explanation_result.suggested_questions
                }
            else:
                # 이미 dict인 경우
                result = explanation_result
            
            self.log_result(result)
            return result
            
        except Exception as e:
            logger.error(f"[{self.name}] 실행 실패: {str(e)}", exc_info=True)
            # 오류 시 기본 응답 반환
            return self._generate_default_explanation(
                provision=provision,
                risk_score=risk_score,
                issue_type=issue_type,
                legal_contexts=legal_contexts
            )
    
    def _extract_legal_basis(
        self,
        legal_contexts: List[Dict[str, Any]],
        provision: Dict[str, Any]
    ) -> List[str]:
        """
        법령 조문 자동 추출
        
        legal_contexts에서 관련 법령 조문을 추출
        """
        legal_basis = []
        
        for ctx in legal_contexts[:5]:  # 상위 5개만 사용
            source_type = ctx.get("source_type", "")
            title = ctx.get("title", "")
            content = ctx.get("content", "")
            
            # 법령 조문 패턴 추출 (제n조, 제n항 등)
            article_pattern = re.compile(r'제\s*\d+\s*조[^\n]*', re.MULTILINE)
            articles = article_pattern.findall(content)
            
            if articles:
                # 법령명과 조문 결합
                for article in articles[:2]:  # 최대 2개
                    legal_basis.append(f"{title} {article.strip()}")
            elif source_type == "law" and title:
                # 조문이 없으면 제목만
                legal_basis.append(title)
        
        # 중복 제거
        return list(dict.fromkeys(legal_basis))[:5]  # 최대 5개
    
    async def _generate_llm_explanation(
        self,
        provision: Dict[str, Any],
        risk_score: float,
        legal_contexts: List[Dict[str, Any]],
        legal_basis: List[str],
        issue_type: str,
        contract_type: str
    ) -> ExplanationResult:
        """LLM 기반 설명 생성"""
        
        prov_title = provision.get("title", "")
        prov_content = provision.get("content", "")
        
        # 법령 컨텍스트 요약
        context_summary = "\n".join([
            f"[{ctx.get('source_type', 'law')}] {ctx.get('title', '')}\n{ctx.get('content', '')[:300]}"
            for ctx in legal_contexts[:3]
        ])
        
        # 이슈 타입별 설명
        issue_descriptions = {
            "missing": "필수 조항이 누락되었습니다",
            "excessive": "표준 계약서에 없는 과도한 조항이 포함되어 있습니다",
            "illegal": "법적으로 문제가 될 수 있는 조항이 포함되어 있습니다",
            "ambiguous": "모호한 표현으로 인해 해석의 여지가 있습니다",
            "normal": "일반적인 조항입니다"
        }
        
        issue_desc = issue_descriptions.get(issue_type, "조항을 분석합니다")
        
        # 위험도 레벨
        if risk_score >= 70:
            risk_level = "매우 높음"
            urgency = "즉시 검토가 필요합니다"
        elif risk_score >= 40:
            risk_level = "중간"
            urgency = "주의 깊게 검토하시기 바랍니다"
        else:
            risk_level = "낮음"
            urgency = "참고하시기 바랍니다"
        
        prompt = f"""당신은 법률 전문가입니다. 다음 계약서 조항에 대한 상세한 분석과 개선 방안을 제시해주세요.

**중요한 원칙:**
1. 이 서비스는 법률 자문이 아닙니다. 정보 안내와 가이드를 제공하는 것입니다.
2. 항상 관련 법령을 근거로 설명하세요.
3. 구체적이고 실용적인 조언을 제공하세요.

**계약서 조항:**
{prov_title}
{prov_content}

**이슈 유형:** {issue_desc}
**위험도:** {risk_score:.1f}점 ({risk_level}) - {urgency}

**관련 법령/가이드:**
{context_summary}

**추출된 법령 조문:**
{chr(10).join(f"- {basis}" for basis in legal_basis) if legal_basis else "- 관련 법령을 검색 중입니다"}

다음 JSON 형식으로 응답해주세요:
{{
    "explanation": "이 조항의 문제점과 법적 위험성을 상세히 설명 (200-300자)",
    "legal_basis": ["근로기준법 제27조", "근로기준법 제56조"] (추출된 법령 조문 리스트, 최대 5개),
    "suggested_revision": "수정 제안 문구 (구체적인 문장으로 작성)",
    "rationale": "왜 이렇게 수정해야 하는지 이유 (100-150자)",
    "suggested_questions": [
        "회사에 이렇게 질문할 수 있는 문구 1",
        "회사에 이렇게 질문할 수 있는 문구 2",
        "회사에 이렇게 질문할 수 있는 문구 3"
    ]
}}

중요 사항:
1. 모든 응답은 한국어로 작성하세요.
2. legal_basis에는 한국어 법령명과 조항을 명확히 표기하세요.
   예: "근로기준법 제56조", "퇴직급여법 제8조"
3. suggested_revision은 실제로 계약서에 넣을 수 있는 구체적인 문구로 작성하세요.
4. suggested_questions는 회사에 정중하게 질문할 수 있는 문구로 작성하세요.

JSON 형식만 반환하세요."""
        
        try:
            if self.generator.use_ollama:
                from config import settings
                import json
                
                try:
                    from langchain_ollama import OllamaLLM
                    llm = OllamaLLM(
                        base_url=settings.ollama_base_url,
                        model=settings.ollama_model
                    )
                except ImportError:
                    from langchain_community.llms import Ollama
                    llm = Ollama(
                        base_url=settings.ollama_base_url,
                        model=settings.ollama_model
                    )
                
                response_text = llm.invoke(prompt)
                
                # JSON 추출
                try:
                    json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                    if json_match:
                        explanation_data = json.loads(json_match.group())
                        
                        # 법령 조문이 없으면 자동 추출한 것으로 보완
                        if not explanation_data.get("legal_basis") and legal_basis:
                            explanation_data["legal_basis"] = legal_basis
                        
                        return ExplanationResult(
                            explanation=explanation_data.get("explanation", ""),
                            legal_basis=explanation_data.get("legal_basis", legal_basis),
                            suggested_revision=explanation_data.get("suggested_revision", ""),
                            rationale=explanation_data.get("rationale", ""),
                            suggested_questions=explanation_data.get("suggested_questions", [])
                        )
                except Exception as e:
                    logger.warning(f"LLM 응답 파싱 실패: {str(e)}")
                    logger.debug(f"LLM 응답 원문: {response_text[:500]}")
        
        except Exception as e:
            logger.warning(f"LLM 설명 생성 실패: {str(e)}")
        
        # LLM 실패 시 기본 응답
        default_result = self._generate_default_explanation(
            provision=provision,
            risk_score=risk_score,
            issue_type=issue_type,
            legal_contexts=legal_contexts
        )
        
        # ExplanationResult로 변환
        explanation_result = default_result.get("explanation_result")
        if not explanation_result:
            explanation_result = ExplanationResult(
                explanation=default_result.get("explanation", ""),
                legal_basis=default_result.get("legal_basis", legal_basis),
                suggested_revision=default_result.get("suggested_revision", ""),
                rationale=default_result.get("rationale", ""),
                suggested_questions=default_result.get("suggested_questions", [])
            )
        
        return explanation_result
    
    def _generate_default_explanation(
        self,
        provision: Dict[str, Any],
        risk_score: float,
        issue_type: str,
        legal_contexts: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """LLM 비활성화 시 기본 설명 생성"""
        prov_title = provision.get("title", "")
        prov_content = provision.get("content", "")
        
        # 기본 설명
        if issue_type == "missing":
            explanation = f"'{prov_title}' 조항이 표준 계약서에 없거나 누락되었을 수 있습니다."
        elif issue_type == "illegal":
            explanation = f"'{prov_title}' 조항에 법적으로 문제가 될 수 있는 내용이 포함되어 있습니다."
        elif issue_type == "ambiguous":
            explanation = f"'{prov_title}' 조항의 표현이 모호하여 해석의 여지가 있습니다."
        elif issue_type == "excessive":
            explanation = f"'{prov_title}' 조항이 표준 계약서에 없는 과도한 조항일 수 있습니다."
        else:
            explanation = f"'{prov_title}' 조항을 검토하시기 바랍니다."
        
        # 법령 조문 추출
        legal_basis = self._extract_legal_basis(legal_contexts, provision)
        
        # 기본 수정 제안
        suggested_revision = f"표준 계약서 형식에 맞게 '{prov_title}' 조항을 수정하는 것을 권장합니다."
        
        # 기본 질문
        suggested_questions = [
            f"'{prov_title}' 조항의 구체적인 의미를 설명해주실 수 있나요?",
            "이 조항이 법적으로 문제가 되지 않는지 확인해주실 수 있나요?",
            "표준 계약서 형식에 맞게 수정이 가능한가요?"
        ]
        
        explanation_result = ExplanationResult(
            explanation=explanation,
            legal_basis=legal_basis,
            suggested_revision=suggested_revision,
            rationale="LLM 분석이 비활성화되어 있습니다. 기본 가이드를 제공합니다.",
            suggested_questions=suggested_questions
        )
        
        return {
            "explanation": explanation_result.explanation,
            "legal_basis": explanation_result.legal_basis,
            "suggested_revision": explanation_result.suggested_revision,
            "rationale": explanation_result.rationale,
            "suggested_questions": explanation_result.suggested_questions,
            "explanation_result": explanation_result
        }
    
    # 편의 메서드
    async def explain(
        self,
        provision: Dict[str, Any],
        risk_score: float,
        legal_contexts: List[Dict[str, Any]],
        issue_type: str = "unknown"
    ) -> Dict[str, Any]:
        """explain 메서드 (execute의 별칭)"""
        return await self.execute(
            provision=provision,
            risk_score=risk_score,
            legal_contexts=legal_contexts,
            issue_type=issue_type
        )

