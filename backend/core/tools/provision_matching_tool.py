"""
ProvisionMatchingTool - 조항 매칭 도구
표준근로계약서와 의미 기반 매칭, 누락/과도 조항 탐지
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from pathlib import Path
import logging

from .base_tool import BaseTool
from .vector_search_tool import VectorSearchTool
from ..generator_v2 import LLMGenerator

# Provision은 document_parser_tool에서 정의되지만 순환 참조 방지를 위해 여기서 import
# 실제 사용 시에는 dict 형태로 받아서 처리

logger = logging.getLogger(__name__)


@dataclass
class MatchedProvision:
    """표준 계약서와 매칭된 조항"""
    provision: Dict[str, Any]  # Provision 객체 (dict 형태)
    standard_provision: Optional[Dict[str, Any]]  # 표준 계약서 조항 정보
    similarity_score: float  # 유사도 점수 (0-1)
    match_type: str  # "exact" | "semantic" | "partial" | "none"


class ProvisionMatchingTool(BaseTool):
    """조항 매칭 도구 - 표준 계약서와 의미 기반 매칭"""
    
    # 필수 조항 체크리스트 (계약서 타입별)
    REQUIRED_PROVISIONS = {
        "employment": [
            "근로자", "사용자", "근로기간", "근무장소", "근무내용",
            "근로시간", "휴게시간", "휴일", "임금", "퇴직금",
            "수습기간", "해고", "계약해지"
        ],
        "freelance": [
            "의뢰인", "수급인", "의뢰사항", "대가", "지급방법",
            "지급시기", "지적재산권", "계약해지", "손해배상"
        ],
        "contract": [
            "계약당사자", "계약목적", "계약기간", "대가", "지급조건",
            "계약해지", "손해배상", "분쟁해결"
        ]
    }
    
    def __init__(self):
        """도구 초기화"""
        self.vector_searcher = VectorSearchTool()
        self.generator = LLMGenerator()
    
    @property
    def name(self) -> str:
        return "ProvisionMatchingTool"
    
    @property
    def description(self) -> str:
        return "표준근로계약서와 의미 기반 매칭 및 누락/과도 조항 탐지"
    
    async def execute(
        self,
        contract_text: str,
        contract_provisions: List[Any],  # Provision 타입
        standard_contract_type: str = "employment",
        similarity_threshold: float = 0.6,
        **kwargs
    ) -> Dict[str, Any]:
        """
        조항 매칭 실행
        
        Args:
            contract_text: 계약서 텍스트
            contract_provisions: 계약서 조항 리스트
            standard_contract_type: 표준 계약서 타입 (employment, freelance, contract)
            similarity_threshold: 유사도 임계값 (0-1)
            **kwargs: 추가 옵션
        
        Returns:
            {
                "matched_provisions": List[MatchedProvision],
                "missing_provisions": List[Dict],
                "excessive_provisions": List[Provision],
                "matching_scores": Dict[str, float],
                "summary": str
            }
        """
        self.log_execution(
            contract_provisions_count=len(contract_provisions),
            standard_contract_type=standard_contract_type
        )
        
        # 입력 검증
        self.validate_input(
            ["contract_text", "contract_provisions"],
            contract_text=contract_text,
            contract_provisions=contract_provisions
        )
        
        try:
            # 1. 표준 계약서 조항 검색
            standard_provisions = await self._load_standard_provisions(
                contract_type=standard_contract_type
            )
            
            # 2. 의미 기반 매칭
            matched_provisions = await self._semantic_matching(
                contract_provisions=contract_provisions,
                standard_provisions=standard_provisions,
                threshold=similarity_threshold
            )
            
            # 3. 누락 조항 탐지
            missing_provisions = self._detect_missing_provisions(
                contract_provisions=contract_provisions,
                contract_type=standard_contract_type
            )
            
            # 4. 과도 조항 탐지
            excessive_provisions = self._detect_excessive_provisions(
                contract_provisions=contract_provisions,
                standard_provisions=standard_provisions,
                matched_provisions=matched_provisions
            )
            
            # 5. 매칭 점수 계산
            matching_scores = self._calculate_matching_scores(
                contract_provisions=contract_provisions,
                matched_provisions=matched_provisions
            )
            
            # 6. 요약 생성
            summary = self._generate_summary(
                matched_count=len(matched_provisions),
                missing_count=len(missing_provisions),
                excessive_count=len(excessive_provisions),
                total_provisions=len(contract_provisions)
            )
            
            result = {
                "matched_provisions": [
                    {
                        "provision": mp.provision if isinstance(mp.provision, dict) else {
                            "id": getattr(mp.provision, "id", ""),
                            "title": getattr(mp.provision, "title", ""),
                            "content": getattr(mp.provision, "content", ""),
                            "article_number": getattr(mp.provision, "article_number", None),
                            "category": getattr(mp.provision, "category", None)
                        },
                        "standard_provision": mp.standard_provision,
                        "similarity_score": mp.similarity_score,
                        "match_type": mp.match_type
                    }
                    for mp in matched_provisions
                ],
                "missing_provisions": missing_provisions,
                "excessive_provisions": [
                    ep if isinstance(ep, dict) else {
                        "id": getattr(ep, "id", ""),
                        "title": getattr(ep, "title", ""),
                        "content": getattr(ep, "content", ""),
                        "article_number": getattr(ep, "article_number", None),
                        "category": getattr(ep, "category", None)
                    }
                    for ep in excessive_provisions
                ],
                "matching_scores": matching_scores,
                "summary": summary
            }
            
            self.log_result(result)
            return result
            
        except Exception as e:
            logger.error(f"[{self.name}] 실행 실패: {str(e)}", exc_info=True)
            raise
    
    async def _load_standard_provisions(
        self,
        contract_type: str
    ) -> List[Dict[str, Any]]:
        """
        표준 계약서 조항 로드
        
        VectorSearchTool을 사용하여 표준 계약서 검색
        """
        # 표준 계약서 검색 쿼리
        query = f"표준 {contract_type} 계약서 조항"
        
        # 표준 계약서 검색
        search_result = await self.vector_searcher.search(
            query=query,
            doc_types=["standard_contract"],
            top_k=10,
            use_hybrid=True
        )
        
        # 검색 결과를 표준 조항으로 변환
        standard_provisions = []
        for result in search_result["results"]:
            # 조항 추출 시도 (제n조 패턴)
            import re
            article_pattern = re.compile(r'제\s*(\d+)\s*조[^\n]*\n(.*?)(?=제\s*\d+\s*조|$)', re.DOTALL)
            matches = article_pattern.findall(result["content"])
            
            for article_num, content in matches:
                standard_provisions.append({
                    "article_number": int(article_num),
                    "title": f"제{article_num}조",
                    "content": content.strip(),
                    "source": result["title"],
                    "source_id": result["id"]
                })
        
        # 검색 결과가 없으면 기본 필수 조항 리스트 반환
        if not standard_provisions:
            required_keywords = self.REQUIRED_PROVISIONS.get(contract_type, [])
            standard_provisions = [
                {
                    "article_number": i + 1,
                    "title": f"필수 조항 {i+1}",
                    "content": keyword,
                    "source": "기본 체크리스트",
                    "source_id": None
                }
                for i, keyword in enumerate(required_keywords)
            ]
        
        return standard_provisions
    
    async def _semantic_matching(
        self,
        contract_provisions: List[Any],  # Provision 객체 리스트
        standard_provisions: List[Dict[str, Any]],
        threshold: float = 0.6
    ) -> List[MatchedProvision]:
        """
        의미 기반 매칭 (임베딩 유사도)
        
        각 계약서 조항과 표준 조항을 임베딩으로 비교
        """
        matched = []
        
        for contract_prov in contract_provisions:
            best_match = None
            best_score = 0.0
            best_match_type = "none"
            
            # Provision 객체에서 정보 추출 (dict 또는 객체 모두 지원)
            if isinstance(contract_prov, dict):
                prov_title = contract_prov.get("title", "")
                prov_content = contract_prov.get("content", "")
                prov_id = contract_prov.get("id", "")
            else:
                prov_title = getattr(contract_prov, "title", "")
                prov_content = getattr(contract_prov, "content", "")
                prov_id = getattr(contract_prov, "id", "")
            
            # 계약서 조항 임베딩 생성
            contract_text = f"{prov_title} {prov_content}"
            contract_embedding = self.generator.embed_one(contract_text)
            
            # 표준 조항들과 비교
            for std_prov in standard_provisions:
                std_text = f"{std_prov['title']} {std_prov['content']}"
                std_embedding = self.generator.embed_one(std_text)
                
                # 코사인 유사도 계산
                import numpy as np
                contract_vec = np.array(contract_embedding, dtype=np.float32)
                std_vec = np.array(std_embedding, dtype=np.float32)
                
                similarity = np.dot(contract_vec, std_vec) / (
                    np.linalg.norm(contract_vec) * np.linalg.norm(std_vec)
                )
                
                if similarity > best_score:
                    best_score = float(similarity)
                    best_match = std_prov
                    
                    # 매칭 타입 결정
                    if similarity >= 0.9:
                        best_match_type = "exact"
                    elif similarity >= threshold:
                        best_match_type = "semantic"
                    elif similarity >= threshold * 0.7:
                        best_match_type = "partial"
            
            # 임계값 이상이면 매칭된 것으로 간주
            if best_score >= threshold:
                # Provision을 dict로 변환
                if isinstance(contract_prov, dict):
                    prov_dict = contract_prov
                else:
                    prov_dict = {
                        "id": getattr(contract_prov, "id", ""),
                        "title": getattr(contract_prov, "title", ""),
                        "content": getattr(contract_prov, "content", ""),
                        "article_number": getattr(contract_prov, "article_number", None),
                        "category": getattr(contract_prov, "category", None)
                    }
                
                matched.append(MatchedProvision(
                    provision=prov_dict,
                    standard_provision=best_match,
                    similarity_score=best_score,
                    match_type=best_match_type
                ))
        
        return matched
    
    def _detect_missing_provisions(
        self,
        contract_provisions: List[Any],  # Provision 객체 리스트
        contract_type: str
    ) -> List[Dict[str, Any]]:
        """
        누락된 필수 조항 탐지
        
        필수 조항 체크리스트와 계약서 조항을 비교
        """
        required_keywords = self.REQUIRED_PROVISIONS.get(contract_type, [])
        contract_text = " ".join([
            f"{p.get('title', '') if isinstance(p, dict) else getattr(p, 'title', '')} "
            f"{p.get('content', '') if isinstance(p, dict) else getattr(p, 'content', '')}"
            for p in contract_provisions
        ]).lower()
        
        missing = []
        for keyword in required_keywords:
            # 키워드가 계약서에 포함되어 있는지 확인
            if keyword.lower() not in contract_text:
                # 유사한 조항이 있는지 확인 (부분 매칭)
                found_similar = False
                for prov in contract_provisions:
                    if isinstance(prov, dict):
                        prov_text = f"{prov.get('title', '')} {prov.get('content', '')}".lower()
                    else:
                        prov_text = f"{getattr(prov, 'title', '')} {getattr(prov, 'content', '')}".lower()
                    if keyword.lower() in prov_text or any(
                        kw in prov_text for kw in keyword.split()
                    ):
                        found_similar = True
                        break
                
                if not found_similar:
                    missing.append({
                        "keyword": keyword,
                        "description": f"'{keyword}' 관련 조항이 누락되었습니다.",
                        "importance": "high" if keyword in ["임금", "근로시간", "해고"] else "medium"
                    })
        
        return missing
    
    def _detect_excessive_provisions(
        self,
        contract_provisions: List[Any],  # Provision 객체 리스트
        standard_provisions: List[Dict[str, Any]],
        matched_provisions: List[MatchedProvision]
    ) -> List[Any]:  # Provision 객체 리스트
        """
        과도한 조항 탐지
        
        표준 계약서에 없는 불필요하거나 과도한 조항 식별
        """
        # 매칭된 조항 ID
        matched_ids = {
            mp.provision.get("id", "") if isinstance(mp.provision, dict) 
            else getattr(mp.provision, "id", "")
            for mp in matched_provisions
        }
        
        # 위험 키워드 (불리한 조항)
        risk_keywords = [
            "일방적", "무조건", "임의로", "즉시 해고",
            "손해배상 무제한", "비밀유지 영구", "경쟁금지 무기한"
        ]
        
        excessive = []
        for prov in contract_provisions:
            # Provision에서 ID 추출
            if isinstance(prov, dict):
                prov_id = prov.get("id", "")
                prov_title = prov.get("title", "")
                prov_content = prov.get("content", "")
            else:
                prov_id = getattr(prov, "id", "")
                prov_title = getattr(prov, "title", "")
                prov_content = getattr(prov, "content", "")
            
            # 매칭되지 않은 조항 중에서
            if prov_id not in matched_ids:
                prov_text = f"{prov_title} {prov_content}".lower()
                
                # 위험 키워드 포함 여부 확인
                has_risk_keyword = any(
                    keyword in prov_text for keyword in risk_keywords
                )
                
                # 표준 조항과 유사도가 매우 낮은 경우
                is_unusual = True
                for std_prov in standard_provisions:
                    std_text = f"{std_prov['title']} {std_prov['content']}".lower()
                    # 간단한 키워드 매칭
                    common_words = set(prov_text.split()) & set(std_text.split())
                    if len(common_words) >= 3:  # 공통 단어가 3개 이상
                        is_unusual = False
                        break
                
                if has_risk_keyword or is_unusual:
                    excessive.append(prov)
        
        return excessive
    
    def _calculate_matching_scores(
        self,
        contract_provisions: List[Any],  # Provision 객체 리스트
        matched_provisions: List[MatchedProvision]
    ) -> Dict[str, float]:
        """매칭 점수 계산"""
        if not contract_provisions:
            return {}
        
        # 전체 매칭률
        total_match_rate = len(matched_provisions) / len(contract_provisions)
        
        # 평균 유사도
        avg_similarity = sum(
            mp.similarity_score for mp in matched_provisions
        ) / len(matched_provisions) if matched_provisions else 0.0
        
        # 카테고리별 매칭 점수
        category_scores = {}
        for mp in matched_provisions:
            prov = mp.provision
            if isinstance(prov, dict):
                category = prov.get("category") or "other"
            else:
                category = getattr(prov, "category", None) or "other"
            if category not in category_scores:
                category_scores[category] = []
            category_scores[category].append(mp.similarity_score)
        
        category_avg = {
            cat: sum(scores) / len(scores)
            for cat, scores in category_scores.items()
        }
        
        return {
            "total_match_rate": total_match_rate,
            "average_similarity": avg_similarity,
            "category_scores": category_avg,
            "matched_count": len(matched_provisions),
            "total_count": len(contract_provisions)
        }
    
    def _generate_summary(
        self,
        matched_count: int,
        missing_count: int,
        excessive_count: int,
        total_provisions: int
    ) -> str:
        """매칭 결과 요약 생성"""
        match_rate = (matched_count / total_provisions * 100) if total_provisions > 0 else 0
        
        summary_parts = [
            f"총 {total_provisions}개 조항 중 {matched_count}개가 표준 계약서와 매칭되었습니다.",
            f"매칭률: {match_rate:.1f}%"
        ]
        
        if missing_count > 0:
            summary_parts.append(f"⚠️ {missing_count}개 필수 조항이 누락되었습니다.")
        
        if excessive_count > 0:
            summary_parts.append(f"⚠️ {excessive_count}개 과도한 조항이 발견되었습니다.")
        
        if missing_count == 0 and excessive_count == 0:
            summary_parts.append("✅ 계약서가 표준 계약서와 잘 일치합니다.")
        
        return " ".join(summary_parts)
    
    # 편의 메서드
    async def match(
        self,
        contract_text: str,
        contract_provisions: List[Any],  # Provision 객체 리스트
        standard_contract_type: str = "employment"
    ) -> Dict[str, Any]:
        """match 메서드 (execute의 별칭)"""
        return await self.execute(
            contract_text=contract_text,
            contract_provisions=contract_provisions,
            standard_contract_type=standard_contract_type
        )

