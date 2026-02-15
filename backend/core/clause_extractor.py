"""
Clause Extractor - 계약서에서 canonical clause 리스트 추출
LegalChunker 결과를 클라이언트/LLM/DB에서 공통으로 사용하는 형식으로 변환
"""

from typing import List, Dict
import logging
from .legal_chunker import LegalChunker

logger = logging.getLogger(__name__)


def extract_clauses(contract_text: str) -> List[Dict]:
    """
    contract_analyses.clauses에 들어갈 canonical clause 리스트 생성
    
    Args:
        contract_text: 계약서 원문 텍스트
    
    Returns:
        List[Dict]: clause 리스트
        [
            {
                "id": "clause-1",
                "title": "제1조 (목적)",
                "content": "조항 본문...",
                "articleNumber": 1,
                "startIndex": 0,
                "endIndex": 150,
                "category": None,  # LLM 라벨링 이후 채움
            }
        ]
    """
    if not contract_text or not contract_text.strip():
        logger.warning("[clause_extractor] contract_text가 비어있습니다.")
        return []
    
    chunker = LegalChunker()
    sections = chunker.split_by_article(contract_text)
    
    logger.info(f"[clause_extractor] LegalChunker로 {len(sections)}개 섹션 추출됨")
    
    clauses: List[Dict] = []
    offset = 0
    
    for idx, section in enumerate(sections, start=1):
        body = (section.body or "").strip()
        if not body:
            continue
        
        # startIndex / endIndex 계산
        # 1. 정확한 매칭 시도 (offset 이후부터)
        start_idx = contract_text.find(body, offset)
        
        # 2. 정확히 못 찾으면 공백 정규화해서 검색
        if start_idx == -1:
            # body의 공백을 정규화 (연속 공백을 하나로)
            import re
            body_normalized = re.sub(r'\s+', ' ', body.strip())
            contract_normalized = re.sub(r'\s+', ' ', contract_text[offset:])
            normalized_start = contract_normalized.find(body_normalized)
            if normalized_start >= 0:
                # 원본 텍스트에서 실제 위치 찾기
                # offset 이후의 정규화된 텍스트에서 찾았으므로, 원본에서도 찾기
                search_text = contract_text[offset:]
                # 부분 매칭으로 찾기
                for i in range(len(search_text) - len(body_normalized) + 1):
                    if re.sub(r'\s+', ' ', search_text[i:i+len(body_normalized)]) == body_normalized:
                        start_idx = offset + i
                        break
        
        # 3. 그래도 못 찾으면 앞부분에서 검색 (body의 앞 100자)
        if start_idx == -1:
            search_body = body[:100] if len(body) > 100 else body
            start_idx = contract_text.find(search_body, offset)
            if start_idx == -1:
                # 전체 텍스트에서 검색
                start_idx = contract_text.find(search_body)
        
        # 4. 그래도 못 찾으면 offset 위치 사용
        if start_idx == -1:
            start_idx = offset
            logger.warning(f"[clause_extractor] clause-{idx} '{section.title[:30]}'의 본문을 찾지 못해 offset 위치({offset}) 사용")
        
        # endIndex 계산: body의 실제 길이 사용
        end_idx = start_idx + len(body)
        
        # 다음 검색 시작 위치 업데이트 (겹치지 않도록)
        offset = max(end_idx, offset + 1)
        
        # article_number 추출 (제목에서 숫자 추출)
        article_number = idx
        import re
        article_match = re.search(r'제\s*(\d+)\s*조', section.title)
        if article_match:
            article_number = int(article_match.group(1))
        
        clause = {
            "id": f"clause-{idx}",
            "title": section.title,
            "content": body,
            "articleNumber": article_number,
            "startIndex": start_idx,
            "endIndex": end_idx,
            "category": None,  # LLM 라벨링 이후 채움
        }
        
        clauses.append(clause)
        logger.debug(f"[clause_extractor] clause 추출: id={clause['id']}, title={clause['title'][:30]}, start={start_idx}, end={end_idx}")
    
    # 아무 것도 못 뽑았으면 전체를 하나로
    if not clauses and contract_text.strip():
        logger.warning("[clause_extractor] 조항을 추출하지 못해 전체를 하나의 clause로 생성합니다.")
        clauses.append({
            "id": "clause-1",
            "title": "전체",
            "content": contract_text.strip(),
            "articleNumber": 1,
            "startIndex": 0,
            "endIndex": len(contract_text),
            "category": None,
        })
    
    logger.info(f"[clause_extractor] 총 {len(clauses)}개 clause 추출 완료")
    return clauses

