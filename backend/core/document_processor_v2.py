"""
DocumentProcessor v2 - 실전형
PDF → Text → Chunks 변환
"""

from typing import List, Dict, Any
import re
import os
from pathlib import Path
from pydantic import BaseModel

# langchain_text_splitters는 scipy/nltk 의존성으로 Windows에서 매우 느리므로
# 기본적으로 SimpleTextSplitter를 사용하고, 필요시에만 lazy import
LANGCHAIN_SPLITTER_AVAILABLE = False
RecursiveCharacterTextSplitter = None


class Chunk(BaseModel):
    """청크 모델"""
    index: int
    content: str
    metadata: Dict[str, Any]


class SimpleDocument:
    """간단한 문서 클래스 (LangChain Document 호환)"""
    def __init__(self, page_content: str, metadata: Dict[str, Any]):
        self.page_content = page_content
        self.metadata = metadata


class SimpleTextSplitter:
    """간단한 텍스트 분할기 (langchain_text_splitters 대체용)"""
    
    def __init__(self, chunk_size: int = 1000, chunk_overlap: int = 200, separators: List[str] = None):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = separators or ["\n\n", "\n", ". ", " ", ""]
    
    def create_documents(self, texts: List[str], metadatas: List[Dict[str, Any]] = None) -> List[SimpleDocument]:
        """텍스트 리스트를 문서 리스트로 변환"""
        if metadatas is None:
            metadatas = [{}] * len(texts)
        
        documents = []
        for text, metadata in zip(texts, metadatas):
            chunks = self._split_text(text)
            for i, chunk_text in enumerate(chunks):
                doc = SimpleDocument(
                    page_content=chunk_text,
                    metadata={**metadata, 'chunk_index': i}
                )
                documents.append(doc)
        
        return documents
    
    def _split_text(self, text: str) -> List[str]:
        """텍스트를 청크로 분할"""
        if not text:
            return []
        
        chunks = []
        current_pos = 0
        
        while current_pos < len(text):
            # 청크 크기 계산
            chunk_end = min(current_pos + self.chunk_size, len(text))
            
            # 오버랩을 고려한 시작 위치
            if current_pos > 0:
                chunk_start = max(0, current_pos - self.chunk_overlap)
            else:
                chunk_start = current_pos
            
            # 청크 텍스트 추출
            chunk_text = text[chunk_start:chunk_end]
            
            # 구분자를 사용하여 자연스러운 분할 시도
            if chunk_end < len(text):
                # 다음 구분자 찾기
                best_split = -1
                best_sep_len = 0
                for sep in self.separators:
                    if sep:
                        last_sep = chunk_text.rfind(sep)
                        if last_sep > len(chunk_text) * 0.5:  # 청크의 절반 이상에서 찾은 경우만
                            if last_sep > best_split:
                                best_split = last_sep
                                best_sep_len = len(sep)
                
                if best_split > 0:
                    chunk_text = chunk_text[:best_split + best_sep_len]
                    chunk_end = chunk_start + len(chunk_text)
            
            if chunk_text.strip():
                chunks.append(chunk_text.strip())
            
            # 다음 청크 시작 위치
            if chunk_end >= len(text):
                break
            current_pos = chunk_end
        
        return chunks if chunks else [text]


class ContractArticleSplitter:
    """계약서 조항 단위 분할기 (제n조 패턴 + 번호 기반 헤더 패턴)"""
    
    # 조항 패턴: "제1조", "제 1 조", "제1조 (제목)" 등 다양한 형식 지원
    ARTICLE_PATTERN = re.compile(
        r'(제\s*\d+\s*조(?:\s*\([^)]+\))?[^\n]*)'  # 조항 헤더 (제1조 (제목))
        r'([\s\S]*?)'  # 조항 본문
        r'(?=제\s*\d+\s*조|$)',  # 다음 조항 또는 끝까지
        re.MULTILINE
    )
    
    # ✅ 새로 추가: "1. 근로계약기간 :" 같은 한 줄 헤더 패턴
    NUMBERED_HEADER_PATTERN = re.compile(
        r'^\s*(\d{1,2})\.\s*'          # 1. / 10.
        r'([가-힣A-Za-z0-9\s·]+?)'     # 제목 (근로계약기간, 임 금 등)
        r'\s*[:：]?\s*(.*)$',          # 같은 줄에 이어지는 본문 (있어도 되고 없어도 됨)
        re.MULTILINE
    )
    
    def __init__(self, max_article_length: int = 2000):
        """
        Args:
            max_article_length: 조항이 이 길이를 초과하면 문단으로 추가 분할
        """
        self.max_article_length = max_article_length
        self.paragraph_splitter = ArticleParagraphSplitter()
    
    def split_contract_by_articles(self, text: str) -> List[Dict[str, Any]]:
        """
        계약서를 조항 단위로 분할
        
        Returns:
            [{
                "content": str,
                "article_number": int,
                "article_header": str,
                "chunk_index": int,
                "type": "article" | "paragraph",
                "paragraph_index": int (optional)
            }]
        """
        chunks = []
        text = text.strip()
        
        # 1️⃣ 먼저 "제n조" 패턴 시도
        matches = list(self.ARTICLE_PATTERN.finditer(text))
        
        if matches:
            for idx, match in enumerate(matches):
                header = match.group(1).strip()
                body = match.group(2).strip()
                full_content = f"{header}\n{body}".strip()
                
                # 조항 번호 추출
                article_num_match = re.search(r'제\s*(\d+)\s*조', header)
                article_number = int(article_num_match.group(1)) if article_num_match else idx + 1
                
                # 조항이 너무 길면 문단으로 분할
                if len(full_content) > self.max_article_length:
                    paragraph_chunks = self.paragraph_splitter.split_article_into_paragraphs(
                        full_content, article_number
                    )
                    chunks.extend(paragraph_chunks)
                else:
                    chunks.append({
                        "content": full_content,
                        "article_number": article_number,
                        "article_header": header,
                        "chunk_index": idx,
                        "type": "article"
                    })
            
            return chunks
        
        # 2️⃣ "제n조"가 전혀 없으면 "1. 근로계약기간" 형식으로 분할
        numbered_chunks = self._split_by_numbered_headers(text)
        if numbered_chunks:
            return numbered_chunks
        
        # 3️⃣ 그래도 못 찾으면 전체를 하나의 청크로
        return [{
            "content": text,
            "article_number": 0,
            "article_header": "",
            "chunk_index": 0,
            "type": "article"
        }]
    
    def _split_by_numbered_headers(self, text: str) -> List[Dict[str, Any]]:
        """
        '1. 근로계약기간 :' 형식 번호 기반 헤더로 조항 분할
        """
        lines = text.splitlines()
        clauses: List[Dict[str, Any]] = []
        
        current_header: str | None = None
        current_number: int | None = None
        current_body_lines: List[str] = []
        chunk_index = 0
        
        for line in lines:
            line = line.strip()
            if not line:
                # 빈 줄은 본문에 그냥 붙인다
                if current_header is not None:
                    current_body_lines.append("")
                continue
            
            m = self.NUMBERED_HEADER_PATTERN.match(line)
            
            if m:
                # 이전 조항 flush
                if current_header is not None:
                    full_content = (current_header + "\n" + "\n".join(current_body_lines)).strip()
                    if len(full_content) > self.max_article_length:
                        paragraph_chunks = self.paragraph_splitter.split_article_into_paragraphs(
                            full_content,
                            current_number or 0
                        )
                        # paragraph_chunks 안의 chunk_index 는 내부에서 다시 매김
                        for pc in paragraph_chunks:
                            pc.setdefault("article_header", current_header)
                        clauses.extend(paragraph_chunks)
                    else:
                        clauses.append({
                            "content": full_content,
                            "article_number": current_number or 0,
                            "article_header": current_header,
                            "chunk_index": chunk_index,
                            "type": "article"
                        })
                        chunk_index += 1
                
                # 새 헤더 시작
                number = int(m.group(1))
                title = m.group(2).strip()
                same_line_body = m.group(3).strip()
                
                current_header = f"{number}. {title}"
                current_number = number
                current_body_lines = []
                if same_line_body:
                    current_body_lines.append(same_line_body)
            else:
                # 헤더가 열린 상태에서만 본문으로 추가
                if current_header is not None:
                    current_body_lines.append(line)
                else:
                    # 앞부분 인사말/머리말 등은 article_number=0 번으로 모으고 싶으면 여기 별도 처리
                    continue
        
        # 마지막 조항 flush
        if current_header is not None:
            full_content = (current_header + "\n" + "\n".join(current_body_lines)).strip()
            if len(full_content) > self.max_article_length:
                paragraph_chunks = self.paragraph_splitter.split_article_into_paragraphs(
                    full_content,
                    current_number or 0
                )
                for pc in paragraph_chunks:
                    pc.setdefault("article_header", current_header)
                clauses.extend(paragraph_chunks)
            else:
                clauses.append({
                    "content": full_content,
                    "article_number": current_number or 0,
                    "article_header": current_header,
                    "chunk_index": chunk_index,
                    "type": "article"
                })
        
        return clauses
    
    @staticmethod
    def extract_article_number(header: str) -> int:
        """조항 헤더에서 조항 번호 추출"""
        # 제n조 패턴 시도
        match = re.search(r'제\s*(\d+)\s*조', header)
        if match:
            return int(match.group(1))
        
        # 번호. 제목 패턴 시도
        match = re.search(r'^(\d{1,2})\.', header)
        if match:
            return int(match.group(1))
        
        return 0


