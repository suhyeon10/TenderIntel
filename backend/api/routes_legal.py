"""
Legal RAG API Routes
법률 리스크 분석 API 엔드포인트
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status
from typing import Optional
import tempfile
import os
import logging
from pathlib import Path

from models.schemas import (
    LegalAnalyzeSituationRequest,
    LegalAnalysisResult,
    LegalSearchResponse,
    LegalChatRequest,
    LegalChatResponse,
    SituationAnalysisRequest,
    SituationAnalysisResponse,
)
from core.legal_rag_service import LegalRAGService
from core.document_processor_v2 import DocumentProcessor


router_legal = APIRouter(
    prefix="/api/v1/legal",
    tags=["legal"],
)

# 서비스 인스턴스 (지연 초기화)
_service = None

def get_legal_service() -> LegalRAGService:
    """Legal RAG 서비스 인스턴스 가져오기 (지연 초기화)"""
    global _service
    if _service is None:
        _service = LegalRAGService()
    return _service

# 임시 파일 디렉토리
TEMP_DIR = "./data/temp"
os.makedirs(TEMP_DIR, exist_ok=True)

# 문서 프로세서
_processor = None

def get_processor() -> DocumentProcessor:
    """문서 프로세서 인스턴스 가져오기"""
    global _processor
    if _processor is None:
        _processor = DocumentProcessor()
    return _processor


@router_legal.post(
    "/analyze-contract",
    response_model=LegalAnalysisResult,
    summary="계약서 파일 + 상황 설명 기반 법률 리스크 분석",
)
async def analyze_contract_api(
    file: UploadFile = File(..., description="계약서 또는 관련 문서 (pdf, hwp, hwpx 등)"),
    description: Optional[str] = Form(
        None,
        description="추가로 설명하고 싶은 상황/걱정 포인트",
    ),
):
    """
    - 계약서/문서를 업로드하면 OCR/텍스트 추출 후
    - 법률 RAG + LLM으로 리스크 분석 결과 반환
    """
    try:
        # 파일 임시 저장
        temp_path = None
        try:
            # 원본 파일 확장자 유지
            suffix = Path(file.filename).suffix if file.filename else ".tmp"
            temp_file = tempfile.NamedTemporaryFile(
                delete=False,
                suffix=suffix,
                dir=TEMP_DIR
            )
            temp_path = temp_file.name
            
            # 파일 내용 쓰기
            content = await file.read()
            temp_file.write(content)
            temp_file.close()
            
            # 텍스트 추출
            processor = get_processor()
            extracted_text, _ = processor.process_file(temp_path, file_type=None)
            
            if not extracted_text or extracted_text.strip() == "":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="업로드된 파일에서 텍스트를 추출할 수 없습니다.",
                )

            # 법률 리스크 분석
            service = get_legal_service()
            result = await service.analyze_contract(
                extracted_text=extracted_text,
                description=description,
            )
            # 계약서 텍스트 추가
            result.contract_text = extracted_text
            return result

        finally:
            # 임시 파일 삭제
            if temp_path and os.path.exists(temp_path):
                os.unlink(temp_path)

    except HTTPException:
        raise
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"계약서 분석 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"계약서 분석 중 오류가 발생했습니다: {str(e)}",
        )


@router_legal.post(
    "/analyze-situation",
    response_model=LegalAnalysisResult,
    summary="텍스트 기반 법률 상황 분석",
)
async def analyze_situation_api(
    body: LegalAnalyzeSituationRequest,
):
    """
    - 사용자가 겪고 있는 법적 상황을 텍스트로 설명하면
    - 관련 케이스/법령을 검색하여 리스크와 대응 방안을 요약
    """
    try:
        service = get_legal_service()
        result = await service.analyze_situation(text=body.text)
        return result
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"상황 분석 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"상황 분석 중 오류가 발생했습니다: {str(e)}",
        )


@router_legal.get(
    "/search-cases",
    response_model=LegalSearchResponse,
    summary="법률 시나리오/케이스 검색",
)
async def search_cases_api(
    query: str,
    limit: int = 5,
):
    """
    - 우리가 만든 case_01~05 등 시나리오 기반으로,
      유사한 케이스를 찾아 프리뷰를 제공
    """
    try:
        service = get_legal_service()
        cases = await service.search_cases(query=query, limit=limit)
        return LegalSearchResponse(query=query, cases=cases)
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"케이스 검색 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"케이스 검색 중 오류가 발생했습니다: {str(e)}",
        )


@router_legal.post(
    "/chat",
    response_model=LegalChatResponse,
    summary="법률 상담 챗 (컨텍스트 기반)",
)
async def legal_chat_api(
    body: LegalChatRequest,
):
    """
    - 계약서 분석 결과를 컨텍스트로 포함한 법률 상담 챗
    - 선택된 이슈 정보와 분석 요약을 활용하여 더 정확한 답변 제공
    """
    try:
        service = get_legal_service()
        result = await service.chat_with_context(
            query=body.query,
            doc_ids=body.doc_ids,
            selected_issue_id=body.selected_issue_id,
            selected_issue=body.selected_issue,
            analysis_summary=body.analysis_summary,
            risk_score=body.risk_score,
            total_issues=body.total_issues,
            top_k=body.top_k,
        )
        return result
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"법률 상담 챗 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"법률 상담 챗 중 오류가 발생했습니다: {str(e)}",
        )


@router_legal.post(
    "/situation/analyze",
    response_model=SituationAnalysisResponse,
    summary="상황 기반 진단 (상세 정보 포함)",
)
async def analyze_situation_detailed_api(
    body: SituationAnalysisRequest,
):
    """
    - 계약서 없이 상황 설명만으로 법적 위험 진단
    - 사용자 정보(고용 형태, 근무 기간 등)를 참고하여 더 정확한 진단 제공
    - 행동 가이드 및 스크립트 템플릿 제공
    """
    try:
        service = get_legal_service()
        result = await service.analyze_situation_detailed(
            category_hint=body.category_hint,
            situation_text=body.situation_text,
            summary=getattr(body, 'summary', None),
            details=getattr(body, 'details', None),
            employment_type=body.employment_type,
            work_period=body.work_period,
            weekly_hours=body.weekly_hours,
            is_probation=body.is_probation,
            social_insurance=body.social_insurance,
        )
        return result
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"상황 진단 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"상황 진단 중 오류가 발생했습니다: {str(e)}",
        )

