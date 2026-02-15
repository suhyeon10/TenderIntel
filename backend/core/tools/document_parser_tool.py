"""
DocumentParserTool - 문서 파싱 도구
OCR, 조항 단위 청킹, 조항 번호/패턴 분석
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from pathlib import Path
import uuid
import logging

from .base_tool import BaseTool
from ..document_processor_v2 import DocumentProcessor
from ..legal_chunker import LegalChunker, Section

logger = logging.getLogger(__name__)


@dataclass
class Provision:
    """계약서 조항"""
    id: str
    title: str  # "제1조 (목적)"
    content: str  # 조항 본문
    article_number: Optional[int] = None  # 조 번호
    start_index: int = 0  # 원문에서 시작 위치
    end_index: int = 0  # 원문에서 종료 위치
    category: Optional[str] = None  # "working_hours", "wage" 등


@dataclass
class Chunk:
    """청크 모델"""
    index: int
    content: str
    metadata: Dict[str, Any]


class DocumentParserTool(BaseTool):
    """문서 파싱 도구 - OCR, 조항 단위 청킹, 패턴 분석"""
    
    def __init__(self):
        """도구 초기화"""
        self.processor = DocumentProcessor()
        self.chunker = LegalChunker(max_chars=1200, overlap=200)
    
    @property
    def name(self) -> str:
        return "DocumentParserTool"
    
    @property
    def description(self) -> str:
        return "문서에서 텍스트 추출 및 구조화 (OCR, 조항 단위 청킹, 패턴 분석)"
    
    async def execute(
        self,
        file_path: str,
        file_type: Optional[str] = None,
        extract_provisions: bool = True,
        **kwargs
    ) -> Dict[str, Any]:
        """
        문서 파싱 실행
        
        Args:
            file_path: 파일 경로
            file_type: 파일 타입 (pdf, hwp, hwpx, html, txt) - None이면 자동 감지
            extract_provisions: 조항 추출 여부 (기본값: True)
            **kwargs: 추가 옵션
        
        Returns:
            {
                "extracted_text": str,
                "chunks": List[Chunk],
                "provisions": List[Provision],
                "metadata": {
                    "file_type": str,
                    "page_count": int,
                    "total_chars": int,
                    "provision_count": int,
                    "doc_id": str
                }
            }
        """
        self.log_execution(file_path=file_path, file_type=file_type)
        
        # 입력 검증
        self.validate_input(["file_path"], file_path=file_path)
        
        # 파일 존재 확인
        if not Path(file_path).exists():
            raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")
        
        try:
            # 1. 텍스트 추출
            extracted_text, chunks = self.processor.process_file(
                file_path=file_path,
                file_type=file_type
            )
            
            # 2. 조항 추출 (선택적)
            provisions = []
            if extract_provisions:
                provisions = self._extract_provisions(extracted_text)
            
            # 3. 청크 변환
            chunk_objects = self._convert_chunks(chunks)
            
            # 4. 메타데이터 생성
            doc_id = str(uuid.uuid4())
            metadata = {
                "file_type": file_type or Path(file_path).suffix.lower().lstrip('.'),
                "page_count": self._estimate_page_count(extracted_text),
                "total_chars": len(extracted_text),
                "provision_count": len(provisions),
                "doc_id": doc_id,
                "file_path": file_path,
                "file_name": Path(file_path).name
            }
            
            result = {
                "extracted_text": extracted_text,
                "chunks": [
                    {
                        "index": chunk.index,
                        "content": chunk.content,
                        "metadata": chunk.metadata
                    }
                    for chunk in chunk_objects
                ],
                "provisions": [
                    {
                        "id": prov.id,
                        "title": prov.title,
                        "content": prov.content,
                        "article_number": prov.article_number,
                        "start_index": prov.start_index,
                        "end_index": prov.end_index,
                        "category": prov.category
                    }
                    for prov in provisions
                ],
                "metadata": metadata
            }
            
            self.log_result(result)
            return result
            
        except Exception as e:
            logger.error(f"[{self.name}] 실행 실패: {str(e)}", exc_info=True)
            raise
    
    def _extract_provisions(self, text: str) -> List[Provision]:
        """
        조항 추출 (제n조 기준)
        
        Args:
            text: 원본 텍스트
        
        Returns:
            Provision 리스트
        """
        sections = self.chunker.split_by_article(text)
        provisions = []
        
        for i, section in enumerate(sections):
            # 조 번호 추출
            article_number = self._extract_article_number(section.title)
            
            # 원문에서 위치 찾기
            start_index = text.find(section.title)
            end_index = start_index + len(section.body) if start_index >= 0 else 0
            
            # 카테고리 추정 (간단한 키워드 기반)
            category = self._infer_category(section.title, section.body)
            
            provision = Provision(
                id=f"provision-{i+1}",
                title=section.title,
                content=section.body,
                article_number=article_number,
                start_index=start_index if start_index >= 0 else 0,
                end_index=end_index,
                category=category
            )
            provisions.append(provision)
        
        return provisions
    
    def _extract_article_number(self, title: str) -> Optional[int]:
        """조 번호 추출"""
        import re
        match = re.search(r'제\s*(\d+)\s*조', title)
        if match:
            return int(match.group(1))
        return None
    
    def _infer_category(self, title: str, content: str) -> Optional[str]:
        """카테고리 추정 (키워드 기반)"""
        text = (title + " " + content).lower()
        
        # 키워드 매핑
        category_keywords = {
            "working_hours": ["근로시간", "근무시간", "야근", "연장근로", "휴게시간"],
            "wage": ["임금", "급여", "수당", "보너스", "상여금"],
            "probation_termination": ["수습", "인턴", "해고", "계약해지", "퇴직"],
            "stock_option_ip": ["스톡옵션", "지분", "지적재산권", "저작권", "특허"]
        }
        
        for category, keywords in category_keywords.items():
            if any(keyword in text for keyword in keywords):
                return category
        
        return None
    
    def _convert_chunks(self, chunks: List) -> List[Chunk]:
        """DocumentProcessor의 청크를 Chunk 객체로 변환"""
        chunk_objects = []
        for i, chunk in enumerate(chunks):
            if hasattr(chunk, 'page_content'):
                content = chunk.page_content
                metadata = getattr(chunk, 'metadata', {})
            else:
                content = str(chunk)
                metadata = {}
            
            chunk_objects.append(Chunk(
                index=i,
                content=content,
                metadata=metadata
            ))
        
        return chunk_objects
    
    def _estimate_page_count(self, text: str) -> int:
        """페이지 수 추정 (대략적)"""
        # 평균 페이지당 2000자 가정
        return max(1, len(text) // 2000)
    
    # 편의 메서드
    async def parse(self, file_path: str, file_type: Optional[str] = None) -> Dict[str, Any]:
        """parse 메서드 (execute의 별칭)"""
        return await self.execute(file_path=file_path, file_type=file_type)

