"""
OCR 테스트 스크립트

이미지 기반 PDF의 OCR 처리 테스트용 스크립트
"""

import os
import sys
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from core.document_processor_v2 import DocumentProcessor
from core.logging_config import get_logger

logger = get_logger(__name__)


def test_ocr(pdf_path: str, output_path: str = None, force_ocr: bool = False):
    """
    PDF 파일의 OCR 처리 테스트
    
    Args:
        pdf_path: PDF 파일 경로
        output_path: 추출된 텍스트를 저장할 파일 경로 (선택)
        force_ocr: True면 무조건 OCR만 사용
    """
    if not os.path.exists(pdf_path):
        logger.error(f"파일을 찾을 수 없습니다: {pdf_path}")
        return
    
    logger.info("=" * 60)
    logger.info(f"[OCR 테스트] {pdf_path}")
    logger.info("=" * 60)
    
    processor = DocumentProcessor(verbose=True)
    
    try:
        # 텍스트 추출
        if force_ocr:
            logger.info("[모드] 강제 OCR 모드 (force_ocr=True)")
            text = processor.pdf_to_text(pdf_path, force_ocr=True)
        else:
            logger.info("[모드] 자동 모드 (텍스트 추출 실패 시 OCR 자동 전환)")
            text = processor.pdf_to_text(pdf_path)
        
        if text:
            logger.info(f"\n[성공] 텍스트 추출 완료: {len(text):,}자")
            
            # 미리보기
            preview = text[:500].replace('\n', ' ')
            logger.info(f"\n[미리보기] {preview}...")
            
            # 통계
            digit_count = sum(ch.isdigit() for ch in text)
            korean_count = sum(1 for ch in text if '가' <= ch <= '힣')
            english_count = sum(1 for ch in text if ch.isalpha() and ord(ch) < 128)
            
            logger.info(f"\n[통계]")
            logger.info(f"  - 총 문자 수: {len(text):,}자")
            logger.info(f"  - 숫자: {digit_count:,}개")
            logger.info(f"  - 한글: {korean_count:,}개")
            logger.info(f"  - 영문: {english_count:,}개")
            
            # 파일로 저장
            if output_path:
                with open(output_path, "w", encoding="utf-8") as f:
                    f.write(text)
                logger.info(f"\n[저장] {output_path}")
            else:
                # 기본 출력 파일명
                pdf_name = Path(pdf_path).stem
                default_output = backend_dir / "output" / f"{pdf_name}_ocr.txt"
                default_output.parent.mkdir(exist_ok=True)
                with open(default_output, "w", encoding="utf-8") as f:
                    f.write(text)
                logger.info(f"\n[저장] {default_output}")
        else:
            logger.error("[실패] 텍스트를 추출할 수 없습니다")
            
    except Exception as e:
        logger.error(f"[오류] {str(e)}", exc_info=True)


def main():
    """메인 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description="OCR 테스트 스크립트")
    parser.add_argument("pdf_path", help="테스트할 PDF 파일 경로")
    parser.add_argument("-o", "--output", help="출력 텍스트 파일 경로 (선택)")
    parser.add_argument("--force-ocr", action="store_true", help="무조건 OCR만 사용")
    
    args = parser.parse_args()
    
    test_ocr(args.pdf_path, args.output, args.force_ocr)


if __name__ == "__main__":
    main()

