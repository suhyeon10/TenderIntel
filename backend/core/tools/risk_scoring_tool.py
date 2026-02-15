"""
RiskScoringTool - 위험도 산정 도구
각 조항별 위험도 산정 및 전체 위험 스코어 생성
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import logging

from .base_tool import BaseTool
from ..generator_v2 import LLMGenerator

# Provision과 MatchedProvision은 dict 형태로 받아서 처리

logger = logging.getLogger(__name__)


@dataclass
class ProvisionRisk:
    """조항별 위험도"""
    provision: Dict[str, Any]  # Provision 객체 (dict 형태)
    risk_score: float  # 위험도 (0-100)
    issue_type: str  # "missing" | "excessive" | "illegal" | "ambiguous" | "normal"
    severity: str  # "low" | "medium" | "high"
    reasons: List[str]  # 위험 사유


class RiskScoringTool(BaseTool):
    """위험도 산정 도구 - 조항별 및 전체 위험도 계산"""
    
    # 위험 키워드 및 점수
    RISK_KEYWORDS = {
        "illegal": {
            "keywords": [
                "일방적 해고", "임의 해고", "무조건 해고",
                "손해배상 무제한", "비밀유지 영구", "경쟁금지 무기한",
                "연장근로 수당 없음", "휴일근로 수당 없음"
            ],
            "score": 40
        },
        "ambiguous": {
            "keywords": [
                "적절한", "합리적인", "필요시", "가능한 범위 내",
                "회사 사정에 따라", "추후 결정"
            ],
            "score": 20
        },
        "unfair": {
            "keywords": [
                "불리한 조건", "불공정", "일방적", "강제"
            ],
            "score": 30
        }
    }
    
    # 카테고리별 가중치
    CATEGORY_WEIGHTS = {
        "working_hours": 0.25,
        "wage": 0.30,
        "probation_termination": 0.25,
        "stock_option_ip": 0.20
    }
    
    def __init__(self):
        """도구 초기화"""
        self.generator = LLMGenerator()
    
    @property
    def name(self) -> str:
        return "RiskScoringTool"
    
    @property
    def description(self) -> str:
        return "각 조항별 위험도 산정 및 전체 위험 스코어 생성"
    
    async def execute(
        self,
        provisions: List[Any],  # Provision 타입
        matched_provisions: Optional[List[Any]] = None,  # MatchedProvision 타입
        legal_contexts: Optional[List[Dict[str, Any]]] = None,
        contract_type: str = "employment",
        use_llm: bool = True,
        **kwargs
    ) -> Dict[str, Any]:
        """
        위험도 산정 실행
        
        Args:
            provisions: 계약서 조항 리스트
            matched_provisions: 표준 계약서 매칭 결과
            legal_contexts: 관련 법령 검색 결과
            contract_type: 계약서 타입
            use_llm: LLM 기반 평가 사용 여부
            **kwargs: 추가 옵션
        
        Returns:
            {
                "provision_risks": List[ProvisionRisk],
                "overall_risk_score": float,
                "risk_level": str,
                "risk_breakdown": Dict[str, float],
                "critical_issues": List[str]
            }
        """
        self.log_execution(
            provisions_count=len(provisions),
            contract_type=contract_type
        )
        
        # 입력 검증
        self.validate_input(["provisions"], provisions=provisions)
        
        try:
            # 1. 조항별 위험도 산정
            provision_risks = await self._score_provisions(
                provisions=provisions,
                matched_provisions=matched_provisions or [],
                legal_contexts=legal_contexts or [],
                use_llm=use_llm
            )
            
            # 2. 전체 위험 스코어 계산
            overall_risk_score = self._calculate_overall_score(provision_risks)
            
            # 3. 위험도 레벨 분류
            risk_level = self._classify_risk_level(overall_risk_score)
            
            # 4. 영역별 위험도 분류
            risk_breakdown = self._calculate_risk_breakdown(provision_risks)
            
            # 5. 심각한 이슈 추출
            critical_issues = self._extract_critical_issues(provision_risks)
            
            result = {
                "provision_risks": [
                    {
                        "provision": pr.provision,  # 이미 dict 형태
                        "risk_score": pr.risk_score,
                        "issue_type": pr.issue_type,
                        "severity": pr.severity,
                        "reasons": pr.reasons
                    }
                    for pr in provision_risks
                ],
                "overall_risk_score": overall_risk_score,
                "risk_level": risk_level,
                "risk_breakdown": risk_breakdown,
                "critical_issues": critical_issues
            }
            
            self.log_result(result)
            return result
            
        except Exception as e:
            logger.error(f"[{self.name}] 실행 실패: {str(e)}", exc_info=True)
            raise
    
    async def _score_provisions(
        self,
        provisions: List[Any],  # Provision 객체 리스트
        matched_provisions: List[Any],  # MatchedProvision 객체 리스트
        legal_contexts: List[Dict[str, Any]],
        use_llm: bool
    ) -> List[ProvisionRisk]:
        """조항별 위험도 산정"""
        provision_risks = []
        
        # 매칭 결과를 딕셔너리로 변환 (빠른 조회)
        matched_dict = {}
        for mp in matched_provisions:
            # MatchedProvision에서 provision 추출
            if isinstance(mp, dict):
                prov = mp.get("provision", {})
                prov_id = prov.get("id", "") if isinstance(prov, dict) else getattr(prov, "id", "")
            else:
                prov = getattr(mp, "provision", {})
                if isinstance(prov, dict):
                    prov_id = prov.get("id", "")
                else:
                    prov_id = getattr(prov, "id", "")
            
            if prov_id:
                matched_dict[prov_id] = mp
        
        for provision in provisions:
            # Provision을 dict로 변환
            if isinstance(provision, dict):
                prov_dict = provision
            else:
                prov_dict = {
                    "id": getattr(provision, "id", ""),
                    "title": getattr(provision, "title", ""),
                    "content": getattr(provision, "content", ""),
                    "article_number": getattr(provision, "article_number", None),
                    "category": getattr(provision, "category", None)
                }
            
            # 1. 규칙 기반 점수 (50%)
            rule_score = self._rule_based_score(prov_dict, matched_dict)
            
            # 2. LLM 기반 점수 (50%, 선택적)
            llm_score = 0.0
            if use_llm and not self.generator.disable_llm:
                try:
                    llm_score = await self._llm_based_score(
                        provision=prov_dict,
                        legal_contexts=legal_contexts
                    )
                except Exception as e:
                    logger.warning(f"LLM 기반 점수 계산 실패: {str(e)}")
                    llm_score = rule_score  # 실패 시 규칙 기반 점수 사용
            
            # 최종 점수 (가중 평균)
            final_score = (rule_score * 0.5) + (llm_score * 0.5)
            
            # 이슈 타입 및 심각도 결정
            issue_type, severity, reasons = self._classify_issue(
                provision=prov_dict,
                score=final_score,
                matched_dict=matched_dict
            )
            
            provision_risks.append(ProvisionRisk(
                provision=prov_dict,
                risk_score=final_score,
                issue_type=issue_type,
                severity=severity,
                reasons=reasons
            ))
        
        return provision_risks
    
    def _rule_based_score(
        self,
        provision: Dict[str, Any],  # Provision dict
        matched_dict: Dict[str, Any]  # MatchedProvision dict
    ) -> float:
        """
        규칙 기반 위험도 점수 (0-100)
        
        규칙:
        - 필수 조항 누락: +30점
        - 불법 조항 포함: +40점
        - 모호한 표현: +20점
        - 표준과 불일치: +15점
        """
        score = 0.0
        prov_title = provision.get("title", "")
        prov_content = provision.get("content", "")
        prov_id = provision.get("id", "")
        prov_text = f"{prov_title} {prov_content}".lower()
        
        # 1. 불법 조항 체크
        for risk_type, risk_info in self.RISK_KEYWORDS.items():
            for keyword in risk_info["keywords"]:
                if keyword.lower() in prov_text:
                    score += risk_info["score"]
                    break
        
        # 2. 표준 계약서와의 불일치
        if prov_id not in matched_dict:
            score += 15.0  # 매칭되지 않은 조항
        else:
            match = matched_dict[prov_id]
            # MatchedProvision에서 similarity_score 추출
            if isinstance(match, dict):
                similarity = match.get("similarity_score", 0.0)
            else:
                similarity = getattr(match, "similarity_score", 0.0)
            
            if similarity < 0.7:
                score += 10.0  # 낮은 유사도
        
        # 3. 모호한 표현 체크
        ambiguous_count = sum(
            1 for keyword in self.RISK_KEYWORDS["ambiguous"]["keywords"]
            if keyword in prov_text
        )
        if ambiguous_count > 0:
            score += 20.0
        
        # 점수는 0-100 범위로 제한
        return min(100.0, score)
    
    async def _llm_based_score(
        self,
        provision: Dict[str, Any],  # Provision dict
        legal_contexts: List[Dict[str, Any]]
    ) -> float:
        """
        LLM 기반 위험도 평가
        
        법령 컨텍스트를 바탕으로 조항의 법적 적합성 판단
        """
        if self.generator.disable_llm:
            return 0.0
        
        # 법령 컨텍스트 요약
        context_summary = "\n".join([
            f"[{ctx.get('source_type', 'law')}] {ctx.get('title', '')}\n{ctx.get('content', '')[:200]}"
            for ctx in legal_contexts[:3]
        ])
        
        prov_text = f"{provision.get('title', '')}\n{provision.get('content', '')}"
        
        prompt = f"""당신은 법률 전문가입니다. 다음 계약서 조항의 법적 위험도를 0-100 점수로 평가해주세요.

