"""
HighlightTool - 위험 조항 자동 하이라이트 도구
문서 전문에 위험 조항 표시, start/end index 마킹
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import logging

from .base_tool import BaseTool

logger = logging.getLogger(__name__)


@dataclass
class HighlightedText:
    """하이라이트된 텍스트"""
    text: str
    start_index: int
    end_index: int
    severity: str  # "low" | "medium" | "high"
    issue_id: str  # 연결된 issue ID


class HighlightTool(BaseTool):
    """위험 조항 자동 하이라이트 도구"""
    
    @property
    def name(self) -> str:
        return "HighlightTool"
    
    @property
    def description(self) -> str:
        return "문서 전문에서 위험 조항을 찾아 하이라이트 정보 생성"
    
    async def execute(
        self,
        contract_text: str,
        issues: List[Dict[str, Any]],
        **kwargs
    ) -> Dict[str, Any]:
        """
        위험 조항 하이라이트 실행
        
        Args:
            contract_text: 계약서 원문 텍스트
            issues: 이슈 리스트
            **kwargs: 추가 옵션
        
        Returns:
            {
                "highlightedTexts": List[HighlightedText]
            }
        """
        self.log_execution(contract_text_length=len(contract_text), issues_count=len(issues))
        
        # 입력 검증
        self.validate_input(["contract_text", "issues"], contract_text=contract_text, issues=issues)
        
        if not contract_text or not issues:
            return {
                "highlightedTexts": []
            }
        
        try:
            highlighted_texts = []
            
            for issue in issues:
                original_text = issue.get("originalText", "")
                issue_id = issue.get("id", "")
                severity = issue.get("severity", "medium")
                
                if not original_text or not original_text.strip():
                    logger.debug(f"[하이라이트] issue={issue_id}: originalText가 없어 건너뜁니다")
                    continue
                
                # originalText에서 페이지 정보 제거 (예: "페이지 2/2 1. 근로계약서" → "1. 근로계약서")
                cleaned_original_text = self._clean_page_info(original_text)
                
                # 원문에서 originalText 찾기 (정확한 매칭 시도)
                start_index = contract_text.find(cleaned_original_text)
                
                if start_index >= 0:
                    end_index = start_index + len(cleaned_original_text)
                    
                    highlighted_text = HighlightedText(
                        text=cleaned_original_text,
                        start_index=start_index,
                        end_index=end_index,
                        severity=severity,
                        issue_id=issue_id
                    )
                    highlighted_texts.append(highlighted_text)
                    logger.debug(f"[하이라이트] issue={issue_id}: 정확한 매칭 성공 (start={start_index}, end={end_index})")
                else:
                    # 정확히 일치하지 않으면 부분 매칭 시도
                    # 1. originalText의 핵심 키워드 추출
                    keywords = self._extract_keywords(cleaned_original_text)
                    if keywords:
                        # 2. 키워드가 포함된 문장 찾기
                        matched_text, matched_start, matched_end = self._find_text_by_keywords(
                            contract_text, keywords, cleaned_original_text
                        )
                        if matched_text:
                            highlighted_text = HighlightedText(
                                text=matched_text,
                                start_index=matched_start,
                                end_index=matched_end,
                                severity=severity,
                                issue_id=issue_id
                            )
                            highlighted_texts.append(highlighted_text)
                            logger.debug(f"[하이라이트] issue={issue_id}: 키워드 매칭 성공 (start={matched_start}, end={matched_end})")
                        else:
                            # 3. 키워드 매칭도 실패하면, originalText의 일부만으로 매칭 시도
                            matched_text, matched_start, matched_end = self._find_partial_match(
                                contract_text, cleaned_original_text
                            )
                            if matched_text:
                                highlighted_text = HighlightedText(
                                    text=matched_text,
                                    start_index=matched_start,
                                    end_index=matched_end,
                                    severity=severity,
                                    issue_id=issue_id
                                )
                                highlighted_texts.append(highlighted_text)
                                logger.debug(f"[하이라이트] issue={issue_id}: 부분 매칭 성공 (start={matched_start}, end={matched_end})")
                            else:
                                logger.warning(f"[하이라이트] issue={issue_id}: 매칭 실패 - originalText='{original_text[:100]}...'")
            
            # 중복 제거 (같은 위치의 하이라이트는 하나만)
            unique_highlights = self._remove_overlaps(highlighted_texts)
            
            result = {
                "highlightedTexts": [
                    {
                        "text": h.text,
                        "startIndex": h.start_index,
                        "endIndex": h.end_index,
                        "severity": h.severity,
                        "issueId": h.issue_id
                    }
                    for h in unique_highlights
                ]
            }
            
            self.log_result(result)
            return result
            
        except Exception as e:
            logger.error(f"[{self.name}] 실행 실패: {str(e)}", exc_info=True)
            raise
    
    def _clean_page_info(self, text: str) -> str:
        """originalText에서 페이지 정보 제거"""
        import re
        # "페이지 2/2", "페이지 1/3" 같은 패턴 제거
        text = re.sub(r'페이지\s*\d+/\d+\s*', '', text)
        # "페이지 2/2 1. 근로계약서" → "1. 근로계약서"
        text = text.strip()
        return text
    
    def _extract_keywords(self, text: str) -> List[str]:
        """핵심 키워드 추출"""
        # 간단한 키워드 추출 (실제로는 더 정교한 NLP 사용 가능)
        keywords = []
        
        # 중요한 단어 추출 (2글자 이상)
        words = text.split()
        for word in words:
            word_clean = word.strip(".,!?()[]{}")
            if len(word_clean) >= 2:
                keywords.append(word_clean)
        
        # 상위 5개만 반환
        return keywords[:5]
    
    def _find_text_by_keywords(
        self,
        contract_text: str,
        keywords: List[str],
        original_text: str
    ) -> tuple:
        """
        키워드로 텍스트 찾기
        
        Returns:
            (matched_text, start_index, end_index) 또는 (None, 0, 0)
        """
        # 키워드가 모두 포함된 문장 찾기
        sentences = contract_text.split('。')  # 한국어 문장 구분자
        if not sentences:
            sentences = contract_text.split('.')
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            # 키워드가 모두 포함되어 있는지 확인
            if all(keyword in sentence for keyword in keywords[:3]):  # 상위 3개 키워드만 확인
                start_index = contract_text.find(sentence)
                if start_index >= 0:
                    end_index = start_index + len(sentence)
                    return (sentence, start_index, end_index)
        
        return (None, 0, 0)
    
    def _find_partial_match(
        self,
        contract_text: str,
        original_text: str
    ) -> tuple:
        """
        originalText의 일부만으로 매칭 시도 (더 관대한 매칭)
        
        Returns:
            (matched_text, start_index, end_index) 또는 (None, 0, 0)
        """
        if not original_text or len(original_text) < 10:
            return (None, 0, 0)
        
        # originalText의 중간 부분부터 시도 (앞뒤가 잘릴 수 있음)
        # 최소 20자 이상의 텍스트로 매칭 시도
        min_length = min(20, len(original_text) // 2)
        
        # originalText의 중간 부분 추출
        start_offset = len(original_text) // 4
        end_offset = len(original_text) - start_offset
        search_text = original_text[start_offset:end_offset]
        
        if len(search_text) < min_length:
            # 너무 짧으면 전체 텍스트 사용
            search_text = original_text
        
        # contract_text에서 찾기
        start_index = contract_text.find(search_text)
        
        if start_index >= 0:
            # 찾은 위치를 기준으로 앞뒤로 확장
            # 앞으로 문장/문단 시작 찾기
            expanded_start = start_index
            while expanded_start > 0 and contract_text[expanded_start] not in ['\n', '。', '.', '제']:
                expanded_start -= 1
            expanded_start = max(0, expanded_start)
            
            # 뒤로 문장/문단 끝 찾기
            expanded_end = start_index + len(search_text)
            while expanded_end < len(contract_text) and contract_text[expanded_end] not in ['\n', '。', '.', '제']:
                expanded_end += 1
            expanded_end = min(len(contract_text), expanded_end)
            
            matched_text = contract_text[expanded_start:expanded_end].strip()
            if len(matched_text) >= min_length:
                return (matched_text, expanded_start, expanded_end)
        
        return (None, 0, 0)
    
    def _remove_overlaps(self, highlights: List[HighlightedText]) -> List[HighlightedText]:
        """중복/겹치는 하이라이트 제거"""
        if not highlights:
            return []
        
        # severity 우선순위: high > medium > low
        severity_priority = {"high": 3, "medium": 2, "low": 1}
        
        # start_index 기준 정렬
        sorted_highlights = sorted(highlights, key=lambda h: h.start_index)
        
        unique_highlights = []
        for highlight in sorted_highlights:
            # 기존 하이라이트와 겹치는지 확인
            overlap = False
            for existing in unique_highlights:
                # 겹치는 범위 확인
                if not (highlight.end_index <= existing.start_index or highlight.start_index >= existing.end_index):
                    overlap = True
                    # severity가 더 높으면 기존 것 교체
                    if severity_priority.get(highlight.severity, 0) > severity_priority.get(existing.severity, 0):
                        unique_highlights.remove(existing)
                        unique_highlights.append(highlight)
                    break
            
            if not overlap:
                unique_highlights.append(highlight)
        
        return unique_highlights