class ArticleParagraphSplitter:
    """조항 내부 문단 분할기"""
    
    # 문단 구분자: \n\n, ①, ②, 1., 2. 등
    PARAGRAPH_PATTERNS = [
        r'\n\s*\n',  # 빈 줄
        r'[①-⑳]',  # 원문자
        r'\d+[\.\)]\s+',  # 번호 (1. 또는 1))
        r'[가-힣][\.\)]\s+',  # 한글 번호 (가. 또는 가))
    ]
    
    def __init__(self, chunk_size: int = None, chunk_overlap: int = None):
        self.chunk_size = chunk_size or int(os.getenv("CHUNK_SIZE", "1500"))
        self.chunk_overlap = chunk_overlap or int(os.getenv("CHUNK_OVERLAP", "300"))
    
    def split_article_into_paragraphs(
        self, 
        article_text: str, 
        article_number: int
    ) -> List[Dict[str, Any]]:
        """
        조항을 문단 단위로 분할
        
        Args:
            article_text: 조항 전체 텍스트
            article_number: 조항 번호
        
        Returns:
            [{
                "content": str,
                "article_number": int,
                "paragraph_index": int,
                "chunk_index": int,
                "type": "paragraph"
            }]
        """
        chunks = []
        
        # 먼저 \n\n으로 문단 분할 시도
        paragraphs = re.split(r'\n\s*\n+', article_text)
        
        # 각 문단이 여전히 길면 번호 패턴으로 추가 분할
        all_paragraphs = []
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            
            # 번호 패턴으로 분할 시도
            numbered_parts = self._split_by_numbered_patterns(para)
            all_paragraphs.extend(numbered_parts)
        
        # 문단이 없으면 전체를 하나로
        if not all_paragraphs:
            all_paragraphs = [article_text]
        
        # 각 문단을 청크로 변환
        for p_idx, paragraph in enumerate(all_paragraphs):
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            
            # 문단이 너무 길면 chunk_size로 강제 분할
            if len(paragraph) > self.chunk_size:
                sub_chunks = self._split_long_paragraph(paragraph, article_number, p_idx)
                chunks.extend(sub_chunks)
            else:
                chunks.append({
                    "content": paragraph,
                    "article_number": article_number,
                    "paragraph_index": p_idx,
                    "chunk_index": len(chunks),
                    "type": "paragraph"
                })
        
        return chunks
    
    def _split_by_numbered_patterns(self, text: str) -> List[str]:
        """번호 패턴으로 텍스트 분할"""
        # 원문자 패턴으로 분할
        parts = re.split(r'([①-⑳])', text)
        if len(parts) > 1:
            # 원문자와 함께 재결합
            result = []
            for i in range(0, len(parts) - 1, 2):
                if i + 1 < len(parts):
                    result.append(parts[i] + parts[i + 1] + (parts[i + 2] if i + 2 < len(parts) else ""))
            if result:
                return [p.strip() for p in result if p.strip()]
        
        # 숫자 번호 패턴으로 분할
        parts = re.split(r'(\d+[\.\)]\s+)', text)
        if len(parts) > 1:
            result = []
            for i in range(0, len(parts) - 1, 2):
                if i + 1 < len(parts):
                    result.append(parts[i] + parts[i + 1] + (parts[i + 2] if i + 2 < len(parts) else ""))
            if result:
                return [p.strip() for p in result if p.strip()]
        
        return [text]
    
    def _split_long_paragraph(
        self, 
        paragraph: str, 
        article_number: int, 
        paragraph_index: int
    ) -> List[Dict[str, Any]]:
        """긴 문단을 chunk_size 단위로 분할"""
        chunks = []
        current_pos = 0
        chunk_idx = 0
        
        while current_pos < len(paragraph):
            chunk_end = min(current_pos + self.chunk_size, len(paragraph))
            
            # 문장 끝에서 분할 시도
            if chunk_end < len(paragraph):
                # 마지막 문장 끝 찾기
                last_period = paragraph.rfind('.', current_pos, chunk_end)
                last_newline = paragraph.rfind('\n', current_pos, chunk_end)
                split_pos = max(last_period, last_newline)
                
                if split_pos > current_pos + self.chunk_size * 0.5:
                    chunk_end = split_pos + 1
            
            chunk_text = paragraph[current_pos:chunk_end].strip()
            if chunk_text:
                chunks.append({
                    "content": chunk_text,
                    "article_number": article_number,
                    "paragraph_index": paragraph_index,
                    "chunk_index": chunk_idx,
                    "type": "paragraph",
                    "sub_chunk": True
                })
                chunk_idx += 1
            
            # 오버랩 고려
            current_pos = max(current_pos + self.chunk_size - self.chunk_overlap, chunk_end)
            if current_pos >= len(paragraph):
                break
        
        return chunks