계약서 조항:
{prov_text}

관련 법령:
{context_summary}

평가 기준:
- 0-30: 법적으로 문제없음
- 31-60: 주의 필요 (모호하거나 불완전한 조항)
- 61-80: 위험 (법적 문제 가능성)
- 81-100: 매우 위험 (명백한 불법 또는 매우 불리한 조항)

점수만 숫자로 반환하세요 (예: 45)"""
        
        try:
            if self.generator.use_ollama:
                from config import settings
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
                
                response = llm.invoke(prompt)
                
                # 숫자 추출
                import re
                numbers = re.findall(r'\d+', response)
                if numbers:
                    score = float(numbers[0])
                    return min(100.0, max(0.0, score))
        except Exception as e:
            logger.warning(f"LLM 점수 계산 실패: {str(e)}")
        
        return 0.0
    
    def _classify_issue(
        self,
        provision: Dict[str, Any],  # Provision dict
        score: float,
        matched_dict: Dict[str, Any]  # MatchedProvision dict
    ) -> tuple[str, str, List[str]]:
        """이슈 타입 및 심각도 분류"""
        issue_type = "normal"
        severity = "low"
        reasons = []
        
        prov_title = provision.get("title", "")
        prov_content = provision.get("content", "")
        prov_id = provision.get("id", "")
        prov_text = f"{prov_title} {prov_content}".lower()
        
        # 이슈 타입 결정
        if prov_id not in matched_dict:
            issue_type = "missing"
            reasons.append("표준 계약서와 매칭되지 않음")
        elif any(keyword in prov_text for keyword in self.RISK_KEYWORDS["illegal"]["keywords"]):
            issue_type = "illegal"
            reasons.append("불법 조항 포함 가능성")
        elif any(keyword in prov_text for keyword in self.RISK_KEYWORDS["ambiguous"]["keywords"]):
            issue_type = "ambiguous"
            reasons.append("모호한 표현 포함")
        elif any(keyword in prov_text for keyword in self.RISK_KEYWORDS["unfair"]["keywords"]):
            issue_type = "excessive"
            reasons.append("불공정한 조항 포함")
        
        # 심각도 결정
        if score >= 70:
            severity = "high"
        elif score >= 40:
            severity = "medium"
        else:
            severity = "low"
        
        return issue_type, severity, reasons
    
    def _calculate_overall_score(
        self,
        provision_risks: List[ProvisionRisk]
    ) -> float:
        """전체 위험 스코어 계산 (가중 평균)"""
        if not provision_risks:
            return 0.0
        
        # 카테고리별 점수 계산
        category_scores = {}
        category_counts = {}
        
        for pr in provision_risks:
            prov = pr.provision
            category = prov.get("category") if isinstance(prov, dict) else getattr(prov, "category", None)
            category = category or "other"
            if category not in category_scores:
                category_scores[category] = 0.0
                category_counts[category] = 0
            
            category_scores[category] += pr.risk_score
            category_counts[category] += 1
        
        # 카테고리별 평균
        category_avg = {
            cat: scores / category_counts[cat]
            for cat, scores in category_scores.items()
        }
        
        # 가중 평균 계산
        total_score = 0.0
        total_weight = 0.0
        
        for category, avg_score in category_avg.items():
            weight = self.CATEGORY_WEIGHTS.get(category, 0.1)
            total_score += avg_score * weight
            total_weight += weight
        
        # 가중치가 없는 카테고리는 균등 가중치 적용
        if total_weight < 0.9:  # 가중치 합이 1에 못 미치면
            remaining_weight = 1.0 - total_weight
            other_categories = [cat for cat in category_avg.keys() 
                              if cat not in self.CATEGORY_WEIGHTS]
            if other_categories:
                weight_per_category = remaining_weight / len(other_categories)
                for cat in other_categories:
                    total_score += category_avg[cat] * weight_per_category
                total_weight = 1.0
        
        return total_score / total_weight if total_weight > 0 else 0.0
    
    def _classify_risk_level(self, score: float) -> str:
        """위험도 레벨 분류"""
        if score >= 70:
            return "high"
        elif score >= 40:
            return "medium"
        else:
            return "low"
    
    def _calculate_risk_breakdown(
        self,
        provision_risks: List[ProvisionRisk]
    ) -> Dict[str, float]:
        """영역별 위험도 분류"""
        breakdown = {
            "working_hours": 0.0,
            "wage": 0.0,
            "probation_termination": 0.0,
            "stock_option_ip": 0.0
        }
        
        category_scores = {}
        category_counts = {}
        
        for pr in provision_risks:
            category = pr.provision.category
            if category and category in breakdown:
                if category not in category_scores:
                    category_scores[category] = 0.0
                    category_counts[category] = 0
                
                category_scores[category] += pr.risk_score
                category_counts[category] += 1
        
        # 평균 계산
        for category in breakdown.keys():
            if category in category_scores:
                breakdown[category] = category_scores[category] / category_counts[category]
        
        return breakdown
    
    def _extract_critical_issues(
        self,
        provision_risks: List[ProvisionRisk]
    ) -> List[str]:
        """심각한 이슈 추출 (위험도 60 이상)"""
        critical = []
        
        for pr in provision_risks:
            if pr.risk_score >= 60:
                prov = pr.provision
                prov_title = prov.get("title", "") if isinstance(prov, dict) else getattr(prov, "title", "")
                issue_desc = f"[{prov_title}] {pr.severity.upper()} 위험 ({pr.risk_score:.1f}점)"
                if pr.reasons:
                    issue_desc += f": {', '.join(pr.reasons)}"
                critical.append(issue_desc)
        
        return critical
    
    # 편의 메서드
    async def score(
        self,
        provisions: List[Any],  # Provision 객체 리스트
        matched_provisions: Optional[List[Any]] = None,  # MatchedProvision 객체 리스트
        legal_contexts: Optional[List[Dict[str, Any]]] = None,
        contract_type: str = "employment"
    ) -> Dict[str, Any]:
        """score 메서드 (execute의 별칭)"""
        return await self.execute(
            provisions=provisions,
            matched_provisions=matched_provisions,
            legal_contexts=legal_contexts,
            contract_type=contract_type
        )

