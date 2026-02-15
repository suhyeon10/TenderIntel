"""
Legal RAG API Routes v2
법률 리스크 분석 API 엔드포인트 (v2 - 가이드 스펙 준수)
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Query, Header
from fastapi.responses import StreamingResponse, RedirectResponse
from typing import Optional, List, Dict, Any
import tempfile
import os
import logging
import asyncio
from pathlib import Path
from datetime import datetime
import uuid
import re
from supabase import create_client
from config import settings

from models.schemas import (
    CreateChatSessionRequest,
    ChatMessageRequest,
    ScriptsV2,
    LegalSearchResponseV2,
    LegalSearchResult,
    SituationRequestV2,
    SituationResponseV2,
    ContractAnalysisResponseV2,
    ContractIssueV2,
    ClauseV2,
    HighlightedTextV2,
    ContractComparisonRequestV2,
    ContractComparisonResponseV2,
    ClauseRewriteRequestV2,
    ClauseRewriteResponseV2,
    LegalChatRequestV2,
    LegalChatResponseV2,
    UsedChunksV2,
    UsedChunkV2,
    ConversationRequestV2,
    CreateChatSessionRequest,
    ChatMessageRequest,
    LegalChatMode,
    LegalChatAgentResponse,
    UsedReportMeta,
    UsedSourceMeta,
    ContractAnalysisSummary,
    SituationAnalysisSummary,
)
from core.legal_rag_service import LegalRAGService
from core.document_processor_v2 import DocumentProcessor
from core.contract_storage import ContractStorageService
from core.tools import ClauseLabelingTool, HighlightTool, RewriteTool
from core.snippet_analyzer import analyze_snippet
from core.dependencies import (
    get_legal_service_dep,
    get_processor_dep,
    get_storage_service_dep,
)
from core.logging_config import get_logger
from core.clause_extractor import extract_clauses

router = APIRouter(
    prefix="/api/v2/legal",
    tags=["legal-v2"],
)

# 레거시 호환성을 위한 함수 (의존성 주입 패턴으로 마이그레이션 권장)
def get_legal_service() -> LegalRAGService:
    """Legal RAG 서비스 인스턴스 가져오기 (레거시 호환)"""
    from core.dependencies import get_legal_service as _get_legal_service
    return _get_legal_service()

def get_processor() -> DocumentProcessor:
    """문서 프로세서 인스턴스 가져오기 (레거시 호환)"""
    from core.dependencies import get_processor as _get_processor
    return _get_processor()

def get_storage_service() -> ContractStorageService:
    """계약서 저장 서비스 인스턴스 가져오기 (레거시 호환)"""
    from core.dependencies import get_storage_service as _get_storage_service
    return _get_storage_service()

# 임시 파일 디렉토리
TEMP_DIR = "./data/temp"
os.makedirs(TEMP_DIR, exist_ok=True)

# 계약서 분석 결과 저장소 (fallback용)
_contract_analyses = {}

logger = get_logger(__name__)


@router.get("/health")
async def health():
    """헬스 체크"""
    return {
        "status": "ok",
        "message": "Linkus Public RAG API is running"
    }


@router.get("/search", response_model=LegalSearchResponseV2)
async def search_legal(
    q: str = Query(..., description="검색어"),
    limit: int = Query(5, ge=1, le=50, description="결과 개수"),
    doc_type: Optional[str] = Query(None, description="문서 타입 (law, standard_contract, manual, case)"),
):
    """
    법령/표준계약/매뉴얼/케이스 RAG 검색
    """
    try:
        service = get_legal_service()
        
        # RAG 검색 수행
        chunks = await service._search_legal_chunks(query=q, top_k=limit)
        
        # 결과 변환 (LegalGroundingChunk 객체를 dict로 변환)
        results = []
        for chunk in chunks:
            result = LegalSearchResult(
                legal_document_id=chunk.source_id,
                section_title=None,  # LegalGroundingChunk에는 없음
                text=chunk.snippet,
                score=chunk.score,
                source=None,  # LegalGroundingChunk에는 없음
                doc_type=chunk.source_type,
                title=chunk.title,
            )
            results.append(result)
        
        return LegalSearchResponseV2(
            results=results,
            count=len(results),
            query=q,
        )
    except Exception as e:
        logger.error(f"법령 검색 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"법령 검색 중 오류가 발생했습니다: {str(e)}",
        )


@router.post("/analyze-contract", response_model=ContractAnalysisResponseV2)
async def analyze_contract(
    file: UploadFile = File(..., description="계약서 파일 (PDF/HWPX 등)"),
    title: Optional[str] = Form(None, description="문서 이름"),
    doc_type: Optional[str] = Form(None, description="문서 타입 (employment, freelance 등)"),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id", description="사용자 ID"),
    contract_type: Optional[str] = Form(None, description="계약 종류: freelancer | part_time | regular | service | other"),
    user_role: Optional[str] = Form(None, description="역할: worker (을/프리랜서/근로자) | employer (갑/발주사/고용주)"),
    field: Optional[str] = Form(None, description="분야: it_dev | design | marketing | other"),
    concerns: Optional[str] = Form(None, description="우선 확인하고 싶은 고민"),
):
    """
    계약서 PDF/HWPX 업로드 → 위험 분석
    
    같은 파일이면 DB에서 바로 불러오기 (캐시 조회)
    """
    logger.info(f"[계약서 분석] ========== v2 엔드포인트 호출 시작 ==========")
    logger.info(f"[계약서 분석] 파일명: {file.filename}, title: {title}, doc_type: {doc_type}, user_id: {x_user_id}")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="파일이 필요합니다.")

    # STEP 1 - 캐시 조회: 같은 파일이면 DB에서 바로 불러오기
    # ⚠️ 개발/테스트 단계: 캐시 조회 비활성화 (항상 분석 수행)
    # TODO: 운영 환경에서는 아래 주석을 해제하여 캐시 조회 활성화
    """
    fileName = file.filename
    logger.info(f"[계약서 분석] STEP 1 - 캐시 조회 시작: file_name={fileName}")
    
    try:
        storage_service = get_storage_service()
        cached_analysis = await storage_service.get_contract_analysis_by_filename(
            file_name=fileName,
            user_id=x_user_id
        )
        
        if cached_analysis:
            logger.info(f"[계약서 분석] ✅ 캐시에서 분석 결과 발견: doc_id={cached_analysis.get('docId')}, file_name={fileName}")
            logger.info(f"[계약서 분석] 캐시 응답 반환: issues={len(cached_analysis.get('issues', []))}개, clauses={len(cached_analysis.get('clauses', []))}개")
            
            # v2 응답 형식으로 변환하여 반환
            return ContractAnalysisResponseV2(**cached_analysis)
        else:
            logger.info(f"[계약서 분석] 캐시에 없음, 전체 파이프라인 실행: file_name={fileName}")
    except Exception as cache_error:
        logger.warning(f"[계약서 분석] 캐시 조회 실패, 전체 파이프라인 실행: {str(cache_error)}", exc_info=True)
        # 캐시 조회 실패해도 계속 진행
    """
    
    # 개발/테스트 단계: 항상 전체 파이프라인 실행
    fileName = file.filename
    logger.info(f"[계약서 분석] ⚠️ 개발 모드: 캐시 조회 비활성화, 항상 전체 파이프라인 실행: file_name={fileName}")
    
    # STEP 2 - 전체 파이프라인 실행
    logger.info(f"[계약서 분석] STEP 2 - 전체 파이프라인 실행 시작: file_name={fileName}")

    temp_path = None
    try:
        # 파일 임시 저장
        suffix = Path(file.filename).suffix if file.filename else ".tmp"
        temp_file = tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix,
            dir=TEMP_DIR
        )
        temp_path = temp_file.name
        
        content = await file.read()
        temp_file.write(content)
        temp_file.close()
        
        # 텍스트 추출 (계약서는 이미지 기반 PDF일 가능성이 높으므로 OCR 우선 사용)
        processor = get_processor()
        # mode="contract"이면 자동으로 prefer_ocr=True가 적용됨
        extracted_text, _ = processor.process_file(
            temp_path, 
            file_type=None, 
            mode="contract"
        )
        
        # extracted_text 추출 확인 로깅
        logger.info(f"[계약서 분석] 텍스트 추출 완료: extracted_text 길이={len(extracted_text) if extracted_text else 0}, 미리보기={extracted_text[:100] if extracted_text else '(없음)'}")
        
        if not extracted_text or extracted_text.strip() == "":
            logger.error(f"[계약서 분석] 텍스트 추출 실패: extracted_text가 비어있음")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="업로드된 파일에서 텍스트를 추출할 수 없습니다.",
            )

        # 계약서 조항 단위 청킹 및 벡터 저장 (Dual RAG를 위해)
        doc_id = str(uuid.uuid4())
        doc_title = title or file.filename or "계약서"
        
        # contract_chunks 저장을 먼저 완료한 후 분석 시작 (Race condition 해결)
        async def prepare_contract_chunks():
            """계약서 청킹 및 벡터 저장"""
            try:
                # 1. 조항 단위 청킹
                processor = get_processor()
                contract_chunks = processor.to_contract_chunks(
                    text=extracted_text,
                    base_meta={
                        "contract_id": doc_id,
                        "title": doc_title,
                        "filename": file.filename,
                    }
                )
                
                # 2. 임베딩 생성 (비동기로 실행하여 블로킹 방지)
                from core.generator_v2 import LLMGenerator
                generator = LLMGenerator()
                chunk_texts = [chunk.content for chunk in contract_chunks]
                embeddings = await asyncio.to_thread(generator.embed, chunk_texts)
                
                # 3. contract_chunks 테이블에 저장
                from core.supabase_vector_store import SupabaseVectorStore
                vector_store = SupabaseVectorStore()
                
                chunk_payload = []
                for idx, chunk in enumerate(contract_chunks):
                    chunk_payload.append({
                        "article_number": chunk.metadata.get("article_number", 0),
                        "paragraph_index": chunk.metadata.get("paragraph_index"),
                        "content": chunk.content,
                        "chunk_index": chunk.index,
                        "chunk_type": chunk.metadata.get("chunk_type", "article"),
                        "embedding": embeddings[idx],
                        "metadata": chunk.metadata,
                    })
                
                vector_store.bulk_upsert_contract_chunks(
                    contract_id=doc_id,
                    chunks=chunk_payload
                )
                logger.info(f"[계약서 분석] contract_chunks 저장 완료: {len(chunk_payload)}개 청크")
                return True
            except Exception as chunk_error:
                logger.warning(f"[계약서 분석] contract_chunks 저장 실패 (계속 진행): {str(chunk_error)}", exc_info=True)
                # 청크 저장 실패해도 분석은 계속 진행
                return False
        
        # contract_chunks 저장을 먼저 완료
        chunks_saved = await prepare_contract_chunks()
        
        # Step 1: canonical clause 리스트 생성
        clauses = extract_clauses(extracted_text)
        logger.info(f"[계약서 분석] clause 추출 완료: {len(clauses)}개")
        
        # 저장 완료 후 분석 시작 (Dual RAG에서 contract_chunks 사용 가능)
        async def analyze_contract_risk():
            """법률 리스크 분석 (clause_id 기반)"""
            service = get_legal_service()
            # doc_id를 전달하여 contract_chunks도 검색
            # chunks_saved가 True면 contract_chunks가 저장되어 있으므로 검색 가능
            # clauses를 전달하여 clause_id 기반 분석 수행
            return await service.analyze_contract(
                extracted_text=extracted_text,
                description=concerns,  # 사용자 고민사항을 description으로 전달
                doc_id=doc_id if chunks_saved else None,  # 저장 실패 시 None 전달
                clauses=clauses,  # clause 리스트 전달
                contract_type=contract_type,
                user_role=user_role,
                field=field,
            )
        
        # 분석 실행
        result = await analyze_contract_risk()
        
        # result가 예외인 경우 처리 (이미 await 했으므로 예외는 자동으로 전파됨)
        if not result:
            logger.error(f"[계약서 분석] 분석 결과가 None입니다")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="계약서 분석에 실패했습니다.",
            )
        
        # 영역별 점수 계산 (기존 result에서 추출 또는 기본값)
        sections = {
            "working_hours": 0,
            "wage": 0,
            "probation_termination": 0,
            "stock_option_ip": 0,
        }
        
        # issues 변환: clause_id 기반으로 original_text 채우기
        issues = []
        clauses_by_id = {c["id"]: c for c in clauses}
        
        # [DEBUG] rawIssues 확인 (result.issues가 rawIssues)
        raw_issues_count = len(result.issues) if result and result.issues else 0
        logger.info(f"[DEBUG] rawIssues 개수: {raw_issues_count}")
        if result and result.issues and len(result.issues) > 0:
            logger.info(f"[DEBUG] rawIssues[0] 샘플: {result.issues[0]}")
            logger.info(f"[DEBUG] rawIssues[0] 속성: name={getattr(result.issues[0], 'name', 'N/A')}, clause_id={getattr(result.issues[0], 'clause_id', 'N/A')}, category={getattr(result.issues[0], 'category', 'N/A')}")
        
        logger.info(f"[계약서 분석] result.issues 개수: {raw_issues_count}")
        
        if not result:
            logger.error(f"[계약서 분석] result가 None입니다!")
        elif not result.issues:
            logger.error(f"[계약서 분석] result.issues가 비어있습니다. result 타입: {type(result)}, result.issues 타입: {type(result.issues) if hasattr(result, 'issues') else 'N/A'}")
        else:
            logger.info(f"[계약서 분석] result.issues 타입: {type(result.issues)}, 첫 번째 issue 타입: {type(result.issues[0]) if result.issues else 'N/A'}")
            for idx, issue in enumerate(result.issues):
                try:
                    # clause_id 기반으로 original_text 채우기
                    # LegalIssue는 clause_id 필드를 사용
                    clause_id = getattr(issue, 'clause_id', None)
                    original_text = ""
                    
                    if clause_id and clause_id in clauses_by_id:
                        # 새 방식: clause.content를 original_text로 사용
                        clause = clauses_by_id[clause_id]
                        original_text = clause.get("content", "")
                        logger.info(f"[계약서 분석] issue-{idx+1}: clause_id={clause_id} 기반으로 original_text 설정 (길이={len(original_text)})")
                    else:
                        # clause_id가 있지만 clauses_by_id에 없는 경우
                        if clause_id:
                            logger.warning(f"[계약서 분석] issue-{idx+1}: clause_id={clause_id}가 clauses_by_id에 없습니다. 사용 가능한 clause_id: {list(clauses_by_id.keys())[:10]}")
                            # 가장 유사한 clause 찾기 시도 (clause 번호만 추출)
                            import re
                            clause_num_match = re.search(r'clause-(\d+)', clause_id)
                            if clause_num_match:
                                clause_num = int(clause_num_match.group(1))
                                # clause 번호가 범위를 벗어나면 가장 가까운 것으로 매핑
                                if clause_num > len(clauses_by_id):
                                    # 가장 마지막 clause 사용
                                    last_clause_id = f"clause-{len(clauses_by_id)}"
                                    if last_clause_id in clauses_by_id:
                                        clause_id = last_clause_id
                                        clause = clauses_by_id[clause_id]
                                        original_text = clause.get("content", "")
                                        logger.info(f"[계약서 분석] issue-{idx+1}: clause_id를 {last_clause_id}로 수정하여 매핑 (길이={len(original_text)})")
                                    else:
                                        original_text = ""
                                else:
                                    original_text = ""
                            else:
                                original_text = ""
                        else:
                            # clause_id가 없는 경우: 레거시 방식
                            if hasattr(issue, 'original_text') and issue.original_text:
                                original_text = issue.original_text
                            elif hasattr(issue, 'description') and issue.description:
                                original_text = issue.description[:200]
                            else:
                                original_text = ""
                            logger.info(f"[계약서 분석] issue-{idx+1}: 레거시 방식으로 original_text 설정 (clause_id={clause_id})")
                    
                    # clause_id가 없으면 로깅
                    if not clause_id:
                        logger.warning(f"[계약서 분석] issue-{idx+1}: clause_id가 없습니다. issue 객체 속성: {[attr for attr in dir(issue) if not attr.startswith('_')]}")
                    
                    # issue_id 추출 (새 스키마에서는 name이 issue_id)
                    issue_id = getattr(issue, 'name', None) or getattr(issue, 'issue_id', None) or f"issue-{idx+1}"
                    
                    # category 추출 (새 스키마에서는 category 필드 사용)
                    category = getattr(issue, 'category', None) or (issue_id.lower().replace(" ", "_") if issue_id else "unknown")
                    
                    # severity 추출
                    severity = getattr(issue, 'severity', 'medium')
                    
                    # description 추출
                    description = getattr(issue, 'description', '') or getattr(issue, 'summary', '')
                    
                    # legal_basis 추출 및 구조화
                    legal_basis_raw = getattr(issue, 'legal_basis', []) or []
                    
                    # legal_basis가 이미 LegalBasisItemV2 객체 배열인지 확인
                    from models.schemas import LegalBasisItemV2
                    legal_basis = []
                    
                    if legal_basis_raw:
                        # 첫 번째 항목이 이미 LegalBasisItemV2 객체인지 확인
                        first_item = legal_basis_raw[0]
                        if isinstance(first_item, LegalBasisItemV2):
                            # 이미 구조화된 형식이면 그대로 사용
                            legal_basis = legal_basis_raw
                            logger.debug(f"[계약서 분석] issue-{idx+1}: legal_basis가 이미 구조화된 형식입니다 ({len(legal_basis)}개)")
                        elif isinstance(first_item, dict):
                            # Dict 형식이면 LegalBasisItemV2로 변환
                            for item in legal_basis_raw:
                                if isinstance(item, dict):
                                    legal_basis.append(
                                        LegalBasisItemV2(
                                            title=item.get("title", ""),
                                            snippet=item.get("snippet", ""),
                                            sourceType=item.get("sourceType", item.get("source_type", "law")),
                                            status=item.get("status"),
                                            filePath=item.get("filePath", item.get("file_path")),
                                            similarityScore=item.get("similarityScore", item.get("similarity_score")),
                                            chunkIndex=item.get("chunkIndex", item.get("chunk_index")),
                                            externalId=item.get("externalId", item.get("external_id")),
                                            reason=item.get("reason"),
                                        )
                                    )
                                else:
                                    legal_basis.append(item)
                            logger.debug(f"[계약서 분석] issue-{idx+1}: legal_basis를 Dict에서 구조화된 형식으로 변환 ({len(legal_basis)}개)")
                        else:
                            # 문자열 배열이면 retrievedContexts와 매칭하여 구조화
                            legal_basis_structured = []
                            if result.grounding:
                                # legal_basis 문자열을 retrievedContexts와 매칭
                                for basis_str in legal_basis_raw[:5]:  # 최대 5개만
                                    if not isinstance(basis_str, str):
                                        continue
                                    
                                    # retrievedContexts에서 제목이 유사한 것 찾기
                                    matched_chunk = None
                                    for chunk in result.grounding:
                                        # 제목이나 스니펫에 legal_basis 문자열이 포함되어 있는지 확인
                                        if (basis_str.lower() in chunk.title.lower() or 
                                            basis_str.lower() in chunk.snippet.lower()[:200] or
                                            chunk.title.lower() in basis_str.lower()):
                                            matched_chunk = chunk
                                            break
                                    
                                    if matched_chunk:
                                        # file_path가 없으면 external_id로 생성
                                        file_path = getattr(matched_chunk, 'file_path', None)
                                        if not file_path and getattr(matched_chunk, 'external_id', None):
                                            service = get_legal_service()
                                            file_path = service._build_file_path(
                                                matched_chunk.source_type or "law",
                                                matched_chunk.external_id
                                            )
                                        
                                        # 구조화된 형식으로 변환
                                        legal_basis_structured.append(
                                            LegalBasisItemV2(
                                                title=matched_chunk.title,
                                                snippet=matched_chunk.snippet[:500],  # 최대 500자
                                                sourceType=matched_chunk.source_type or "law",
                                                status=None,
                                                filePath=file_path,  # 스토리지 키
                                                similarityScore=getattr(matched_chunk, 'score', None),  # 벡터 유사도
                                                chunkIndex=getattr(matched_chunk, 'chunk_index', None),  # 청크 인덱스
                                                externalId=getattr(matched_chunk, 'external_id', None),  # external_id
                                                reason=None,  # 나중에 LLM으로 생성 가능
                                            )
                                        )
                                    else:
                                        # 매칭되지 않으면 문자열 그대로 사용 (하위 호환성)
                                        legal_basis_structured.append(basis_str)
                            
                            # 구조화된 형식이 있으면 사용, 없으면 원본 문자열 배열 사용
                            legal_basis = legal_basis_structured if legal_basis_structured else legal_basis_raw
                            logger.debug(f"[계약서 분석] issue-{idx+1}: legal_basis를 문자열에서 구조화된 형식으로 변환 시도 ({len(legal_basis)}개)")
                    else:
                        # legal_basis가 비어있으면 빈 배열
                        legal_basis = []
                        logger.debug(f"[계약서 분석] issue-{idx+1}: legal_basis가 비어있습니다")
                    
                    # rationale 추출
                    rationale = getattr(issue, 'rationale', None) or getattr(issue, 'reason', None) or description
                    
                    # suggested_text 추출
                    suggested_text = getattr(issue, 'suggested_text', None) or getattr(issue, 'suggested_revision', None) or ""
                    
                    # toxic_clause_detail 추출
                    toxic_clause_detail = getattr(issue, 'toxic_clause_detail', None)
                    toxic_clause_detail_v2 = None
                    if toxic_clause_detail:
                        from models.schemas import ToxicClauseDetail
                        try:
                            # LegalIssue의 toxic_clause_detail이 이미 ToxicClauseDetail 객체인 경우
                            if isinstance(toxic_clause_detail, ToxicClauseDetail):
                                toxic_clause_detail_v2 = toxic_clause_detail
                            # Dict인 경우 변환
                            elif isinstance(toxic_clause_detail, dict):
                                toxic_clause_detail_v2 = ToxicClauseDetail(
                                    clauseLocation=toxic_clause_detail.get("clause_location", ""),
                                    contentSummary=toxic_clause_detail.get("content_summary", ""),
                                    whyRisky=toxic_clause_detail.get("why_risky", ""),
                                    realWorldProblems=toxic_clause_detail.get("real_world_problems", ""),
                                    suggestedRevisionLight=toxic_clause_detail.get("suggested_revision_light", ""),
                                    suggestedRevisionFormal=toxic_clause_detail.get("suggested_revision_formal", ""),
                                )
                        except Exception as toxic_err:
                            logger.warning(f"[계약서 분석] toxic_clause_detail 변환 실패: {str(toxic_err)}")
                    
                    issue_v2 = ContractIssueV2(
                        id=issue_id,
                        category=category,
                        severity=severity,
                        summary=description,
                        originalText=original_text,  # clause.content 또는 issue.original_text
                        legalBasis=legal_basis,
                        explanation=rationale,
                        suggestedRevision=suggested_text,
                        clauseId=clause_id,  # clause_id 추가
                        toxicClauseDetail=toxic_clause_detail_v2,  # 독소조항 상세 정보
                    )
                    issues.append(issue_v2)
                    logger.debug(f"[계약서 분석] issue-{idx+1} 변환 완료: id={issue_id}, category={category}, severity={severity}")
                except Exception as issue_error:
                    logger.error(f"[계약서 분석] issue-{idx+1} 변환 실패: {str(issue_error)}", exc_info=True)
                    # 개별 issue 변환 실패해도 계속 진행
                    continue
        
        # [DEBUG] normalizedDataIssues 확인 (issues가 normalizedDataIssues)
        logger.info(f"[DEBUG] normalizedDataIssues 개수: {len(issues)}개")
        logger.info(f"[계약서 분석] 최종 issues 개수: {len(issues)}개")
        
        # [DEBUG] validIssues 확인 (현재는 issues와 동일, 필터링 없음)
        valid_issues = [i for i in issues if i.summary or i.description]  # 최소한 summary나 description이 있는 것만
        logger.info(f"[DEBUG] validIssues 개수: {len(valid_issues)}개 (summary/description 필터 적용)")
        
        # retrievedContexts 변환 (filePath, externalId, chunkIndex 포함)
        retrieved_contexts = []
        for chunk in result.grounding:
            # file_path가 없으면 external_id로 생성
            file_path = getattr(chunk, 'file_path', None)
            if not file_path and getattr(chunk, 'external_id', None):
                service = get_legal_service()
                file_path = service._build_file_path(
                    chunk.source_type or "law",
                    chunk.external_id
                )
            
            retrieved_contexts.append({
                "sourceType": chunk.source_type,
                "title": chunk.title,
                "snippet": chunk.snippet,
                "filePath": file_path,  # 스토리지 키
                "externalId": getattr(chunk, 'external_id', None),  # external_id
                "chunkIndex": getattr(chunk, 'chunk_index', None),  # chunk_index
            })
        
        # clauses에 이슈 정보 attach 및 하이라이트 생성 헬퍼 함수
        def attach_issue_info_to_clauses(clauses: List[Dict], issues: List) -> List[Dict]:
            """clauses에 이슈 정보(severity, category) attach"""
            clauses_by_id = {c["id"]: c.copy() for c in clauses}
            severity_order = {"low": 1, "medium": 2, "high": 3}
            
            for issue in issues:
                clause_id = getattr(issue, 'clauseId', None) or issue.clauseId if hasattr(issue, 'clauseId') else None
                if not clause_id:
                    continue
                
                clause = clauses_by_id.get(clause_id)
                if not clause:
                    continue
                
                # 최고 severity
                current_severity = clause.get("severity")
                new_severity = issue.severity
                if new_severity and (
                    not current_severity
                    or severity_order.get(new_severity, 0) > severity_order.get(current_severity or "low", 0)
                ):
                    clause["severity"] = new_severity
                
                # 카테고리 (첫 번째 이슈의 category 사용)
                if not clause.get("category") and issue.category:
                    clause["category"] = issue.category
            
            return list(clauses_by_id.values())
        
        def build_highlights_from_clauses(clauses: List[Dict], issues: List) -> List[Dict]:
            """clause 기준으로 하이라이트 생성"""
            highlights = []
            issues_by_clause = {}
            
            logger.info(f"[하이라이트 생성] issues 개수: {len(issues)}, clauses 개수: {len(clauses)}")
            
            # issues의 clauseId 수집
            for issue in issues:
                # ContractIssueV2는 clauseId 필드 사용
                clause_id = getattr(issue, 'clauseId', None)
                if not clause_id:
                    # LegalIssue는 clause_id 필드 사용 (레거시)
                    clause_id = getattr(issue, 'clause_id', None)
                
                if clause_id:
                    issues_by_clause.setdefault(clause_id, []).append(issue)
                    logger.debug(f"[하이라이트 생성] issue {getattr(issue, 'id', 'unknown')} -> clause_id={clause_id}")
                else:
                    logger.warning(f"[하이라이트 생성] issue {getattr(issue, 'id', 'unknown')}에 clause_id가 없습니다. issue 타입: {type(issue)}, 속성: {dir(issue) if hasattr(issue, '__dict__') else 'N/A'}")
            
            logger.info(f"[하이라이트 생성] issues_by_clause: {list(issues_by_clause.keys())}")
            
            # 사용 가능한 clause_id 목록
            available_clause_ids = set()
            for clause in clauses:
                if isinstance(clause, dict):
                    available_clause_ids.add(clause.get("id"))
                else:
                    available_clause_ids.add(getattr(clause, 'id', None))
            logger.info(f"[하이라이트 생성] 사용 가능한 clause_id: {sorted(available_clause_ids)}")
            
            # 매칭되지 않는 clause_id 확인
            unmatched_clause_ids = set(issues_by_clause.keys()) - available_clause_ids
            if unmatched_clause_ids:
                logger.warning(f"[하이라이트 생성] [경고] 매칭되지 않는 clause_id: {unmatched_clause_ids}")
                # 가장 가까운 clause_id로 매핑 시도
                for unmatched_id in unmatched_clause_ids:
                    import re
                    num_match = re.search(r'clause-(\d+)', unmatched_id)
                    if num_match:
                        unmatched_num = int(num_match.group(1))
                        # 가장 가까운 clause 찾기
                        best_match = None
                        best_diff = float('inf')
                        for clause_id in available_clause_ids:
                            if clause_id:
                                match = re.search(r'clause-(\d+)', clause_id)
                                if match:
                                    clause_num = int(match.group(1))
                                    diff = abs(clause_num - unmatched_num)
                                    if diff < best_diff:
                                        best_diff = diff
                                        best_match = clause_id
                        
                        if best_match and best_diff <= 3:  # 3 이내 차이만 허용
                            logger.info(f"[하이라이트 생성] clause_id {unmatched_id}를 {best_match}로 매핑 (차이: {best_diff})")
                            # issues_by_clause 업데이트
                            if unmatched_id in issues_by_clause:
                                issues_by_clause.setdefault(best_match, []).extend(issues_by_clause[unmatched_id])
                                del issues_by_clause[unmatched_id]
            
            # clauses와 매칭
            for clause in clauses:
                # clause가 Dict인지 ClauseV2인지 확인
                if isinstance(clause, dict):
                    clause_id = clause.get("id")
                    clause_content = clause.get("content", "")
                    clause_start = clause.get("startIndex", 0)
                    clause_end = clause.get("endIndex", 0)
                else:
                    # ClauseV2 객체
                    clause_id = getattr(clause, 'id', None)
                    clause_content = getattr(clause, 'content', "")
                    clause_start = getattr(clause, 'startIndex', 0)
                    clause_end = getattr(clause, 'endIndex', 0)
                
                if not clause_id:
                    logger.warning(f"[하이라이트 생성] clause에 id가 없습니다: {clause}")
                    continue
                
                clause_issues = issues_by_clause.get(clause_id, [])
                if not clause_issues:
                    continue
                
                logger.info(f"[하이라이트 생성] clause {clause_id}에 {len(clause_issues)}개 이슈 매칭됨")
                
                # clause에 걸린 이슈 중 최고 severity
                severity = max(
                    (getattr(i, 'severity', 'low') for i in clause_issues),
                    key=lambda s: {"low": 1, "medium": 2, "high": 3}.get(s or "low", 0),
                    default="low",
                )
                
                highlights.append({
                    "text": clause_content,
                    "startIndex": clause_start,
                    "endIndex": clause_end,
                    "severity": severity,
                    "clauseId": clause_id,
                    "issueIds": [getattr(i, 'id', str(i)) for i in clause_issues],
                })
            
            logger.info(f"[하이라이트 생성] 최종 하이라이트 개수: {len(highlights)}")
            return highlights
        
        # clauses에 이슈 정보 attach 및 하이라이트 생성
        highlighted_texts = []
        
        try:
            # clauses를 Dict 형식으로 변환 (하이라이트 생성 전에)
            clauses_dict = [
                {
                    "id": c.get("id") if isinstance(c, dict) else getattr(c, 'id', ''),
                    "title": c.get("title") if isinstance(c, dict) else getattr(c, 'title', ''),
                    "content": c.get("content") if isinstance(c, dict) else getattr(c, 'content', ''),
                    "articleNumber": c.get("articleNumber") if isinstance(c, dict) else getattr(c, 'articleNumber', None),
                    "startIndex": c.get("startIndex", 0) if isinstance(c, dict) else getattr(c, 'startIndex', 0),
                    "endIndex": c.get("endIndex", 0) if isinstance(c, dict) else getattr(c, 'endIndex', 0),
                    "category": c.get("category") if isinstance(c, dict) else getattr(c, 'category', None),
                }
                for c in clauses
            ]
            
            # 1. clauses에 이슈 정보 attach (severity, category)
            clauses_dict = attach_issue_info_to_clauses(clauses_dict, issues)
            
            # 2. clause 기준으로 하이라이트 생성 (Dict 리스트)
            highlighted_texts_dict = build_highlights_from_clauses(clauses_dict, issues)
            
            # 3. clauses를 ClauseV2 형식으로 변환
            clauses_v2 = [
                ClauseV2(
                    id=clause["id"],
                    title=clause["title"],
                    content=clause["content"],
                    articleNumber=clause.get("articleNumber"),
                    startIndex=clause.get("startIndex", 0),
                    endIndex=clause.get("endIndex", 0),
                    category=clause.get("category")
                )
                for clause in clauses
            ]
            clauses = clauses_v2
            
            # 4. highlighted_texts를 HighlightedTextV2 형식으로 변환 (프론트엔드 호환성)
            # 프론트엔드는 issueId를 기대하므로 각 issueId마다 별도로 생성
            highlighted_texts = []
            for ht_dict in highlighted_texts_dict:
                issue_ids = ht_dict.get("issueIds", [])
                if issue_ids:
                    # 각 issueId마다 별도의 HighlightedTextV2 생성
                    for issue_id in issue_ids:
                        highlighted_texts.append(
                            HighlightedTextV2(
                                text=ht_dict["text"],
                                startIndex=ht_dict["startIndex"],
                                endIndex=ht_dict["endIndex"],
                                severity=ht_dict["severity"],
                                issueId=issue_id,
                            )
                        )
                else:
                    # issueIds가 없으면 clauseId를 issueId로 사용 (하위 호환성)
                    highlighted_texts.append(
                        HighlightedTextV2(
                            text=ht_dict["text"],
                            startIndex=ht_dict["startIndex"],
                            endIndex=ht_dict["endIndex"],
                            severity=ht_dict["severity"],
                            issueId=ht_dict.get("clauseId", ""),
                        )
                    )
            
            # 5. issue에 startIndex, endIndex 추가 (clause 기준)
            for issue_v2 in issues:
                if issue_v2.clauseId:
                    # clauses_dict에서 찾기
                    matched_clause = next((c for c in clauses_dict if c.get("id") == issue_v2.clauseId), None)
                    if matched_clause:
                        issue_v2.startIndex = matched_clause.get("startIndex")
                        issue_v2.endIndex = matched_clause.get("endIndex")
                        logger.debug(f"[하이라이트 생성] issue {issue_v2.id}에 startIndex={issue_v2.startIndex}, endIndex={issue_v2.endIndex} 설정")
                    else:
                        logger.warning(f"[하이라이트 생성] issue {issue_v2.id}의 clauseId {issue_v2.clauseId}를 clauses_dict에서 찾을 수 없음")
            
            logger.info(f"[계약서 분석] clause 기반 처리 완료: {len(clauses)}개 조항, {len(highlighted_texts)}개 하이라이트")
            
            # 검증: clauses가 비어있으면 경고
            if not clauses:
                logger.warning(f"[계약서 분석] [경고] 조항이 추출되지 않았습니다.")
        except Exception as e:
            logger.warning(f"[계약서 분석] clause 기반 처리 실패: {str(e)}", exc_info=True)
            # 실패해도 계속 진행
        
        # 결과 저장 (DB에 저장)
        # contractText 설정 전 확인
        logger.info(f"[계약서 분석] ContractAnalysisResponseV2 생성 전: extracted_text 길이={len(extracted_text) if extracted_text else 0}, extracted_text 타입={type(extracted_text)}")
        
        # extracted_text가 None이면 빈 문자열로 변환
        contract_text_value = extracted_text if extracted_text else ""
        logger.info(f"[계약서 분석] contractText 값 설정: 길이={len(contract_text_value)}, 비어있음={not contract_text_value or contract_text_value.strip() == ''}")
        
        # 새로운 독소조항 탐지 필드 추출
        one_line_summary = getattr(result, 'one_line_summary', None)
        risk_traffic_light = getattr(result, 'risk_traffic_light', None)
        top3_action_points = getattr(result, 'top3_action_points', None)
        risk_summary_table = getattr(result, 'risk_summary_table', None)
        toxic_clauses = getattr(result, 'toxic_clauses', None)
        negotiation_questions = getattr(result, 'negotiation_questions', None)
        
        # risk_summary_table을 Dict로 변환 (JSON 직렬화를 위해)
        risk_summary_table_dict = None
        if risk_summary_table:
            from models.schemas import RiskSummaryItem
            risk_summary_table_dict = [
                {
                    "item": item.item,
                    "riskLevel": item.riskLevel,
                    "problemPoint": item.problemPoint,
                    "simpleExplanation": item.simpleExplanation,
                    "revisionKeyword": item.revisionKeyword,
                }
                for item in risk_summary_table
            ]
        
        # toxic_clauses를 Dict로 변환
        toxic_clauses_dict = None
        if toxic_clauses:
            from models.schemas import ToxicClauseDetail
            toxic_clauses_dict = [
                {
                    "clauseLocation": detail.clauseLocation,
                    "contentSummary": detail.contentSummary,
                    "whyRisky": detail.whyRisky,
                    "realWorldProblems": detail.realWorldProblems,
                    "suggestedRevisionLight": detail.suggestedRevisionLight,
                    "suggestedRevisionFormal": detail.suggestedRevisionFormal,
                }
                for detail in toxic_clauses
            ]
        
        analysis_result = ContractAnalysisResponseV2(
            docId=doc_id,
            title=doc_title,
            riskScore=result.risk_score,
            riskLevel=result.risk_level,
            sections=sections,
            issues=issues,
            summary=result.summary,
            retrievedContexts=retrieved_contexts,
            contractText=contract_text_value,  # 계약서 원문 텍스트 포함 (None이면 빈 문자열)
            clauses=clauses,  # 조항 목록
            highlightedTexts=highlighted_texts,  # 하이라이트된 텍스트
            createdAt=datetime.utcnow().isoformat() + "Z",
            # 새로운 독소조항 탐지 필드
            oneLineSummary=one_line_summary,
            riskTrafficLight=risk_traffic_light,
            top3ActionPoints=top3_action_points,
            riskSummaryTable=risk_summary_table_dict,
            toxicClauses=toxic_clauses_dict,
            negotiationQuestions=negotiation_questions,
        )
        
        # 생성 후 확인
        logger.info(f"[계약서 분석] ContractAnalysisResponseV2 생성 후: contractText 길이={len(analysis_result.contractText) if analysis_result.contractText else 0}, contractText 존재={bool(analysis_result.contractText)}")
        logger.info(f"[계약서 분석] 응답 생성 완료: docId={doc_id}, title={doc_title}, issues={len(issues)}개")
        
        # DB에 저장 시도
        try:
            storage_service = get_storage_service()
            # file_name 필드를 확실하게 채우기 위해 우선순위 적용
            # original_filename은 file.filename 또는 doc_title 사용
            original_filename_for_db = file.filename if file.filename and file.filename.strip() else doc_title
            
            logger.info(f"[계약서 분석] DB 저장 시도: doc_id={doc_id}, title={doc_title}, original_filename={original_filename_for_db}, file.filename={file.filename}")
            
            # DB 저장 전 데이터 요약 로깅
            issues_for_db = [{
                "id": issue.id,
                "category": issue.category,
                "severity": issue.severity,
                "summary": issue.summary,
                "originalText": issue.originalText,
                "legalBasis": issue.legalBasis,
                "explanation": issue.explanation,
                "suggestedRevision": issue.suggestedRevision,
            } for issue in issues]
            
            logger.info(f"[DB 저장] 저장할 데이터 요약:")
            logger.info(f"  - doc_id: {doc_id}")
            logger.info(f"  - title: {doc_title}")
            logger.info(f"  - risk_score: {result.risk_score}, risk_level: {result.risk_level}")
            logger.info(f"  - summary 길이: {len(result.summary)}")
            logger.info(f"  - issues 개수: {len(issues_for_db)}")
            logger.info(f"  - contract_text 길이: {len(extracted_text) if extracted_text else 0}")
            logger.info(f"  - retrieved_contexts 개수: {len(retrieved_contexts)}")
            for idx, issue in enumerate(issues_for_db[:3]):  # 처음 3개만 로깅
                logger.info(f"  - issue[{idx}]: id={issue['id']}, category={issue['category']}, severity={issue['severity']}, summary={issue['summary'][:50]}")
            
            # clauses와 highlightedTexts를 DB 저장 형식으로 변환
            clauses_for_db = [
                {
                    "id": clause.id,
                    "title": clause.title,
                    "content": clause.content,
                    "articleNumber": clause.articleNumber,
                    "startIndex": clause.startIndex,
                    "endIndex": clause.endIndex,
                    "category": clause.category,
                }
                for clause in clauses
            ] if clauses else []
            
            # highlighted_texts는 HighlightedTextV2 객체 리스트이므로 Dict로 변환
            highlighted_texts_for_db = []
            if highlighted_texts:
                for ht in highlighted_texts:
                    if isinstance(ht, dict):
                        # 이미 Dict면 그대로 사용
                        highlighted_texts_for_db.append(ht)
                    else:
                        # HighlightedTextV2 객체면 Dict로 변환
                        highlighted_texts_for_db.append({
                            "text": getattr(ht, 'text', ''),
                            "startIndex": getattr(ht, 'startIndex', 0),
                            "endIndex": getattr(ht, 'endIndex', 0),
                            "severity": getattr(ht, 'severity', 'low'),
                            "issueId": getattr(ht, 'issueId', ''),
                            "clauseId": getattr(ht, 'clauseId', None),
                            "issueIds": getattr(ht, 'issueIds', []),
                        })
            logger.info(f"[DB 저장] highlighted_texts_for_db 개수: {len(highlighted_texts_for_db)}")
            
            await storage_service.save_contract_analysis(
                doc_id=doc_id,
                title=doc_title,
                original_filename=original_filename_for_db,  # file.filename이 None이면 doc_title 사용
                doc_type=doc_type,
                risk_score=result.risk_score,
                risk_level=result.risk_level,
                sections=sections,
                summary=result.summary,
                retrieved_contexts=retrieved_contexts,
                issues=issues_for_db,
                user_id=x_user_id,
                contract_text=extracted_text,  # 계약서 원문 텍스트 저장
                clauses=clauses_for_db,  # 조항 목록 저장
                highlighted_texts=highlighted_texts_for_db,  # 하이라이트된 텍스트 저장
            )
            logger.info(f"[계약서 분석] DB 저장 완료: doc_id={doc_id}")
        except Exception as save_error:
            logger.warning(f"[계약서 분석] DB 저장 실패, 메모리에만 저장: {str(save_error)}", exc_info=True)
            # Fallback: 메모리에 저장
            _contract_analyses[doc_id] = analysis_result
            logger.info(f"[계약서 분석] 메모리에 저장 완료: doc_id={doc_id}, contractText 길이={len(analysis_result.contractText) if analysis_result.contractText else 0}")
        
        # 응답 직렬화 확인
        response_dict = analysis_result.model_dump()
        contract_text_length = len(response_dict.get('contractText', '')) if response_dict.get('contractText') else 0
        
        # 상세 로깅
        logger.info(f"[계약서 분석] 응답 생성 완료:")
        logger.info(f"  - docId: {response_dict.get('docId')}")
        logger.info(f"  - contractText 길이: {contract_text_length}")
        logger.info(f"  - contractText 존재: {bool(response_dict.get('contractText'))}")
        logger.info(f"  - contractText 미리보기: {response_dict.get('contractText', '')[:100] if response_dict.get('contractText') else '(없음)'}")
        logger.info(f"  - 응답 키: {list(response_dict.keys())}")
        logger.info(f"  - issues 개수: {len(response_dict.get('issues', []))}")
        logger.info(f"  - retrievedContexts 개수: {len(response_dict.get('retrievedContexts', []))}")
        
        # contractText가 없으면 경고
        if not response_dict.get('contractText') or contract_text_length == 0:
            logger.warning(f"[계약서 분석] [경고] contractText가 응답에 없습니다! extracted_text 길이: {len(extracted_text) if extracted_text else 0}")
        
        # v2 형식 검증: 필수 필드 확인
        required_fields = ['docId', 'title', 'riskScore', 'riskLevel', 'sections', 'issues', 'summary', 'retrievedContexts', 'contractText', 'createdAt']
        missing_fields = [field for field in required_fields if field not in response_dict]
        if missing_fields:
            logger.error(f"[계약서 분석] ❌ v2 형식 필수 필드 누락: {missing_fields}")
        else:
            logger.info(f"[계약서 분석] ✅ v2 형식 검증 통과")
        
        return analysis_result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"계약서 분석 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"계약서 분석 중 오류가 발생했습니다: {str(e)}",
        )
    finally:
        # 임시 파일 삭제
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


@router.post("/compare-contracts", response_model=ContractComparisonResponseV2)
async def compare_contracts(
    request: ContractComparisonRequestV2,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id", description="사용자 ID"),
):
    """
    계약서 버전 비교 (이전 vs 새 계약서)
    """
    try:
        storage_service = get_storage_service()
        
        # 이전 계약서 조회
        old_contract = await storage_service.get_contract_analysis(request.oldContractId)
        if not old_contract:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"이전 계약서를 찾을 수 없습니다: {request.oldContractId}"
            )
        
        # 새 계약서 조회
        new_contract = await storage_service.get_contract_analysis(request.newContractId)
        if not new_contract:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"새 계약서를 찾을 수 없습니다: {request.newContractId}"
            )
        
        # 변경된 조항 찾기
        changed_clauses = []
        old_clauses = {clause.get("id"): clause for clause in old_contract.get("clauses", [])}
        new_clauses = {clause.get("id"): clause for clause in new_contract.get("clauses", [])}
        
        # 새로 추가된 조항
        for clause_id, clause in new_clauses.items():
            if clause_id not in old_clauses:
                changed_clauses.append({
                    "type": "added",
                    "clauseId": clause_id,
                    "title": clause.get("title"),
                    "content": clause.get("content")
                })
        
        # 삭제된 조항
        for clause_id, clause in old_clauses.items():
            if clause_id not in new_clauses:
                changed_clauses.append({
                    "type": "removed",
                    "clauseId": clause_id,
                    "title": clause.get("title"),
                    "content": clause.get("content")
                })
        
        # 수정된 조항
        for clause_id in old_clauses.keys() & new_clauses.keys():
            old_clause = old_clauses[clause_id]
            new_clause = new_clauses[clause_id]
            if old_clause.get("content") != new_clause.get("content"):
                changed_clauses.append({
                    "type": "modified",
                    "clauseId": clause_id,
                    "title": new_clause.get("title"),
                    "oldContent": old_clause.get("content"),
                    "newContent": new_clause.get("content")
                })
        
        # 위험도 변화
        risk_change = {
            "oldRiskScore": old_contract.get("riskScore", 0),
            "newRiskScore": new_contract.get("riskScore", 0),
            "oldRiskLevel": old_contract.get("riskLevel", "medium"),
            "newRiskLevel": new_contract.get("riskLevel", "medium"),
            "riskScoreDelta": new_contract.get("riskScore", 0) - old_contract.get("riskScore", 0)
        }
        
        # 비교 요약 생성
        summary = f"총 {len(changed_clauses)}개 조항이 변경되었습니다. "
        summary += f"위험도: {risk_change['oldRiskScore']:.1f} → {risk_change['newRiskScore']:.1f} "
        summary += f"({risk_change['riskScoreDelta']:+.1f})"
        
        # 응답 생성
        old_contract_response = ContractAnalysisResponseV2(**old_contract)
        new_contract_response = ContractAnalysisResponseV2(**new_contract)
        
        return ContractComparisonResponseV2(
            oldContract=old_contract_response,
            newContract=new_contract_response,
            changedClauses=changed_clauses,
            riskChange=risk_change,
            summary=summary
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"계약서 비교 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"계약서 비교 중 오류가 발생했습니다: {str(e)}",
        )


@router.post("/rewrite-clause", response_model=ClauseRewriteResponseV2)
async def rewrite_clause(
    request: ClauseRewriteRequestV2,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id", description="사용자 ID"),
):
    """
    조항 자동 리라이트 (위험 조항을 안전한 문구로 수정)
    """
    try:
        rewrite_tool = RewriteTool()
        
        # issue 정보 가져오기 (있는 경우)
        legal_basis = request.legalBasis or []
        
        # legalBasis가 없고 issueId가 있으면 issue 정보 조회 시도
        if not legal_basis and request.issueId:
            try:
                storage_service = get_storage_service()
                # issue 정보 조회 (docId는 알 수 없으므로 legalBasis만 전달받은 것으로 사용)
                # 실제로는 docId를 함께 받아서 issue를 조회해야 하지만, 
                # 현재는 프론트엔드에서 legalBasis를 함께 보내도록 함
                pass
            except Exception as e:
                logger.warning(f"issue 정보 조회 실패 (무시): {str(e)}")
        
        # 리라이트 실행
        result = await rewrite_tool.execute(
            original_text=request.originalText,
            issue_id=request.issueId,
            legal_basis=legal_basis,
            contract_type="employment"  # 기본값
        )
        
        return ClauseRewriteResponseV2(
            originalText=result["originalText"],
            rewrittenText=result["rewrittenText"],
            explanation=result["explanation"],
            legalBasis=result["legalBasis"]
        )
        
    except Exception as e:
        logger.error(f"조항 리라이트 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"조항 리라이트 중 오류가 발생했습니다: {str(e)}",
        )


@router.get("/contracts/history", response_model=List[dict])
async def get_contract_history(
    x_user_id: str = Header(..., alias="X-User-Id", description="사용자 ID"),
    limit: int = Query(20, ge=1, le=100, description="조회 개수"),
    offset: int = Query(0, ge=0, description="오프셋"),
):
    """
    사용자별 계약서 분석 히스토리 조회
    """
    try:
        storage_service = get_storage_service()
        history = await storage_service.get_user_contract_analyses(
            user_id=x_user_id,
            limit=limit,
            offset=offset,
        )
        return history
    except Exception as e:
        logger.error(f"히스토리 조회 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"히스토리 조회 중 오류가 발생했습니다: {str(e)}",
        )


@router.get("/contracts/{doc_id}", response_model=ContractAnalysisResponseV2)
async def get_contract_analysis(
    doc_id: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id", description="사용자 ID (옵션, 필터링에 사용하지 않음)"),
):
    """
    계약서 분석 결과 조회
    
    doc_id만으로 조회하므로 자신의 히스토리가 아니어도 확인 가능합니다.
    """
    logger.info(f"[계약서 조회] doc_id={doc_id}, user_id={x_user_id} 조회 시작 (user_id 필터링 없음)")
    
    # 임시 ID인 경우 메모리에서만 조회
    if doc_id.startswith("temp-"):
        logger.warning(f"[계약서 조회] 임시 ID 감지: {doc_id}, 메모리에서만 조회")
        if doc_id in _contract_analyses:
            result = _contract_analyses[doc_id]
            contract_text_length = len(result.contractText) if result.contractText else 0
            logger.info(f"[계약서 조회] 메모리에서 찾음: doc_id={doc_id}, contractText 길이={contract_text_length}")
            return result
        else:
            logger.warning(f"[계약서 조회] 메모리에서도 찾을 수 없음: {doc_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"임시 분석 결과를 찾을 수 없습니다. (doc_id: {doc_id})",
            )
    
    # DB에서 조회 시도 (user_id 필터링 없이 doc_id만으로 조회)
    try:
        storage_service = get_storage_service()
        # user_id를 전달하지 않아도 되지만, 호환성을 위해 전달 (내부에서 필터링하지 않음)
        result = await storage_service.get_contract_analysis(doc_id, user_id=None)
        if result:
            contract_text_length = len(result.get('contractText', '')) if result.get('contractText') else 0
            logger.info(f"[계약서 조회] DB에서 찾음: doc_id={doc_id}, contractText 길이={contract_text_length} (user_id 필터링 없음)")
            return ContractAnalysisResponseV2(**result)
        else:
            logger.warning(f"[계약서 조회] DB에서 찾을 수 없음: doc_id={doc_id}")
    except Exception as e:
        logger.error(f"[계약서 조회] DB 조회 실패: {str(e)}", exc_info=True)
    
    # Fallback: 메모리에서 조회
    if doc_id in _contract_analyses:
        result = _contract_analyses[doc_id]
        contract_text_length = len(result.contractText) if result.contractText else 0
        logger.info(f"[계약서 조회] 메모리에서 찾음: doc_id={doc_id}, contractText 길이={contract_text_length}")
        return result
    
    logger.error(f"[계약서 조회] 어디서도 찾을 수 없음: doc_id={doc_id}")
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"분석 결과를 찾을 수 없습니다. (doc_id: {doc_id})",
    )


@router.post("/analyze-situation", response_model=dict)
async def analyze_situation(
    payload: SituationRequestV2,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id", description="사용자 ID"),
):
    """
    텍스트 기반 상황 설명 + 메타 정보 → 맞춤형 상담 분석
    """
    # logger를 명시적으로 참조 (스코프 문제 방지)
    import logging
    _logger = logging.getLogger(__name__)
    
    try:
        service = get_legal_service()
        
        # LangGraph 워크플로우 사용 (RAG 검색 결과를 더 정확하게 활용)
        result = await service.analyze_situation_detailed(
            category_hint=payload.category or "unknown",
            situation_text=payload.situation,
            summary=None,
            details=None,
            employment_type=payload.employmentType,
            work_period=payload.workPeriod,
            weekly_hours=None,
            is_probation=None,
            social_insurance=", ".join(payload.socialInsurance) if payload.socialInsurance else None,
            use_workflow=True,  # 워크플로우 활성화: 분류 → 필터링 → RAG 검색 → 리포트 생성
        )
        
        # 디버깅: 워크플로우 결과 확인
        _logger.info(f"[analyze-situation] 워크플로우 결과 키: {list(result.keys()) if isinstance(result, dict) else 'Not a dict'}")
        _logger.info(f"[analyze-situation] 워크플로우 결과 summary 존재: {bool(result.get('summary'))}, 길이: {len(result.get('summary', ''))}자")
        _logger.info(f"[analyze-situation] 워크플로우 결과 summary (처음 200자): {result.get('summary', '')[:200]}")
        _logger.info(f"[analyze-situation] 워크플로우 결과 findings 존재: {bool(result.get('findings'))}, 개수: {len(result.get('findings', []))}개")
        _logger.info(f"[analyze-situation] 워크플로우 결과 criteria: {result.get('criteria', 'NOT FOUND')}")
        _logger.info(f"[analyze-situation] 워크플로우 결과 criteria 타입: {type(result.get('criteria', []))}")
        _logger.info(f"[analyze-situation] 워크플로우 결과 criteria 길이: {len(result.get('criteria', [])) if isinstance(result.get('criteria', []), list) else 'Not a list'}")
        
        # v2 스펙에 맞춰 변환
        risk_level = "low"
        if result["risk_score"] >= 70:
            risk_level = "high"
        elif result["risk_score"] >= 40:
            risk_level = "medium"
        
        # action_plan, checklist, recommendations는 더 이상 사용하지 않음 (레거시 호환을 위해 빈 배열로 DB 저장)
        checklist = []
        
        # scripts 변환 (이메일 템플릿 구조: {subject, body})
        scripts_data = result.get("scripts", {})
        scripts = None
        if scripts_data:
            # to_company 변환
            to_company_raw = scripts_data.get("to_company", {})
            to_company_template = None
            if isinstance(to_company_raw, dict) and "subject" in to_company_raw and "body" in to_company_raw:
                from models.schemas import EmailTemplateV2
                to_company_template = EmailTemplateV2(
                    subject=to_company_raw.get("subject", ""),
                    body=to_company_raw.get("body", "")
                )
            elif isinstance(to_company_raw, str):
                # 레거시 형식 (문자열)인 경우 기본 구조로 변환
                from models.schemas import EmailTemplateV2
                to_company_template = EmailTemplateV2(
                    subject="근로계약 관련 확인 요청",
                    body=to_company_raw[:200] if len(to_company_raw) > 200 else to_company_raw
                )
            
            # to_advisor 변환
            to_advisor_raw = scripts_data.get("to_advisor", {})
            to_advisor_template = None
            if isinstance(to_advisor_raw, dict) and "subject" in to_advisor_raw and "body" in to_advisor_raw:
                from models.schemas import EmailTemplateV2
                to_advisor_template = EmailTemplateV2(
                    subject=to_advisor_raw.get("subject", ""),
                    body=to_advisor_raw.get("body", "")
                )
            elif isinstance(to_advisor_raw, str):
                # 레거시 형식 (문자열)인 경우 기본 구조로 변환
                from models.schemas import EmailTemplateV2
                to_advisor_template = EmailTemplateV2(
                    subject="노무 상담 요청",
                    body=to_advisor_raw[:200] if len(to_advisor_raw) > 200 else to_advisor_raw
                )
            
            if to_company_template or to_advisor_template:
                scripts = ScriptsV2(
                    toCompany=to_company_template,
                    toAdvisor=to_advisor_template,
                )
        
        # relatedCases 변환: grounding_chunks를 문서 단위로 그룹핑하여 새 구조로 구성
        from collections import defaultdict
        from core.file_utils import get_document_file_url
        
        # grounding_chunks를 documentTitle 또는 externalId 기준으로 그룹핑
        grounding_chunks = result.get("grounding_chunks", [])
        criteria_list = result.get("criteria", [])
        
        # criteria에서 usageReason 매핑 생성 (snippet 기반)
        snippet_to_usage_reason = {}
        for criterion in criteria_list:
            snippet_text = criterion.get("snippet", "")
            usage_reason = criterion.get("usageReason", "")
            if snippet_text and usage_reason:
                # snippet의 앞부분을 키로 사용 (유사도 매칭용)
                snippet_key = snippet_text[:100].strip()
                snippet_to_usage_reason[snippet_key] = usage_reason
        
        grouped_by_document = defaultdict(list)
        
        # grounding_chunks를 기반으로 그룹핑
        for chunk in grounding_chunks:
            # chunk가 dict인지 객체인지 확인
            if isinstance(chunk, dict):
                title = chunk.get("title", "")
                source_type = chunk.get("source_type", "law")
                external_id = chunk.get("external_id") or chunk.get("externalId")
                snippet = chunk.get("snippet", "")
                score = chunk.get("score", 0.0)
                source_id = chunk.get("source_id", "")
            else:
                title = getattr(chunk, "title", "")
                source_type = getattr(chunk, "source_type", "law")
                external_id = getattr(chunk, "external_id", None)
                snippet = getattr(chunk, "snippet", "")
                score = getattr(chunk, "score", 0.0)
                source_id = getattr(chunk, "source_id", "")
            
            # 키 결정: external_id가 있으면 사용, 없으면 title 사용
            group_key = external_id if external_id else title
            
            if group_key:
                grouped_by_document[group_key].append({
                    "title": title,
                    "source_type": source_type,
                    "external_id": external_id,
                    "snippet": snippet,
                    "score": score,
                    "source_id": source_id,
                })
        
        # 그룹별로 relatedCase 구성
        related_cases = []
        for group_key, chunk_items in list(grouped_by_document.items())[:5]:  # 최대 5개 문서
            if not chunk_items:
                continue
            
            # 첫 번째 chunk에서 공통 정보 추출
            first_chunk = chunk_items[0]
            document_title = first_chunk.get("title", "")
            source_type = first_chunk.get("source_type", "law")
            external_id = first_chunk.get("external_id") or group_key
            
            # fileUrl 생성
            file_url = None
            if external_id:
                try:
                    file_url = get_document_file_url(
                        external_id=external_id,
                        source_type=source_type,
                        expires_in=3600
                    )
                except Exception as e:
                    _logger.warning(f"relatedCase fileUrl 생성 실패 (external_id={external_id}, sourceType={source_type}): {str(e)}")
            
            # overallSimilarity 계산 (가장 높은 score 사용)
            overall_similarity = max(
                float(chunk.get("score", 0.0))
                for chunk in chunk_items
            )
            
            # summary 생성 (문서 제목 기반으로 간단한 설명 생성)
            # TODO: 나중에 LLM으로 더 나은 summary 생성 가능
            if document_title:
                # 문서 제목에서 요약 생성
                if "표준" in document_title and "계약" in document_title:
                    summary = f"{document_title}의 계약 조항을 참고하여 법적 판단 기준으로 사용했습니다."
                elif "법" in document_title or "규칙" in document_title:
                    summary = f"{document_title}의 법령 조항을 참고하여 법적 판단 기준으로 사용했습니다."
                else:
                    summary = f"{document_title}의 내용을 참고하여 법적 판단 기준으로 사용했습니다."
            else:
                summary = "관련 법령 및 표준 문서를 참고하여 법적 판단 기준으로 사용했습니다."
            
            # snippets 배열 구성
            snippets = []
            for chunk in chunk_items:
                snippet_text = chunk.get("snippet", "")
                similarity_score = float(chunk.get("score", 0.0))
                
                # usageReason 찾기 (criteria에서 매칭)
                usage_reason = ""
                snippet_key = snippet_text[:100].strip()
                if snippet_key in snippet_to_usage_reason:
                    usage_reason = snippet_to_usage_reason[snippet_key]
                else:
                    # 매칭 실패 시 snippet 기반으로 구체적인 usageReason 생성
                    snippet_prefix = snippet_text[:200].strip() if snippet_text else ""
                    
                    # snippet에서 핵심 쟁점 키워드 추출
                    issue_keywords = []
                    if any(kw in snippet_prefix for kw in ["행사기간", "행사 기간", "행사기한"]):
                        issue_keywords.append("행사기간")
                    if any(kw in snippet_prefix for kw in ["재직", "재임", "근무기간"]):
                        issue_keywords.append("재직요건")
                    if any(kw in snippet_prefix for kw in ["해고", "계약해지", "해지"]):
                        issue_keywords.append("해고 예고")
                    if any(kw in snippet_prefix for kw in ["선급금", "선금", "계약금"]):
                        issue_keywords.append("선급금")
                    if any(kw in snippet_prefix for kw in ["지연", "배상", "이자"]):
                        issue_keywords.append("지연배상")
                    if any(kw in snippet_prefix for kw in ["임금", "급여", "지급일"]):
                        issue_keywords.append("임금지급일")
                    if any(kw in snippet_prefix for kw in ["수습", "수습기간"]):
                        issue_keywords.append("수습기간")
                    if any(kw in snippet_prefix for kw in ["연장근로", "야간근로", "휴일근로"]):
                        issue_keywords.append("연장근로수당")
                    
                    # snippet 핵심 내용 요약 (첫 100자)
                    snippet_summary = snippet_prefix[:100].replace("\n", " ").strip()
                    
                    # 문서 타입에 따른 판단 포인트
                    if issue_keywords:
                        issue_text = ", ".join(issue_keywords[:2])  # 최대 2개만
                        if "표준" in document_title and "계약" in document_title:
                            usage_reason = f"이 조항은 {issue_text}에 대한 규정을 포함하고 있어, 현재 사용자 계약서의 해당 조항이 불명확하거나 과도하게 설정되어 있는지 비교·판단하는 기준으로 사용했습니다."
                        elif "법" in document_title or "규칙" in document_title:
                            usage_reason = f"이 조항은 {issue_text}에 대한 법적 요건을 규정하고 있어, 현재 상황에서 해당 요건이 충족되었는지 판단하는 근거로 활용했습니다."
                        else:
                            usage_reason = f"이 조항은 {issue_text}에 대한 내용을 다루고 있어, 현재 사용자 상황/계약서에서 해당 부분을 평가하는 기준으로 사용했습니다."
                    else:
                        # 키워드가 없으면 snippet 요약 기반으로 생성
                        if "표준" in document_title and "계약" in document_title:
                            usage_reason = f"이 조항은 '{snippet_summary}...'의 내용을 규정하고 있어, 현재 계약서의 관련 조항과 비교하여 적절성을 판단하는 기준으로 사용했습니다."
                        elif "법" in document_title or "규칙" in document_title:
                            usage_reason = f"이 조항은 '{snippet_summary}...'의 법적 요건을 명시하고 있어, 현재 상황에서 해당 요건 충족 여부를 판단하는 근거로 활용했습니다."
                        else:
                            usage_reason = f"이 조항은 '{snippet_summary}...'의 내용을 포함하고 있어, 현재 사용자 상황과 비교하여 평가하는 기준으로 사용했습니다."
                
                snippets.append({
                    "snippet": snippet_text[:500] if len(snippet_text) > 500 else snippet_text,
                    "similarityScore": similarity_score,
                    "usageReason": usage_reason,
                })
            
            related_cases.append({
                "documentTitle": document_title,
                "fileUrl": file_url,
                "sourceType": source_type,
                "externalId": external_id,
                "overallSimilarity": overall_similarity,
                "summary": summary,
                "snippets": snippets,
            })
        
        _logger.info(f"relatedCases 문서 단위 그룹핑 완료: {len(related_cases)}개 문서 (원본 grounding_chunks: {len(grounding_chunks)}개)")
        
        # sources 변환 (RAG 검색 출처)
        sources = []
        grounding_chunks = result.get("grounding_chunks", [])
        # 공통 유틸 함수 사용 (fileUrl 생성용)
        from core.file_utils import get_document_file_url
        # DB 조회용 vector_store 인스턴스
        from core.supabase_vector_store import SupabaseVectorStore
        vector_store = SupabaseVectorStore()
        # snippet 분석 함수 (이미 위에서 import됨)
        
        for chunk in grounding_chunks:
            source_id = chunk.get("source_id", "")  # legal_chunks.id (UUID)
            source_type = chunk.get("source_type", "law")
            # externalId는 grounding_chunks에서 제공된 external_id 사용 (실제 파일 ID)
            external_id = chunk.get("external_id") or chunk.get("externalId")
            
            # external_id나 source_type이 없으면 DB에서 조회
            if not external_id or not source_type:
                chunk_info = vector_store.get_legal_chunk_by_id(source_id)
                if chunk_info:
                    external_id = external_id or chunk_info.get("external_id")
                    source_type = source_type or chunk_info.get("source_type", "law")
            
            # fileUrl 무조건 새로 생성 (legal_chunks에 저장된 file_url은 신뢰할 수 없음)
            file_url = None
            if external_id and source_type:
                try:
                    file_url = get_document_file_url(
                        external_id=external_id,
                        source_type=source_type,
                        expires_in=3600
                    )
                except Exception as e:
                    _logger.warning(f"source fileUrl 생성 실패 (externalId={external_id}, sourceType={source_type}): {str(e)}")
            
            # snippet 분석
            original_snippet = chunk.get("snippet", "")
            analyzed_snippet = None
            try:
                _logger.debug(f"[analyze-situation] source snippet 분석 시작 (sourceId={source_id}, snippet 길이={len(original_snippet)})")
                analyzed_snippet = await analyze_snippet(original_snippet)
                if analyzed_snippet:
                    _logger.debug(f"[analyze-situation] source snippet 분석 성공 (sourceId={source_id}): core_clause={analyzed_snippet.get('core_clause', '')[:50]}")
                else:
                    _logger.warning(f"[analyze-situation] source snippet 분석 결과 None (sourceId={source_id})")
            except Exception as e:
                _logger.error(f"source snippet 분석 실패 (sourceId={source_id}): {str(e)}", exc_info=True)
            
            sources.append({
                "sourceId": source_id,  # legal_chunks.id (UUID)
                "sourceType": source_type,
                "title": chunk.get("title", ""),
                "snippet": original_snippet,  # 원본 유지 (하위 호환성)
                "snippetAnalyzed": analyzed_snippet,  # 분석된 결과 추가
                "score": float(chunk.get("score", 0.0)),
                "externalId": external_id,  # legal_chunks.external_id (실제 파일 ID, DB 조회로 보완)
                "fileUrl": file_url,  # 스토리지 Signed URL (무조건 새로 생성)
            })
        
        # DB에 저장 (비동기, 실패해도 응답은 반환)
        situation_analysis_id = None
        try:
            storage_service = get_storage_service()
            analysis_summary = result.get("summary", "")
            
            # 프론트엔드가 기대하는 AnalysisJSON 구조로 변환
            analysis_json = {
                "summary": analysis_summary,
                "sources": sources,  # RAG 검색 출처
                "criteria": result.get("criteria", []),  # 법적 판단 기준
                "findings": result.get("findings", []),  # 법적 쟁점 발견 항목
                "scripts": result.get("scripts", {}),  # 말하기 템플릿
                "relatedCases": related_cases,  # 관련 사례 (문서 단위로 그룹핑됨)
                "classifiedType": result.get("classified_type", "unknown"),  # 분류 유형
                "riskScore": float(result.get("risk_score", 0)),  # 위험도 점수
                "organizations": result.get("organizations", []),  # 추천 기관 목록
            }
            
            situation_analysis_id = await storage_service.save_situation_analysis(
                situation=payload.situation,
                category=payload.category,
                employment_type=payload.employmentType,
                company_size=payload.companySize,
                work_period=payload.workPeriod,
                has_written_contract=payload.hasWrittenContract,
                social_insurance=payload.socialInsurance,
                risk_score=float(result["risk_score"]),
                risk_level=risk_level,
                analysis=analysis_json,  # 전체 분석 결과를 JSONB로 저장
                checklist=checklist,
                related_cases=related_cases,
                user_id=x_user_id,
                # situation_reports 통합 필드
                question=payload.situation,  # question은 situation과 동일
                answer=analysis_summary,  # answer는 analysis.summary
                details=None,  # details는 현재 제공되지 않음
                category_hint=payload.category,  # category_hint는 category와 동일
                classified_type=result.get("classified_type", "unknown"),
            )
            _logger.info(f"상황 분석 결과 DB 저장 완료 (id: {situation_analysis_id}, user_id: {x_user_id})")
            
            # 대화 메시지는 트리거가 자동으로 저장하므로 수동 저장 불필요
            # 트리거가 answer 필드를 sequence_number 0으로 저장함
            # 사용자 입력 메시지는 프론트엔드에서 저장하거나 별도로 저장할 수 있음
            # 여기서는 트리거에 의존하므로 수동 저장하지 않음
        except Exception as save_error:
            # DB 저장 실패해도 분석 결과는 반환
            _logger.warning(f"상황 분석 결과 DB 저장 실패 (응답은 정상 반환): {str(save_error)}")
        
        # v2 응답 생성 (DB 저장 후 ID 포함)
        # Pydantic 모델에 없는 필드는 dict로 변환 후 추가
        
        # criteria 확인 및 로깅 (새로운 구조: RAG 검색 결과 기반)
        criteria_from_result = result.get("criteria", [])
        _logger.info(f"[analyze-situation] result에서 criteria 가져옴: 개수={len(criteria_from_result) if isinstance(criteria_from_result, list) else 0}")
        
        # criteria는 이미 RAG 검색 결과 기반 구조로 워크플로우에서 생성됨
        # 로그 출력 (디버깅용)
        if isinstance(criteria_from_result, list) and len(criteria_from_result) > 0:
            for idx, criterion in enumerate(criteria_from_result[:3]):  # 처음 3개만 로그
                if isinstance(criterion, dict):
                    _logger.info(f"[analyze-situation] criteria[{idx}] 요약: documentTitle={criterion.get('documentTitle', '')[:30]}, sourceType={criterion.get('sourceType', '')}")
        
        # scripts를 dict로 변환 (Pydantic 모델이면 model_dump 사용)
        scripts_dict = None
        if scripts:
            if hasattr(scripts, 'model_dump'):
                scripts_dict = scripts.model_dump()
            elif isinstance(scripts, dict):
                scripts_dict = scripts
            else:
                # 기본 구조로 변환
                scripts_dict = {
                    "toCompany": {
                        "subject": getattr(scripts, 'toCompany', {}).get('subject', '') if hasattr(scripts, 'toCompany') else '',
                        "body": getattr(scripts, 'toCompany', {}).get('body', '') if hasattr(scripts, 'toCompany') else ''
                    },
                    "toAdvisor": {
                        "subject": getattr(scripts, 'toAdvisor', {}).get('subject', '') if hasattr(scripts, 'toAdvisor') else '',
                        "body": getattr(scripts, 'toAdvisor', {}).get('body', '') if hasattr(scripts, 'toAdvisor') else ''
                    }
                }
        
        # tags 추출 (classified_type 기반)
        tags = [result.get("classified_type", "unknown")]
        
        # 최종 응답: id, riskScore, riskLevel, tags + summary, findings, relatedCases, scripts, organizations 포함
        response_dict_final = {
            "id": situation_analysis_id,  # DB 저장 후 생성된 ID
            "riskScore": float(result.get("risk_score", 0)),  # 위험도 점수
            "riskLevel": risk_level,  # 위험도 레벨 (low/medium/high)
            "tags": tags,  # 분류 태그 (classified_type 기반)
            "summary": result.get("summary") or result.get("summary_report") or "## 📊 상황 분석의 결과\n\n상황을 분석했습니다. 아래 법적 관점과 행동 가이드를 참고하세요.\n\n## ⚖️ 법적 관점에서 본 현재 상황\n\n관련 법령을 확인하는 중입니다.\n\n## 🎯 지금 당장 할 수 있는 행동\n\n- 상황을 다시 확인해주세요\n- 잠시 후 다시 시도해주세요\n\n## 💬 이렇게 말해보세요\n\n상담 기관에 문의하시기 바랍니다.",
            "findings": result.get("findings", []),  # 법적 쟁점 발견 항목
            "relatedCases": related_cases,  # 법적 문서 (문서 단위 그룹핑)
            "scripts": scripts_dict or {
                "toCompany": {"subject": "", "body": ""},
                "toAdvisor": {"subject": "", "body": ""}
            },  # 이메일 템플릿 (to_company, to_advisor)
            "organizations": result.get("organizations", []),  # 추천 기관 목록
        }
        
        _logger.info(f"[analyze-situation] 최종 응답 생성:")
        _logger.info(f"  - id: {response_dict_final.get('id')}")
        _logger.info(f"  - riskScore: {response_dict_final.get('riskScore')}")
        _logger.info(f"  - riskLevel: {response_dict_final.get('riskLevel')}")
        _logger.info(f"  - tags: {response_dict_final.get('tags')}")
        _logger.info(f"  - summary 길이: {len(response_dict_final.get('summary', ''))}자")
        _logger.info(f"  - findings 개수: {len(response_dict_final.get('findings', []))}개")
        _logger.info(f"  - relatedCases 개수: {len(response_dict_final.get('relatedCases', []))}개")
        _logger.info(f"  - scripts 존재: {bool(response_dict_final.get('scripts'))}")
        
        return response_dict_final
    except Exception as e:
        _logger.error(f"상황 분석 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"상황 분석 중 오류가 발생했습니다: {str(e)}",
        )


@router.get("/situations/history", response_model=List[dict])
async def get_situation_history(
    x_user_id: Optional[str] = Header(None, alias="X-User-Id", description="사용자 ID"),
    limit: int = Query(20, ge=1, le=100, description="조회 개수"),
    offset: int = Query(0, ge=0, description="오프셋"),
):
    """
    사용자별 상황 분석 히스토리 조회
    """
    try:
        if not x_user_id:
            logger.warning("사용자 ID가 제공되지 않아 빈 배열 반환")
            return []
        
        storage_service = get_storage_service()
        history = await storage_service.get_user_situation_analyses(
            user_id=x_user_id,
            limit=limit,
            offset=offset,
        )
        return history
    except Exception as e:
        logger.error(f"상황 분석 히스토리 조회 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"히스토리 조회 중 오류가 발생했습니다: {str(e)}",
        )


@router.get("/situations/{situation_id}", response_model=dict)
async def get_situation_analysis(
    situation_id: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id", description="사용자 ID"),
):
    """
    특정 상황 분석 결과 조회
    """
    try:
        storage_service = get_storage_service()
        analysis = await storage_service.get_situation_analysis(situation_id, x_user_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="분석 결과를 찾을 수 없습니다.")
        return analysis
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"상황 분석 조회 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"분석 결과 조회 중 오류가 발생했습니다: {str(e)}",
        )


# 레거시 API 제거됨 - 새 테이블 구조(legal_chat_sessions, legal_chat_messages) 사용


# ============================================================================
# 새로운 통합 챗 시스템 API (legal_chat_sessions, legal_chat_messages)
# ============================================================================

@router.post("/chat/sessions", response_model=dict)
async def create_chat_session(
    payload: CreateChatSessionRequest,
    x_user_id: str = Header(..., alias="X-User-Id", description="사용자 ID"),
):
    """
    새로운 챗 세션 생성
    """
    try:
        if not x_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="사용자 ID가 필요합니다."
            )
        
        storage_service = get_storage_service()
        session_id = await storage_service.create_chat_session(
            user_id=x_user_id,
            initial_context_type=payload.initial_context_type or 'none',
            initial_context_id=payload.initial_context_id,
            title=payload.title,
        )
        
        return {"id": session_id, "success": True}
    except Exception as e:
        logger.error(f"챗 세션 생성 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"챗 세션 생성 중 오류가 발생했습니다: {str(e)}",
        )


@router.get("/chat/sessions", response_model=List[dict])
async def get_chat_sessions(
    x_user_id: str = Header(..., alias="X-User-Id", description="사용자 ID"),
    limit: int = Query(20, ge=1, le=100, description="조회 개수"),
    offset: int = Query(0, ge=0, description="오프셋"),
):
    """
    사용자의 챗 세션 목록 조회
    """
    try:
        storage_service = get_storage_service()
        sessions = await storage_service.get_chat_sessions(
            user_id=x_user_id,
            limit=limit,
            offset=offset,
        )
        return sessions
    except Exception as e:
        logger.error(f"챗 세션 목록 조회 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"챗 세션 목록 조회 중 오류가 발생했습니다: {str(e)}",
        )


@router.get("/chat/sessions/{session_id}", response_model=dict)
async def get_chat_session(
    session_id: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id", description="사용자 ID"),
):
    """
    특정 챗 세션 조회
    """
    try:
        storage_service = get_storage_service()
        session = await storage_service.get_chat_session(
            session_id=session_id,
            user_id=x_user_id,
        )
        
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"챗 세션을 찾을 수 없습니다. (id: {session_id})"
            )
        
        return session
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"챗 세션 조회 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"챗 세션 조회 중 오류가 발생했습니다: {str(e)}",
        )


@router.post("/chat/sessions/{session_id}/messages", response_model=dict)
async def save_chat_message(
    session_id: str,
    payload: ChatMessageRequest,
    x_user_id: str = Header(..., alias="X-User-Id", description="사용자 ID"),
):
    """
    챗 메시지 저장
    """
    try:
        if payload.sender_type not in ['user', 'assistant']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="sender_type은 'user' 또는 'assistant'여야 합니다."
            )
        
        storage_service = get_storage_service()
        message_id = await storage_service.save_chat_message(
            session_id=session_id,
            user_id=x_user_id,
            sender_type=payload.sender_type,
            message=payload.message,
            sequence_number=payload.sequence_number,
            context_type=payload.context_type or 'none',
            context_id=payload.context_id,
        )
        
        return {"id": message_id, "success": True}
    except Exception as e:
        logger.error(f"챗 메시지 저장 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"챗 메시지 저장 중 오류가 발생했습니다: {str(e)}",
        )


@router.get("/chat/sessions/{session_id}/messages", response_model=List[dict])
async def get_chat_messages(
    session_id: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id", description="사용자 ID"),
):
    """
    챗 세션의 메시지 목록 조회
    """
    try:
        storage_service = get_storage_service()
        messages = await storage_service.get_chat_messages(
            session_id=session_id,
            user_id=x_user_id,
        )
        return messages
    except Exception as e:
        logger.error(f"챗 메시지 조회 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"챗 메시지 조회 중 오류가 발생했습니다: {str(e)}",
        )


@router.put("/chat/sessions/{session_id}", response_model=dict)
async def update_chat_session(
    session_id: str,
    title: Optional[str] = None,
    x_user_id: str = Header(..., alias="X-User-Id", description="사용자 ID"),
):
    """
    챗 세션 업데이트 (제목 등)
    """
    try:
        storage_service = get_storage_service()
        await storage_service.update_chat_session(
            session_id=session_id,
            user_id=x_user_id,
            title=title,
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"챗 세션 업데이트 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"챗 세션 업데이트 중 오류가 발생했습니다: {str(e)}",
        )


@router.delete("/chat/sessions/{session_id}", response_model=dict)
async def delete_chat_session(
    session_id: str,
    x_user_id: str = Header(..., alias="X-User-Id", description="사용자 ID"),
):
    """
    챗 세션 삭제 (CASCADE로 메시지도 함께 삭제됨)
    """
    try:
        storage_service = get_storage_service()
        await storage_service.delete_chat_session(
            session_id=session_id,
            user_id=x_user_id,
        )
        return {"success": True}
    except Exception as e:
        logger.error(f"챗 세션 삭제 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"챗 세션 삭제 중 오류가 발생했습니다: {str(e)}",
        )




@router.post("/chat", response_model=LegalChatResponseV2)
async def chat_with_contract(
    payload: LegalChatRequestV2,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id", description="사용자 ID"),
):
    """
    법률 상담 챗 (컨텍스트 지원)
    
    - 컨텍스트 타입: 'none' | 'situation' | 'contract'
    - 상황 분석 리포트 또는 계약서 분석 리포트를 컨텍스트로 포함
    - Dual RAG 검색 (계약서 내부 + 외부 법령)
    - 구조화된 프롬프트로 답변 생성
    """
    try:
        service = get_legal_service()
        storage_service = get_storage_service()
        
        # 컨텍스트 타입 확인 (기본값: 'none')
        context_type = payload.contextType or 'none'
        context_id = payload.contextId
        
        # 컨텍스트 유효성 검증
        if context_type != 'none' and not context_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"contextType이 '{context_type}'인데 contextId가 제공되지 않았습니다."
            )
        
        # 컨텍스트 데이터 조회 및 구성
        prompt_context = None
        if context_type == 'situation' and context_id:
            # 상황 분석 리포트 조회
            situation = await storage_service.get_situation_analysis(
                situation_id=context_id,
                user_id=x_user_id
            )
            if not situation:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"상황 분석 리포트를 찾을 수 없습니다. (id: {context_id})"
                )
            
            prompt_context = {
                "type": "situation",
                "analysis": situation.get("analysis", {}),
                "risk_score": situation.get("risk_score", 0),
                "summary": situation.get("analysis", {}).get("summary", situation.get("situation", "")),
                "criteria": situation.get("criteria", []),
                "checklist": situation.get("checklist", []),
                "related_cases": situation.get("relatedCases", []),
            }
            
            # 기존 analysisSummary, riskScore가 없으면 컨텍스트에서 가져오기
            if not payload.analysisSummary:
                payload.analysisSummary = prompt_context["summary"]
            if not payload.riskScore:
                payload.riskScore = int(prompt_context["risk_score"])
                
        elif context_type == 'contract' and context_id:
            # 계약서 분석 리포트 조회
            contract = await storage_service.get_contract_analysis(
                doc_id=context_id,
                user_id=x_user_id
            )
            if not contract:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"계약서 분석 리포트를 찾을 수 없습니다. (id: {context_id})"
                )
            
            prompt_context = {
                "type": "contract",
                "risk_score": contract.get("risk_score", 0),
                "summary": contract.get("summary", ""),
                "issues": contract.get("issues", []),
                "sections": contract.get("sections", {}),
            }
            
            # 계약서 컨텍스트인 경우 docIds에 추가 (RAG 검색용)
            if context_id not in (payload.docIds or []):
                if payload.docIds is None:
                    payload.docIds = []
                payload.docIds.append(context_id)
        
        # selected_issue 변환 (프론트엔드 형식 → 백엔드 형식)
        selected_issue = None
        if payload.selectedIssue:
            selected_issue = {
                "category": payload.selectedIssue.get("category"),
                "summary": payload.selectedIssue.get("summary"),
                "severity": payload.selectedIssue.get("severity"),
                "originalText": payload.selectedIssue.get("originalText"),
                "legalBasis": payload.selectedIssue.get("legalBasis", []),
            }
        
        # Dual RAG 검색 및 답변 생성 (컨텍스트 포함)
        result = await service.chat_with_context(
            query=payload.query,
            doc_ids=payload.docIds or [],
            selected_issue_id=payload.selectedIssueId,
            selected_issue=selected_issue,
            analysis_summary=payload.analysisSummary,
            risk_score=payload.riskScore,
            total_issues=payload.totalIssues,
            top_k=payload.topK or 8,
            context_type=context_type,
            context_data=prompt_context,
        )
        
        # used_chunks 변환 (프론트엔드 형식)
        used_chunks_v2 = None
        if result.get("used_chunks"):
            used_chunks = result["used_chunks"]
            used_chunks_v2 = UsedChunksV2(
                contract=[
                    UsedChunkV2(
                        id=chunk.get("id"),
                        source_type="contract",
                        title=f"제{chunk.get('article_number', '')}조",
                        content=chunk.get("content", "")[:500],
                        score=chunk.get("score"),
                    )
                    for chunk in used_chunks.get("contract", [])
                ],
                legal=[
                    UsedChunkV2(
                        id=chunk.get("id"),
                        source_type=chunk.get("source_type", "law"),
                        title=chunk.get("title", ""),
                        content=chunk.get("content", "")[:500],
                        score=chunk.get("score"),
                    )
                    for chunk in used_chunks.get("legal", [])
                ],
            )
        
        return LegalChatResponseV2(
            answer=result.get("answer", ""),
            markdown=result.get("markdown", result.get("answer", "")),
            query=result.get("query", payload.query),
            usedChunks=used_chunks_v2,
        )
    except Exception as e:
        logger.error(f"법률 상담 챗 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"법률 상담 챗 중 오류가 발생했습니다: {str(e)}",
        )


@router.get("/file")
async def get_legal_file(
    path: str = Query(..., description="파일 경로 (Storage 경로 또는 로컬 상대 경로)"),
    download: bool = Query(False, description="다운로드 모드 (Content-Disposition: attachment)"),
):
    """
    법령 파일 서빙 (Supabase Storage 또는 로컬 파일)
    
    Args:
        path: 파일 경로
            - Storage 경로: "laws/abcd1234.pdf" (Storage에 업로드된 경우)
            - 로컬 경로: "data/legal/laws/파일명.pdf" (로컬 파일 사용 시)
        download: True면 다운로드 모드, False면 브라우저에서 열기
    
    Returns:
        파일 스트림 또는 Supabase Storage 직접 URL로 리다이렉트
    """
    try:
        # 경로 검증 (보안: 상위 디렉토리 접근 방지)
        if ".." in path or path.startswith("/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="잘못된 파일 경로입니다"
            )
        
        # 로컬 파일 경로인지 확인 (data/legal/로 시작하면 로컬 파일)
        is_local_path = path.startswith("data/legal/")
        
        if is_local_path:
            # 방법 1: 로컬 파일 서빙
            backend_dir = Path(__file__).parent.parent.parent
            local_file_path = backend_dir / path
            
            if not local_file_path.exists():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="파일을 찾을 수 없습니다"
                )
            
            # 파일명 추출
            filename = local_file_path.name
            
            # Content-Type 추정
            ext = local_file_path.suffix.lower()
            content_type_map = {
                ".pdf": "application/pdf",
                ".txt": "text/plain",
                ".md": "text/markdown",
                ".hwp": "application/x-hwp",
                ".hwpx": "application/x-hwpx",
            }
            content_type = content_type_map.get(ext, "application/octet-stream")
            
            # 다운로드 모드 설정
            headers = {}
            if download:
                headers["Content-Disposition"] = f'attachment; filename="{filename}"'
            else:
                headers["Content-Disposition"] = f'inline; filename="{filename}"'
            
            # 파일 읽기 및 스트리밍
            def file_generator():
                with open(local_file_path, "rb") as f:
                    while True:
                        chunk = f.read(8192)  # 8KB 청크
                        if not chunk:
                            break
                        yield chunk
            
            return StreamingResponse(
                file_generator(),
                media_type=content_type,
                headers=headers,
            )
        else:
            # 방법 2: Supabase Storage에서 파일 가져오기
            supabase_url = os.getenv("SUPABASE_URL") or settings.supabase_url
            supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or settings.supabase_service_role_key
            
            if not supabase_url or not supabase_key:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Supabase 설정이 없습니다"
                )
            
            supabase = create_client(supabase_url, supabase_key)
            STORAGE_BUCKET = "legal-sources"  # 지시서에 따라 "legal-sources" 사용
            
            # 방법 2-1: Public 버킷인 경우 직접 URL로 리다이렉트 (권장)
            try:
                public_url = f"{supabase_url}/storage/v1/object/public/{STORAGE_BUCKET}/{path}"
                return RedirectResponse(url=public_url, status_code=302)
            except:
                pass
            
            # 방법 2-2: Private 버킷이거나 Public URL이 안 되는 경우 파일 다운로드
            try:
                response = supabase.storage.from_(STORAGE_BUCKET).download(path)
                
                if not response:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="파일을 찾을 수 없습니다"
                    )
                
                filename = path.split("/")[-1] if "/" in path else path
                ext = Path(path).suffix.lower()
                content_type_map = {
                    ".pdf": "application/pdf",
                    ".txt": "text/plain",
                    ".md": "text/markdown",
                    ".hwp": "application/x-hwp",
                    ".hwpx": "application/x-hwpx",
                }
                content_type = content_type_map.get(ext, "application/octet-stream")
                
                headers = {}
                if download:
                    headers["Content-Disposition"] = f'attachment; filename="{filename}"'
                else:
                    headers["Content-Disposition"] = f'inline; filename="{filename}"'
                
                return StreamingResponse(
                    iter([response]),
                    media_type=content_type,
                    headers=headers,
                )
            except Exception as download_err:
                logger.error(f"파일 다운로드 실패: {str(download_err)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"파일을 가져오는 중 오류가 발생했습니다: {str(download_err)}"
                )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"법령 파일 서빙 중 오류: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"파일 서빙 중 오류가 발생했습니다: {str(e)}"
        )



