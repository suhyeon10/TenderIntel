"""
Legal Chunker - 법률/계약 문서 전용 청킹
제n조 기준으로 문서를 분할
"""

import re
from typing import List, Dict, Any, Optional
from pathlib import Path
from dataclasses import dataclass


@dataclass
class Section:
    """법률 조항 섹션"""
    title: str  # "제1조 (목적)"
    body: str   # 조항 본문


@dataclass
class LegalChunk:
    """법률 청크"""
    id: Optional[str] = None
    doc_id: Optional[str] = None
    source: Optional[str] = None
    file_path: Optional[str] = None
    section_title: Optional[str] = None
    chunk_index: int = 0
    text: str = ""


class LegalChunker:
    """법률/계약 문서 전용 청커"""
    
    # 조 헤딩 패턴 (제n조, 제 n 조 등 다양한 형식 지원)
    ARTICLE_PATTERN = re.compile(
        r"^제\s*\d+\s*조\b.*",
        re.MULTILINE
    )
    
    # 부칙, 부록 등도 섹션으로 인식
    SUBSECTION_PATTERNS = [
        re.compile(r"^제\s*\d+\s*조", re.MULTILINE),  # 제n조
        re.compile(r"^제\s*\d+\s*장", re.MULTILINE),  # 제n장
        re.compile(r"^제\s*\d+\s*절", re.MULTILINE),  # 제n절
        re.compile(r"^\d+\.\s", re.MULTILINE),        # 1. 2. 3.
        re.compile(r"^\(\d+\)", re.MULTILINE),        # (1) (2) (3)
        re.compile(r"^[가-힣]\.\s", re.MULTILINE),    # 가. 나. 다.
    ]
    
    def __init__(self, max_chars: int = 1200, overlap: int = 200):
        """
        Args:
            max_chars: 최대 청크 크기 (문자 수)
            overlap: 청크 간 오버랩 (문자 수)
        """
        self.max_chars = max_chars
        self.overlap = overlap
    
    def split_by_article(self, text: str) -> List[Section]:
        """
        텍스트를 키워드 기반으로 섹션 분할
        무조건 키워드 기반 분할만 사용 (제n조 패턴 무시)
        줄바꿈이 없어도 작동하도록 개선
        
        Args:
            text: 원본 텍스트
        
        Returns:
            Section 리스트
        """
        if not text or not text.strip():
            return []
        
        sections = []
        
        # 표준근로계약서 형식의 섹션 키워드
        # 줄바꿈이 없어도 작동하도록 공백/줄바꿈 앞뒤로 인식
        # (?:^|\s+) = 텍스트 시작 또는 공백/줄바꿈 앞
        SECTION_KEYWORDS = [
            r'(?:^|\s+)근로계약기간\s+',
            r'(?:^|\s+)근무\s*장소\s+',
            r'(?:^|\s+)업무의\s*내용\s+|(?:^|\s+)업무\s*내용\s+',
            r'(?:^|\s+)소정\s*근로시간\s+|(?:^|\s+)소정근로시간\s+',
            r'(?:^|\s+)휴게시간\s+|(?:^|\s+)휴게\s*시간\s+',
            r'(?:^|\s+)근무일\s+|(?:^|\s+)휴일\s+',
            r'(?:^|\s+)주\s*휴일\s+|(?:^|\s+)주휴일\s+',
            r'(?:^|\s+)임\s*금\s+|(?:^|\s+)임금\s+',
            r'(?:^|\s+)상여금\s+',
            r'(?:^|\s+)기타\s*급여\s+|(?:^|\s+)기타급여\s+',
            r'(?:^|\s+)제수당\s+',
            r'(?:^|\s+)식대\s+',
            r'(?:^|\s+)자기\s*계발비\s+|(?:^|\s+)자기계발비\s+',
            r'(?:^|\s+)임금\s*지급일\s+|(?:^|\s+)임금지급일\s+',
            r'(?:^|\s+)지급\s*방법\s+|(?:^|\s+)지급방법\s+',
            r'(?:^|\s+)특약\s*사항\s+|(?:^|\s+)특약사항\s+',
            r'(?:^|\s+)수습\s*기간\s+|(?:^|\s+)수습기간\s+',
            r'(?:^|\s+)계약\s*해지\s+|(?:^|\s+)계약해지\s+',
            r'(?:^|\s+)연차\s*유급\s*휴가\s+|(?:^|\s+)연차유급휴가\s+',
            r'(?:^|\s+)사회보험\s*적용\s+',
            r'(?:^|\s+)근로계약서\s*교부\s+',
            r'(?:^|\s+)근로계약\s*취업규칙\s+',
            r'(?:^|\s+)기\s*타\s+|(?:^|\s+)기타\s+',
        ]
        
        section_keyword_pattern = re.compile('|'.join(SECTION_KEYWORDS), re.IGNORECASE)
        
        # 줄바꿈이 있으면 줄 단위로, 없으면 전체 텍스트에서 직접 검색
        lines = text.split('\n')
        if len(lines) == 1 or (len(lines) == 2 and not lines[1].strip()):
            # 줄바꿈이 없거나 거의 없는 경우: 전체 텍스트에서 직접 키워드 검색
            keyword_positions = []
            
            # 간단한 키워드 리스트 (공백 무시하고 검색)
            simple_keywords = [
                '근로계약기간', '근무 장소', '근무장소', '업무의 내용', '업무 내용', 
                '소정근로시간', '소정 근로시간', '휴게시간', '휴게 시간',
                '근무일', '휴일', '주휴일', '주 휴일', '임금', '임 금',
                '상여금', '기타급여', '기타 급여', '제수당', '식대',
                '자기계발비', '자기 계발비', '임금지급일', '임금 지급일',
                '지급방법', '지급 방법', '특약사항', '특약 사항',
                '수습기간', '수습 기간', '계약해지', '계약 해지',
                '연차유급휴가', '연차 유급 휴가', '사회보험 적용',
                '근로계약서 교부', '근로계약 취업규칙', '기타'
            ]
            
            # 각 키워드를 텍스트에서 찾기
            for keyword in simple_keywords:
                # 키워드 앞뒤에 공백이 있는지 확인
                pattern = re.compile(r'(?:^|\s+)' + re.escape(keyword) + r'\s+', re.IGNORECASE)
                for match in pattern.finditer(text):
                    # 실제 키워드 시작 위치 (공백 제외)
                    keyword_start = match.start()
                    # 앞의 공백 제거
                    while keyword_start < len(text) and text[keyword_start] in [' ', '\n', '\t']:
                        keyword_start += 1
                    
                    keyword_positions.append({
                        'start': keyword_start,
                        'end': match.end(),
                        'keyword': keyword
                    })
            
            # 위치 순으로 정렬 및 중복 제거
            keyword_positions.sort(key=lambda x: x['start'])
            # 중복 제거 (같은 위치 근처의 키워드)
            unique_positions = []
            last_pos = -10
            for kw_pos in keyword_positions:
                if kw_pos['start'] - last_pos > 5:  # 5자 이상 차이나면 다른 키워드
                    unique_positions.append(kw_pos)
                    last_pos = kw_pos['start']
            keyword_positions = unique_positions
            
            if not keyword_positions:
                # 키워드를 찾지 못하면 전체를 하나의 섹션으로
                sections.append(Section(
                    title="전체",
                    body=text.strip()
                ))
                return sections
            
            # 첫 키워드 이전 내용 처리
            first_kw = keyword_positions[0]
            if first_kw['start'] > 0:
                prev_text = text[:first_kw['start']].strip()
                if prev_text:
                    sections.append(Section(
                        title="전체",
                        body=prev_text
                    ))
            
            # 각 키워드를 기준으로 섹션 분할
            for idx, kw_pos in enumerate(keyword_positions):
                # 다음 키워드 시작 위치
                next_start = keyword_positions[idx + 1]['start'] if idx + 1 < len(keyword_positions) else len(text)
                
                # 키워드 제목 추출
                title_text = kw_pos['keyword']
                
                # 본문은 키워드 다음부터 다음 키워드 전까지
                body_start = kw_pos['end']
                body_end = next_start
                body_text = text[body_start:body_end].strip()
                
                new_section = Section(
                    title=title_text,
                    body=body_text
                )
                sections.append(new_section)
            
            return sections
        
        # 줄바꿈이 있는 경우: 기존 로직 사용
        current_section = None
        current_body = []
        
        for line in lines:
            line_stripped = line.strip()
            if not line_stripped:
                if current_section:
                    current_body.append(line)
                continue
            
            # 섹션 키워드 발견
            if section_keyword_pattern.search(line_stripped):
                # 이전 섹션 저장
                if current_section and current_body:
                    current_section.body = '\n'.join(current_body).strip()
                    if current_section.body:
                        sections.append(current_section)
                
                # 키워드를 포함한 줄을 제목으로
                keyword_match = section_keyword_pattern.search(line_stripped)
                if keyword_match:
                    title_start = keyword_match.start()
                    title_text = line_stripped[title_start:title_start+100].strip()
                    current_section = Section(
                        title=title_text if title_text else line_stripped[:100],
                        body=""
                    )
                else:
                    current_section = Section(
                        title=line_stripped[:100],
                        body=""
                    )
                current_body = []
            else:
                # 본문 추가
                if current_section:
                    current_body.append(line)
                else:
                    # 첫 섹션이 없으면 첫 줄을 제목으로
                    if not current_section:
                        current_section = Section(
                            title="전체",
                            body=""
                        )
                    current_body.append(line)
        
        # 마지막 섹션 저장
        if current_section:
            current_section.body = '\n'.join(current_body).strip()
            if current_section.body:
                sections.append(current_section)
        
        # 섹션이 하나도 없으면 전체를 하나의 섹션으로
        if not sections:
            sections.append(Section(
                title="전체",
                body=text.strip()
            ))
        
        return sections
    
    def chunk_text(self, text: str, max_chars: int = None, overlap: int = None) -> List[str]:
        """
        텍스트를 길이 기준으로 청크 생성 (슬라이딩 윈도우)
        
        Args:
            text: 원본 텍스트
            max_chars: 최대 청크 크기 (기본값: self.max_chars)
            overlap: 오버랩 크기 (기본값: self.overlap)
        
        Returns:
            청크 텍스트 리스트
        """
        if max_chars is None:
            max_chars = self.max_chars
        if overlap is None:
            overlap = self.overlap
        
        if not text or not text.strip():
            return []
        
        text = text.strip()
        
        # 텍스트가 max_chars보다 짧으면 그대로 반환
        if len(text) <= max_chars:
            return [text]
        
        chunks = []
        current_pos = 0
        
        while current_pos < len(text):
            # 청크 끝 위치 계산
            chunk_end = min(current_pos + max_chars, len(text))
            
            # 오버랩을 고려한 시작 위치
            if current_pos > 0:
                chunk_start = max(0, current_pos - overlap)
            else:
                chunk_start = current_pos
            
            # 청크 텍스트 추출
            chunk_text = text[chunk_start:chunk_end]
            
            # 자연스러운 분할을 위해 문장 끝에서 자르기 시도
            if chunk_end < len(text):
                # 마지막 문장 끝 찾기
                last_period = chunk_text.rfind('.')
                last_newline = chunk_text.rfind('\n')
                
                # 문장 끝이나 줄바꿈이 있으면 그 지점에서 자르기
                if last_period > len(chunk_text) * 0.7:  # 청크의 70% 이상에서 찾은 경우만
                    chunk_text = chunk_text[:last_period + 1]
                    chunk_end = chunk_start + len(chunk_text)
                elif last_newline > len(chunk_text) * 0.7:
                    chunk_text = chunk_text[:last_newline]
                    chunk_end = chunk_start + len(chunk_text)
            
            if chunk_text.strip():
                chunks.append(chunk_text.strip())
            
            # 다음 청크 시작 위치
            if chunk_end >= len(text):
                break
            current_pos = chunk_end
        
        return chunks if chunks else [text]
    
    def build_legal_chunks(
        self,
        text: str,
        source_name: str,
        file_path: str,
        doc_id: Optional[str] = None
    ) -> List[LegalChunk]:
        """
        텍스트에서 법률 청크 생성
        
        프로세스:
        1. split_by_article로 섹션 분할
        2. 각 섹션의 body에 chunk_text 적용
        3. LegalChunk 리스트 반환
        
        Args:
            text: 원본 텍스트
            source_name: 출처 (예: "moel", "mss", "mcst")
            file_path: 파일 경로
            doc_id: 문서 ID (선택)
        
        Returns:
            LegalChunk 리스트
        """
        chunks = []
        
        # 1. 섹션 분할
        sections = self.split_by_article(text)
        
        if not sections:
            # 섹션이 없으면 전체를 하나의 청크로
            section_chunks = self.chunk_text(text)
            for i, chunk_text in enumerate(section_chunks):
                chunks.append(LegalChunk(
                    doc_id=doc_id,
                    source=source_name,
                    file_path=file_path,
                    section_title="전체",
                    chunk_index=i,
                    text=chunk_text
                ))
            return chunks
        
        # 2. 각 섹션을 청크로 분할
        global_chunk_index = 0
        for section in sections:
            section_chunks = self.chunk_text(section.body)
            
            for i, chunk_text in enumerate(section_chunks):
                chunks.append(LegalChunk(
                    doc_id=doc_id,
                    source=source_name,
                    file_path=file_path,
                    section_title=section.title,
                    chunk_index=global_chunk_index,
                    text=chunk_text
                ))
                global_chunk_index += 1
        
        return chunks


def extract_doc_type_from_path(file_path: str) -> str:
    """
    파일 경로에서 문서 타입 추출
    
    Args:
        file_path: 파일 경로
    
    Returns:
        문서 타입 ("law", "standard_contract", "manual", "case")
    """
    path_lower = file_path.lower()
    
    if "laws" in path_lower or "법" in path_lower:
        return "law"
    elif "standard_contracts" in path_lower or "계약" in path_lower or "contract" in path_lower:
        return "standard_contract"
    elif "manuals" in path_lower or "매뉴얼" in path_lower or "manual" in path_lower:
        return "manual"
    elif "cases" in path_lower or "케이스" in path_lower or "case" in path_lower:
        return "case"
    else:
        return "law"  # 기본값