class DocumentProcessor:
    """문서 처리기 - PDF/텍스트 → 청크"""
    
    def __init__(self, chunk_size: int = None, chunk_overlap: int = None, verbose: bool = True):
        self.chunk_size = (
            int(os.getenv("CHUNK_SIZE", "1000")) 
            if chunk_size is None 
            else chunk_size
        )
        self.chunk_overlap = (
            int(os.getenv("CHUNK_OVERLAP", "200")) 
            if chunk_overlap is None 
            else chunk_overlap
        )
        self.verbose = verbose
        
        # 기본적으로 SimpleTextSplitter 사용 (Windows에서 scipy/nltk 로딩이 매우 느림)
        # langchain_text_splitters는 필요시에만 lazy import
        self.splitter = SimpleTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap
        )
        
        # 계약서 조항 단위 분할기
        self.contract_splitter = ContractArticleSplitter(
            max_article_length=int(os.getenv("CONTRACT_MAX_ARTICLE_LENGTH", "2000"))
        )
    
    def _log(self, msg: str):
        """verbose 모드일 때만 로그 출력"""
        if self.verbose:
            # Windows에서 이모티콘 인코딩 오류 방지
            import sys
            if sys.platform == "win32":
                # 이모티콘을 ASCII 문자로 대체
                safe_msg = msg.replace('⚠️', '[경고]').replace('✅', '[완료]')
                try:
                    print(safe_msg)
                except UnicodeEncodeError:
                    # 인코딩 오류 발생 시 errors='replace' 사용
                    print(safe_msg.encode('utf-8', errors='replace').decode('utf-8', errors='replace'))
            else:
                print(msg)
    
    def pdf_to_text(
        self, 
        pdf_path: str, 
        force_ocr: bool = False,          # 무조건 OCR만 쓰고 싶을 때
        prefer_ocr: bool = False          # 텍스트 추출 성공해도 OCR 품질을 우선할 때
    ) -> str:
        """
        PDF → 텍스트 추출 (텍스트 기반 → OCR 순서로 시도)
        
        Args:
            pdf_path: PDF 파일 경로
            force_ocr: True면 무조건 OCR만 사용
            prefer_ocr: True면 텍스트 추출 성공해도 OCR 품질을 우선
        
        Returns:
            추출된 텍스트
        """
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF 파일을 찾을 수 없습니다: {pdf_path}")
        
        error_messages: List[str] = []
        text = ""
        
        # 1) force_ocr면 바로 OCR
        if force_ocr:
            self._log("[PDF 처리] force_ocr=True → OCR만 사용")
            text = self._extract_with_ocr(pdf_path, error_messages)
        else:
            # 2) 텍스트 기반 추출 순차 시도
            for extractor in (
                self._extract_with_pymupdf, 
                self._extract_with_pdfplumber, 
                self._extract_with_pypdf
            ):
                text = extractor(pdf_path, error_messages)
                if text and text.strip():
                    # 이미지 기반 PDF 감지: 텍스트가 너무 짧거나 의미있는 내용이 없는 경우
                    text_stripped = text.strip()
                    
                    # 감지 조건:
                    # 1. 텍스트가 50자 미만
                    # 2. 숫자가 전혀 없음
                    # 3. 한글이 전혀 없고 영어도 거의 없음 (이미지 기반일 가능성)
                    has_digits = self._has_digits(text_stripped, min_count=1)
                    has_korean = any('가' <= ch <= '힣' for ch in text_stripped)
                    has_english = sum(1 for ch in text_stripped if ch.isalpha() and ord(ch) < 128) > 10
                    
                    is_likely_image_based = (
                        len(text_stripped) < 50 or 
                        (not has_digits and not has_korean and not has_english)
                    )
                    
                    if is_likely_image_based:
                        self._log("[PDF 처리] 이미지 기반 PDF로 감지됨 (텍스트 추출 결과가 너무 짧거나 의미없음) → OCR로 전환")
                        text = ""
                        continue
                    break
            
            # 3) prefer_ocr=True 이거나, 위 방법들로 실패한 경우 OCR 시도
            if prefer_ocr or not text:
                if not text:
                    self._log("[PDF 처리] 텍스트 추출 실패 → OCR로 자동 전환")
                else:
                    self._log("[PDF 처리] prefer_ocr=True → OCR 품질 우선 사용")
                
                ocr_text = self._extract_with_ocr(pdf_path, error_messages)
                # OCR이 훨씬 길거나 숫자가 풍부하면 그쪽을 채택
                if ocr_text:
                    if not text or len(ocr_text) > len(text) * 1.2:  # OCR이 20% 이상 길면
                        self._log("[PDF 처리] OCR 결과가 더 우수하여 OCR 텍스트 채택")
                        text = ocr_text
                    elif self._has_digits(ocr_text, min_count=5) and not self._has_digits(text, min_count=5):
                        # OCR에 숫자가 더 많으면 OCR 채택
                        self._log("[PDF 처리] OCR 결과에 숫자가 더 많아 OCR 텍스트 채택")
                        text = ocr_text
        
        # 정제
        if text:
            text = self._clean_text(text)
        
        # 최종 검증
        if not text or not text.strip():
            error_msg = "PDF 파일에서 텍스트를 추출할 수 없습니다.\n"
            if error_messages:
                error_msg += "시도한 방법:\n"
                for msg in error_messages:
                    error_msg += f"  - {msg}\n"
            error_msg += "\n[해결 방법]\n"
            error_msg += "1. OCR 설치: pip install pytesseract pdf2image\n"
            error_msg += "2. Tesseract OCR 엔진 설치: https://github.com/tesseract-ocr/tesseract\n"
            error_msg += "3. Poppler 설치 (Windows): https://github.com/oschwartz10612/poppler-windows/releases\n"
            raise ValueError(error_msg)

        return text

    def _has_digits(self, text: str, min_count: int = 1) -> bool:
        """텍스트에 최소 개수의 숫자가 포함되어 있는지 확인"""
        if not text:
            return False
        return sum(ch.isdigit() for ch in text) >= min_count

    def _extract_with_pymupdf(self, pdf_path: str, error_messages: List[str]) -> str:
        """PyMuPDF 기반 텍스트 추출 (일반 텍스트 위주, 숫자까지 집착하지 않음)"""
        try:
            import fitz  # PyMuPDF
        except ImportError:
            msg = "PyMuPDF가 설치되지 않았습니다 (pip install pymupdf)"
            self._log(f"[PDF 처리] {msg}")
            error_messages.append(msg)
            return ""

        try:
            doc = fitz.open(pdf_path)
        except Exception as e:
            msg = f"PyMuPDF로 PDF를 여는 데 실패했습니다: {e}"
            self._log(f"[PDF 처리] {msg}")
            error_messages.append(msg)
            return ""

        pages: List[str] = []
        self._log(f"[PDF 처리] PyMuPDF로 시도 중... (파일: {os.path.basename(pdf_path)})")

        for i, page in enumerate(doc):
            try:
                page_text = page.get_text("text") or ""
            except Exception:
                try:
                    page_text = page.get_text() or ""
                except Exception:
                    page_text = ""

            if page_text.strip():
                pages.append(page_text)
                self._log(f"[PDF 처리] PyMuPDF 페이지 {i + 1}: {len(page_text)}자 추출")

        doc.close()

        if pages:
            text = "\n".join(pages)
            digit_count = sum(ch.isdigit() for ch in text)
            if digit_count > 0:
                self._log(f"[PDF 처리] PyMuPDF 성공: {len(pages)}페이지, 총 {len(text)}자, 숫자 {digit_count}개 포함")
            else:
                self._log(f"[PDF 처리] PyMuPDF 성공: {len(pages)}페이지, 총 {len(text)}자 ([경고] 숫자 없음)")
            return text

        msg = "PyMuPDF: 텍스트를 추출할 수 없습니다 (이미지 기반 PDF일 수 있음)"
        self._log(f"[PDF 처리] {msg}")
        error_messages.append(msg)
        return ""

    def _extract_with_pdfplumber(self, pdf_path: str, error_messages: List[str]) -> str:
        """pdfplumber 기반 텍스트 추출 (표·숫자에 비교적 강함)"""
        try:
            import pdfplumber
        except ImportError:
            msg = "pdfplumber가 설치되지 않았습니다 (pip install pdfplumber)"
            self._log(f"[PDF 처리] {msg}")
            error_messages.append(msg)
            return ""

        try:
            self._log("[PDF 처리] pdfplumber로 시도 중...")
            text_parts: List[str] = []
            with pdfplumber.open(pdf_path) as pdf:
                for i, page in enumerate(pdf.pages):
                    page_text = page.extract_text() or ""
                    if page_text.strip():
                        text_parts.append(page_text)
                        digit_count = sum(ch.isdigit() for ch in page_text)
                        self._log(f"[PDF 처리] pdfplumber 페이지 {i + 1}: {len(page_text)}자, 숫자 {digit_count}개")
            
            if text_parts:
                text = "\n".join(text_parts)
                digit_count = sum(ch.isdigit() for ch in text)
                if digit_count > 0:
                    self._log(f"[PDF 처리] pdfplumber 성공: {len(text_parts)}페이지, 총 {len(text)}자, 숫자 {digit_count}개 포함")
                else:
                    self._log(f"[PDF 처리] pdfplumber 성공: {len(text_parts)}페이지, 총 {len(text)}자 ([경고] 숫자 없음)")
                return text

            msg = "pdfplumber: 텍스트를 추출할 수 없습니다"
            self._log(f"[PDF 처리] {msg}")
            error_messages.append(msg)
            return ""
        except Exception as e:
            msg = f"pdfplumber 실패: {e}"
            self._log(f"[PDF 처리] {msg}")
            error_messages.append(msg)
            return ""

    def _extract_with_pypdf(self, pdf_path: str, error_messages: List[str]) -> str:
        """pypdf 기반 텍스트 추출 (마지막 텍스트 기반 fallback)"""
        try:
            from pypdf import PdfReader
        except ImportError:
            msg = "pypdf가 설치되지 않았습니다 (pip install pypdf)"
            self._log(f"[PDF 처리] {msg}")
            error_messages.append(msg)
            return ""

        try:
            self._log("[PDF 처리] pypdf로 시도 중...")
            reader = PdfReader(pdf_path)
            pages: List[str] = []

            for i, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                if page_text.strip():
                    pages.append(page_text)
                    self._log(f"[PDF 처리] pypdf 페이지 {i + 1}: {len(page_text)}자 추출")

            if pages:
                text = "\n".join(pages)
                digit_count = sum(ch.isdigit() for ch in text)
                if digit_count > 0:
                    self._log(f"[PDF 처리] pypdf 성공: {len(pages)}페이지, 총 {len(text)}자, 숫자 {digit_count}개 포함")
                else:
                    self._log(f"[PDF 처리] pypdf 성공: {len(pages)}페이지, 총 {len(text)}자 ([경고] 숫자 없음)")
                return text

            msg = "pypdf: 텍스트를 추출할 수 없습니다"
            self._log(f"[PDF 처리] {msg}")
            error_messages.append(msg)
            return ""
        except Exception as e:
            msg = f"pypdf 실패: {e}"
            self._log(f"[PDF 처리] {msg}")
            error_messages.append(msg)
            return ""

    def _extract_with_ocr(self, pdf_path: str, error_messages: List[str]) -> str:
        """
        이미지 기반 OCR 추출 (숫자 인식 담당)
        - pytesseract + pdf2image 사용
        """
        try:
            import pytesseract
            from pdf2image import convert_from_path
            
            # Windows에서 Tesseract 경로 자동 설정
            import platform
            if platform.system() == "Windows":
                tesseract_paths = [
                    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
                ]
                for tesseract_path in tesseract_paths:
                    if os.path.exists(tesseract_path):
                        pytesseract.pytesseract.tesseract_cmd = tesseract_path
                        self._log(f"[PDF 처리] Tesseract 경로 설정: {tesseract_path}")
                        break
                
                # 한국어 언어 팩 확인
                try:
                    available_langs = pytesseract.get_languages()
                    if 'kor' not in available_langs:
                        self._log(f"[PDF 처리] [경고] 한국어 언어 팩(kor)이 설치되지 않았습니다. 설치된 언어: {available_langs}")
                        self._log(f"[PDF 처리] 한국어 언어 팩 설치 방법: Tesseract 설치 시 'Additional language data'에서 'Korean' 선택")
                    else:
                        self._log(f"[PDF 처리] ✅ 한국어 언어 팩 확인됨")
                except Exception as e:
                    self._log(f"[PDF 처리] 언어 팩 확인 중 오류: {e}")
        except ImportError as e:
            missing = str(e).split("'")[1] if "'" in str(e) else "pytesseract 또는 pdf2image"
            msg = f"OCR: {missing}가 설치되지 않았습니다 (pip install pytesseract pdf2image)"
            self._log(f"[PDF 처리] {msg}")
            error_messages.append(msg)
            return ""

        # Windows에서 Poppler 경로 자동 설정
        poppler_path = None
        if platform.system() == "Windows":
            # 환경 변수 확인
            poppler_path = os.getenv("POPPLER_PATH")
            
            # 기본 설치 경로 탐색
            if not poppler_path:
                # 하드코딩된 경로 (최우선)
                hardcoded_path = r"C:\Users\suhyeonjang\Downloads\Release-25.11.0-0\poppler-25.11.0\Library\bin"
                
                # 사용자 홈 디렉토리 가져오기
                user_home = os.path.expanduser("~")
                downloads_dir = os.path.join(user_home, "Downloads")
                
                # Downloads 폴더에서 poppler 폴더 검색
                possible_paths = [
                    hardcoded_path,  # 하드코딩된 경로 최우선
                    r"C:\Program Files\poppler\Library\bin",
                    r"C:\Program Files (x86)\poppler\Library\bin",
                    r"C:\poppler\Library\bin",
                    os.path.join(os.getcwd(), "poppler", "Library", "bin"),
                ]
                
                # Downloads 폴더에서 poppler 검색
                if os.path.exists(downloads_dir):
                    try:
                        for item in os.listdir(downloads_dir):
                            item_path = os.path.join(downloads_dir, item)
                            if os.path.isdir(item_path) and "poppler" in item.lower():
                                # poppler 폴더 내부에서 Library\bin 찾기
                                for root, dirs, files in os.walk(item_path):
                                    if "pdftoppm.exe" in files:
                                        bin_dir = os.path.dirname(os.path.join(root, "pdftoppm.exe"))
                                        if bin_dir not in possible_paths:
                                            possible_paths.insert(0, bin_dir)  # 우선순위 높게
                                        break
                    except Exception as e:
                        self._log(f"[PDF 처리] Downloads 폴더 검색 중 오류: {e}")
                
                # 경로 탐색
                for path in possible_paths:
                    pdftoppm_exe = os.path.join(path, "pdftoppm.exe")
                    if os.path.exists(pdftoppm_exe):
                        poppler_path = path
                        self._log(f"[PDF 처리] Poppler 경로 자동 설정: {poppler_path}")
                        break
                    else:
                        self._log(f"[PDF 처리] Poppler 경로 확인 실패: {path}")
        
        try:
            self._log("[PDF 처리] OCR로 시도 중... (이미지 기반/숫자 추출용)")
            # 해상도를 높여서 한글 인식 품질 개선 (600 DPI로 증가)
            if poppler_path:
                images = convert_from_path(pdf_path, dpi=600, poppler_path=poppler_path)
            else:
                images = convert_from_path(pdf_path, dpi=600)  # 해상도 높임
            self._log(f"[PDF 처리] OCR: PDF를 {len(images)}개 이미지로 변환 완료 (600 DPI)")
        except Exception as e:
            error_str = str(e)
            if "poppler" in error_str.lower() or "Unable to get page count" in error_str:
                msg = f"OCR: Poppler가 설치되지 않았거나 PATH에 없습니다. Windows용 Poppler 다운로드: https://github.com/oschwartz10612/poppler-windows/releases"
            else:
                msg = f"OCR: PDF를 이미지로 변환하는 데 실패했습니다: {error_str}"
            self._log(f"[PDF 처리] {msg}")
            error_messages.append(msg)
            return ""

        text_parts: List[str] = []
        
        # PIL/Pillow를 사용한 이미지 전처리
        try:
            from PIL import Image, ImageEnhance, ImageFilter
            use_image_preprocessing = True
        except ImportError:
            use_image_preprocessing = False
            self._log("[PDF 처리] PIL/Pillow가 없어 이미지 전처리를 건너뜁니다")

        for i, img in enumerate(images):
            try:
                # 이미지 전처리 (명암 조정, 선명도 향상)
                if use_image_preprocessing:
                    # 그레이스케일 변환
                    if img.mode != 'L':
                        img = img.convert('L')
                    
                    # 이진화 (numpy 사용 가능한 경우)
                    try:
                        import numpy as np
                        img_array = np.array(img)
                        # 간단한 임계값 처리 (128 기준)
                        threshold = 128
                        img_array = np.where(img_array > threshold, 255, 0).astype(np.uint8)
                        img = Image.fromarray(img_array)
                    except ImportError:
                        # numpy가 없으면 이진화 건너뛰기
                        pass
                    
                    # 명암 조정 (약하게)
                    enhancer = ImageEnhance.Contrast(img)
                    img = enhancer.enhance(1.2)  # 대비 1.2배 증가
                    
                    # 선명도 향상 (약하게)
                    enhancer = ImageEnhance.Sharpness(img)
                    img = enhancer.enhance(1.5)  # 선명도 1.5배 증가
                
                # OCR 실행 - 여러 PSM 모드 시도
                # PSM 6: 단일 균일 텍스트 블록 (계약서에 적합)
                # PSM 11: 희미한 텍스트
                # PSM 3: 완전 자동 페이지 분할 (기본값)
                page_text = None
                psm_modes = [6, 11, 3]  # 우선순위 순서
                
                for psm_mode in psm_modes:
                    try:
                        page_text = pytesseract.image_to_string(
                            img,
                            lang="kor+eng",
                            config=f"--psm {psm_mode} -c preserve_interword_spaces=1"
                        )
                        if page_text and len(page_text.strip()) > 10:  # 의미있는 텍스트가 있으면
                            self._log(f"[PDF 처리] OCR 페이지 {i + 1}: PSM {psm_mode} 모드로 인식 성공")
                            break
                    except Exception as e:
                        self._log(f"[PDF 처리] OCR 페이지 {i + 1}: PSM {psm_mode} 모드 실패: {e}")
                        continue
                
                if not page_text:
                    # 모든 모드 실패 시 기본 모드로 재시도
                    try:
                        page_text = pytesseract.image_to_string(
                            img,
                            lang="kor+eng",
                            config="--psm 6"
                        )
                    except Exception as e:
                        # 기본 모드도 실패한 경우
                        error_str = str(e)
                        if "tesseract" in error_str.lower() or "TesseractNotFoundError" in str(type(e)):
                            msg = f"OCR: Tesseract OCR이 설치되지 않았거나 PATH에 없습니다. 설치: https://github.com/tesseract-ocr/tesseract"
                            self._log(f"[PDF 처리] {msg}")
                            error_messages.append(msg)
                            return ""
                        else:
                            self._log(f"[PDF 처리] OCR 페이지 {i + 1} 기본 모드 실패: {error_str}")
                            page_text = None  # None으로 설정하여 continue로 넘어가도록
            except Exception as e:
                error_str = str(e)
                if "tesseract" in error_str.lower() or "TesseractNotFoundError" in str(type(e)):
                    msg = f"OCR: Tesseract OCR이 설치되지 않았거나 PATH에 없습니다. 설치: https://github.com/tesseract-ocr/tesseract"
                    self._log(f"[PDF 처리] {msg}")
                    error_messages.append(msg)
                    return ""
                else:
                    self._log(f"[PDF 처리] OCR 페이지 {i + 1} 실패: {error_str}")
                    continue

            if page_text and page_text.strip():
                digit_count = sum(ch.isdigit() for ch in page_text)
                korean_count = sum(1 for ch in page_text if '가' <= ch <= '힣')
                preview = page_text[:100].replace('\n', ' ') if len(page_text) > 100 else page_text.replace('\n', ' ')
                self._log(f"[PDF 처리] OCR 페이지 {i + 1}: {len(page_text)}자, 숫자 {digit_count}개, 한글 {korean_count}개")
                self._log(f"[PDF 처리] OCR 미리보기: {preview}...")
                text_parts.append(page_text)

        if not text_parts:
            msg = "OCR: 텍스트를 추출할 수 없습니다 (모든 페이지에서 실패)"
            self._log(f"[PDF 처리] {msg}")
            error_messages.append(msg)
            return ""

        text = "\n".join(text_parts)
        
        # OCR 결과 후처리 (끊긴 단어 복구)
        text = self._postprocess_ocr_text(text)
        
        digit_count_total = sum(ch.isdigit() for ch in text)
        if digit_count_total > 0:
            self._log(f"[PDF 처리] OCR 성공: {len(text_parts)}페이지, 총 {len(text)}자, 숫자 {digit_count_total}개 포함 ✅")
        else:
            self._log(f"[PDF 처리] OCR 성공: {len(text_parts)}페이지, 총 {len(text)}자 ([경고] 숫자 없음)")
        return text
    
    def _postprocess_ocr_text(self, text: str) -> str:
        """
        OCR 결과 후처리: 끊긴 단어 복구 및 일반적인 오인식 교정
        """
        # 일반적인 OCR 오인식 패턴 교정 (계약서 용어 중심)
        corrections = [
            # 한글 오인식 패턴
            (r'\bSHO\b', '정함'),
            (r'\bBash\b', '라 함'),
            (r'\bVerve Be\b', '다음과 같이'),
            (r'\bAaa\)', '직접지급'),
            (r'\bSEA\b', '근로자'),
            (r'\baz\b', '지급'),
            (r'\bOF S\b', '야 함'),
            (r'\bAlc:\b', '식대'),
            (r'\bAlok-\b', '근로자'),
            (r'\bStr\.\b', '서명'),
            (r'\bSo\b', '및'),
            (r'\bAl\b', '원'),
            # 공백 정리 (순서 중요)
            (r'\s+([.,)])', r'\1'),  # 구두점 앞 공백 제거
            (r'([(])\s+', r'\1'),  # 여는 괄호 뒤 공백 제거
            (r'\s+', ' '),  # 연속된 공백을 하나로 (마지막에)
        ]
        
        for pattern, replacement in corrections:
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
        
        # 한글과 영문/숫자 사이 공백 정리
        text = re.sub(r'([가-힣])\s+([a-zA-Z0-9])', r'\1 \2', text)
        text = re.sub(r'([a-zA-Z0-9])\s+([가-힣])', r'\1 \2', text)
        
        # 연속된 줄바꿈 정리
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # 단어 경계에서 끊긴 한글 복구 시도 (간단한 휴리스틱)
        # 예: "근 로자" → "근로자", "사 업주" → "사업주"
        common_words = [
            ('근 로자', '근로자'),
            ('사 업주', '사업주'),
            ('대 표', '대표'),
            ('연 락', '연락'),
            ('주 소', '주소'),
            ('전 화', '전화'),
            ('서 명', '서명'),
            ('체 결', '체결'),
            ('합 의', '합의'),
            ('지 급', '지급'),
            ('임 금', '임금'),
            ('근 무', '근무'),
            ('휴 게', '휴게'),
            ('수 습', '수습'),
            ('해 지', '해지'),
        ]
        
        for broken, fixed in common_words:
            text = text.replace(broken, fixed)
        
        return text.strip()
    
    def hwp_to_text(self, hwp_path: str) -> str:
        """
        HWP/HWPX/HWPS → 텍스트 추출
        
        Args:
            hwp_path: HWP, HWPX 또는 HWPS 파일 경로
        
        Returns:
            추출된 텍스트
        """
        file_path = Path(hwp_path)
        suffix = file_path.suffix.lower()
        
        if suffix in ['.hwpx', '.hwps']:
            return self._hwpx_to_text(hwp_path)
        elif suffix == '.hwp':
            return self._hwp_to_text(hwp_path)
        else:
            raise ValueError(f"지원하지 않는 HWP 형식: {suffix}")
    
    def _hwpx_to_text(self, hwpx_path: str) -> str:
        """
        HWPX (XML 기반) → 텍스트 추출
        """
        try:
            import zipfile
            import xml.etree.ElementTree as ET
            
            # HWPX는 ZIP 압축 파일
            with zipfile.ZipFile(hwpx_path, 'r') as zip_ref:
                # Contents/section0.xml에서 텍스트 추출
                try:
                    section_xml = zip_ref.read('Contents/section0.xml')
                    root = ET.fromstring(section_xml)
                    
                    # 텍스트 추출 (간단한 방법)
                    text_parts = []
                    for elem in root.iter():
                        if elem.text:
                            text_parts.append(elem.text.strip())
                    
                    text = '\n'.join(text_parts)
                    return self._clean_text(text)
                except KeyError:
                    # section0.xml이 없으면 다른 방법 시도
                    return self._extract_text_from_hwpx_zip(zip_ref)
        except Exception as e:
            raise Exception(f"HWPX 처리 실패: {str(e)}")
    
    def _extract_text_from_hwpx_zip(self, zip_ref) -> str:
        """HWPX ZIP에서 텍스트 추출 (대체 방법)"""
        import xml.etree.ElementTree as ET
        text_parts = []
        for name in zip_ref.namelist():
            if name.endswith('.xml'):
                try:
                    xml_content = zip_ref.read(name)
                    root = ET.fromstring(xml_content)
                    for elem in root.iter():
                        if elem.text and elem.text.strip():
                            text_parts.append(elem.text.strip())
                except:
                    continue
        return self._clean_text('\n'.join(text_parts))
    
    def _hwp_to_text(self, hwp_path: str) -> str:
        """
        HWP (바이너리) → 텍스트 추출
        
        주의: HWP 바이너리 형식은 복잡하므로 외부 서비스 사용 권장
        """
        # 방법 1: 외부 변환 서비스 사용 (권장)
        hwp_converter_url = os.getenv("HWP_CONVERTER_URL", "http://localhost:8001/convert")
        
        try:
            import requests
            
            with open(hwp_path, 'rb') as f:
                files = {'file': f}
                response = requests.post(
                    hwp_converter_url,
                    files=files,
                    timeout=30
                )
                response.raise_for_status()
                return self._clean_text(response.text)
        except Exception as e:
            print(f"[경고] HWP 변환 서비스 실패: {str(e)}")
            print("[팁] HWP 변환 서비스를 설정하거나 olefile 라이브러리를 사용하세요.")
            
            # 방법 2: olefile로 기본 추출 시도 (제한적)
            try:
                import olefile
                
                if olefile.isOleFile(hwp_path):
                    ole = olefile.OleFileIO(hwp_path)
                    # HWP 내부 구조에서 텍스트 추출 시도
                    # 주의: 이는 기본적인 추출만 가능
                    text_parts = []
                    for stream in ole.listdir():
                        if 'BodyText' in str(stream):
                            try:
                                data = ole.openstream(stream).read()
                                # 간단한 텍스트 추출 (완벽하지 않음)
                                text = data.decode('utf-8', errors='ignore')
                                text_parts.append(text)
                            except:
                                continue
                    ole.close()
                    return self._clean_text('\n'.join(text_parts))
                else:
                    raise Exception("올바른 HWP 파일이 아닙니다")
            except ImportError:
                raise Exception(
                    "HWP 파일 처리를 위해 다음 중 하나가 필요합니다:\n"
                    "1. HWP 변환 서비스 설정 (HWP_CONVERTER_URL)\n"
                    "2. olefile 라이브러리 설치: pip install olefile"
                )
            except Exception as e:
                raise Exception(f"HWP 처리 실패: {str(e)}")
    
    def html_to_text(self, html_path: str) -> str:
        """
        HTML → 텍스트 추출
        
        Args:
            html_path: HTML 파일 경로
            
        Returns:
            추출된 텍스트
        """
        try:
            from html.parser import HTMLParser
            from html import unescape
            
            class TextExtractor(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.text_parts = []
                    self.skip_tags = {'script', 'style', 'meta', 'link', 'head'}
                    self.current_tag = None
                
                def handle_starttag(self, tag, attrs):
                    self.current_tag = tag.lower()
                    if tag.lower() in {'br', 'p', 'div', 'li'}:
                        self.text_parts.append('\n')
                
                def handle_endtag(self, tag):
                    if tag.lower() in {'p', 'div', 'li', 'tr'}:
                        self.text_parts.append('\n')
                    self.current_tag = None
                
                def handle_data(self, data):
                    if self.current_tag not in self.skip_tags:
                        self.text_parts.append(data)
            
            with open(html_path, 'r', encoding='utf-8') as f:
                html_content = f.read()
            
            parser = TextExtractor()
            parser.feed(html_content)
            text = ''.join(parser.text_parts)
            
            # HTML 엔티티 디코딩
            text = unescape(text)
            
            # 텍스트 정제
            text = self._clean_text(text)
            
            return text
        except Exception as e:
            raise Exception(f"HTML 처리 실패: {str(e)}")
    
    def _clean_text(self, text: str) -> str:
        """텍스트 정제 (숫자 보존 강화)"""
        # 원본에 숫자가 있는지 확인
        has_numbers_before = any(c.isdigit() for c in text)
        
        # 중복 공백 제거 (줄바꿈은 유지)
        text = re.sub(r'[ \t]+', ' ', text)  # 공백과 탭만 제거, 줄바꿈은 유지
        # 줄바꿈 정리 (연속된 줄바꿈을 2개로 제한)
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # 불필요한 특수문자 제거 (한글, 영문, 숫자, 기본 구두점만 유지)
        # 숫자와 금액 관련 특수문자(쉼표, 원화 기호 등) 보존 강화
        # 금액 패턴: 2,000,000원, ₩1,000,000, 100만원 등
        # 날짜 패턴: 2025-01-01, 2025.01.01, 2025/01/01 등
        # 숫자 관련 특수문자: , (쉼표), . (소수점/날짜), - (하이픈/날짜), / (슬래시/날짜), : (시간)
        text = re.sub(r'[^\w\s가-힣.,()%\-:/0-9₩원만억]', '', text)
        
        # 숫자 보존 확인 로깅 (디버깅용)
        has_numbers_after = any(c.isdigit() for c in text)
        if has_numbers_before and not has_numbers_after:
            print(f"[텍스트 정제] [경고] 정제 후 텍스트에서 숫자가 사라졌습니다!")
            print(f"[텍스트 정제] 원본 샘플 (처음 500자): {text[:500] if len(text) > 500 else text}")
        elif not has_numbers_after and len(text) > 100:
            print(f"[텍스트 정제] [경고] 정제 후 텍스트에 숫자가 없습니다. 원본 길이: {len(text)}")
        
        return text.strip()
    
    def to_chunks(self, text: str, base_meta: Dict[str, Any] = None) -> List[Chunk]:
        """
        텍스트 → 청크 변환
        
        Args:
            text: 원본 텍스트
            base_meta: 기본 메타데이터
        
        Returns:
            청크 리스트
        """
        if base_meta is None:
            base_meta = {}
        
        # 텍스트 유효성 검사
        if text is None:
            raise ValueError("텍스트가 None입니다. 파일에서 텍스트를 추출하지 못했습니다.")
        
        if not isinstance(text, str):
            raise ValueError(f"텍스트가 문자열이 아닙니다. 타입: {type(text)}")
        
        # 텍스트가 비어있거나 공백만 있는지 확인
        text_stripped = text.strip()
        if not text_stripped:
            raise ValueError("텍스트가 비어있습니다. 파일이 비어있거나 텍스트 추출에 실패했습니다.")
        
        # 텍스트가 너무 짧은지 확인 (최소 길이 체크)
        if len(text_stripped) < 10:
            raise ValueError(f"텍스트가 너무 짧습니다 (길이: {len(text_stripped)}). 최소 10자 이상의 텍스트가 필요합니다.")
        
        try:
            # LangChain Document로 변환
            docs = self.splitter.create_documents([text])
            
            # 문서가 생성되지 않은 경우
            if not docs:
                raise ValueError(f"청크 분할 실패: 텍스트 길이 {len(text)}자, chunk_size={self.chunk_size}, chunk_overlap={self.chunk_overlap}")
            
            # Chunk 모델로 변환
            chunks = [
                Chunk(
                    index=i,
                    content=d.page_content,
                    metadata={
                        **base_meta,
                        "chunk_size": len(d.page_content),
                        "total_chunks": len(docs)
                    }
                )
                for i, d in enumerate(docs)
            ]
            
            # 빈 청크 필터링 (내용이 없는 청크 제거)
            chunks = [chunk for chunk in chunks if chunk.content.strip()]
            
            if not chunks:
                raise ValueError("모든 청크가 비어있습니다. 텍스트 정제 과정에서 내용이 모두 제거되었을 수 있습니다.")
            
            return chunks
            
        except Exception as e:
            # 더 자세한 오류 정보 제공
            error_msg = f"청크 생성 중 오류 발생: {str(e)}"
            if isinstance(e, ValueError):
                raise ValueError(error_msg)
            else:
                raise Exception(error_msg)
    
    def to_contract_chunks(self, text: str, base_meta: Dict[str, Any] = None) -> List[Chunk]:
        """
        계약서 텍스트 → 조항 단위 청크 변환
        
        계약서를 조항(제n조) 단위로 분할하고, 조항이 너무 길면 문단 단위로 추가 분할합니다.
        
        Args:
            text: 계약서 원본 텍스트
            base_meta: 기본 메타데이터
        
        Returns:
            조항 단위 청크 리스트 (article_number, paragraph_index 등 메타데이터 포함)
        """
        if base_meta is None:
            base_meta = {}
        
        # 텍스트 유효성 검사
        if text is None:
            raise ValueError("텍스트가 None입니다. 파일에서 텍스트를 추출하지 못했습니다.")
        
        if not isinstance(text, str):
            raise ValueError(f"텍스트가 문자열이 아닙니다. 타입: {type(text)}")
        
        text_stripped = text.strip()
        if not text_stripped:
            raise ValueError("텍스트가 비어있습니다. 파일이 비어있거나 텍스트 추출에 실패했습니다.")
        
        try:
            # 조항 단위로 분할
            article_chunks = self.contract_splitter.split_contract_by_articles(text_stripped)
            
            # Chunk 모델로 변환
            chunks = []
            for chunk_data in article_chunks:
                chunk_meta = {
                    **base_meta,
                    "article_number": chunk_data.get("article_number", 0),
                    "article_header": chunk_data.get("article_header", ""),
                    "chunk_type": chunk_data.get("type", "article"),
                    "chunk_size": len(chunk_data.get("content", "")),
                    "total_chunks": len(article_chunks)
                }
                
                # 문단 정보 추가
                if "paragraph_index" in chunk_data:
                    chunk_meta["paragraph_index"] = chunk_data["paragraph_index"]
                
                if chunk_data.get("sub_chunk"):
                    chunk_meta["sub_chunk"] = True
                
                chunks.append(Chunk(
                    index=chunk_data.get("chunk_index", len(chunks)),
                    content=chunk_data.get("content", ""),
                    metadata=chunk_meta
                ))
            
            # 빈 청크 필터링
            chunks = [chunk for chunk in chunks if chunk.content.strip()]
            
            if not chunks:
                raise ValueError("모든 청크가 비어있습니다. 계약서 텍스트에서 조항을 추출하지 못했습니다.")
            
            return chunks
            
        except Exception as e:
            error_msg = f"계약서 청크 생성 중 오류 발생: {str(e)}"
            if isinstance(e, ValueError):
                raise ValueError(error_msg)
            else:
                raise Exception(error_msg)
    
    def extract_structured_meta(self, text: str) -> Dict[str, Any]:
        """
        정규식으로 구조화된 메타데이터 추출
        (LLM 분석 전 초기 힌트 제공)
        
        Args:
            text: 공고 텍스트
        
        Returns:
            추출된 메타데이터
        """
        meta = {}
        
        # 예산 추출
        budget_patterns = [
            r'예산[:\s]*([0-9,]+)\s*(억|만원|원)',
            r'사업[비용]*[:\s]*([0-9,]+)\s*(억|만원|원)',
            r'(\d+)\s*억\s*원',
            r'₩?\s?([0-9,]+)\s*원',
        ]
        
        for pattern in budget_patterns:
            match = re.search(pattern, text)
            if match:
                amount = match.group(1).replace(',', '')
                unit = match.group(2) if len(match.groups()) > 1 else '원'
                
                # 단위 변환
                if '억' in unit:
                    meta['budget_hint'] = f"{amount}억원"
                elif '만원' in unit:
                    meta['budget_hint'] = f"{amount}만원"
                else:
                    meta['budget_hint'] = f"{amount}원"
                break
        
        # 기간 추출
        period_patterns = [
            r'[수행]*기간[:\s]*([0-9]+)\s*(개월|일|년)',
            r'사업기간[:\s]*([0-9]+)\s*(개월|일|년)',
        ]
        
        for pattern in period_patterns:
            match = re.search(pattern, text)
            if match:
                meta['period_hint'] = f"{match.group(1)}{match.group(2)}"
                break
        
        # 입찰 마감일 추출
        deadline_patterns = [
            r'마감[일]*[:\s]*(\d{4}[-./년]\d{1,2}[-./월]\d{1,2})',
            r'제출기한[:\s]*(\d{4}[-./년]\d{1,2}[-./월]\d{1,2})',
        ]
        
        for pattern in deadline_patterns:
            match = re.search(pattern, text)
            if match:
                meta['deadline_hint'] = match.group(1)
                break
        
        return meta
    
    def process_file(
        self,
        file_path: str,
        file_type: str = None,
        base_meta: Dict[str, Any] = None,
        mode: str = "normal",  # ✅ "contract" 추가
        force_ocr: bool = False,  # OCR 강제 사용
        prefer_ocr: bool = False  # OCR 우선 사용
    ) -> tuple[str, List[Chunk]]:
        """
        파일 처리 (텍스트 추출 + 청킹)
        
        Args:
            file_path: 파일 경로
            file_type: 파일 타입 ('pdf', 'text', 'hwp', 'hwpx', 'html') - None이면 자동 감지
            base_meta: 기본 메타데이터
            mode: 처리 모드 ("normal" 또는 "contract") - "contract"이면 to_contract_chunks 사용
        
        Returns:
            (text, chunks)
        """
        # 파일 타입 자동 감지
        if file_type is None:
            suffix = Path(file_path).suffix.lower()
            if suffix == '.pdf':
                file_type = 'pdf'
            elif suffix in ['.hwp', '.hwpx', '.hwps']:
                file_type = 'hwp'
            elif suffix == '.txt':
                file_type = 'text'
            elif suffix in ['.html', '.htm']:
                file_type = 'html'
            else:
                raise ValueError(f"지원하지 않는 파일 형식: {suffix}")
        
        # 파일 타입별 처리
        if file_type == "pdf":
            # 계약서 모드일 때는 기본적으로 OCR 우선 사용
            # (명시적으로 force_ocr/prefer_ocr가 지정되지 않은 경우)
            if mode == "contract" and not force_ocr and prefer_ocr is False:
                prefer_ocr = True
            text = self.pdf_to_text(file_path, force_ocr=force_ocr, prefer_ocr=prefer_ocr)
        elif file_type == "text":
            if not os.path.exists(file_path):
                raise FileNotFoundError(f"텍스트 파일을 찾을 수 없습니다: {file_path}")
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    text = f.read()
            except UnicodeDecodeError:
                # UTF-8 실패 시 다른 인코딩 시도
                try:
                    with open(file_path, 'r', encoding='cp949') as f:
                        text = f.read()
                except Exception as e:
                    raise Exception(f"텍스트 파일 인코딩 오류: {str(e)}")
            
            if not text or not text.strip():
                raise ValueError(f"텍스트 파일이 비어있습니다: {file_path}")
            
            text = self._clean_text(text)
            
            if not text or not text.strip():
                raise ValueError(f"텍스트 정제 후 내용이 비어있습니다: {file_path}")
        elif file_type == "hwp":
            text = self.hwp_to_text(file_path)
        elif file_type == "html":
            text = self.html_to_text(file_path)
        else:
            raise ValueError(f"지원하지 않는 파일 타입: {file_type}")
        
        # 텍스트 추출 검증
        if text is None:
            raise ValueError(f"파일에서 텍스트를 추출하지 못했습니다: {file_path}")
        
        if not isinstance(text, str):
            raise ValueError(f"추출된 텍스트가 문자열이 아닙니다. 타입: {type(text)}")
        
        text_stripped = text.strip()
        if not text_stripped:
            raise ValueError(f"추출된 텍스트가 비어있습니다: {file_path}")
        
        # 텍스트 검증 후 여기에서 분기
        if mode == "contract":
            chunks = self.to_contract_chunks(text, base_meta)
        else:
            chunks = self.to_chunks(text, base_meta)
        
        return text, chunks

