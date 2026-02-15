"""
Agent 기반 통합 챗 API Routes
Plain/Contract/Situation 모드 지원
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Header
from typing import Optional, List, Dict, Any
import tempfile
import os
import json
import uuid
from pathlib import Path
from datetime import datetime
from collections import defaultdict

from models.schemas import (
    LegalChatMode,
    LegalChatAgentResponse,
    UsedReportMeta,
    UsedSourceMeta,
    ContractAnalysisSummary,
    SituationAnalysisSummary,
    SituationRequestV2,
    ContractAnalysisResponseV2,
    ContractIssueV2,
    LegalIssue,
    LegalBasisItemV2,
    ToxicClauseDetail,
    CaseCard,
    LegalGroundingChunk,
)
from core.legal_rag_service import LegalRAGService
from core.document_processor_v2 import DocumentProcessor
from core.contract_storage import ContractStorageService
from core.clause_extractor import extract_clauses
from core.dependencies import (
    get_legal_service,
    get_processor,
    get_storage_service,
)
from core.logging_config import get_logger
from core.agent_chat_service import AgentChatService

router = APIRouter(
    prefix="/api/v2/legal",
    tags=["legal-agent"],
)

# 임시 파일 디렉토리
TEMP_DIR = "./data/temp"
os.makedirs(TEMP_DIR, exist_ok=True)

logger = get_logger(__name__)


def convert_legal_issue_to_contract_issue_v2(
    legal_issue: LegalIssue,
    clauses_by_id: Optional[Dict[str, Dict]] = None,
    idx: int = 0,
) -> ContractIssueV2:
    """
    LegalIssue를 ContractIssueV2로 변환하는 헬퍼 함수
    
    Args:
        legal_issue: 변환할 LegalIssue 객체
        clauses_by_id: clause_id로 조회할 수 있는 딕셔너리 (optional)
        idx: 이슈 인덱스 (로깅용)
    
    Returns:
        ContractIssueV2 객체
    """
    try:
        # clause_id 기반으로 original_text 채우기
        clause_id = getattr(legal_issue, 'clause_id', None)
        original_text = ""
        
        if clause_id and clauses_by_id and clause_id in clauses_by_id:
            clause = clauses_by_id[clause_id]
            original_text = clause.get("content", "")
        else:
            # clause_id가 없거나 매칭되지 않는 경우
            if hasattr(legal_issue, 'original_text') and legal_issue.original_text:
                original_text = legal_issue.original_text
            elif hasattr(legal_issue, 'description') and legal_issue.description:
                original_text = legal_issue.description[:200]
            else:
                original_text = ""
        
        # issue_id 추출
        issue_id = getattr(legal_issue, 'name', None) or getattr(legal_issue, 'issue_id', None) or f"issue-{idx+1}"
        
        # category 추출
        category = getattr(legal_issue, 'category', None) or "unknown"
        
        # severity 추출
        severity = getattr(legal_issue, 'severity', 'medium')
        
        # description/summary 추출
        description = getattr(legal_issue, 'description', '') or getattr(legal_issue, 'summary', '')
        summary = getattr(legal_issue, 'summary', None) or description
        
        # legal_basis 추출 및 구조화
        legal_basis_raw = getattr(legal_issue, 'legal_basis', []) or []
        legal_basis = []
        
        if legal_basis_raw:
            first_item = legal_basis_raw[0] if legal_basis_raw else None
            if isinstance(first_item, LegalBasisItemV2):
                legal_basis = legal_basis_raw
            elif isinstance(first_item, dict):
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
            else:
                # 문자열 배열인 경우 그대로 사용
                legal_basis = legal_basis_raw
        
        # rationale 추출
        rationale = getattr(legal_issue, 'rationale', None) or getattr(legal_issue, 'reason', None) or description
        
        # suggested_text 추출
        suggested_text = getattr(legal_issue, 'suggested_text', None) or getattr(legal_issue, 'suggested_revision', None) or ""
        
        # start_index, end_index 추출
        start_index = getattr(legal_issue, 'start_index', None)
        end_index = getattr(legal_issue, 'end_index', None)
        
        # toxic_clause_detail 추출
        toxic_clause_detail = getattr(legal_issue, 'toxic_clause_detail', None)
        toxic_clause_detail_v2 = None
        if toxic_clause_detail:
            try:
                if isinstance(toxic_clause_detail, ToxicClauseDetail):
                    toxic_clause_detail_v2 = toxic_clause_detail
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
                logger.warning(f"[LegalIssue 변환] toxic_clause_detail 변환 실패: {str(toxic_err)}")
        
        return ContractIssueV2(
            id=issue_id,
            category=category,
            severity=severity,
            summary=summary,
            originalText=original_text,
            legalBasis=legal_basis,
            explanation=rationale,
            suggestedRevision=suggested_text,
            clauseId=clause_id,
            startIndex=start_index,
            endIndex=end_index,
            toxicClauseDetail=toxic_clause_detail_v2,
        )
    except Exception as e:
        logger.error(f"[LegalIssue 변환] 이슈 변환 실패: {str(e)}", exc_info=True)
        # 최소한의 ContractIssueV2 객체라도 반환
        return ContractIssueV2(
            id=getattr(legal_issue, 'name', f"issue-{idx+1}"),
            category=getattr(legal_issue, 'category', 'unknown'),
            severity=getattr(legal_issue, 'severity', 'medium'),
            summary=getattr(legal_issue, 'summary', '') or getattr(legal_issue, 'description', ''),
            originalText=getattr(legal_issue, 'original_text', ''),
            legalBasis=getattr(legal_issue, 'legal_basis', []),
            explanation=getattr(legal_issue, 'description', ''),
            suggestedRevision=getattr(legal_issue, 'suggested_text', ''),
            clauseId=getattr(legal_issue, 'clause_id', None),
            startIndex=getattr(legal_issue, 'start_index', None),
            endIndex=getattr(legal_issue, 'end_index', None),
            toxicClauseDetail=None,
        )


@router.post(
    "/agent/chat",
    response_model=LegalChatAgentResponse,
    summary="Agent 기반 통합 법률 상담 챗 (일반/계약/상황)"
)
async def legal_chat_agent(
    mode: LegalChatMode = Form(..., description="plain | contract | situation"),
    message: str = Form(..., description="사용자 질문 텍스트"),
    session_id: Optional[str] = Form(None, alias="sessionId", description="기존 legal_chat_sessions.id"),
    contract_analysis_id: Optional[str] = Form(None, alias="contractAnalysisId"),
    situation_analysis_id: Optional[str] = Form(None, alias="situationAnalysisId"),
    situation_template_key: Optional[str] = Form(None, alias="situationTemplateKey"),
    situation_form_json: Optional[str] = Form(None, alias="situationForm", description="상황 분석용 폼 데이터 JSON 문자열"),
    file: Optional[UploadFile] = File(None, description="계약서 분석용 파일 (PDF/HWPX/이미지 등)"),
    x_user_id: Optional[str] = Header(None, alias="X-User-Id", description="사용자 ID"),
):
    """
    Agent 기반 통합 챗 엔드포인트
    
    - mode=plain: 일반 Q&A
    - mode=contract: 계약서 파일 기반 분석 + 챗
    - mode=situation: 폼 기반 상황분석 + 유사케이스 + 챗
    """
    import time
    import logging
    logger = logging.getLogger(__name__)
    
    # 전체 API 실행 시간 측정 시작
    api_start_time = time.time()
    
    if not x_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="사용자 ID가 필요합니다. X-User-Id 헤더를 제공해주세요.",
        )
    
    user_id = x_user_id
    storage_service = get_storage_service()
    legal_service = get_legal_service()
    
    # ---------- 1. 세션 로드 or 생성 ----------
    if session_id:
        session = await storage_service.get_chat_session(session_id, user_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat session not found",
            )
    else:
        session_id = await storage_service.create_chat_session(
            user_id=user_id,
            initial_context_type="none",
            initial_context_id=None,
        )
    
    # ---------- 2. 모드별 컨텍스트 준비 ----------
    contract_analysis = None
    situation_analysis = None
    used_reports: List[UsedReportMeta] = []
    used_sources: List[UsedSourceMeta] = []
    
    # 상황 폼 JSON 파싱
    situation_form: Optional[Dict[str, Any]] = None
    if situation_form_json:
        try:
            situation_form = json.loads(situation_form_json)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid situationForm JSON",
            )
    
    # 2-1. 계약 모드
    if mode == LegalChatMode.contract:
        # 해커톤 데모용: Contract 모드일 때 무조건 고정된 계약서 분석 ID 사용
        contract_analysis_id = "062ce081-c218-424c-8102-45b9089fcea3"
        logger.info(f"[Agent Chat] Contract 모드: 고정 계약서 분석 ID 사용 (파일/ID 무시): {contract_analysis_id}")
        
        # 파일이 있어도 새로 분석하지 않고 고정 ID 사용 (해커톤 데모용)
        # 주석 처리: 파일 업로드 시 새로 분석하는 로직
        """
        # 최초 요청: 파일 포함 → 분석 실행
        if file is not None:
            # 기존 analyze_contract 엔드포인트 로직 재사용
            logger.info(f"[Agent Chat] 계약서 분석 시작: file={file.filename}")
            
            temp_path = None
            extracted_text = None
            try:
                # 파일 유효성 검사
                if not file.filename:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="파일명이 없습니다.",
                    )
                
                # 파일 크기 제한 체크 (10MB)
                file_size = 0
                content = None
                try:
                    # 파일 포인터를 처음으로 이동
                    await file.seek(0)
                    content = await file.read()
                    file_size = len(content)
                    
                    # 파일 크기 제한 (10MB)
                    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
                    if file_size > MAX_FILE_SIZE:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"파일 크기는 10MB를 초과할 수 없습니다. (현재: {file_size / 1024 / 1024:.2f}MB)",
                        )
                    
                    # 파일이 비어있는지 체크
                    if file_size == 0:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="업로드된 파일이 비어있습니다.",
                        )
                    
                except HTTPException:
                    raise
                except Exception as read_error:
                    logger.error(f"[Agent Chat] 파일 읽기 실패: {str(read_error)}", exc_info=True)
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"파일을 읽는 중 오류가 발생했습니다: {str(read_error)}",
                    )
                
                # 임시 파일 저장
                suffix = Path(file.filename).suffix if file.filename else ".tmp"
                temp_file = tempfile.NamedTemporaryFile(
                    delete=False,
                    suffix=suffix,
                    dir=TEMP_DIR
                )
                temp_path = temp_file.name
                
                # 파일 내용을 임시 파일에 쓰기
                temp_file.write(content)
                temp_file.close()
                
                logger.info(f"[Agent Chat] 임시 파일 저장 완료: {temp_path}, 크기={file_size} bytes")
                
                # 텍스트 추출
                processor = get_processor()
                extracted_text, _ = processor.process_file(
                    temp_path,
                    file_type=None,
                    mode="contract"
                )
                
                if not extracted_text or extracted_text.strip() == "":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="업로드된 파일에서 텍스트를 추출할 수 없습니다.",
                    )
                
                logger.info(f"[Agent Chat] 텍스트 추출 완료: 길이={len(extracted_text)}")
                
            except HTTPException:
                # HTTPException은 그대로 전파 (임시 파일은 finally에서 정리)
                raise
            except Exception as e:
                logger.error(f"[Agent Chat] 계약서 파일 처리 중 오류: {str(e)}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"파일 처리 중 오류가 발생했습니다: {str(e)}",
                )
            finally:
                # 텍스트 추출이 완료된 후에만 임시 파일 삭제
                # (분석 중에는 파일이 필요할 수 있으므로 여기서는 삭제하지 않음)
                # 대신 분석 완료 후 삭제하도록 함
                pass
            
            # 계약서 분석 실행 (extracted_text가 None이면 에러 발생)
            if not extracted_text:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="텍스트 추출에 실패했습니다.",
                )
            doc_id = str(uuid.uuid4())
            clauses = extract_clauses(extracted_text)
            
            result = await legal_service.analyze_contract(
                extracted_text=extracted_text,
                description=None,
                doc_id=doc_id,
                clauses=clauses,
            )
            
            # clauses를 딕셔너리로 변환 (clause_id로 조회 가능하도록)
            clauses_by_id = {}
            if clauses:
                for clause in clauses:
                    if isinstance(clause, dict):
                        clause_id = clause.get("id")
                        if clause_id:
                            clauses_by_id[clause_id] = clause
                    else:
                        clause_id = getattr(clause, 'id', None)
                        if clause_id:
                            clauses_by_id[clause_id] = {
                                "id": clause_id,
                                "content": getattr(clause, 'content', ''),
                                "title": getattr(clause, 'title', ''),
                            }
            
            # LegalIssue를 ContractIssueV2로 변환
            issues_v2 = []
            if result.issues:
                for idx, legal_issue in enumerate(result.issues):
                    try:
                        issue_v2 = convert_legal_issue_to_contract_issue_v2(
                            legal_issue=legal_issue,
                            clauses_by_id=clauses_by_id,
                            idx=idx,
                        )
                        issues_v2.append(issue_v2)
                    except Exception as issue_error:
                        logger.error(f"[Agent Chat] 이슈 변환 실패 (idx={idx}): {str(issue_error)}", exc_info=True)
                        # 변환 실패해도 계속 진행
                        continue
            
            # DB에 저장
            analysis_result = ContractAnalysisResponseV2(
                docId=doc_id,
                title=file.filename or "계약서",
                riskScore=result.risk_score,
                riskLevel=result.risk_level,
                sections={},
                issues=issues_v2,
                summary=result.summary,
                retrievedContexts=[],
                contractText=extracted_text,
                clauses=[],
                highlightedTexts=[],
                createdAt=datetime.utcnow().isoformat() + "Z",
            )
            
            await storage_service.save_contract_analysis(
                doc_id=doc_id,
                title=file.filename or "계약서",
                original_filename=file.filename,
                doc_type=None,
                risk_score=result.risk_score,
                risk_level=result.risk_level,
                sections={},
                summary=result.summary,
                retrieved_contexts=[],
                issues=[{
                    "id": issue.name,
                    "category": issue.category or "unknown",
                    "severity": issue.severity,
                    "summary": issue.summary or issue.description,
                    "description": issue.description,
                } for issue in result.issues],
                user_id=user_id,
                contract_text=extracted_text,
            )
            
            # DB에서 저장된 분석 결과 조회하여 ID 가져오기
            saved_analysis = await storage_service.get_contract_analysis(doc_id, user_id)
            if saved_analysis:
                contract_analysis_id = saved_analysis.get("id") or doc_id
            else:
                contract_analysis_id = doc_id
            
            # 세션 컨텍스트 업데이트
            await storage_service.update_chat_session(
                session_id=session_id,
                user_id=user_id,
                title=None,
            )
            
            # 임시 파일 삭제 (모든 작업 완료 후)
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                    logger.info(f"[Agent Chat] 임시 파일 삭제 완료: {temp_path}")
                except Exception as cleanup_error:
                    logger.warning(f"[Agent Chat] 임시 파일 삭제 실패: {temp_path}, {str(cleanup_error)}")
        """
        
        # 후속 요청: 기존 분석 참고 (고정 ID 사용)
        if contract_analysis_id is not None and contract_analysis is None:
            saved_analysis = await storage_service.get_contract_analysis(contract_analysis_id, user_id)
            if saved_analysis:
                contract_analysis = ContractAnalysisSummary(
                    id=saved_analysis.get("id", contract_analysis_id),
                    title=saved_analysis.get("title"),
                    riskScore=saved_analysis.get("riskScore") or saved_analysis.get("risk_score"),
                    riskLevel=saved_analysis.get("riskLevel") or saved_analysis.get("risk_level"),
                    summary=saved_analysis.get("summary"),
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Contract analysis not found",
                )
        
        if contract_analysis:
            used_reports.append(
                UsedReportMeta(
                    type="contract",
                    analysisId=contract_analysis.id,
                    findingsIds=None,
                )
            )
    
    # 2-2. 상황 모드
    elif mode == LegalChatMode.situation:
        # 최초 요청: situation_form 으로 상황 분석 실행
        if situation_analysis_id is None:
            if not situation_template_key or not situation_form:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="situationTemplateKey and situationForm are required for first situation analysis",
                )
            
            # SituationRequestV2 형식으로 변환
            situation_request = SituationRequestV2(
                situation=situation_form.get("situation", ""),
                category=situation_form.get("category"),
                employmentType=situation_form.get("employmentType"),
                workPeriod=situation_form.get("workPeriod"),
                socialInsurance=situation_form.get("socialInsurance", []),
            )
            
            # 기존 analyze_situation 엔드포인트 로직 재사용
            result = await legal_service.analyze_situation_detailed(
                category_hint=situation_request.category or "unknown",
                situation_text=situation_request.situation,
                summary=None,
                details=None,
                employment_type=situation_request.employmentType,
                work_period=situation_request.workPeriod,
                weekly_hours=None,
                is_probation=None,
                social_insurance=", ".join(situation_request.socialInsurance) if situation_request.socialInsurance else None,
                use_workflow=True,
            )
            
            # DB에 저장 (기존 analyze_situation 엔드포인트 로직 재사용)
            risk_level = "low"
            if result.get("risk_score", 0) >= 70:
                risk_level = "high"
            elif result.get("risk_score", 0) >= 40:
                risk_level = "medium"
            
            # relatedCases 변환 (문서 단위 그룹핑)
            grounding_chunks = result.get("grounding_chunks", [])
            grouped_by_document = defaultdict(list)
            
            for chunk in grounding_chunks:
                if isinstance(chunk, dict):
                    title = chunk.get("title", "")
                    external_id = chunk.get("external_id") or chunk.get("externalId")
                else:
                    title = getattr(chunk, "title", "")
                    external_id = getattr(chunk, "external_id", None)
                
                group_key = external_id if external_id else title
                if group_key:
                    grouped_by_document[group_key].append(chunk)
            
            related_cases = []
            for group_key, chunk_items in list(grouped_by_document.items())[:5]:
                if not chunk_items:
                    continue
                first_chunk = chunk_items[0]
                if isinstance(first_chunk, dict):
                    document_title = first_chunk.get("title", "")
                    source_type = first_chunk.get("source_type", "law")
                    external_id = first_chunk.get("external_id") or group_key
                else:
                    document_title = getattr(first_chunk, "title", "")
                    source_type = getattr(first_chunk, "source_type", "law")
                    external_id = getattr(first_chunk, "external_id", None) or group_key
                
                overall_similarity = max(
                    float(chunk.get("score", 0.0)) if isinstance(chunk, dict) else float(getattr(chunk, "score", 0.0))
                    for chunk in chunk_items
                )
                
                snippets = []
                for chunk in chunk_items:
                    snippet_text = chunk.get("snippet", "") if isinstance(chunk, dict) else getattr(chunk, "snippet", "")
                    similarity_score = float(chunk.get("score", 0.0)) if isinstance(chunk, dict) else float(getattr(chunk, "score", 0.0))
                    snippets.append({
                        "snippet": snippet_text[:500] if len(snippet_text) > 500 else snippet_text,
                        "similarityScore": similarity_score,
                        "usageReason": "",
                    })
                
                related_cases.append({
                    "documentTitle": document_title,
                    "fileUrl": None,
                    "sourceType": source_type,
                    "externalId": external_id,
                    "overallSimilarity": overall_similarity,
                    "summary": f"{document_title}의 내용을 참고하여 법적 판단 기준으로 사용했습니다.",
                    "snippets": snippets,
                })
            
            # sources 변환
            sources = []
            for chunk in grounding_chunks:
                if isinstance(chunk, dict):
                    source_id = chunk.get("source_id", "")
                    source_type = chunk.get("source_type", "law")
                    title = chunk.get("title", "")
                    snippet = chunk.get("snippet", "")
                    score = float(chunk.get("score", 0.0))
                    external_id = chunk.get("external_id") or chunk.get("externalId")
                else:
                    source_id = getattr(chunk, "source_id", "")
                    source_type = getattr(chunk, "source_type", "law")
                    title = getattr(chunk, "title", "")
                    snippet = getattr(chunk, "snippet", "")
                    score = float(getattr(chunk, "score", 0.0))
                    external_id = getattr(chunk, "external_id", None)
                
                sources.append({
                    "sourceId": source_id,
                    "sourceType": source_type,
                    "title": title,
                    "snippet": snippet,
                    "snippetAnalyzed": None,
                    "score": score,
                    "externalId": external_id,
                    "fileUrl": None,
                })
            
            # analysis_json 구성
            analysis_json = {
                "summary": result.get("summary", ""),
                "sources": sources,
                "criteria": result.get("criteria", []),
                "findings": result.get("findings", []),
                "scripts": result.get("scripts", {}),
                "relatedCases": related_cases,
                "classifiedType": result.get("classified_type", "unknown"),
                "riskScore": float(result.get("risk_score", 0)),
                "organizations": result.get("organizations", []),
            }
            
            situation_id = await storage_service.save_situation_analysis(
                situation=situation_request.situation,
                category=situation_request.category,
                employment_type=situation_request.employmentType,
                company_size=None,
                work_period=situation_request.workPeriod,
                has_written_contract=None,
                social_insurance=situation_request.socialInsurance,
                risk_score=float(result.get("risk_score", 0)),
                risk_level=risk_level,
                analysis=analysis_json,
                checklist=[],
                related_cases=related_cases,
                user_id=user_id,
                question=situation_request.situation,
                answer=result.get("summary", ""),
                details=None,
                category_hint=situation_request.category,
                classified_type=result.get("classified_type", "unknown"),
            )
            
            situation_analysis_id = situation_id
            
            # 세션 컨텍스트 업데이트
            await storage_service.update_chat_session(
                session_id=session_id,
                user_id=user_id,
                title=None,
            )
        
        # 후속 요청: 기존 분석 참고
        if situation_analysis_id is not None and situation_analysis is None:
            saved_analysis = await storage_service.get_situation_analysis(situation_analysis_id, user_id)
            if saved_analysis:
                situation_analysis = SituationAnalysisSummary(
                    id=saved_analysis.get("id", situation_analysis_id),
                    title=saved_analysis.get("title"),
                    riskScore=saved_analysis.get("riskScore") or saved_analysis.get("risk_score"),
                    riskLevel=saved_analysis.get("riskLevel") or saved_analysis.get("risk_level"),
                    summary=saved_analysis.get("summary") or saved_analysis.get("answer", ""),
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Situation analysis not found",
                )
        
        if situation_analysis:
            used_reports.append(
                UsedReportMeta(
                    type="situation",
                    analysisId=situation_analysis.id,
                    findingsIds=None,
                )
            )
    
    # ---------- 3. 히스토리 로드 ----------
    history_messages = await storage_service.get_chat_messages(session_id, user_id)
    # 최근 30개만 사용 (sequence_number 역순으로 정렬되어 있으므로 뒤에서 30개)
    history_messages = history_messages[-30:] if len(history_messages) > 30 else history_messages
    
    # ---------- 4. LLM 컨텍스트 구성 + 답변 생성 ----------
    # 컨텍스트 데이터 준비
    context_type = _context_type_from_mode(mode)
    context_data = None
    
    if contract_analysis:
        saved_analysis = await storage_service.get_contract_analysis(contract_analysis.id, user_id)
        if saved_analysis:
            context_data = {
                "type": "contract",
                "analysis": saved_analysis,
            }
    elif situation_analysis:
        saved_analysis = await storage_service.get_situation_analysis(situation_analysis.id, user_id)
        if saved_analysis:
            context_data = {
                "type": "situation",
                "analysis": saved_analysis,
            }
    
    # RAG 검색 및 답변 생성 (Agent 서비스 사용)
    agent_service = AgentChatService()
    
    # 히스토리 메시지 변환 (storage 형식 → agent 형식)
    history_for_agent = []
    if history_messages:
        for msg in history_messages:
            history_for_agent.append({
                "sender_type": msg.get("sender_type", "user"),
                "message": msg.get("message", ""),
            })
    
    if mode == LegalChatMode.plain:
        # Plain 모드: RAG 기반 일반 법률 상담
        answer_markdown, used_legal_chunks = await agent_service.chat_plain(
            query=message,
            legal_chunks=None,  # 자동 검색
            history_messages=history_for_agent,
        )
        
        # used_sources 구성
        for chunk in used_legal_chunks:
            used_sources.append(
                UsedSourceMeta(
                    documentTitle=getattr(chunk, 'title', ''),
                    fileUrl=getattr(chunk, 'file_url', None),
                    sourceType=getattr(chunk, 'source_type', 'law'),
                    similarityScore=getattr(chunk, 'score', 0.0),
                )
            )
    elif mode == LegalChatMode.contract and contract_analysis:
        # Contract 모드: 계약서 분석 결과 기반
        saved_analysis = await storage_service.get_contract_analysis(contract_analysis.id, user_id)
        if saved_analysis:
            answer_markdown = await agent_service.chat_contract(
                query=message,
                contract_analysis=saved_analysis,
                legal_chunks=None,  # 자동 검색
                history_messages=history_for_agent,
            )
        else:
            # 분석 결과가 없으면 Plain 모드로 fallback
            answer_markdown, used_legal_chunks = await agent_service.chat_plain(
                query=message,
                legal_chunks=None,
                history_messages=history_for_agent,
            )
            # used_sources 구성
            for chunk in used_legal_chunks:
                used_sources.append(
                    UsedSourceMeta(
                        documentTitle=getattr(chunk, 'title', ''),
                        fileUrl=getattr(chunk, 'file_url', None),
                        sourceType=getattr(chunk, 'source_type', 'law'),
                        similarityScore=getattr(chunk, 'score', 0.0),
                    )
                )
    elif mode == LegalChatMode.situation and situation_analysis:
        # Situation 모드: 상황 분석 결과 기반
        saved_analysis = await storage_service.get_situation_analysis(situation_analysis.id, user_id)
        if saved_analysis:
            # 상황 분석 결과를 dict 형식으로 변환
            analysis_dict = {
                "risk_score": saved_analysis.get("risk_score") or saved_analysis.get("riskScore", 0),
                "risk_level": saved_analysis.get("risk_level") or saved_analysis.get("riskLevel", "unknown"),
                "summary": saved_analysis.get("summary") or saved_analysis.get("answer", ""),
                "criteria": saved_analysis.get("criteria", []),
                "findings": saved_analysis.get("findings", []),
            }
            answer_markdown = await agent_service.chat_situation(
                query=message,
                situation_analysis=analysis_dict,
                legal_chunks=None,  # 자동 검색
                history_messages=history_for_agent,
            )
        else:
            # 분석 결과가 없으면 Plain 모드로 fallback
            answer_markdown, used_legal_chunks = await agent_service.chat_plain(
                query=message,
                legal_chunks=None,
                history_messages=history_for_agent,
            )
            # used_sources 구성
            for chunk in used_legal_chunks:
                used_sources.append(
                    UsedSourceMeta(
                        documentTitle=getattr(chunk, 'title', ''),
                        fileUrl=getattr(chunk, 'file_url', None),
                        sourceType=getattr(chunk, 'source_type', 'law'),
                        similarityScore=getattr(chunk, 'score', 0.0),
                    )
                )
    else:
        # Fallback: Plain 모드
        answer_markdown, used_legal_chunks = await agent_service.chat_plain(
            query=message,
            legal_chunks=None,
            history_messages=history_for_agent,
        )
        # used_sources 구성
        for chunk in used_legal_chunks:
            used_sources.append(
                UsedSourceMeta(
                    documentTitle=getattr(chunk, 'title', ''),
                    fileUrl=getattr(chunk, 'file_url', None),
                    sourceType=getattr(chunk, 'source_type', 'law'),
                    similarityScore=getattr(chunk, 'score', 0.0),
                )
            )
    
    # ---------- 4-1. 케이스 추출 (situation 모드 전용) ----------
    extracted_cases: List[CaseCard] = []
    if mode == LegalChatMode.situation:
        # Contract/Situation 모드는 기존 방식 유지
        chat_result = await legal_service.chat_with_context(
            query=message,
            doc_ids=[contract_analysis.id] if contract_analysis else [],
            selected_issue_id=None,
            selected_issue=None,
            analysis_summary=contract_analysis.summary if contract_analysis else (situation_analysis.summary if situation_analysis else None),
            risk_score=contract_analysis.riskScore if contract_analysis else (situation_analysis.riskScore if situation_analysis else None),
            total_issues=None,
            top_k=8,
            context_type=context_type,
            context_data=context_data,
        )
        
        # legal chunk에서 case 타입 추출
        used_chunks = chat_result.get("used_chunks", {})
        legal_chunks = used_chunks.get("legal", [])
        
        logger.info(f"[Agent API] legal_chunks 개수: {len(legal_chunks)}개")
        # source_type별 개수 확인
        source_type_counts = {}
        for chunk in legal_chunks:
            st = chunk.get("source_type", "unknown")
            source_type_counts[st] = source_type_counts.get(st, 0) + 1
        logger.info(f"[Agent API] source_type별 개수: {source_type_counts}")
        
        # case 타입 chunk를 케이스 카드로 변환
        extracted_cases = await _extract_cases_from_chunks(legal_chunks, storage_service)
        logger.info(f"[Agent API] 케이스 추출 완료: {len(extracted_cases)}개")
        
        # LLM 응답(answer_markdown)에서 JSON 추출 및 cases 필드를 실제 추출한 cases로 대체
        if answer_markdown and extracted_cases:
            try:
                import re
                # JSON 코드 블록 찾기
                json_match = re.search(r'```json\s*(\{.*?\})\s*```', answer_markdown, re.DOTALL)
                if not json_match:
                    # ```json 없이 JSON만 있는 경우
                    json_match = re.search(r'\{[\s\S]*"reportTitle"[\s\S]*\}', answer_markdown, re.DOTALL)
                
                if json_match:
                    json_str = json_match.group(1) if json_match.lastindex else json_match.group(0)
                    parsed_json = json.loads(json_str)
                    
                    # cases 필드를 실제 추출한 cases로 대체
                    cases_data = [case.dict() for case in extracted_cases]
                    parsed_json["cases"] = cases_data
                    
                    # JSON을 다시 문자열로 변환
                    updated_json_str = json.dumps(parsed_json, ensure_ascii=False, indent=2)
                    
                    # 원본 JSON 부분을 업데이트된 JSON으로 교체
                    if json_match.lastindex:
                        answer_markdown = answer_markdown.replace(json_match.group(0), f"```json\n{updated_json_str}\n```")
                    else:
                        answer_markdown = answer_markdown.replace(json_match.group(0), updated_json_str)
                    
                    logger.info(f"[Agent API] LLM 응답 JSON에 cases {len(extracted_cases)}개 추가 완료")
            except Exception as json_err:
                logger.warning(f"[Agent API] JSON 파싱 및 cases 대체 실패: {str(json_err)}")
                # 실패해도 계속 진행
        
        # used_sources 변환
        for chunk in legal_chunks:
            used_sources.append(
                UsedSourceMeta(
                    documentTitle=chunk.get("title", ""),
                    fileUrl=None,
                    sourceType=chunk.get("source_type", "law"),
                    similarityScore=chunk.get("score"),
                )
            )
    elif mode != LegalChatMode.plain:
        # Contract 모드
        chat_result = await legal_service.chat_with_context(
            query=message,
            doc_ids=[contract_analysis.id] if contract_analysis else [],
            selected_issue_id=None,
            selected_issue=None,
            analysis_summary=contract_analysis.summary if contract_analysis else (situation_analysis.summary if situation_analysis else None),
            risk_score=contract_analysis.riskScore if contract_analysis else (situation_analysis.riskScore if situation_analysis else None),
            total_issues=None,
            top_k=8,
            context_type=context_type,
            context_data=context_data,
        )
        
        # used_sources 변환
        used_chunks = chat_result.get("used_chunks", {})
        for chunk in used_chunks.get("legal", []):
            used_sources.append(
                UsedSourceMeta(
                    documentTitle=chunk.get("title", ""),
                    fileUrl=None,
                    sourceType=chunk.get("source_type", "law"),
                    similarityScore=chunk.get("score"),
                )
            )
    
    # ---------- 5. 메시지 저장 ----------
    # 시퀀스 번호 계산
    if history_messages:
        max_seq = max(msg.get("sequence_number", 0) for msg in history_messages)
        next_seq = max_seq + 1
    else:
        next_seq = 1
    
    await storage_service.save_chat_message(
        session_id=session_id,
        user_id=user_id,
        sender_type="user",
        message=message,
        sequence_number=next_seq,
        context_type=context_type,
        context_id=contract_analysis_id or situation_analysis_id,
    )
    
    # assistant 메시지 metadata에 cases 추가 (situation 모드일 때만)
    assistant_metadata = None
    if mode == LegalChatMode.situation:
        # extracted_cases가 비어있어도 빈 배열로 저장
        assistant_metadata = {
            "cases": [case.dict() for case in extracted_cases]
        }
        logger.info(f"[Agent API] assistant metadata에 cases 저장: {len(extracted_cases)}개")
    
    await storage_service.save_chat_message(
        session_id=session_id,
        user_id=user_id,
        sender_type="assistant",
        message=answer_markdown,
        sequence_number=next_seq + 1,
        context_type=context_type,
        context_id=contract_analysis_id or situation_analysis_id,
        metadata=assistant_metadata,
    )
    
    # ---------- 6. 응답 ----------
    # 전체 API 실행 시간 측정 완료
    api_elapsed = time.time() - api_start_time
    logger.info(
        f"[Agent API] 전체 실행 완료: "
        f"mode={mode.value}, "
        f"전체 실행 시간={api_elapsed:.2f}초, "
        f"답변 길이={len(answer_markdown)}자"
    )
    
    return LegalChatAgentResponse(
        sessionId=session_id,
        mode=mode,
        contractAnalysisId=contract_analysis_id,
        situationAnalysisId=situation_analysis_id,
        answerMarkdown=answer_markdown,
        usedReports=used_reports,
        usedSources=used_sources,
        contractAnalysis=contract_analysis,
        situationAnalysis=situation_analysis,
        cases=extracted_cases if mode == LegalChatMode.situation else [],
    )


def _context_type_from_mode(mode: LegalChatMode) -> str:
    """모드에서 컨텍스트 타입 추출"""
    if mode == LegalChatMode.contract:
        return "contract"
    if mode == LegalChatMode.situation:
        return "situation"
    return "none"


async def _extract_cases_from_chunks(
    legal_chunks: List[Dict[str, Any]], 
    storage_service: Optional[ContractStorageService] = None
) -> List[CaseCard]:
    """
    legal chunk 중 source_type이 'case'인 것들을 케이스 카드 형태로 변환
    
    Args:
        legal_chunks: legal chunk 목록 (dict)
        storage_service: DB에서 metadata를 조회하기 위한 서비스 (옵션)
    
    Returns:
        CaseCard 목록
    """
    cases = []
    seen_case_ids = set()  # 중복 제거용
    
    logger.info(f"[케이스 추출] legal_chunks 개수: {len(legal_chunks)}개")
    
    for chunk in legal_chunks:
        # dict 형태 처리
        source_type = chunk.get("source_type", "")
        external_id = chunk.get("external_id") or chunk.get("externalId", "")
        title = chunk.get("title", "")
        snippet = chunk.get("snippet", "") or chunk.get("content", "")
        
        # case 타입만 처리
        if source_type != "case":
            continue
        
        logger.info(f"[케이스 추출] case 타입 발견: external_id={external_id}, title={title}")
        
        # 중복 제거 (같은 external_id는 한 번만)
        case_id = external_id or title
        if not case_id or case_id in seen_case_ids:
            continue
        seen_case_ids.add(case_id)
        
        # metadata 추출 (chunk에서 직접 또는 DB에서 조회)
        metadata = chunk.get("metadata", {})
        
        # metadata가 없고 storage_service가 있으면 DB에서 조회 시도
        if not metadata and storage_service and external_id:
            try:
                # legal_chunks 테이블에서 metadata 조회
                from config import settings
                from supabase import create_client
                sb = create_client(settings.supabase_url, settings.supabase_key)
                result = sb.table("legal_chunks")\
                    .select("metadata")\
                    .eq("external_id", external_id)\
                    .eq("source_type", "case")\
                    .limit(1)\
                    .execute()
                
                if result.data and len(result.data) > 0:
                    metadata = result.data[0].get("metadata", {})
            except Exception as e:
                logger.warning(f"[케이스 추출] DB에서 metadata 조회 실패 (external_id={external_id}): {str(e)}")
        
        # metadata가 문자열이면 파싱
        if isinstance(metadata, str):
            try:
                import json
                metadata = json.loads(metadata)
            except:
                metadata = {}
        
        # 케이스 카드 데이터 구성
        situation = metadata.get("situation", snippet[:200] if snippet else "")
        main_issues = metadata.get("issues", [])
        if not main_issues and isinstance(metadata.get("main_issues"), list):
            main_issues = metadata.get("main_issues", [])
        
        # category 추출 (metadata 또는 title에서)
        category = metadata.get("category")
        if not category:
            # title에서 카테고리 추정
            title_lower = title.lower()
            if "인턴" in title_lower or "수습" in title_lower:
                category = "intern"
            elif "임금" in title_lower or "급여" in title_lower or "수당" in title_lower:
                category = "wage"
            elif "스톡" in title_lower or "옵션" in title_lower:
                category = "stock"
            elif "프리랜서" in title_lower or "용역" in title_lower:
                category = "freelancer"
            elif "괴롭힘" in title_lower or "모욕" in title_lower or "성희롭" in title_lower:
                category = "harassment"
            else:
                category = "all"
        
        # severity 추정 (기본값: medium)
        severity = metadata.get("severity", "medium")
        
        # keywords 생성
        keywords = [f"#{issue}" for issue in main_issues[:3]]
        
        # legalIssues, learnings, actions는 metadata에서 추출 (없으면 빈 배열)
        legal_issues = metadata.get("legalIssues", metadata.get("legal_issues", []))
        learnings = metadata.get("learnings", [])
        actions = metadata.get("actions", [])
        
        case_card = CaseCard(
            id=case_id,
            title=title,
            situation=situation,
            main_issues=main_issues,
            category=category,
            severity=severity,
            keywords=keywords,
            legalIssues=legal_issues if isinstance(legal_issues, list) else [],
            learnings=learnings if isinstance(learnings, list) else [],
            actions=actions if isinstance(actions, list) else [],
        )
        cases.append(case_card)
    
    return cases


@router.get(
    "/agent/analyses/contracts/{analysis_id}",
    response_model=ContractAnalysisSummary,
    summary="계약서 분석 리포트 조회"
)
async def get_contract_analysis_agent(
    analysis_id: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id", description="사용자 ID"),
):
    """계약서 분석 리포트 조회"""
    storage_service = get_storage_service()
    analysis = await storage_service.get_contract_analysis(analysis_id, x_user_id)
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contract analysis not found",
        )
    return ContractAnalysisSummary(
        id=analysis.get("id", analysis_id),
        title=analysis.get("title"),
        riskScore=analysis.get("riskScore") or analysis.get("risk_score"),
        riskLevel=analysis.get("riskLevel") or analysis.get("risk_level"),
        summary=analysis.get("summary"),
    )


@router.get(
    "/agent/analyses/situations/{analysis_id}",
    response_model=SituationAnalysisSummary,
    summary="상황 분석 리포트 조회"
)
async def get_situation_analysis_agent(
    analysis_id: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id", description="사용자 ID"),
):
    """상황 분석 리포트 조회"""
    storage_service = get_storage_service()
    analysis = await storage_service.get_situation_analysis(analysis_id, x_user_id)
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Situation analysis not found",
        )
    return SituationAnalysisSummary(
        id=analysis.get("id", analysis_id),
        title=analysis.get("title"),
        riskScore=analysis.get("riskScore") or analysis.get("risk_score"),
        riskLevel=analysis.get("riskLevel") or analysis.get("risk_level"),
        summary=analysis.get("summary") or analysis.get("answer", ""),
    )

