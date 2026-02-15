"""
UI 데이터 통합 테스트 스크립트
각 페이지(상황분석/즉시상담/계약서분석)에서 UI에 필요한 데이터가 제대로 출력되는지 검증
"""

import asyncio
import json
import sys
import re
import time
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.legal_rag_service import LegalRAGService
from core.situation_workflow import SituationWorkflow
from core.document_processor_v2 import DocumentProcessor
from config import settings


class UIDataIntegrationTester:
    """UI 데이터 통합 테스트 클래스"""
    
    def __init__(self):
        self.legal_service = LegalRAGService(embedding_cache_size=100)
        self.processor = DocumentProcessor()
        self.results = {
            "timestamp": datetime.now().isoformat(),
            "tests": {}
        }
    
    def print_header(self, title: str):
        """헤더 출력"""
        print("\n" + "=" * 70)
        print(f"  {title}")
        print("=" * 70)
    
    def validate_field(self, data: Any, field_path: str, required: bool = True, field_type: type = None) -> tuple[bool, str]:
        """
        필드 검증
        
        Returns:
            (is_valid, error_message)
        """
        try:
            # 중첩된 필드 경로 처리 (예: "analysis.summary")
            current = data
            for part in field_path.split('.'):
                if isinstance(current, dict):
                    if part not in current:
                        if required:
                            return False, f"필수 필드 누락: {field_path}"
                        return True, ""  # 선택 필드는 없어도 OK
                    current = current[part]
                elif isinstance(current, list):
                    try:
                        idx = int(part)
                        if idx >= len(current):
                            if required:
                                return False, f"필수 필드 누락: {field_path} (인덱스 {idx} 범위 초과)"
                            return True, ""
                        current = current[idx]
                    except (ValueError, IndexError):
                        if required:
                            return False, f"필수 필드 누락: {field_path} (리스트 인덱스 오류)"
                        return True, ""
                else:
                    if required:
                        return False, f"필수 필드 누락: {field_path} (경로 중간에 None/다른 타입)"
                    return True, ""
            
            # 타입 검증
            if field_type and not isinstance(current, field_type):
                return False, f"타입 불일치: {field_path} (예상: {field_type.__name__}, 실제: {type(current).__name__})"
            
            # 빈 값 검증 (문자열, 리스트, 딕셔너리)
            if required:
                if current is None:
                    return False, f"필수 필드가 None: {field_path}"
                if isinstance(current, str) and not current.strip():
                    return False, f"필수 필드가 빈 문자열: {field_path}"
                if isinstance(current, list) and len(current) == 0:
                    return False, f"필수 필드가 빈 리스트: {field_path}"
                if isinstance(current, dict) and len(current) == 0:
                    return False, f"필수 필드가 빈 딕셔너리: {field_path}"
            
            return True, ""
        except Exception as e:
            return False, f"검증 중 오류: {field_path} - {str(e)}"
    
    async def test_contract_analysis_ui_data(self) -> Dict[str, Any]:
        """계약서 분석 페이지 UI 데이터 검증"""
        self.print_header("1. 계약서 분석 페이지 UI 데이터 검증")
        
        start_time = time.time()
        
        # 테스트용 계약서 텍스트 생성
        test_contract_text = """
        제1조(대금)
        갑은 을에게 작업 완료 후 대금을 지급한다.
        
        제2조(작업 기간)
        을은 2024년 1월 1일부터 2024년 12월 31일까지 작업을 수행한다.
        
        제3조(지적재산권)
        본 계약에 따른 모든 지적재산권은 갑에게 귀속된다.
        
        제4조(검수)
        갑은 을의 작업물을 검수한 후 승인한다.
        
        제5조(손해배상)
        을은 계약 위반 시 모든 손해를 배상한다.
        """
        
        test_result = {
            "passed": True,
            "errors": [],
            "warnings": [],
            "fields_checked": []
        }
        
        try:
            # 계약서 분석 실행
            print("   계약서 분석 실행 중...")
            
            # 청킹 (clauses 생성용) - analyze_contract 호출 전에 미리 생성
            chunks = self.processor.to_contract_chunks(test_contract_text)
            
            # clauses 생성 (analyze_contract에 전달)
            clauses = []
            for idx, chunk in enumerate(chunks[:10], 1):
                article_num = chunk.metadata.get("article_number", idx)
                clauses.append({
                    "id": f"clause-{idx}",
                    "title": f"제{article_num}조",
                    "content": chunk.content[:400]
                })
            
            print(f"   생성된 clauses: {len(clauses)}개")
            
            # RAG 검색을 먼저 수행하여 retrievedContexts 생성
            query = self.legal_service._build_query_from_contract(test_contract_text, None)
            legal_chunks = await self.legal_service._search_legal_chunks(query=query, top_k=8)
            
            # retrievedContexts 생성
            retrieved_contexts = [
                {
                    "title": chunk.title,
                    "snippet": chunk.snippet,
                    "sourceType": chunk.source_type,
                }
                for chunk in legal_chunks[:5]
            ]
            
            # analyze_contract 메서드 직접 사용 (clauses 포함)
            result_obj = await self.legal_service.analyze_contract(
                extracted_text=test_contract_text,
                description=None,
                doc_id=None,
                clauses=clauses,  # clauses 전달
                contract_type="freelancer",
                user_role="worker",
                field="it_dev",
            )
            
            # API 응답 형식으로 변환
            result = {
                "docId": "test-doc-id",
                "title": "테스트 계약서",
                "riskScore": result_obj.risk_score,
                "riskLevel": result_obj.risk_level,
                "summary": result_obj.summary,
                "issues": [
                    {
                        "id": getattr(issue, 'id', f"issue-{idx}"),
                        "name": issue.name,
                        "description": issue.description,
                        "severity": issue.severity,
                        "category": getattr(issue, 'category', None),
                        "summary": getattr(issue, 'summary', None),
                        "clause_id": getattr(issue, 'clause_id', None),
                        "originalText": getattr(issue, 'original_text', ""),
                        "legalBasis": issue.legal_basis,
                        "explanation": getattr(issue, 'rationale', ""),
                        "suggestedRevision": getattr(issue, 'suggested_text', ""),
                    }
                    for idx, issue in enumerate(result_obj.issues)
                ],
                "sections": {},  # sections는 별도 계산 필요 (카테고리별 위험도)
                "retrievedContexts": retrieved_contexts,  # RAG 검색 결과 포함
                "contractText": test_contract_text,
                "clauses": clauses,
                "createdAt": datetime.now().isoformat() + "Z",
            }
            
            # sections 계산 (카테고리별 위험도)
            sections = {}
            for issue in result_obj.issues:
                category = getattr(issue, 'category', 'other')
                if category not in sections:
                    sections[category] = 0
                # severity에 따라 점수 계산
                severity_score = {"high": 80, "medium": 50, "low": 20}.get(issue.severity, 50)
                sections[category] = max(sections[category], severity_score)
            result["sections"] = sections
            
            # 필수 필드 검증 (스키마에 맞게 수정)
            required_fields = [
                ("docId", str, True),
                ("title", str, True),
                ("riskScore", (int, float), True),
                ("riskLevel", str, True),
                ("summary", str, True),
                ("issues", list, True),
                ("sections", dict, True),  # sections는 dict 타입 (카테고리별 위험도)
                ("retrievedContexts", list, False),  # API 레벨에서 생성되므로 테스트에서는 선택 필드로 처리
                ("contractText", str, True),
                ("clauses", list, True),
                ("createdAt", str, True),
            ]
            
            # 선택 필드 (UI에서 사용할 수 있음)
            optional_fields = [
                ("oneLineSummary", str, False),
                ("riskTrafficLight", str, False),
                ("top3ActionPoints", list, False),
                ("riskSummaryTable", list, False),
                ("toxicClauses", list, False),
                ("negotiationQuestions", list, False),
                ("highlightedTexts", list, False),
            ]
            
            # 필수 필드 검증
            print("\n   필수 필드 검증:")
            for field_name, field_type, required in required_fields:
                is_valid, error = self.validate_field(result, field_name, required, field_type)
                test_result["fields_checked"].append({
                    "field": field_name,
                    "required": required,
                    "valid": is_valid,
                    "error": error
                })
                if is_valid:
                    print(f"      ✅ {field_name}: OK")
                else:
                    print(f"      ❌ {field_name}: {error}")
                    test_result["errors"].append(f"{field_name}: {error}")
                    test_result["passed"] = False
            
            # 선택 필드 검증
            print("\n   선택 필드 검증:")
            for field_name, field_type, required in optional_fields:
                is_valid, error = self.validate_field(result, field_name, required, field_type)
                test_result["fields_checked"].append({
                    "field": field_name,
                    "required": required,
                    "valid": is_valid,
                    "error": error
                })
                if is_valid:
                    print(f"      ✅ {field_name}: OK")
                else:
                    print(f"      ⚠️ {field_name}: {error}")
                    test_result["warnings"].append(f"{field_name}: {error}")
            
            # issues 배열 내부 구조 검증
            if isinstance(result.get("issues"), list) and len(result["issues"]) > 0:
                print("\n   issues 배열 내부 구조 검증:")
                first_issue = result["issues"][0]
                issue_fields = [
                    ("name", str, True),
                    ("description", str, True),
                    ("severity", str, True),
                    ("category", str, False),
                    ("summary", str, False),
                    ("clause_id", str, False),
                ]
                for field_name, field_type, required in issue_fields:
                    is_valid, error = self.validate_field(first_issue, field_name, required, field_type)
                    if is_valid:
                        print(f"      ✅ issues[0].{field_name}: OK")
                    else:
                        print(f"      {'❌' if required else '⚠️'} issues[0].{field_name}: {error}")
            
            # sections 배열 내부 구조 검증
            if isinstance(result.get("sections"), list) and len(result["sections"]) > 0:
                print("\n   sections 배열 내부 구조 검증:")
                first_section = result["sections"][0]
                section_fields = [
                    ("title", str, True),
                    ("issues", list, True),
                ]
                for field_name, field_type, required in section_fields:
                    is_valid, error = self.validate_field(first_section, field_name, required, field_type)
                    if is_valid:
                        print(f"      ✅ sections[0].{field_name}: OK")
                    else:
                        print(f"      {'❌' if required else '⚠️'} sections[0].{field_name}: {error}")
            
        except Exception as e:
            print(f"   ❌ 테스트 실패: {str(e)}")
            import traceback
            traceback.print_exc()
            test_result["passed"] = False
            test_result["errors"].append(f"테스트 실행 중 오류: {str(e)}")
        
        return test_result
    
    async def test_situation_analysis_ui_data(self) -> Dict[str, Any]:
        """상황분석 페이지 UI 데이터 검증"""
        self.print_header("2. 상황분석 페이지 UI 데이터 검증")
        
        start_time = time.time()
        
        test_result = {
            "passed": True,
            "errors": [],
            "warnings": [],
            "fields_checked": []
        }
        
        try:
            # 상황분석 실행
            print("   상황분석 실행 중...")
            result = await self.legal_service.analyze_situation_detailed(
                category_hint="unpaid_wage",
                situation_text="3개월째 월급이 늦게 들어와요. 매번 다음 달 중순에 들어오는데, 이번 달은 아직도 안 들어왔어요.",
                employment_type="regular",
                work_period="1_3_years",
                weekly_hours=40,
                is_probation=False,
                social_insurance="all",
                use_workflow=True,
            )
            
            # 필수 필드 검증
            required_fields = [
                ("risk_score", (int, float), True),
                ("summary", str, True),
                ("criteria", list, True),
                ("action_plan", (dict, list), True),
                ("scripts", dict, True),
            ]
            
            # 선택 필드
            optional_fields = [
                ("classified_type", str, False),
                ("organizations", list, False),
                ("related_cases", list, False),
            ]
            
            # 필수 필드 검증
            print("\n   필수 필드 검증:")
            for field_name, field_type, required in required_fields:
                is_valid, error = self.validate_field(result, field_name, required, field_type)
                test_result["fields_checked"].append({
                    "field": field_name,
                    "required": required,
                    "valid": is_valid,
                    "error": error
                })
                if is_valid:
                    print(f"      ✅ {field_name}: OK")
                else:
                    print(f"      ❌ {field_name}: {error}")
                    test_result["errors"].append(f"{field_name}: {error}")
                    test_result["passed"] = False
            
            # 선택 필드 검증
            print("\n   선택 필드 검증:")
            for field_name, field_type, required in optional_fields:
                is_valid, error = self.validate_field(result, field_name, required, field_type)
                test_result["fields_checked"].append({
                    "field": field_name,
                    "required": required,
                    "valid": is_valid,
                    "error": error
                })
                if is_valid:
                    print(f"      ✅ {field_name}: OK")
                else:
                    print(f"      ⚠️ {field_name}: {error}")
                    test_result["warnings"].append(f"{field_name}: {error}")
            
            # criteria 배열 내부 구조 검증
            if isinstance(result.get("criteria"), list) and len(result["criteria"]) > 0:
                print("\n   criteria 배열 내부 구조 검증:")
                first_criteria = result["criteria"][0]
                criteria_fields = [
                    ("name", str, True),
                    ("status", str, True),
                    ("reason", str, True),
                ]
                for field_name, field_type, required in criteria_fields:
                    is_valid, error = self.validate_field(first_criteria, field_name, required, field_type)
                    if is_valid:
                        print(f"      ✅ criteria[0].{field_name}: OK")
                    else:
                        print(f"      {'❌' if required else '⚠️'} criteria[0].{field_name}: {error}")
            
            # action_plan 구조 검증
            action_plan = result.get("action_plan", {})
            if isinstance(action_plan, dict):
                print("\n   action_plan 구조 검증:")
                if "steps" in action_plan:
                    steps = action_plan["steps"]
                    if isinstance(steps, list) and len(steps) > 0:
                        first_step = steps[0]
                        step_fields = [
                            ("title", str, True),
                            ("items", list, True),
                        ]
                        for field_name, field_type, required in step_fields:
                            is_valid, error = self.validate_field(first_step, field_name, required, field_type)
                            if is_valid:
                                print(f"      ✅ action_plan.steps[0].{field_name}: OK")
                            else:
                                print(f"      {'❌' if required else '⚠️'} action_plan.steps[0].{field_name}: {error}")
            
            # scripts 구조 검증
            scripts = result.get("scripts", {})
            if isinstance(scripts, dict):
                print("\n   scripts 구조 검증:")
                script_fields = [
                    ("to_company", str, False),
                    ("to_advisor", str, False),
                ]
                for field_name, field_type, required in script_fields:
                    is_valid, error = self.validate_field(scripts, field_name, required, field_type)
                    if is_valid:
                        print(f"      ✅ scripts.{field_name}: OK")
                    else:
                        print(f"      {'❌' if required else '⚠️'} scripts.{field_name}: {error}")
            
        except Exception as e:
            print(f"   ❌ 테스트 실패: {str(e)}")
            import traceback
            traceback.print_exc()
            test_result["passed"] = False
            test_result["errors"].append(f"테스트 실행 중 오류: {str(e)}")
        
        elapsed_time = time.time() - start_time
        test_result["elapsed_time"] = elapsed_time
        print(f"\n   ⏱️ 소요 시간: {elapsed_time:.3f}초")
        
        return test_result
    
    async def test_quick_consult_ui_data(self) -> Dict[str, Any]:
        """즉시상담(채팅) 페이지 UI 데이터 검증 - 3가지 케이스"""
        self.print_header("3. 즉시상담(채팅) 페이지 UI 데이터 검증")
        
        start_time = time.time()
        
        test_result = {
            "passed": True,
            "errors": [],
            "warnings": [],
            "fields_checked": [],
            "test_cases": {}
        }
        
        # 테스트 케이스 1: 일반 채팅 (none)
        print("\n   테스트 케이스 1/3: 일반 채팅 (none)")
        try:
            result = await self.legal_service.chat_with_context(
                query="임금 지급 시기는 언제인가요?",
                doc_ids=[],
                top_k=5,
                context_type="none",
                context_data=None,
            )
            
            case_result = self._validate_chat_response(result, "none")
            test_result["test_cases"]["none"] = case_result
            if not case_result["passed"]:
                test_result["passed"] = False
                test_result["errors"].extend(case_result["errors"])
        except Exception as e:
            print(f"      ❌ 실패: {str(e)}")
            test_result["test_cases"]["none"] = {"passed": False, "errors": [str(e)]}
            test_result["passed"] = False
        
        # 테스트 케이스 2: 계약서 리포트 컨텍스트 (contract)
        print("\n   테스트 케이스 2/3: 계약서 리포트 컨텍스트 (contract)")
        try:
            # 먼저 계약서 분석 실행하여 컨텍스트 데이터 생성
            test_contract_text = """
            제1조(대금)
            갑은 을에게 작업 완료 후 대금을 지급한다.
            """
            chunks = self.processor.to_contract_chunks(test_contract_text)
            clauses = []
            for idx, chunk in enumerate(chunks[:3], 1):
                article_num = chunk.metadata.get("article_number", idx)
                clauses.append({
                    "id": f"clause-{idx}",
                    "title": f"제{article_num}조",
                    "content": chunk.content[:400]
                })
            
            contract_result = await self.legal_service.analyze_contract(
                extracted_text=test_contract_text,
                clauses=clauses,
                contract_type="freelancer",
                user_role="worker",
            )
            
            # 계약서 분석 결과를 컨텍스트로 사용
            context_data = {
                "summary": contract_result.summary,
                "risk_score": contract_result.risk_score,
                "risk_level": contract_result.risk_level,
                "issues": [
                    {
                        "id": getattr(issue, 'id', f"issue-{idx}"),
                        "name": issue.name,
                        "category": getattr(issue, 'category', None),
                    }
                    for idx, issue in enumerate(contract_result.issues[:3])
                ]
            }
            
            result = await self.legal_service.chat_with_context(
                query="이 계약서에서 가장 위험한 조항은 무엇인가요?",
                doc_ids=[],
                top_k=5,
                context_type="contract",
                context_data=context_data,
            )
            
            case_result = self._validate_chat_response(result, "contract")
            test_result["test_cases"]["contract"] = case_result
            if not case_result["passed"]:
                test_result["passed"] = False
                test_result["errors"].extend(case_result["errors"])
        except Exception as e:
            print(f"      ❌ 실패: {str(e)}")
            import traceback
            traceback.print_exc()
            test_result["test_cases"]["contract"] = {"passed": False, "errors": [str(e)]}
            test_result["passed"] = False
        
        # 테스트 케이스 3: 상황분석 리포트 컨텍스트 (situation)
        print("\n   테스트 케이스 3/3: 상황분석 리포트 컨텍스트 (situation)")
        try:
            # 먼저 상황분석 실행하여 컨텍스트 데이터 생성
            situation_result = await self.legal_service.analyze_situation_detailed(
                category_hint="unpaid_wage",
                situation_text="3개월째 월급이 늦게 들어와요.",
                employment_type="regular",
                use_workflow=True,
            )
            
            # 상황분석 결과를 컨텍스트로 사용
            context_data = {
                "summary": situation_result.get("summary", ""),
                "risk_score": situation_result.get("risk_score", 0),
                "criteria": situation_result.get("criteria", [])[:3],
                "action_plan": situation_result.get("action_plan", {}),
            }
            
            result = await self.legal_service.chat_with_context(
                query="이 상황에서 제가 할 수 있는 조치는 무엇인가요?",
                doc_ids=[],
                top_k=5,
                context_type="situation",
                context_data=context_data,
            )
            
            case_result = self._validate_chat_response(result, "situation")
            test_result["test_cases"]["situation"] = case_result
            if not case_result["passed"]:
                test_result["passed"] = False
                test_result["errors"].extend(case_result["errors"])
        except Exception as e:
            print(f"      ❌ 실패: {str(e)}")
            import traceback
            traceback.print_exc()
            test_result["test_cases"]["situation"] = {"passed": False, "errors": [str(e)]}
            test_result["passed"] = False
        
        elapsed_time = time.time() - start_time
        test_result["elapsed_time"] = elapsed_time
        print(f"\n   ⏱️ 소요 시간: {elapsed_time:.3f}초")
        
        return test_result
    
    def _validate_chat_response(self, result: Dict[str, Any], context_type: str) -> Dict[str, Any]:
        """채팅 응답 검증 헬퍼 메서드"""
        case_result = {
            "passed": True,
            "errors": [],
            "warnings": [],
            "fields_checked": []
        }
        
        # 필수 필드 검증
        required_fields = [
            ("answer", str, True),
            ("query", str, True),
        ]
        
        # 선택 필드
        optional_fields = [
            ("markdown", str, False),
            ("used_chunks", dict, False),
        ]
        
        # 필수 필드 검증
        print(f"      필수 필드 검증 ({context_type}):")
        for field_name, field_type, required in required_fields:
            is_valid, error = self.validate_field(result, field_name, required, field_type)
            case_result["fields_checked"].append({
                "field": field_name,
                "required": required,
                "valid": is_valid,
                "error": error
            })
            if is_valid:
                print(f"         ✅ {field_name}: OK")
            else:
                print(f"         ❌ {field_name}: {error}")
                case_result["errors"].append(f"{field_name}: {error}")
                case_result["passed"] = False
        
        # 선택 필드 검증
        print(f"      선택 필드 검증 ({context_type}):")
        for field_name, field_type, required in optional_fields:
            is_valid, error = self.validate_field(result, field_name, required, field_type)
            case_result["fields_checked"].append({
                "field": field_name,
                "required": required,
                "valid": is_valid,
                "error": error
            })
            if is_valid:
                print(f"         ✅ {field_name}: OK")
            else:
                print(f"         ⚠️ {field_name}: {error}")
                case_result["warnings"].append(f"{field_name}: {error}")
        
        # used_chunks 구조 검증
        used_chunks = result.get("used_chunks", {})
        if isinstance(used_chunks, dict):
            print(f"      used_chunks 구조 검증 ({context_type}):")
            chunk_types = ["contract", "legal"]
            for chunk_type in chunk_types:
                if chunk_type in used_chunks:
                    chunks = used_chunks[chunk_type]
                    if isinstance(chunks, list) and len(chunks) > 0:
                        first_chunk = chunks[0]
                        chunk_fields = [
                            ("id", str, True),
                            ("title", str, True),
                            ("content", str, True),
                        ]
                        for field_name, field_type, required in chunk_fields:
                            is_valid, error = self.validate_field(first_chunk, field_name, required, field_type)
                            if is_valid:
                                print(f"         ✅ used_chunks.{chunk_type}[0].{field_name}: OK")
                            else:
                                print(f"         {'❌' if required else '⚠️'} used_chunks.{chunk_type}[0].{field_name}: {error}")
        
        return case_result
    
    async def test_chat_message_json_format(self) -> Dict[str, Any]:
        """채팅 메시지 JSON 형식 검증 - LLM 응답이 UI에서 파싱 가능한 형식인지 확인"""
        self.print_header("4. 채팅 메시지 JSON 형식 검증")
        
        start_time = time.time()
        
        test_result = {
            "passed": True,
            "errors": [],
            "warnings": [],
            "test_cases": {}
        }
        
        # 테스트 케이스 1: 일반 채팅 (none) - ContractRiskResult 형식
        print("\n   테스트 케이스 1/3: 일반 채팅 JSON 형식 (ContractRiskResult)")
        try:
            result = await self.legal_service.chat_with_context(
                query="임금 지급 시기는 언제인가요?",
                doc_ids=[],
                top_k=5,
                context_type="none",
                context_data=None,
            )
            
            answer = result.get("answer", "")
            json_valid, json_errors, json_warnings = self._validate_contract_risk_json(answer)
            test_result["test_cases"]["none"] = {
                "passed": json_valid,
                "errors": json_errors,
                "warnings": json_warnings,
                "answer_preview": answer[:200] if answer else ""
            }
            if not json_valid:
                test_result["passed"] = False
                test_result["errors"].extend(json_errors)
                print(f"      ❌ JSON 파싱 실패: {json_errors}")
            else:
                if json_warnings:
                    print(f"      ✅ JSON 형식 검증 통과 (경고: {', '.join(json_warnings)})")
                else:
                    print(f"      ✅ JSON 형식 검증 통과")
        except Exception as e:
            print(f"      ❌ 테스트 실패: {str(e)}")
            test_result["test_cases"]["none"] = {"passed": False, "errors": [str(e)]}
            test_result["passed"] = False
        
        # 테스트 케이스 2: 계약서 리포트 컨텍스트 (contract) - ContractRiskResult 형식
        print("\n   테스트 케이스 2/3: 계약서 컨텍스트 JSON 형식 (ContractRiskResult)")
        try:
            test_contract_text = """
            제1조(대금)
            갑은 을에게 작업 완료 후 대금을 지급한다.
            """
            chunks = self.processor.to_contract_chunks(test_contract_text)
            clauses = []
            for idx, chunk in enumerate(chunks[:3], 1):
                article_num = chunk.metadata.get("article_number", idx)
                clauses.append({
                    "id": f"clause-{idx}",
                    "title": f"제{article_num}조",
                    "content": chunk.content[:400]
                })
            
            contract_result = await self.legal_service.analyze_contract(
                extracted_text=test_contract_text,
                clauses=clauses,
                contract_type="freelancer",
                user_role="worker",
            )
            
            context_data = {
                "summary": contract_result.summary,
                "risk_score": contract_result.risk_score,
                "risk_level": contract_result.risk_level,
                "issues": [
                    {
                        "id": getattr(issue, 'id', f"issue-{idx}"),
                        "name": issue.name,
                        "category": getattr(issue, 'category', None),
                    }
                    for idx, issue in enumerate(contract_result.issues[:3])
                ]
            }
            
            result = await self.legal_service.chat_with_context(
                query="이 계약서에서 가장 위험한 조항은 무엇인가요?",
                doc_ids=[],
                top_k=5,
                context_type="contract",
                context_data=context_data,
            )
            
            answer = result.get("answer", "")
            json_valid, json_errors, json_warnings = self._validate_contract_risk_json(answer)
            test_result["test_cases"]["contract"] = {
                "passed": json_valid,
                "errors": json_errors,
                "warnings": json_warnings,
                "answer_preview": answer[:200] if answer else ""
            }
            if not json_valid:
                test_result["passed"] = False
                test_result["errors"].extend(json_errors)
                print(f"      ❌ JSON 파싱 실패: {json_errors}")
            else:
                if json_warnings:
                    print(f"      ✅ JSON 형식 검증 통과 (경고: {', '.join(json_warnings)})")
                else:
                    print(f"      ✅ JSON 형식 검증 통과")
        except Exception as e:
            print(f"      ❌ 테스트 실패: {str(e)}")
            test_result["test_cases"]["contract"] = {"passed": False, "errors": [str(e)]}
            test_result["passed"] = False
        
        # 테스트 케이스 3: 상황분석 리포트 컨텍스트 (situation) - SituationAnalysisMessagePayload 형식
        print("\n   테스트 케이스 3/3: 상황분석 컨텍스트 JSON 형식 (SituationAnalysisMessagePayload)")
        try:
            situation_result = await self.legal_service.analyze_situation_detailed(
                category_hint="unpaid_wage",
                situation_text="3개월째 월급이 늦게 들어와요.",
                employment_type="regular",
                use_workflow=True,
            )
            
            context_data = {
                "summary": situation_result.get("summary", ""),
                "risk_score": situation_result.get("risk_score", 0),
                "criteria": situation_result.get("criteria", [])[:3],
                "action_plan": situation_result.get("action_plan", {}),
            }
            
            result = await self.legal_service.chat_with_context(
                query="이 상황에서 제가 할 수 있는 조치는 무엇인가요?",
                doc_ids=[],
                top_k=5,
                context_type="situation",
                context_data=context_data,
            )
            
            answer = result.get("answer", "")
            json_valid, json_errors = self._validate_situation_analysis_json(answer)
            test_result["test_cases"]["situation"] = {
                "passed": json_valid,
                "errors": json_errors,
                "answer_preview": answer[:200] if answer else ""
            }
            if not json_valid:
                test_result["passed"] = False
                test_result["errors"].extend(json_errors)
                print(f"      ❌ JSON 파싱 실패: {json_errors}")
            else:
                print(f"      ✅ JSON 형식 검증 통과")
        except Exception as e:
            print(f"      ❌ 테스트 실패: {str(e)}")
            test_result["test_cases"]["situation"] = {"passed": False, "errors": [str(e)]}
            test_result["passed"] = False
        
        elapsed_time = time.time() - start_time
        test_result["elapsed_time"] = elapsed_time
        print(f"\n   ⏱️ 소요 시간: {elapsed_time:.3f}초")
        
        return test_result
    
    def _validate_contract_risk_json(self, answer: str) -> tuple[bool, List[str], List[str]]:
        """ContractRiskResult JSON 형식 검증 - 구조와 값 모두 체크
        
        Returns:
            (is_valid, errors, warnings): 검증 통과 여부, 에러 리스트, 경고 리스트
        """
        errors = []
        warnings = []
        
        try:
            # 프론트엔드와 동일한 파싱 로직 적용
            json_part = answer
            
            # ```json 코드 블록 제거
            json_part = re.sub(r'```json\s*', '', json_part)
            json_part = re.sub(r'```\s*', '', json_part)
            json_part = json_part.strip()
            
            # JSON 객체 시작/끝 찾기
            first_brace = json_part.find('{')
            last_brace = json_part.rfind('}')
            if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                json_part = json_part[first_brace:last_brace + 1]
            
            # JSON 파싱
            parsed = json.loads(json_part)
            
            # 필수 필드 검증
            if not isinstance(parsed, dict):
                errors.append("JSON이 객체가 아닙니다")
                return False, errors, []
            
            # summary 필드 검증 (필수, 빈 값 체크)
            if "summary" not in parsed:
                errors.append("summary 필드가 없습니다")
            elif not isinstance(parsed["summary"], str):
                errors.append("summary 필드가 문자열이 아닙니다")
            elif not parsed["summary"].strip():
                errors.append("summary 필드가 비어있습니다")
            elif len(parsed["summary"].strip()) < 10:
                warnings.append(f"summary가 너무 짧습니다 ({len(parsed['summary'])}자)")
            
            # riskLevel 검증 ("중간"도 허용 - LLM이 가끔 사용)
            valid_risk_levels = ["경미", "보통", "높음", "매우 높음", "중간", None]
            if "riskLevel" in parsed:
                if parsed["riskLevel"] not in valid_risk_levels:
                    errors.append(f"riskLevel이 유효하지 않습니다: {parsed.get('riskLevel')} (유효값: {valid_risk_levels})")
                elif parsed["riskLevel"] == "중간":
                    warnings.append("riskLevel이 '중간'입니다. '보통'을 사용하는 것을 권장합니다.")
            
            # riskLevelDescription 검증
            if "riskLevelDescription" in parsed:
                if not isinstance(parsed["riskLevelDescription"], str):
                    errors.append("riskLevelDescription이 문자열이 아닙니다")
                elif not parsed["riskLevelDescription"].strip():
                    warnings.append("riskLevelDescription이 비어있습니다")
            
            # riskContent 검증 (값 체크 강화)
            if "riskContent" in parsed:
                if not isinstance(parsed["riskContent"], list):
                    errors.append("riskContent가 배열이 아닙니다")
                elif len(parsed["riskContent"]) == 0:
                    warnings.append("riskContent 배열이 비어있습니다")
                else:
                    for idx, item in enumerate(parsed["riskContent"]):
                        if isinstance(item, dict):
                            if "내용" not in item:
                                errors.append(f"riskContent[{idx}]에 '내용' 필드가 없습니다")
                            elif not item["내용"] or not item["내용"].strip():
                                errors.append(f"riskContent[{idx}].내용이 비어있습니다")
                            
                            if "설명" not in item:
                                errors.append(f"riskContent[{idx}]에 '설명' 필드가 없습니다")
                            elif not item["설명"] or not item["설명"].strip():
                                errors.append(f"riskContent[{idx}].설명이 비어있습니다")
                        elif isinstance(item, str):
                            if not item.strip():
                                errors.append(f"riskContent[{idx}] 문자열이 비어있습니다")
            
            # checklist 검증 (값 체크 강화)
            if "checklist" in parsed:
                if not isinstance(parsed["checklist"], list):
                    errors.append("checklist가 배열이 아닙니다")
                elif len(parsed["checklist"]) == 0:
                    warnings.append("checklist 배열이 비어있습니다")
                else:
                    for idx, item in enumerate(parsed["checklist"]):
                        if isinstance(item, dict):
                            if "항목" not in item:
                                errors.append(f"checklist[{idx}]에 '항목' 필드가 없습니다")
                            elif not item["항목"] or not item["항목"].strip():
                                errors.append(f"checklist[{idx}].항목이 비어있습니다")
                            
                            if "결론" not in item:
                                errors.append(f"checklist[{idx}]에 '결론' 필드가 없습니다")
                            elif not item["결론"] or not item["결론"].strip():
                                errors.append(f"checklist[{idx}].결론이 비어있습니다")
                        elif isinstance(item, str):
                            if not item.strip():
                                errors.append(f"checklist[{idx}] 문자열이 비어있습니다")
            
            # negotiationPoints 검증
            if "negotiationPoints" in parsed:
                if not isinstance(parsed["negotiationPoints"], dict):
                    errors.append("negotiationPoints가 객체가 아닙니다")
                else:
                    if "conversationExamples" in parsed["negotiationPoints"]:
                        examples = parsed["negotiationPoints"]["conversationExamples"]
                        if not isinstance(examples, list):
                            errors.append("negotiationPoints.conversationExamples가 배열이 아닙니다")
                        elif len(examples) == 0:
                            warnings.append("negotiationPoints.conversationExamples 배열이 비어있습니다")
                        else:
                            for idx, example in enumerate(examples):
                                if not isinstance(example, str):
                                    errors.append(f"negotiationPoints.conversationExamples[{idx}]가 문자열이 아닙니다")
                                elif not example.strip():
                                    errors.append(f"negotiationPoints.conversationExamples[{idx}]가 비어있습니다")
            
            # legalReferences 검증 (값 체크 강화)
            if "legalReferences" in parsed:
                if not isinstance(parsed["legalReferences"], list):
                    errors.append("legalReferences가 배열이 아닙니다")
                elif len(parsed["legalReferences"]) == 0:
                    warnings.append("legalReferences 배열이 비어있습니다")
                else:
                    for idx, ref in enumerate(parsed["legalReferences"]):
                        if isinstance(ref, dict):
                            if "name" not in ref:
                                errors.append(f"legalReferences[{idx}]에 'name' 필드가 없습니다")
                            elif not ref["name"] or not ref["name"].strip():
                                errors.append(f"legalReferences[{idx}].name이 비어있습니다")
                            
                            if "description" not in ref:
                                errors.append(f"legalReferences[{idx}]에 'description' 필드가 없습니다")
                            elif not ref["description"] or not ref["description"].strip():
                                errors.append(f"legalReferences[{idx}].description이 비어있습니다")
            
            # 경고도 에러로 취급할지 결정 (현재는 경고만)
            if warnings:
                errors.extend([f"[경고] {w}" for w in warnings])
            
            return len(errors) == 0, errors
            
        except json.JSONDecodeError as e:
            errors.append(f"JSON 파싱 실패: {str(e)}")
            return False, errors
        except Exception as e:
            errors.append(f"검증 중 오류: {str(e)}")
            return False, errors
    
    def _validate_situation_analysis_json(self, answer: str) -> tuple[bool, List[str]]:
        """SituationAnalysisMessagePayload JSON 형식 검증 - 구조와 값 모두 체크"""
        errors = []
        warnings = []
        
        try:
            # 프론트엔드와 동일한 파싱 로직 적용
            text = answer.strip()
            
            # ```json 코드 블록 제거
            if text.startswith('```'):
                first_newline = text.find('\n')
                if first_newline != -1:
                    text = text[first_newline + 1:]
                if text.endswith('```'):
                    text = text[:-3]
                text = text.strip()
            
            # --- 구분선 제거
            separator_index = text.find('---')
            if separator_index != -1:
                text = text[:separator_index].strip()
            
            # ⚠️ 뒤에 붙는 안내 문구 제거
            warning_index = text.find('⚠️')
            if warning_index != -1:
                text = text[:warning_index].strip()
            
            # JSON 객체 시작/끝 찾기 (중괄호 매칭)
            first_brace = text.find('{')
            if first_brace != -1:
                brace_count = 0
                last_brace = -1
                for i in range(first_brace, len(text)):
                    if text[i] == '{':
                        brace_count += 1
                    elif text[i] == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            last_brace = i
                            break
                if last_brace != -1:
                    text = text[first_brace:last_brace + 1]
            
            # JSON 파싱 (comma delimiter 오류 등 처리)
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError as e:
                # comma delimiter 오류 등 JSON 문법 오류 수정 시도
                if "Expecting ',' delimiter" in str(e) or "Expecting property name" in str(e):
                    # 마지막 완전한 중괄호까지 찾기
                    brace_count = 0
                    last_valid_pos = -1
                    for i, char in enumerate(text):
                        if char == '{':
                            brace_count += 1
                        elif char == '}':
                            brace_count -= 1
                            if brace_count == 0:
                                last_valid_pos = i + 1
                                break
                    
                    if last_valid_pos > 0:
                        text = text[:last_valid_pos]
                        try:
                            parsed = json.loads(text)
                        except json.JSONDecodeError:
                            errors.append(f"JSON 파싱 실패: {str(e)}")
                            return False, errors
                    else:
                        errors.append(f"JSON 파싱 실패: {str(e)}")
                        return False, errors
                else:
                    errors.append(f"JSON 파싱 실패: {str(e)}")
                    return False, errors
            
            # 필수 필드 검증
            if not isinstance(parsed, dict):
                errors.append("JSON이 객체가 아닙니다")
                return False, errors, []
            
            # reportTitle 검증 (필수, 빈 값 체크)
            if "reportTitle" not in parsed:
                errors.append("reportTitle 필드가 없습니다")
            elif not isinstance(parsed["reportTitle"], str):
                errors.append("reportTitle 필드가 문자열이 아닙니다")
            elif not parsed["reportTitle"].strip():
                errors.append("reportTitle 필드가 비어있습니다")
            elif len(parsed["reportTitle"].strip()) < 5:
                warnings.append(f"reportTitle이 너무 짧습니다 ({len(parsed['reportTitle'])}자)")
            
            # legalPerspective 검증 (필수, 빈 값 체크)
            if "legalPerspective" not in parsed:
                errors.append("legalPerspective 필드가 없습니다")
            elif not isinstance(parsed["legalPerspective"], dict):
                errors.append("legalPerspective 필드가 객체가 아닙니다")
            else:
                if "description" not in parsed["legalPerspective"]:
                    errors.append("legalPerspective.description 필드가 없습니다")
                elif not isinstance(parsed["legalPerspective"]["description"], str):
                    errors.append("legalPerspective.description 필드가 문자열이 아닙니다")
                elif not parsed["legalPerspective"]["description"].strip():
                    errors.append("legalPerspective.description 필드가 비어있습니다")
                elif len(parsed["legalPerspective"]["description"].strip()) < 20:
                    warnings.append(f"legalPerspective.description이 너무 짧습니다 ({len(parsed['legalPerspective']['description'])}자)")
                
                # legalPerspective.references 검증
                if "references" in parsed["legalPerspective"]:
                    refs = parsed["legalPerspective"]["references"]
                    if not isinstance(refs, list):
                        errors.append("legalPerspective.references가 배열이 아닙니다")
                    else:
                        for idx, ref in enumerate(refs):
                            if isinstance(ref, dict):
                                if "name" not in ref or not ref["name"] or not ref["name"].strip():
                                    errors.append(f"legalPerspective.references[{idx}].name이 없거나 비어있습니다")
                                if "description" not in ref or not ref["description"] or not ref["description"].strip():
                                    errors.append(f"legalPerspective.references[{idx}].description이 없거나 비어있습니다")
            
            # actions 검증 (값 체크 강화)
            if "actions" in parsed:
                if not isinstance(parsed["actions"], list):
                    errors.append("actions가 배열이 아닙니다")
                elif len(parsed["actions"]) == 0:
                    warnings.append("actions 배열이 비어있습니다")
                else:
                    for idx, action in enumerate(parsed["actions"]):
                        if isinstance(action, dict):
                            if "key" not in action:
                                errors.append(f"actions[{idx}]에 'key' 필드가 없습니다")
                            elif not action["key"] or not action["key"].strip():
                                errors.append(f"actions[{idx}].key가 비어있습니다")
                            
                            if "description" not in action:
                                errors.append(f"actions[{idx}]에 'description' 필드가 없습니다")
                            elif not action["description"] or not action["description"].strip():
                                errors.append(f"actions[{idx}].description이 비어있습니다")
            
            # conversationExamples 검증 (값 체크 강화)
            if "conversationExamples" in parsed:
                if not isinstance(parsed["conversationExamples"], list):
                    errors.append("conversationExamples가 배열이 아닙니다")
                elif len(parsed["conversationExamples"]) == 0:
                    warnings.append("conversationExamples 배열이 비어있습니다")
                else:
                    for idx, example in enumerate(parsed["conversationExamples"]):
                        if isinstance(example, dict):
                            if "role" not in example:
                                errors.append(f"conversationExamples[{idx}]에 'role' 필드가 없습니다")
                            elif example.get("role") not in ["user", "assistant"]:
                                errors.append(f"conversationExamples[{idx}].role이 유효하지 않습니다: {example.get('role')}")
                            
                            if "content" not in example:
                                errors.append(f"conversationExamples[{idx}]에 'content' 필드가 없습니다")
                            elif not example["content"] or not example["content"].strip():
                                errors.append(f"conversationExamples[{idx}].content가 비어있습니다")
            
            # 경고도 에러로 취급할지 결정 (현재는 경고만)
            if warnings:
                errors.extend([f"[경고] {w}" for w in warnings])
            
            return len(errors) == 0, errors
            
        except json.JSONDecodeError as e:
            errors.append(f"JSON 파싱 실패: {str(e)}")
            return False, errors
        except Exception as e:
            errors.append(f"검증 중 오류: {str(e)}")
            return False, errors
    
    def print_summary(self):
        """전체 결과 요약"""
        self.print_header("테스트 결과 요약")
        
        total_tests = len(self.results["tests"])
        passed_tests = sum(1 for test in self.results["tests"].values() if test.get("passed", False))
        failed_tests = total_tests - passed_tests
        
        print(f"\n   총 테스트: {total_tests}개")
        print(f"   통과: {passed_tests}개")
        print(f"   실패: {failed_tests}개")
        
        if failed_tests > 0:
            print("\n   실패한 테스트:")
            for test_name, test_result in self.results["tests"].items():
                if not test_result.get("passed", False):
                    print(f"      ❌ {test_name}")
                    for error in test_result.get("errors", []):
                        print(f"         - {error}")
        
        # 결과 저장
        result_file = Path(__file__).parent.parent / "data" / "indexed" / "reports" / "ui_integration_test.json"
        result_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(self.results, f, ensure_ascii=False, indent=2)
        
        print(f"\n💾 결과 저장 완료: {result_file}")


async def main():
    """메인 함수"""
    print("🚀 UI 데이터 통합 테스트 시작")
    print(f"   LLM Provider: {settings.llm_provider}")
    print(f"   Embedding Model: {settings.local_embedding_model}")
    
    tester = UIDataIntegrationTester()
    
    try:
        # 1. 계약서 분석 페이지
        contract_result = await tester.test_contract_analysis_ui_data()
        tester.results["tests"]["계약서 분석 페이지"] = contract_result
        
        # 2. 상황분석 페이지
        situation_result = await tester.test_situation_analysis_ui_data()
        tester.results["tests"]["상황분석 페이지"] = situation_result
        
        # 3. 즉시상담 페이지
        chat_result = await tester.test_quick_consult_ui_data()
        tester.results["tests"]["즉시상담 페이지"] = chat_result
        
        # 4. 채팅 메시지 JSON 형식 검증
        json_format_result = await tester.test_chat_message_json_format()
        tester.results["tests"]["채팅 메시지 JSON 형식"] = json_format_result
        
        # 요약
        tester.print_summary()
        
    except KeyboardInterrupt:
        print("\n\n⚠️ 테스트가 중단되었습니다.")
    except Exception as e:
        print(f"\n\n❌ 테스트 중 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())

