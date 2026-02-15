"""
ClauseLabelingTool - 조항 자동 분류 도구
"제n조" 단위로 자동 라벨링 및 issue와 매핑
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import re
import logging
from difflib import SequenceMatcher

from .base_tool import BaseTool
from ..legal_chunker import LegalChunker, Section

logger = logging.getLogger(__name__)


@dataclass
class Clause:
    """계약서 조항"""
    id: str
    title: str  # "제1조 (목적)"
    content: str  # 조항 본문
    article_number: Optional[int] = None  # 조 번호
    start_index: int = 0  # 원문에서 시작 위치
    end_index: int = 0  # 원문에서 종료 위치
    category: Optional[str] = None  # "working_hours", "wage" 등
    issues: List[str] = None  # 연결된 issue ID 리스트


class ClauseLabelingTool(BaseTool):
    """조항 자동 분류 도구 - 조항 추출 및 issue 매핑"""
    
    def __init__(self):
        """도구 초기화"""
        self.chunker = LegalChunker(max_chars=1200, overlap=200)
    
    @property
    def name(self) -> str:
        return "ClauseLabelingTool"
    
    @property
    def description(self) -> str:
        return "계약서에서 조항을 자동으로 추출하고 분류하며, issue와 매핑"
    
    async def execute(
        self,
        contract_text: str,
        issues: List[Dict[str, Any]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        조항 자동 분류 실행
        
        Args:
            contract_text: 계약서 원문 텍스트
            issues: 이슈 리스트 (issue와 조항 매핑용)
            **kwargs: 추가 옵션
        
        Returns:
            {
                "clauses": List[Clause],
                "issue_clause_mapping": Dict[str, List[str]]  # issue_id -> clause_id 리스트
            }
        """
        self.log_execution(contract_text_length=len(contract_text), issues_count=len(issues) if issues else 0)
        
        # 입력 검증
        self.validate_input(["contract_text"], contract_text=contract_text)
        
        if not contract_text or not contract_text.strip():
            return {
                "clauses": [],
                "issue_clause_mapping": {}
            }
        
        try:
            # 1. 조항 추출 (issues 없이도 가능 - 제n조 패턴 기반)
            clauses = self._extract_clauses(contract_text)
            
            # 2. issue와 조항 매핑 (issues가 있고 originalText가 있는 경우만)
            issue_clause_mapping = {}
            if issues:
                # originalText가 있는 issues만 필터링
                valid_issues = [
                    issue for issue in issues 
                    if issue.get("originalText") and issue.get("originalText").strip()
                ]
                if valid_issues:
                    issue_clause_mapping = self._map_issues_to_clauses(valid_issues, clauses, contract_text)
                else:
                    logger.warning(f"[조항 매핑] originalText가 있는 issue가 없어 조항 매핑을 건너뜁니다. 전체 issues 수: {len(issues)}")
            
            result = {
                "clauses": [
                    {
                        "id": clause.id,
                        "title": clause.title,
                        "content": clause.content,
                        "articleNumber": clause.article_number,
                        "startIndex": clause.start_index,
                        "endIndex": clause.end_index,
                        "category": clause.category,
                        "issues": clause.issues or []
                    }
                    for clause in clauses
                ],
                "issue_clause_mapping": issue_clause_mapping
            }
            
            self.log_result(result)
            return result
            
        except Exception as e:
            logger.error(f"[{self.name}] 실행 실패: {str(e)}", exc_info=True)
            raise
    
    def _extract_clauses(self, text: str) -> List[Clause]:
        """
        조항 추출 (제n조 기준)
        
        Args:
            text: 원본 텍스트
        
        Returns:
            Clause 리스트
        """
        sections = self.chunker.split_by_article(text)
        clauses = []
        
        for i, section in enumerate(sections):
            # 조 번호 추출
            article_number = self._extract_article_number(section.title)
            
            # 원문에서 위치 찾기
            # 같은 제목이 여러 번 나올 수 있으므로, 이전 조항의 end_index 이후부터 검색
            search_start = clauses[-1].end_index if clauses else 0
            full_text = section.title + "\n" + section.body
            
            # 이전 조항 이후부터 검색하여 중복 제목 문제 해결
            search_text = text[search_start:]
            relative_start = search_text.find(section.title)
            
            if relative_start >= 0:
                start_index = search_start + relative_start
                end_index = start_index + len(full_text)
            else:
                # 찾지 못한 경우 전체 텍스트에서 검색 (fallback)
                start_index = text.find(section.title)
                end_index = start_index + len(full_text) if start_index >= 0 else 0
                if start_index >= 0 and clauses:
                    # 이미 처리된 조항과 겹치면 다음 위치 찾기
                    for prev_clause in clauses:
                        if start_index < prev_clause.end_index:
                            # 겹치는 경우 다음 위치 찾기
                            next_start = text.find(section.title, prev_clause.end_index)
                            if next_start >= 0:
                                start_index = next_start
                                end_index = start_index + len(full_text)
                            break
            
            # 카테고리 추정
            category = self._infer_category(section.title, section.body)
            
            clause = Clause(
                id=f"clause-{i+1}",
                title=section.title,
                content=section.body,
                article_number=article_number,
                start_index=start_index if start_index >= 0 else 0,
                end_index=end_index,
                category=category,
                issues=[]
            )
            clauses.append(clause)
        
        return clauses
    
    def _extract_article_number(self, title: str) -> Optional[int]:
        """조 번호 추출"""
        match = re.search(r'제\s*(\d+)\s*조', title)
        if match:
            return int(match.group(1))
        return None
    
    def _infer_category(self, title: str, content: str) -> Optional[str]:
        """카테고리 추정 (키워드 기반)"""
        text = (title + " " + content).lower()
        
        # 키워드 매핑
        category_keywords = {
            "working_hours": ["근로시간", "근무시간", "야근", "연장근로", "휴게시간", "휴일", "주휴일"],
            "wage": ["임금", "급여", "수당", "보너스", "상여금", "연봉", "월급"],
            "probation_termination": ["수습", "인턴", "해고", "계약해지", "퇴직", "사직", "퇴사"],
            "stock_option_ip": ["스톡옵션", "지분", "지적재산권", "저작권", "특허", "발명"],
            "vacation": ["휴가", "연차", "병가", "경조사", "출산"],
            "overtime": ["야근", "연장근로", "휴일근로", "야간근로"],
            "benefits": ["복리후생", "보험", "퇴직금", "퇴직연금"]
        }
        
        for category, keywords in category_keywords.items():
            if any(keyword in text for keyword in keywords):
                return category
        
        return None
    
    def _map_issues_to_clauses(
        self,
        issues: List[Dict[str, Any]],
        clauses: List[Clause],
        contract_text: str
    ) -> Dict[str, List[str]]:
        """
        issue와 조항 매핑 (유사도 기반)
        
        Args:
            issues: 이슈 리스트
            clauses: 조항 리스트
            contract_text: 원문 텍스트
        
        Returns:
            issue_id -> clause_id 리스트 매핑
        """
        issue_clause_mapping = {}
        
        # 유사도 임계값
        SIMILARITY_THRESHOLD = 0.6  # 60% 이상 유사하면 매칭
        
        for issue in issues:
            issue_id = issue.get("id", "")
            original_text = issue.get("originalText", "")
            
            if not original_text:
                continue
            
            # issue의 originalText가 원문에서 어디에 있는지 찾기
            issue_start = contract_text.find(original_text)
            issue_end = issue_start + len(original_text) if issue_start >= 0 else -1
            
            # 각 조항과의 유사도 계산
            clause_scores = []
            
            for clause in clauses:
                score = 0.0
                match_type = None
                
                # 1. 정확한 문자열 포함 검사 (가장 높은 우선순위)
                if original_text in clause.content:
                    score = 1.0
                    match_type = "exact_contain"
                elif clause.content in original_text:
                    score = 0.95
                    match_type = "clause_contained"
                # 2. 위치 기반 매칭 (원문에서 겹치는 범위 확인)
                elif issue_start >= 0 and clause.start_index > 0 and clause.end_index > 0:
                    # 조항 범위와 겹치는지 확인
                    if (clause.start_index <= issue_start <= clause.end_index) or \
                       (clause.start_index <= issue_end <= clause.end_index) or \
                       (issue_start <= clause.start_index and issue_end >= clause.end_index):
                        score = 0.9
                        match_type = "position_overlap"
                # 3. 유사도 기반 매칭 (fuzzy matching)
                else:
                    # original_text와 조항 본문의 유사도 계산
                    similarity = SequenceMatcher(None, original_text.lower(), clause.content.lower()).ratio()
                    if similarity >= SIMILARITY_THRESHOLD:
                        score = similarity
                        match_type = "similarity"
                
                if score > 0:
                    clause_scores.append({
                        "clause": clause,
                        "score": score,
                        "match_type": match_type
                    })
            
            # 유사도 순으로 정렬
            clause_scores.sort(key=lambda x: x["score"], reverse=True)
            
            # 상위 매칭된 조항들 선택 (임계값 이상)
            matched_clause_ids = []
            for item in clause_scores:
                if item["score"] >= SIMILARITY_THRESHOLD:
                    clause = item["clause"]
                    if clause.id not in matched_clause_ids:
                        matched_clause_ids.append(clause.id)
                        clause.issues.append(issue_id)
                        logger.debug(
                            f"[조항 매핑] issue={issue_id} -> clause={clause.id} "
                            f"(score={item['score']:.2f}, type={item['match_type']})"
                        )
            
            if matched_clause_ids:
                issue_clause_mapping[issue_id] = matched_clause_ids
            else:
                logger.warning(
                    f"[조항 매핑] issue={issue_id}에 매칭된 조항이 없습니다. "
                    f"originalText 길이={len(original_text)}"
                )
        
        return issue_clause_mapping

