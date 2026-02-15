"""
계약서 분석 결과 Supabase 저장 서비스
"""

from typing import Dict, Any, Optional, List
import os
from supabase import create_client, Client
from config import settings
import logging

logger = logging.getLogger(__name__)


class ContractStorageService:
    """계약서 분석 결과를 Supabase에 저장/조회하는 서비스"""
    
    def __init__(self):
        self.sb: Optional[Client] = None
        self._initialized = False
    
    def _ensure_initialized(self):
        """Supabase 클라이언트 지연 초기화"""
        if self._initialized:
            return
        
        supabase_url = os.getenv("SUPABASE_URL") or settings.supabase_url
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or settings.supabase_service_role_key
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다")
        
        try:
            self.sb = create_client(supabase_url, supabase_key)
            self._initialized = True
        except Exception as e:
            logger.error(f"Supabase 클라이언트 초기화 실패: {str(e)}")
            raise ValueError(f"Supabase 클라이언트 초기화 실패: {str(e)}")
    
    async def save_contract_analysis(
        self,
        doc_id: str,
        title: str,
        original_filename: Optional[str],
        doc_type: Optional[str],
        risk_score: float,
        risk_level: str,
        sections: Dict[str, int],
        summary: str,
        retrieved_contexts: List[Dict[str, Any]],
        issues: List[Dict[str, Any]],
        user_id: Optional[str] = None,
        contract_text: Optional[str] = None,  # 계약서 원문 텍스트
        clauses: Optional[List[Dict[str, Any]]] = None,  # 조항 목록
        highlighted_texts: Optional[List[Dict[str, Any]]] = None,  # 하이라이트된 텍스트
    ) -> str:
        """
        계약서 분석 결과를 DB에 저장
        
        Args:
            user_id: 사용자 ID (옵션)
        
        Returns:
            contract_analysis_id (UUID)
        """
        self._ensure_initialized()
        
        try:
            # file_name 필드는 NOT NULL 제약조건이 있으므로 반드시 값이 있어야 함
            # 우선순위: original_filename > title > 기본값
            file_name_value = None
            if original_filename and original_filename.strip():
                file_name_value = original_filename.strip()
            elif title and title.strip():
                file_name_value = title.strip()
            else:
                file_name_value = "unknown.pdf"  # 최후의 기본값
            
            # 로깅으로 실제 저장되는 값 확인
            logger.info(f"[DB 저장] file_name 설정: original_filename={original_filename}, title={title}, 최종 file_name={file_name_value}")
            
            # 1. contract_analyses 테이블에 헤더 저장
            analysis_data = {
                "doc_id": doc_id,
                "title": title,
                "file_name": original_filename or title,  # file_name은 NOT NULL이므로 original_filename 또는 title 사용
                "file_url": "",  # file_url은 NOT NULL이므로 빈 문자열로 설정 (필요시 나중에 업로드된 파일 URL로 업데이트)
                "original_filename": original_filename,
                "file_name": file_name_value,  # NOT NULL 제약조건 충족
                "doc_type": doc_type,
                "risk_score": int(round(float(risk_score))),  # DB는 integer 타입이므로 변환
                "risk_level": risk_level,
                "sections": sections,
                "summary": summary,
                "retrieved_contexts": retrieved_contexts,
            }
            
            # 계약서 원문 텍스트 저장
            if contract_text:
                analysis_data["contract_text"] = contract_text
            
            # 조항 목록 저장 (JSONB) - Pydantic 모델을 dict로 변환
            if clauses:
                try:
                    from fastapi.encoders import jsonable_encoder
                    clauses_json = jsonable_encoder(clauses)
                    analysis_data["clauses"] = clauses_json
                    logger.debug(f"[DB 저장] clauses 변환 완료: {len(clauses_json)}개, 타입: {type(clauses_json)}")
                except Exception as e:
                    logger.error(f"[DB 저장] clauses 변환 실패: {str(e)}", exc_info=True)
                    # Fallback: 수동 변환
                    clauses_json = []
                    for clause in clauses:
                        if hasattr(clause, 'model_dump'):  # Pydantic v2
                            clauses_json.append(clause.model_dump())
                        elif hasattr(clause, 'dict'):  # Pydantic v1
                            clauses_json.append(clause.dict())
                        elif isinstance(clause, dict):
                            clauses_json.append(clause)
                        else:
                            logger.warning(f"[DB 저장] clause 변환 실패: {type(clause)}")
                    analysis_data["clauses"] = clauses_json
            
            # 하이라이트된 텍스트 저장 (JSONB) - Pydantic 모델을 dict로 변환
            if highlighted_texts:
                try:
                    from fastapi.encoders import jsonable_encoder
                    highlighted_json = jsonable_encoder(highlighted_texts)
                    analysis_data["highlighted_texts"] = highlighted_json
                    logger.debug(f"[DB 저장] highlighted_texts 변환 완료: {len(highlighted_json)}개, 타입: {type(highlighted_json)}")
                except Exception as e:
                    logger.error(f"[DB 저장] highlighted_texts 변환 실패: {str(e)}", exc_info=True)
                    # Fallback: 수동 변환
                    highlighted_json = []
                    for ht in highlighted_texts:
                        if hasattr(ht, 'model_dump'):  # Pydantic v2
                            highlighted_json.append(ht.model_dump())
                        elif hasattr(ht, 'dict'):  # Pydantic v1
                            highlighted_json.append(ht.dict())
                        elif isinstance(ht, dict):
                            highlighted_json.append(ht)
                        else:
                            logger.warning(f"[DB 저장] highlighted_text 변환 실패: {type(ht)}")
                    analysis_data["highlighted_texts"] = highlighted_json
            
            # user_id가 제공된 경우 추가
            if user_id:
                analysis_data["user_id"] = user_id
            
            result = self.sb.table("contract_analyses").insert(analysis_data).execute()
            
            if not result.data or len(result.data) == 0:
                raise ValueError("계약서 분석 결과 저장 실패")
            
            contract_analysis_id = result.data[0]["id"]
            
            # 2. contract_issues 테이블에 이슈들 저장 (테이블이 있는 경우에만)
            logger.info(f"[DB 저장] issues 배열 길이: {len(issues) if issues else 0}")
            if issues:
                try:
                    issues_data = []
                    for idx, issue in enumerate(issues):
                        # legalBasis 변환: LegalBasisItemV2 객체를 dict 또는 string으로 변환
                        legal_basis_raw = issue.get("legalBasis", [])
                        legal_basis_converted = []
                        for basis in legal_basis_raw:
                            if isinstance(basis, dict):
                                # 이미 dict인 경우 그대로 사용
                                legal_basis_converted.append(basis)
                            elif hasattr(basis, 'model_dump'):
                                # Pydantic v2 모델인 경우
                                legal_basis_converted.append(basis.model_dump())
                            elif hasattr(basis, 'dict'):
                                # Pydantic v1 모델인 경우
                                legal_basis_converted.append(basis.dict())
                            elif isinstance(basis, str):
                                # 문자열인 경우 그대로 사용
                                legal_basis_converted.append(basis)
                            else:
                                # 기타 타입은 문자열로 변환
                                legal_basis_converted.append(str(basis))
                        
                        issue_data = {
                            "contract_analysis_id": contract_analysis_id,
                            "issue_id": issue.get("id", f"issue-{idx+1}"),
                            "category": issue.get("category", ""),
                            "severity": issue.get("severity", "medium"),
                            "summary": issue.get("summary", ""),
                            "original_text": issue.get("originalText", ""),
                            "legal_basis": legal_basis_converted,  # 변환된 legal_basis 사용
                            "explanation": issue.get("explanation", ""),
                            "suggested_revision": issue.get("suggestedRevision", ""),
                        }
                        issues_data.append(issue_data)
                        logger.debug(f"[DB 저장] issue[{idx}]: id={issue_data['issue_id']}, summary={issue_data['summary'][:50] if issue_data['summary'] else '(없음)'}")
                
                    if issues_data:
                        result_issues = self.sb.table("contract_issues").insert(issues_data).execute()
                        logger.info(f"[DB 저장] contract_issues 저장 완료: {len(issues_data)}개 이슈 저장됨")
                    else:
                        logger.warning(f"[DB 저장] issues_data가 비어있어 이슈를 저장하지 않음")
                except Exception as issues_error:
                    # contract_issues 테이블이 없으면 무시 (선택적 기능)
                    logger.warning(f"contract_issues 저장 실패 (계속 진행): {str(issues_error)}", exc_info=True)
            else:
                logger.warning(f"[DB 저장] issues 배열이 비어있어 이슈를 저장하지 않음")
            
            logger.info(f"계약서 분석 결과 저장 완료: doc_id={doc_id}, analysis_id={contract_analysis_id}")
            return contract_analysis_id
            
        except Exception as e:
            logger.error(f"계약서 분석 결과 저장 중 오류: {str(e)}", exc_info=True)
            raise
    
    async def get_contract_analysis_by_filename(
        self, 
        file_name: str, 
        user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        file_name으로 계약서 분석 결과를 조회 (캐시 조회용)
        
        Args:
            file_name: 파일명
            user_id: 사용자 ID (옵션, 필터링용)
        
        Returns:
            계약서 분석 결과 딕셔너리 또는 None
            분석이 완료된 경우에만 반환 (clauses가 비어있지 않거나 analysis_result IS NOT NULL)
        """
        self._ensure_initialized()
        
        try:
            # contract_analyses 테이블에서 file_name으로 조회
            # ORDER BY created_at DESC LIMIT 1로 가장 최근 것만 가져옴
            query = (
                self.sb.table("contract_analyses")
                .select("*")
                .eq("file_name", file_name)
                .order("created_at", desc=True)
                .limit(1)
            )
            
            # user_id가 제공된 경우 필터링 (선택사항, 로그인 없이도 사용 가능하므로 필터링하지 않음)
            # 지시서: "로그인 없이도 사용 가능"이므로 user_id 필터링은 하지 않음
            
            result = query.execute()
            
            if not result.data or len(result.data) == 0:
                logger.info(f"[캐시 조회] file_name으로 분석 결과를 찾을 수 없음: {file_name}")
                return None
            
            analysis = result.data[0]
            
            # 분석 완료 여부 확인
            # 지시서: "clauses가 []가 아니거나 analysis_result IS NOT NULL" 둘 중 하나 이상 만족
            clauses = analysis.get("clauses", [])
            analysis_result = analysis.get("analysis_result")
            
            # clauses가 비어있지 않은지 확인
            has_clauses = clauses and isinstance(clauses, list) and len(clauses) > 0
            # analysis_result가 NULL이 아닌지 확인
            has_analysis_result = analysis_result is not None
            
            if not has_clauses and not has_analysis_result:
                logger.info(f"[캐시 조회] 분석이 완료되지 않은 결과 발견: file_name={file_name}, clauses={len(clauses) if isinstance(clauses, list) else 0}, analysis_result={analysis_result is not None}")
                return None
            
            logger.info(f"[캐시 조회] 분석 완료된 결과 발견: file_name={file_name}, doc_id={analysis.get('doc_id')}, clauses={len(clauses) if isinstance(clauses, list) else 0}, analysis_result={analysis_result is not None}")
            
            # 분석이 완료된 경우, get_contract_analysis와 동일한 방식으로 데이터 구성
            contract_analysis_id = analysis["id"]
            doc_id_value = analysis.get("doc_id") or str(analysis["id"])
            
            # contract_issues 테이블에서 이슈들 조회
            issues = []
            try:
                issues_result = (
                    self.sb.table("contract_issues")
                    .select("*")
                    .eq("contract_analysis_id", contract_analysis_id)
                    .execute()
                )
                
                if issues_result.data:
                    for issue in issues_result.data:
                        issues.append({
                            "id": issue.get("issue_id", ""),
                            "category": issue.get("category", ""),
                            "severity": issue.get("severity", "medium"),
                            "summary": issue.get("summary", ""),
                            "originalText": issue.get("original_text", ""),
                            "legalBasis": issue.get("legal_basis", []),
                            "explanation": issue.get("explanation", ""),
                            "suggestedRevision": issue.get("suggested_revision", ""),
                        })
            except Exception as e:
                logger.warning(f"[캐시 조회] contract_issues 조회 실패: {str(e)}")
                issues = []
            
            # clauses와 highlightedTexts 조회 (JSONB 컬럼)
            clauses_data = analysis.get("clauses", [])
            highlighted_texts_data = analysis.get("highlighted_texts", [])
            
            # None 값 처리: Pydantic 검증을 위해 기본값 제공
            title_value = analysis.get("title")
            if title_value is None:
                title_value = analysis.get("file_name") or analysis.get("original_filename") or "계약서"
            
            sections_value = analysis.get("sections")
            if sections_value is None or not isinstance(sections_value, dict):
                sections_value = {}
            
            retrieved_contexts_value = analysis.get("retrieved_contexts")
            if retrieved_contexts_value is None or not isinstance(retrieved_contexts_value, list):
                retrieved_contexts_value = []
            
            summary_value = analysis.get("summary")
            if summary_value is None:
                summary_value = ""
            
            contract_text_value = analysis.get("contract_text")
            if contract_text_value is None:
                contract_text_value = ""
            
            created_at_value = analysis.get("created_at")
            if created_at_value is None:
                from datetime import datetime
                created_at_value = datetime.utcnow().isoformat() + "Z"
            elif isinstance(created_at_value, str):
                # 이미 문자열이면 그대로 사용
                pass
            else:
                # datetime 객체면 ISO 형식으로 변환
                created_at_value = created_at_value.isoformat() + "Z" if hasattr(created_at_value, 'isoformat') else str(created_at_value)
            
            return {
                "docId": doc_id_value,
                "title": title_value,
                "riskScore": float(analysis.get("risk_score", 0)),
                "riskLevel": analysis.get("risk_level", "medium"),
                "sections": sections_value,
                "issues": issues,
                "summary": summary_value,
                "retrievedContexts": retrieved_contexts_value,
                "contractText": contract_text_value,  # 계약서 원문 텍스트
                "clauses": clauses_data if isinstance(clauses_data, list) else [],  # 조항 목록
                "highlightedTexts": highlighted_texts_data if isinstance(highlighted_texts_data, list) else [],  # 하이라이트된 텍스트
                "createdAt": created_at_value,
                "fileUrl": analysis.get("file_url") or None,  # Supabase Storage 파일 URL
            }
            
        except Exception as e:
            logger.error(f"[캐시 조회] file_name으로 계약서 분석 결과 조회 중 오류: {str(e)}", exc_info=True)
            return None
    
    async def get_contract_analysis(self, doc_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        계약서 분석 결과를 DB에서 조회
        
        Args:
            doc_id: 문서 ID
            user_id: 사용자 ID (옵션, 현재는 필터링에 사용하지 않음 - doc_id만으로 조회)
        
        Returns:
            계약서 분석 결과 딕셔너리 또는 None
        """
        self._ensure_initialized()
        
        try:
            # contract_analyses 테이블에서 조회
            # doc_id로 먼저 시도, 없으면 id로 시도 (기존 데이터 호환성)
            # user_id 필터링 제거: doc_id만으로 조회하여 모든 사용자의 계약서를 볼 수 있게 함
            query = self.sb.table("contract_analyses").select("*").eq("doc_id", doc_id)
            
            result = query.execute()
            
            # doc_id로 찾지 못한 경우, id로 시도 (UUID 형식인 경우)
            if not result.data or len(result.data) == 0:
                try:
                    # UUID 형식인지 확인
                    import uuid
                    uuid.UUID(doc_id)
                    query = self.sb.table("contract_analyses").select("*").eq("id", doc_id)
                    result = query.execute()
                except (ValueError, AttributeError):
                    pass
            
            if not result.data or len(result.data) == 0:
                logger.warning(f"계약서 분석 결과를 찾을 수 없음: doc_id={doc_id}, user_id={user_id}")
                return None
            
            analysis = result.data[0]
            contract_analysis_id = analysis["id"]
            
            # contract_issues 테이블에서 이슈들 조회 (테이블이 있는 경우에만)
            issues = []
            try:
                issues_result = (
                    self.sb.table("contract_issues")
                    .select("*")
                    .eq("contract_analysis_id", contract_analysis_id)
                    .execute()
                )
                
                if issues_result.data:
                    for issue in issues_result.data:
                        issues.append({
                            "id": issue.get("issue_id", ""),
                            "category": issue.get("category", ""),
                            "severity": issue.get("severity", "medium"),
                            "summary": issue.get("summary", ""),
                            "originalText": issue.get("original_text", ""),
                            "legalBasis": issue.get("legal_basis", []),
                            "explanation": issue.get("explanation", ""),
                            "suggestedRevision": issue.get("suggested_revision", ""),
                        })
            except Exception:
                # contract_issues 테이블이 없으면 빈 리스트로 설정
                issues = []
            
            # v2 응답 형식으로 변환
            # doc_id가 없으면 id를 사용 (기존 데이터 호환성)
            doc_id_value = analysis.get("doc_id") or str(analysis["id"])
            
            # clauses와 highlightedTexts 조회 (JSONB 컬럼)
            clauses_data = analysis.get("clauses", [])
            highlighted_texts_data = analysis.get("highlighted_texts", [])
            
            return {
                "docId": doc_id_value,
                "title": analysis.get("title", ""),
                "riskScore": float(analysis.get("risk_score", 0)),
                "riskLevel": analysis.get("risk_level", "medium"),
                "sections": analysis.get("sections", {}),
                "issues": issues,
                "summary": analysis.get("summary", ""),
                "retrievedContexts": analysis.get("retrieved_contexts", []),
                "contractText": analysis.get("contract_text", ""),  # 계약서 원문 텍스트
                "clauses": clauses_data if isinstance(clauses_data, list) else [],  # 조항 목록
                "highlightedTexts": highlighted_texts_data if isinstance(highlighted_texts_data, list) else [],  # 하이라이트된 텍스트
                "createdAt": analysis.get("created_at", ""),
                "fileUrl": analysis.get("file_url") or None,  # Supabase Storage 파일 URL
            }
            
        except Exception as e:
            logger.error(f"계약서 분석 결과 조회 중 오류: {str(e)}", exc_info=True)
            return None
    
    async def save_situation_analysis(
        self,
        situation: str,
        category: Optional[str],
        employment_type: Optional[str],
        company_size: Optional[str],
        work_period: Optional[str],
        has_written_contract: Optional[bool],
        social_insurance: Optional[List[str]],
        risk_score: float,
        risk_level: str,
        analysis: Dict[str, Any],
        checklist: List[str],
        related_cases: List[Dict[str, Any]],
        user_id: Optional[str] = None,
        question: Optional[str] = None,
        answer: Optional[str] = None,
        details: Optional[str] = None,
        category_hint: Optional[str] = None,
        classified_type: Optional[str] = None,
    ) -> str:
        """
        상황 분석 결과를 DB에 저장
        
        Args:
            user_id: 사용자 ID (옵션)
            question: 사용자가 입력한 상황 요약 (situation과 동일할 수 있음)
            answer: 리포트 내용 (analysis.summary와 동일할 수 있음)
            details: 상세 설명
            category_hint: 상황 카테고리 힌트 (category와 동일할 수 있음)
            classified_type: 분류된 유형
        
        Returns:
            situation_analysis_id (UUID)
        """
        self._ensure_initialized()
        
        try:
            # analysis에서 summary 추출 (answer가 없을 경우)
            analysis_summary = analysis.get("summary", "") if isinstance(analysis, dict) else ""
            
            data = {
                "situation": situation,
                "category": category,
                "employment_type": employment_type,
                "company_size": company_size,
                "work_period": work_period,
                "has_written_contract": has_written_contract,
                "social_insurance": social_insurance or [],
                "risk_score": int(round(float(risk_score))),  # DB는 integer 타입이므로 변환
                "risk_level": risk_level,
                "analysis": analysis,
                "checklist": checklist,
                "related_cases": related_cases,
                # 새로운 필드들 (situation_reports 통합)
                "question": question or situation,  # question이 없으면 situation 사용
                "answer": answer or analysis_summary,  # answer가 없으면 analysis.summary 사용
                "details": details,
                "category_hint": category_hint or category,  # category_hint가 없으면 category 사용
                "classified_type": classified_type,
            }
            
            # user_id가 제공된 경우 추가
            if user_id:
                data["user_id"] = user_id
            
            result = self.sb.table("situation_analyses").insert(data).execute()
            
            if not result.data or len(result.data) == 0:
                raise ValueError("상황 분석 결과 저장 실패")
            
            situation_analysis_id = result.data[0]["id"]
            logger.info(f"상황 분석 결과 저장 완료: id={situation_analysis_id}")
            return situation_analysis_id
            
        except Exception as e:
            error_str = str(e)
            # situation_conversations 테이블이 없는 경우는 무시 (테이블이 삭제되었지만 트리거가 남아있을 수 있음)
            if "situation_conversations" in error_str and "does not exist" in error_str:
                logger.warning(f"상황 분석 결과 저장 중 situation_conversations 테이블 참조 오류 (무시): {error_str}")
                # 트리거 오류를 무시하고 계속 진행
                # 하지만 insert는 실패했을 수 있으므로 다시 시도하거나 다른 방법 사용
                try:
                    # 트리거를 우회하기 위해 직접 insert 시도 (트리거가 있는 경우 실패할 수 있음)
                    # 또는 트리거를 비활성화하거나 수정해야 함
                    logger.warning("situation_conversations 테이블이 삭제되었지만 트리거가 남아있을 수 있습니다. DB 관리자에게 문의하세요.")
                    # 일단 에러를 다시 발생시켜서 상위에서 처리하도록 함
                    raise
                except:
                    # 재시도도 실패하면 원본 에러를 다시 발생
                    raise
            else:
                logger.error(f"상황 분석 결과 저장 중 오류: {error_str}", exc_info=True)
                raise
    
    async def get_user_contract_analyses(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        사용자별 계약서 분석 히스토리 조회
        
        Args:
            user_id: 사용자 ID
            limit: 조회 개수
            offset: 오프셋
        
        Returns:
            계약서 분석 결과 리스트
        """
        self._ensure_initialized()
        
        try:
            result = (
                self.sb.table("contract_analyses")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(limit)
                .offset(offset)
                .execute()
            )
            
            analyses = []
            if result.data:
                for analysis in result.data:
                    contract_analysis_id = analysis["id"]
                    
                    # 이슈 개수 조회 (contract_issues 테이블이 있는 경우에만)
                    issue_count = 0
                    try:
                        issues_result = (
                            self.sb.table("contract_issues")
                            .select("id", count="exact")
                            .eq("contract_analysis_id", contract_analysis_id)
                            .execute()
                        )
                        issue_count = issues_result.count if hasattr(issues_result, 'count') else 0
                    except Exception:
                        # contract_issues 테이블이 없으면 0으로 설정
                        issue_count = 0
                    
                    # doc_id가 없으면 id를 사용 (기존 데이터 호환성)
                    doc_id_value = analysis.get("doc_id") or str(analysis["id"])
                    
                    analyses.append({
                        "id": analysis["id"],
                        "doc_id": doc_id_value,
                        "title": analysis.get("title", ""),
                        "original_filename": analysis.get("original_filename", ""),
                        "risk_score": float(analysis.get("risk_score", 0)),
                        "risk_level": analysis.get("risk_level", "medium"),
                        "summary": analysis.get("summary", ""),
                        "created_at": analysis.get("created_at", ""),
                        "issue_count": issue_count,
                    })
            
            return analyses
            
        except Exception as e:
            logger.error(f"사용자별 계약서 분석 조회 중 오류: {str(e)}", exc_info=True)
            return []
    
    async def get_user_situation_analyses(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        사용자별 상황 분석 히스토리 조회
        
        Args:
            user_id: 사용자 ID
            limit: 조회 개수
            offset: 오프셋
        
        Returns:
            상황 분석 결과 리스트
        """
        self._ensure_initialized()
        
        try:
            result = (
                self.sb.table("situation_analyses")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(limit)
                .offset(offset)
                .execute()
            )
            
            analyses = []
            if result.data:
                for analysis in result.data:
                    # analysis 필드에서 summary 추출
                    analysis_data = analysis.get("analysis", {})
                    summary = ""
                    if isinstance(analysis_data, dict):
                        summary = analysis_data.get("summary", "")
                    
                    analyses.append({
                        "id": analysis["id"],
                        "situation": analysis.get("situation", "")[:100],  # 미리보기용
                        "category": analysis.get("category", "unknown"),
                        "risk_score": int(analysis.get("risk_score", 0)),
                        "risk_level": analysis.get("risk_level", "low"),
                        "summary": summary[:200] if summary else "",  # 미리보기용
                        "created_at": analysis.get("created_at"),
                    })
            
            return analyses
        except Exception as e:
            logger.error(f"상황 분석 히스토리 조회 중 오류: {str(e)}", exc_info=True)
            raise
    
    async def get_situation_analysis(
        self,
        situation_id: str,
        user_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        특정 상황 분석 결과 조회
        
        Args:
            situation_id: 상황 분석 ID
            user_id: 사용자 ID (선택, 권한 확인용)
        
        Returns:
            상황 분석 결과 또는 None
        """
        self._ensure_initialized()
        
        try:
            # user_id 필터링 제거: 모든 사용자의 분석 결과 조회 가능
            query = self.sb.table("situation_analyses").select("*").eq("id", situation_id)
            
            result = query.execute()
            
            if not result.data or len(result.data) == 0:
                return None
            
            analysis = result.data[0]
            
            # v2 API 형식으로 변환
            analysis_data = analysis.get("analysis", {})
            if not isinstance(analysis_data, dict):
                analysis_data = {}
            
            # 프론트엔드가 기대하는 구조로 변환
            # analysis JSONB 필드에 저장된 전체 구조를 그대로 사용
            summary = analysis_data.get("summary", analysis.get("answer", ""))
            sources = analysis_data.get("sources", [])
            criteria = analysis_data.get("criteria", [])
            # relatedCases는 analyze_situation과 동일한 구조로 변환 (문서 단위 그룹핑)
            related_cases_raw = analysis_data.get("relatedCases", analysis.get("related_cases", []))
            # relatedCases가 이미 문서 단위로 그룹핑된 구조인지 확인
            if related_cases_raw and isinstance(related_cases_raw, list) and len(related_cases_raw) > 0:
                # 첫 번째 항목이 문서 단위 구조인지 확인 (documentTitle, snippets 등이 있는지)
                first_case = related_cases_raw[0]
                if isinstance(first_case, dict) and "documentTitle" in first_case:
                    # 이미 문서 단위로 그룹핑된 구조
                    related_cases = related_cases_raw
                else:
                    # 레거시 구조면 빈 배열로 설정 (analyze_situation과 동일하게 처리)
                    related_cases = []
            else:
                related_cases = []
            action_plan = analysis_data.get("actionPlan", {})
            scripts_raw = analysis_data.get("scripts", {})
            # scripts를 camelCase로 변환 (이메일 템플릿 구조: {subject, body})
            scripts = {}
            if isinstance(scripts_raw, dict):
                # to_company 변환
                to_company_raw = scripts_raw.get("to_company") or scripts_raw.get("toCompany")
                if isinstance(to_company_raw, dict):
                    to_company = {
                        "subject": to_company_raw.get("subject", ""),
                        "body": to_company_raw.get("body", "")
                    }
                elif isinstance(to_company_raw, str):
                    # 레거시 형식 (문자열)인 경우 기본 구조로 변환
                    to_company = {
                        "subject": "근로계약 관련 확인 요청",
                        "body": to_company_raw[:200] if len(to_company_raw) > 200 else to_company_raw
                    }
                else:
                    to_company = None
                
                # to_advisor 변환
                to_advisor_raw = scripts_raw.get("to_advisor") or scripts_raw.get("toAdvisor")
                if isinstance(to_advisor_raw, dict):
                    to_advisor = {
                        "subject": to_advisor_raw.get("subject", ""),
                        "body": to_advisor_raw.get("body", "")
                    }
                elif isinstance(to_advisor_raw, str):
                    # 레거시 형식 (문자열)인 경우 기본 구조로 변환
                    to_advisor = {
                        "subject": "노무 상담 요청",
                        "body": to_advisor_raw[:200] if len(to_advisor_raw) > 200 else to_advisor_raw
                    }
                else:
                    to_advisor = None
                
                scripts = {
                    "toCompany": to_company,
                    "toAdvisor": to_advisor,
                }
            classified_type = analysis_data.get("classifiedType", analysis.get("classified_type", "unknown"))
            risk_score = analysis_data.get("riskScore", float(analysis.get("risk_score", 0)))
            
            # criteria가 비어있으면 빈 배열로 설정 (None 방지)
            if not criteria:
                criteria = []
            elif not isinstance(criteria, list):
                criteria = []
            
            # findings 가져오기
            findings = analysis_data.get("findings", [])
            if not isinstance(findings, list):
                findings = []
            
            # organizations 가져오기
            organizations = analysis_data.get("organizations", [])
            if not isinstance(organizations, list):
                organizations = []
            
            # 디버깅: criteria 확인 (DEBUG 레벨로 변경하여 불필요한 로그 감소)
            # logger.debug(f"[get_situation_analysis] analysis_data 키: {list(analysis_data.keys()) if isinstance(analysis_data, dict) else 'Not a dict'}")
            # logger.debug(f"[get_situation_analysis] criteria 개수: {len(criteria) if isinstance(criteria, list) else 0}")
            # logger.debug(f"[get_situation_analysis] findings 개수: {len(findings) if isinstance(findings, list) else 0}")
            # logger.debug(f"[get_situation_analysis] organizations 개수: {len(organizations) if isinstance(organizations, list) else 0}")
            
            # recommendations는 actionPlan에서 추출 (레거시 호환성)
            recommendations = []
            if action_plan and action_plan.get("steps"):
                for step in action_plan.get("steps", [])[1:]:  # 첫 번째 step 제외
                    recommendations.extend(step.get("items", []))
            elif analysis_data.get("recommendations"):
                recommendations = analysis_data.get("recommendations", [])
            
            # riskLevel 계산
            risk_level = "low"
            if risk_score >= 70:
                risk_level = "high"
            elif risk_score >= 40:
                risk_level = "medium"
            
            # tags 생성 (classified_type 기반)
            tags = [classified_type] if classified_type and classified_type != "unknown" else []
            
            # 분석 API와 동일한 구조로 반환: id, riskScore, riskLevel, tags + summary, findings, relatedCases, scripts, organizations 포함
            return {
                "id": analysis.get("id"),  # 상황 분석 ID
                "riskScore": float(risk_score),  # 위험도 점수
                "riskLevel": risk_level,  # 위험도 레벨 (low/medium/high)
                "tags": tags,  # 분류 태그 (classified_type 기반)
                "summary": summary,
                "findings": findings if isinstance(findings, list) else [],  # 법적 쟁점 발견 항목
                "relatedCases": related_cases,  # 법적 문서 (문서 단위 그룹핑)
                "scripts": scripts,  # 이메일 템플릿 (to_company, to_advisor)
                "organizations": organizations if isinstance(organizations, list) else [],  # 추천 기관 목록
            }
        except Exception as e:
            logger.error(f"상황 분석 조회 중 오류: {str(e)}", exc_info=True)
            raise
    
    # 레거시 함수 제거됨 - 새 테이블 구조(legal_chat_sessions, legal_chat_messages) 사용
    
    # ============================================================================
    # 새로운 통합 챗 시스템 (legal_chat_sessions, legal_chat_messages)
    # ============================================================================
    
    async def create_chat_session(
        self,
        user_id: str,
        initial_context_type: str = 'none',
        initial_context_id: Optional[str] = None,
        title: Optional[str] = None,
    ) -> str:
        """
        새로운 챗 세션 생성
        
        Args:
            user_id: 사용자 ID
            initial_context_type: 초기 컨텍스트 타입 ('none' | 'situation' | 'contract')
            initial_context_id: 초기 컨텍스트 ID (situation_analyses.id 또는 contract_analyses.id)
            title: 세션 제목 (옵션)
        
        Returns:
            session_id (UUID)
        """
        self._ensure_initialized()
        
        try:
            data = {
                "user_id": user_id,
                "initial_context_type": initial_context_type,
            }
            
            if initial_context_id:
                data["initial_context_id"] = initial_context_id
            
            if title:
                data["title"] = title
            
            result = self.sb.table("legal_chat_sessions").insert(data).execute()
            
            if not result.data or len(result.data) == 0:
                raise ValueError("챗 세션 생성 실패")
            
            session_id = result.data[0]["id"]
            logger.info(f"챗 세션 생성 완료: id={session_id}, user_id={user_id}, context_type={initial_context_type}")
            return session_id
            
        except Exception as e:
            logger.error(f"챗 세션 생성 중 오류: {str(e)}", exc_info=True)
            raise
    
    async def save_chat_message(
        self,
        session_id: str,
        user_id: str,
        sender_type: str,
        message: str,
        sequence_number: int,
        context_type: str = 'none',
        context_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        챗 메시지 저장
        
        Args:
            session_id: 챗 세션 ID
            user_id: 사용자 ID
            sender_type: 발신자 타입 ('user' | 'assistant')
            message: 메시지 내용
            sequence_number: 메시지 순서
            context_type: 컨텍스트 타입 ('none' | 'situation' | 'contract')
            context_id: 컨텍스트 ID (옵션)
            metadata: 추가 메타데이터 (옵션)
        
        Returns:
            message_id (UUID)
        """
        self._ensure_initialized()
        
        try:
            data = {
                "session_id": session_id,
                "user_id": user_id,
                "sender_type": sender_type,
                "message": message,
                "sequence_number": sequence_number,
                "context_type": context_type,
            }
            
            if context_id:
                data["context_id"] = context_id
            
            if metadata:
                data["metadata"] = metadata
            
            result = self.sb.table("legal_chat_messages").insert(data).execute()
            
            if not result.data or len(result.data) == 0:
                raise ValueError("챗 메시지 저장 실패")
            
            message_id = result.data[0]["id"]
            logger.info(f"챗 메시지 저장 완료: id={message_id}, session_id={session_id}, sender_type={sender_type}")
            return message_id
            
        except Exception as e:
            logger.error(f"챗 메시지 저장 중 오류: {str(e)}", exc_info=True)
            raise
    
    async def get_chat_sessions(
        self,
        user_id: str,
        limit: int = 20,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        사용자의 챗 세션 목록 조회
        
        Args:
            user_id: 사용자 ID
            limit: 조회 개수
            offset: 오프셋
        
        Returns:
            챗 세션 리스트
        """
        self._ensure_initialized()
        
        try:
            result = (
                self.sb.table("legal_chat_sessions")
                .select("*")
                .eq("user_id", user_id)
                .order("updated_at", desc=True)
                .limit(limit)
                .offset(offset)
                .execute()
            )
            
            return result.data or []
        except Exception as e:
            logger.error(f"챗 세션 목록 조회 중 오류: {str(e)}", exc_info=True)
            raise
    
    async def get_chat_messages(
        self,
        session_id: str,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        챗 세션의 메시지 목록 조회
        
        Args:
            session_id: 챗 세션 ID
            user_id: 사용자 ID (옵션, 권한 확인용)
        
        Returns:
            챗 메시지 리스트 (sequence_number 순서대로 정렬)
        """
        self._ensure_initialized()
        
        try:
            query = (
                self.sb.table("legal_chat_messages")
                .select("*")
                .eq("session_id", session_id)
                .order("sequence_number", desc=False)
            )
            
            if user_id:
                query = query.eq("user_id", user_id)
            
            result = query.execute()
            
            return result.data or []
        except Exception as e:
            logger.error(f"챗 메시지 조회 중 오류: {str(e)}", exc_info=True)
            raise
    
    async def get_chat_session(
        self,
        session_id: str,
        user_id: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """
        특정 챗 세션 조회
        
        Args:
            session_id: 챗 세션 ID
            user_id: 사용자 ID (옵션, 권한 확인용)
        
        Returns:
            챗 세션 정보 또는 None
        """
        self._ensure_initialized()
        
        try:
            query = (
                self.sb.table("legal_chat_sessions")
                .select("*")
                .eq("id", session_id)
            )
            
            if user_id:
                query = query.eq("user_id", user_id)
            
            result = query.execute()
            
            if not result.data or len(result.data) == 0:
                return None
            
            return result.data[0]
        except Exception as e:
            logger.error(f"챗 세션 조회 중 오류: {str(e)}", exc_info=True)
            raise
    
    async def update_chat_session(
        self,
        session_id: str,
        user_id: str,
        title: Optional[str] = None,
    ) -> bool:
        """
        챗 세션 업데이트 (제목 등)
        
        Args:
            session_id: 챗 세션 ID
            user_id: 사용자 ID
            title: 새 제목 (옵션)
        
        Returns:
            성공 여부
        """
        self._ensure_initialized()
        
        try:
            data = {}
            if title is not None:
                data["title"] = title
            
            if not data:
                return True
            
            result = (
                self.sb.table("legal_chat_sessions")
                .update(data)
                .eq("id", session_id)
                .eq("user_id", user_id)
                .execute()
            )
            
            return True
        except Exception as e:
            logger.error(f"챗 세션 업데이트 중 오류: {str(e)}", exc_info=True)
            raise
    
    async def delete_chat_session(
        self,
        session_id: str,
        user_id: str,
    ) -> bool:
        """
        챗 세션 삭제 (CASCADE로 메시지도 함께 삭제됨)
        
        Args:
            session_id: 챗 세션 ID
            user_id: 사용자 ID
        
        Returns:
            성공 여부
        """
        self._ensure_initialized()
        
        try:
            self.sb.table("legal_chat_sessions").delete().eq("id", session_id).eq("user_id", user_id).execute()
            logger.info(f"챗 세션 삭제 완료: session_id={session_id}")
            return True
        except Exception as e:
            logger.error(f"챗 세션 삭제 중 오류: {str(e)}", exc_info=True)
            raise
    
    async def create_chat_session(
        self,
        user_id: str,
        initial_context_type: str = "none",
        initial_context_id: Optional[str] = None,
        title: Optional[str] = None,
    ) -> str:
        """
        새로운 채팅 세션 생성
        
        Args:
            user_id: 사용자 ID
            initial_context_type: 초기 컨텍스트 타입 ('none', 'situation', 'contract')
            initial_context_id: 초기 컨텍스트 ID (situation_analyses.id 또는 contract_analyses.id)
            title: 세션 제목 (옵션)
        
        Returns:
            session_id (UUID)
        """
        self._ensure_initialized()
        
        try:
            data = {
                "user_id": user_id,
                "initial_context_type": initial_context_type,
            }
            
            if initial_context_id:
                data["initial_context_id"] = initial_context_id
            
            if title:
                data["title"] = title
            
            result = self.sb.table("legal_chat_sessions").insert(data).execute()
            
            if not result.data or len(result.data) == 0:
                raise ValueError("채팅 세션 생성 실패")
            
            session_id = result.data[0]["id"]
            logger.info(f"채팅 세션 생성 완료: id={session_id}, context_type={initial_context_type}, context_id={initial_context_id}")
            return session_id
            
        except Exception as e:
            logger.error(f"채팅 세션 생성 중 오류: {str(e)}", exc_info=True)
            raise
    
    async def save_chat_message(
        self,
        session_id: str,
        user_id: str,
        message: str,
        sender_type: str,
        sequence_number: int,
        context_type: str = "none",
        context_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        채팅 메시지 저장
        
        Args:
            session_id: 세션 ID
            user_id: 사용자 ID
            message: 메시지 내용
            sender_type: 발신자 타입 ('user' 또는 'assistant')
            sequence_number: 메시지 순서
            context_type: 컨텍스트 타입 ('none', 'situation', 'contract')
            context_id: 컨텍스트 ID (옵션)
            metadata: 추가 메타데이터 (옵션)
        
        Returns:
            message_id (UUID)
        """
        self._ensure_initialized()
        
        try:
            data = {
                "session_id": session_id,
                "user_id": user_id,
                "message": message,
                "sender_type": sender_type,
                "sequence_number": sequence_number,
                "context_type": context_type,
            }
            
            if context_id:
                data["context_id"] = context_id
            
            if metadata:
                data["metadata"] = metadata
            
            result = self.sb.table("legal_chat_messages").insert(data).execute()
            
            if not result.data or len(result.data) == 0:
                raise ValueError("채팅 메시지 저장 실패")
            
            message_id = result.data[0]["id"]
            logger.info(f"채팅 메시지 저장 완료: id={message_id}, session_id={session_id}, sender_type={sender_type}")
            return message_id
            
        except Exception as e:
            logger.error(f"채팅 메시지 저장 중 오류: {str(e)}", exc_info=True)
            raise
    
    async def get_chat_messages(
        self,
        session_id: str,
        user_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        채팅 메시지 조회
        
        Args:
            session_id: 세션 ID
            user_id: 사용자 ID (옵션, 권한 확인용)
        
        Returns:
            메시지 리스트 (sequence_number 순서대로 정렬)
        """
        self._ensure_initialized()
        
        try:
            query = (
                self.sb.table("legal_chat_messages")
                .select("*")
                .eq("session_id", session_id)
                .order("sequence_number", desc=False)
            )
            
            if user_id:
                query = query.eq("user_id", user_id)
            
            result = query.execute()
            
            messages = []
            if result.data:
                for msg in result.data:
                    messages.append({
                        "id": msg["id"],
                        "session_id": msg["session_id"],
                        "user_id": msg.get("user_id"),
                        "message": msg["message"],
                        "sender_type": msg["sender_type"],
                        "sequence_number": msg["sequence_number"],
                        "context_type": msg.get("context_type", "none"),
                        "context_id": msg.get("context_id"),
                        "metadata": msg.get("metadata"),
                        "created_at": msg.get("created_at"),
                    })
            
            return messages
        except Exception as e:
            logger.error(f"채팅 메시지 조회 중 오류: {str(e)}", exc_info=True)
            raise
    
    async def get_user_chat_sessions(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        사용자의 채팅 세션 목록 조회
        
        Args:
            user_id: 사용자 ID
            limit: 조회할 최대 개수
            offset: 오프셋
        
        Returns:
            세션 리스트 (created_at 내림차순 정렬)
        """
        self._ensure_initialized()
        
        try:
            result = (
                self.sb.table("legal_chat_sessions")
                .select("*")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(limit)
                .offset(offset)
                .execute()
            )
            
            sessions = []
            if result.data:
                for session in result.data:
                    sessions.append({
                        "id": session["id"],
                        "user_id": session.get("user_id"),
                        "initial_context_type": session.get("initial_context_type", "none"),
                        "initial_context_id": session.get("initial_context_id"),
                        "title": session.get("title"),
                        "created_at": session.get("created_at"),
                        "updated_at": session.get("updated_at"),
                    })
            
            return sessions
        except Exception as e:
            logger.error(f"채팅 세션 목록 조회 중 오류: {str(e)}", exc_info=True)
            raise

