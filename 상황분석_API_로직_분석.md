# 상황분석 API 로직 분석 및 절차 확인

## 개요

상황분석 API는 사용자가 입력한 법적 상황을 분석하여 법적 리스크, 판단 기준, 행동 가이드 등을 제공하는 API입니다. LangGraph 기반의 멀티 스텝 워크플로우를 사용하여 정확하고 체계적인 분석을 수행합니다.

## API 엔드포인트

### POST `/api/v2/legal/analyze-situation`

**위치**: `backend/api/routes_legal_v2.py` (1228-1665줄)

**요청 파라미터**:
```typescript
{
  situation: string;              // 상황 설명 텍스트
  category?: string;              // 카테고리 힌트
  employmentType?: string;        // 고용 형태
  companySize?: string;           // 회사 규모
  workPeriod?: string;            // 근무 기간
  hasWrittenContract?: boolean;   // 계약서 보유 여부
  socialInsurance?: string[];     // 사회보험 가입 현황
}
```

**응답 구조**:
```typescript
{
  id: string;                     // DB 저장 후 생성된 ID
  riskScore: number;               // 위험도 점수 (0-100)
  riskLevel: "low" | "medium" | "high";  // 위험도 레벨
  tags: string[];                 // 분류 태그
  summary: string;                 // 마크다운 형식 리포트
  findings: Finding[];            // 법적 쟁점 발견 항목
  relatedCases: RelatedCase[];     // 관련 사례 (문서 단위)
  scripts: ScriptsV2;             // 이메일 템플릿
  organizations: Organization[];   // 추천 기관 목록
}
```

## 전체 처리 흐름

```
1. API 엔드포인트 수신 (routes_legal_v2.py)
   ↓
2. LegalRAGService.analyze_situation_detailed() 호출
   ↓
3. SituationWorkflow.run() 실행 (LangGraph 워크플로우)
   ↓
4. 워크플로우 결과 변환 및 DB 저장
   ↓
5. 최종 응답 반환
```

## 상세 처리 절차

### 1단계: API 엔드포인트 수신 및 검증

**파일**: `backend/api/routes_legal_v2.py` (1228-1255줄)

```1228:1255:backend/api/routes_legal_v2.py
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
```

**처리 내용**:
- 요청 파라미터 검증
- `LegalRAGService` 인스턴스 생성
- `analyze_situation_detailed()` 호출 (워크플로우 활성화)

### 2단계: LegalRAGService.analyze_situation_detailed()

**파일**: `backend/core/legal_rag_service.py` (201-264줄)

```201:264:backend/core/legal_rag_service.py
    async def analyze_situation_detailed(
        self,
        category_hint: str,
        situation_text: str,
        summary: Optional[str] = None,
        details: Optional[str] = None,
        employment_type: Optional[str] = None,
        work_period: Optional[str] = None,
        weekly_hours: Optional[int] = None,
        is_probation: Optional[bool] = None,
        social_insurance: Optional[str] = None,
        use_workflow: bool = False,  # LangGraph 워크플로우 사용 여부
    ) -> dict:
        """
        상황 기반 상세 진단
        
        Args:
            use_workflow: True면 LangGraph 워크플로우 사용, False면 기존 단일 스텝 방식
        
        Returns:
            {
                "classified_type": str,
                "risk_score": int,
                "summary": str,
                "criteria": List[CriteriaItem],
                "action_plan": ActionPlan,
                "scripts": Scripts,
                "related_cases": List[RelatedCase]
            }
        """
        # LangGraph 워크플로우 사용
        if use_workflow:
            try:
                from core.situation_workflow import SituationWorkflow
                workflow = SituationWorkflow()
                initial_state = {
                    "situation_text": situation_text,
                    "category_hint": category_hint,
                    "summary": summary,
                    "details": details,
                    "employment_type": employment_type,
                    "work_period": work_period,
                    "weekly_hours": weekly_hours,
                    "is_probation": is_probation,
                    "social_insurance": social_insurance,
                }
                result = await workflow.run(initial_state)
                logger.info("[상황분석] LangGraph 워크플로우로 분석 완료")
                
                # 워크플로우 결과가 final_output 딕셔너리인지 확인
                # final_output에는 summary, findings, organizations 등이 포함되어 있어야 함
                if not isinstance(result, dict):
                    logger.warning(f"[상황분석] 워크플로우 결과가 dict가 아님: {type(result)}")
                    result = {}
                
                # findings와 organizations가 없으면 빈 배열로 설정
                if "findings" not in result:
                    logger.warning("[상황분석] 워크플로우 결과에 findings 필드가 없음, 빈 배열로 설정")
                    result["findings"] = []
                if "organizations" not in result:
                    logger.warning("[상황분석] 워크플로우 결과에 organizations 필드가 없음, 빈 배열로 설정")
                    result["organizations"] = []
                
                return result
```

**처리 내용**:
- `SituationWorkflow` 인스턴스 생성
- 초기 상태 구성
- 워크플로우 실행
- 결과 검증 및 반환

### 3단계: LangGraph 워크플로우 실행

**파일**: `backend/core/situation_workflow.py`

워크플로우는 다음 7개의 노드로 구성됩니다:

#### 3-1. prepare_query_node: 쿼리 텍스트 준비 및 임베딩 생성

```126:144:backend/core/situation_workflow.py
    async def prepare_query_node(self, state: SituationWorkflowState) -> SituationWorkflowState:
        """1. 쿼리 텍스트 준비 및 임베딩 생성"""
        logger.info("[워크플로우] prepare_query_node 시작")
        
        # 쿼리 텍스트 구성
        query_text = state.get("situation_text", "")
        if state.get("summary"):
            query_text = state["summary"]
            if state.get("details"):
                query_text = f"{state['summary']}\n\n{state['details']}"
        
        # 임베딩 생성
        query_embedding = await self._get_embedding(query_text)
        
        return {
            **state,
            "query_text": query_text,
            "query_embedding": query_embedding,
        }
```

**처리 내용**:
- 상황 텍스트 또는 summary+details 조합으로 쿼리 구성
- 텍스트 임베딩 벡터 생성

#### 3-2. classify_situation_node: 상황 분류

```146:167:backend/core/situation_workflow.py
    async def classify_situation_node(self, state: SituationWorkflowState) -> SituationWorkflowState:
        """2. 상황 분류 (카테고리 + 위험도)"""
        logger.info("[워크플로우] classify_situation_node 시작")
        
        query_text = state.get("query_text", "")
        category_hint = state.get("category_hint")
        
        # LLM으로 분류 수행
        classification = await self._llm_classify(
            situation_text=query_text,
            category_hint=category_hint,
            employment_type=state.get("employment_type"),
            work_period=state.get("work_period"),
            weekly_hours=state.get("weekly_hours"),
            is_probation=state.get("is_probation"),
            social_insurance=state.get("social_insurance"),
        )
        
        return {
            **state,
            "classification": classification,
        }
```

**처리 내용**:
- LLM을 사용하여 상황 분류 (classified_type, risk_score)
- 사용자 메타 정보(고용 형태, 근무 기간 등) 활용

#### 3-3. filter_rules_node: 규정 필터링

```169:185:backend/core/situation_workflow.py
    async def filter_rules_node(self, state: SituationWorkflowState) -> SituationWorkflowState:
        """3. 분류 결과 기반 규정 필터링"""
        logger.info("[워크플로우] filter_rules_node 시작")
        
        classification = state.get("classification", {})
        classified_type = classification.get("classified_type", "unknown")
        
        # 카테고리 기반 필터링 규칙 생성
        filtered_categories = await self._filter_rules_by_classification(
            classified_type=classified_type,
            classification=classification,
        )
        
        return {
            **state,
            "filtered_categories": filtered_categories,
        }
```

**처리 내용**:
- 분류 결과를 기반으로 검색할 법령 카테고리 필터링
- 불필요한 검색 범위 축소로 정확도 향상

#### 3-4. retrieve_guides_node: RAG 검색

```187:233:backend/core/situation_workflow.py
    async def retrieve_guides_node(self, state: SituationWorkflowState) -> SituationWorkflowState:
        """4. RAG 검색 (필터링된 카테고리만) + legalBasis 추출"""
        logger.info("[워크플로우] retrieve_guides_node 시작")
        
        query_embedding = state.get("query_embedding")
        filtered_categories = state.get("filtered_categories", [])
        
        if not query_embedding:
            logger.warning("[워크플로우] query_embedding이 없습니다. 빈 결과 반환")
            return {
                **state,
                "grounding_chunks": [],
                "related_cases": [],
                "legal_basis": [],
            }
        
        # 병렬 검색
        grounding_chunks, related_cases = await asyncio.gather(
            self._search_legal_with_filter(
                query_embedding=query_embedding,
                categories=filtered_categories,
                top_k=8,
            ),
            self._search_cases_with_embedding(
                query_embedding=query_embedding,
                top_k=3,
            ),
            return_exceptions=False
        )
        
        # RAG 검색 결과 로깅
        logger.info(f"[워크플로우] RAG 검색 완료: 법령/가이드 {len(grounding_chunks)}개, 케이스 {len(related_cases)}개")
        if grounding_chunks:
            logger.info(f"[워크플로우] 검색된 법령/가이드 목록:")
            for idx, chunk in enumerate(grounding_chunks[:5], 1):  # 상위 5개만 로깅
                logger.info(f"  {idx}. [{chunk.source_type}] {chunk.title} (score: {chunk.score:.3f})")
                logger.info(f"     내용: {chunk.snippet[:100]}...")
        
        # legalBasis 구조 추출 (criteria 가공용)
        legal_basis = self._extract_legal_basis(grounding_chunks)
        
        return {
            **state,
            "grounding_chunks": grounding_chunks,
            "related_cases": related_cases[:3],  # 최대 3개만
            "legal_basis": legal_basis,
        }
```

**처리 내용**:
- 필터링된 카테고리로 법령/가이드 벡터 검색 (top_k=8)
- 관련 케이스 벡터 검색 (top_k=3)
- 병렬 검색으로 성능 최적화
- legal_basis 구조 추출 (criteria 생성용)

#### 3-5. generate_all_fields_node: 모든 필드 병렬 생성

```235:328:backend/core/situation_workflow.py
    async def generate_all_fields_node(self, state: SituationWorkflowState) -> SituationWorkflowState:
        """5. 모든 필드 병렬 생성 (summary, findings, scripts, organizations)"""
        logger.info("[워크플로우] generate_all_fields_node 시작 - 병렬 실행")
        
        classification = state.get("classification", {})
        grounding_chunks = state.get("grounding_chunks", [])
        legal_basis = state.get("legal_basis", [])
        query_text = state.get("query_text", "")
        
        logger.info(f"[워크플로우] 입력 데이터 확인 - classification: {bool(classification)}, grounding_chunks: {len(grounding_chunks)}개, legal_basis: {len(legal_basis)}개, query_text 길이: {len(query_text)}자")
        
        # legal_basis가 빈 배열일 때 fallback
        if not legal_basis:
            logger.warning("[워크플로우] legal_basis가 비어있습니다. 기본 criteria 생성")
            legal_basis = [{
                "title": "법적 근거 확인 필요",
                "snippet": "관련 법령 정보를 확인하는 중입니다.",
                "source_type": "unknown",
            }]
        
        # 병렬로 모든 필드 생성
        logger.info("[워크플로우] 병렬 LLM 호출 시작 (summary, findings, scripts, organizations)...")
        start_time = asyncio.get_event_loop().time()
        
        summary_result, findings_result, scripts_result, organizations_result = await asyncio.gather(
            self._llm_generate_summary(
                situation_text=query_text,
                classification=classification,
                grounding_chunks=grounding_chunks,
                legal_basis=legal_basis,
                employment_type=state.get("employment_type"),
                work_period=state.get("work_period"),
                weekly_hours=state.get("weekly_hours"),
                is_probation=state.get("is_probation"),
                social_insurance=state.get("social_insurance"),
            ),
            self._llm_generate_findings(
                situation_text=query_text,
                classification=classification,
                grounding_chunks=grounding_chunks,
                legal_basis=legal_basis,
                employment_type=state.get("employment_type"),
                work_period=state.get("work_period"),
                weekly_hours=state.get("weekly_hours"),
                is_probation=state.get("is_probation"),
                social_insurance=state.get("social_insurance"),
            ),
            self._llm_generate_scripts(
                situation_text=query_text,
                classification=classification,
                grounding_chunks=grounding_chunks,
                legal_basis=legal_basis,
                employment_type=state.get("employment_type"),
                work_period=state.get("work_period"),
                weekly_hours=state.get("weekly_hours"),
                is_probation=state.get("is_probation"),
                social_insurance=state.get("social_insurance"),
            ),
            self._llm_generate_organizations(
                situation_text=query_text,
                classification=classification,
            ),
            return_exceptions=True
        )
        
        elapsed_time = asyncio.get_event_loop().time() - start_time
        logger.info(f"[워크플로우] 병렬 LLM 호출 완료 - 소요 시간: {elapsed_time:.2f}초")
        
        # 예외 처리
        if isinstance(summary_result, Exception):
            logger.error(f"[워크플로우] summary 생성 실패: {summary_result}", exc_info=summary_result)
            # 기본 summary 반환 (4개 섹션 구조 유지)
            summary_result = "## 📊 상황 분석의 결과\n\n상황을 분석했습니다. 아래 법적 관점과 행동 가이드를 참고하세요.\n\n## ⚖️ 법적 관점에서 본 현재 상황\n\n관련 법령을 확인하는 중입니다.\n\n## 🎯 지금 당장 할 수 있는 행동\n\n- 상황을 다시 확인해주세요\n- 잠시 후 다시 시도해주세요\n\n## 💬 이렇게 말해보세요\n\n상담 기관에 문의하시기 바랍니다."
        elif not summary_result or (isinstance(summary_result, str) and len(summary_result.strip()) == 0):
            logger.warning("[워크플로우] summary가 비어있음, 기본값 사용")
            summary_result = "## 📊 상황 분석의 결과\n\n상황을 분석했습니다. 아래 법적 관점과 행동 가이드를 참고하세요.\n\n## ⚖️ 법적 관점에서 본 현재 상황\n\n관련 법령을 확인하는 중입니다.\n\n## 🎯 지금 당장 할 수 있는 행동\n\n- 상황을 다시 확인해주세요\n- 잠시 후 다시 시도해주세요\n\n## 💬 이렇게 말해보세요\n\n상담 기관에 문의하시기 바랍니다."
        
        if isinstance(findings_result, Exception):
            logger.error(f"[워크플로우] findings 생성 실패: {findings_result}", exc_info=findings_result)
            findings_result = []
        if isinstance(scripts_result, Exception):
            logger.error(f"[워크플로우] scripts 생성 실패: {scripts_result}", exc_info=scripts_result)
            scripts_result = {}
        if isinstance(organizations_result, Exception):
            logger.error(f"[워크플로우] organizations 생성 실패: {organizations_result}", exc_info=organizations_result)
            organizations_result = []
        
        return {
            **state,
            "summary_report": summary_result if isinstance(summary_result, str) else "",
            "scripts": scripts_result if isinstance(scripts_result, dict) else {},
            "findings": findings_result if isinstance(findings_result, list) else [],
            "organizations": organizations_result if isinstance(organizations_result, list) else [],
        }
```

**처리 내용**:
- **병렬 LLM 호출**로 다음 4개 필드를 동시에 생성:
  1. `summary`: 마크다운 형식 리포트 (4개 섹션: 📊 상황 분석, ⚖️ 법적 판단, 🔮 예상 시나리오, 💡 주의사항)
  2. `findings`: 법적 쟁점 발견 항목 리스트
  3. `scripts`: 이메일 템플릿 (to_company, to_advisor)
  4. `organizations`: 추천 기관 목록
- 예외 처리 및 기본값 설정

#### 3-6. merge_output_node: 최종 출력 병합

```389:652:backend/core/situation_workflow.py
    async def merge_output_node(self, state: SituationWorkflowState) -> SituationWorkflowState:
        """7. 최종 출력 병합"""
        logger.info("[워크플로우] merge_output_node 시작")
        
        classification = state.get("classification", {})
        related_cases = state.get("related_cases", [])
        action_plan = state.get("action_plan", {})
        scripts = state.get("scripts", {})
        criteria = state.get("criteria", [])
        findings = state.get("findings", [])  # 법적 쟁점 발견 항목
        organizations = state.get("organizations", [])  # 추천 기관 목록
        summary_report = state.get("summary_report", "")  # generate_action_guide에서 생성됨
        legal_basis = state.get("legal_basis", [])  # legal_basis 정보 가져오기
        
        # grounding_chunks 가져오기
        grounding_chunks = state.get("grounding_chunks", [])
        
        # 최종 JSON 출력 구성
        # related_cases는 이미 retrieve_guides에서 최대 3개로 제한됨
        # related_cases는 dict 형태로 반환되므로 dict 접근 방식 사용
        formatted_related_cases = []
        for case in related_cases[:3]:  # 최대 3개만 (이중 안전장치)
            if isinstance(case, dict):
                case_id = case.get("id", "")
                case_title = case.get("title", "")
                case_situation = case.get("situation", "")
                case_source_type = case.get("source_type")
            else:
                # 객체인 경우 (Legacy 지원)
                case_id = getattr(case, "id", "")
                case_title = getattr(case, "title", "")
                case_situation = getattr(case, "situation", "")
                case_source_type = getattr(case, "source_type", None)
            
            formatted_related_cases.append({
                "id": case_id,  # external_id
                "title": case_title,
                "summary": case_situation[:200] if len(case_situation) > 200 else case_situation,
                "source_type": case_source_type,  # source_type 정보 추가
            })
        
        # grounding_chunks를 sources 형식으로 변환
        formatted_sources = [
            {
                "source_id": chunk.source_id,
                "source_type": chunk.source_type,
                "title": chunk.title,
                "snippet": chunk.snippet,
                "score": chunk.score,
                "external_id": getattr(chunk, 'external_id', None),
                "file_url": getattr(chunk, 'file_url', None),
            }
            for chunk in grounding_chunks[:8]  # 최대 8개
        ]
        
        # criteria를 grounding_chunks에서 직접 생성 (새로운 RAG 기반 구조)
        # grounding_chunks를 criteria 형식으로 변환
        from core.file_utils import get_document_file_url
        
        criteria_items = []
        for chunk in grounding_chunks[:8]:  # 최대 8개
            external_id = getattr(chunk, 'external_id', None)
            source_type = chunk.source_type
            file_url = getattr(chunk, 'file_url', None)
            
            # file_url이 없으면 생성 (external_id가 있는 경우)
            if not file_url and external_id:
                try:
                    file_url = get_document_file_url(
                        external_id=external_id,
                        source_type=source_type,
                        expires_in=3600
                    )
                except Exception as e:
                    logger.warning(f"[워크플로우] fileUrl 생성 실패 (external_id={external_id}, source_type={source_type}): {str(e)}")
                    file_url = None
            
            # usageReason 생성 (우선순위: LLM criteria reason > snippet 기반 구체적 생성 > 기본 메시지)
            usage_reason = ""
            chunk_snippet_prefix = chunk.snippet[:50].strip() if chunk.snippet else ""
            chunk_snippet = chunk.snippet[:200].strip() if chunk.snippet else ""
            
            # 1. LLM이 생성한 criteria에서 해당 문서와 관련된 reason 찾기
            for criterion in criteria:
                if isinstance(criterion, dict):
                    criterion_name = criterion.get("name", "")
                    criterion_reason = criterion.get("reason", "")
                    criterion_legal_basis = criterion.get("legalBasis", [])
                    
                    # 문서 제목 매칭
                    if chunk.title in criterion_name or criterion_name in chunk.title:
                        # reason이 너무 길면 (snippet 전체가 들어간 경우) 다음 단계로
                        if len(criterion_reason) > 200:
                            break
                        # 일반적인 템플릿 문장인지 확인 ("현재 상황과 관련하여", "법적 판단 기준으로 사용했습니다" 등)
                        elif "현재 상황과 관련하여" in criterion_reason and "법적 판단 기준으로 사용했습니다" in criterion_reason:
                            # 일반적인 문장이면 snippet 기반으로 구체적 생성 시도
                            break
                        else:
                            usage_reason = criterion_reason
                            break
                    
                    # legalBasis에서 snippet 매칭 시도
                    if criterion_legal_basis and isinstance(criterion_legal_basis, list):
                        for basis in criterion_legal_basis:
                            if isinstance(basis, dict):
                                basis_snippet = basis.get("snippet", "")
                                if chunk_snippet_prefix and basis_snippet:
                                    if chunk_snippet_prefix[:30] in basis_snippet[:100] or basis_snippet[:30] in chunk_snippet_prefix[:100]:
                                        # 일반적인 템플릿 문장인지 확인
                                        if "현재 상황과 관련하여" in criterion_reason and "법적 판단 기준으로 사용했습니다" in criterion_reason:
                                            break
                                        else:
                                            usage_reason = criterion_reason if len(criterion_reason) <= 200 else ""
                                            break
                        if usage_reason:
                            break
                else:
                    criterion_name = getattr(criterion, "name", "")
                    criterion_reason = getattr(criterion, "reason", "")
                    if chunk.title in criterion_name or criterion_name in chunk.title:
                        # 일반적인 템플릿 문장인지 확인
                        if "현재 상황과 관련하여" in criterion_reason and "법적 판단 기준으로 사용했습니다" in criterion_reason:
                            break
                        usage_reason = criterion_reason if len(criterion_reason) <= 200 else ""
                        if usage_reason:
                            break
            
            # 2. snippet 기반으로 구체적인 usageReason 생성 (LLM reason이 없거나 일반적인 경우)
            if not usage_reason and chunk_snippet:
                # snippet에서 핵심 쟁점 키워드 추출
                issue_keywords = []
                if any(kw in chunk_snippet for kw in ["행사기간", "행사 기간", "행사기한"]):
                    issue_keywords.append("행사기간")
                if any(kw in chunk_snippet for kw in ["재직", "재임", "근무기간"]):
                    issue_keywords.append("재직요건")
                if any(kw in chunk_snippet for kw in ["해고", "계약해지", "해지"]):
                    issue_keywords.append("해고 예고")
                if any(kw in chunk_snippet for kw in ["선급금", "선금", "계약금"]):
                    issue_keywords.append("선급금")
                if any(kw in chunk_snippet for kw in ["지연", "배상", "이자"]):
                    issue_keywords.append("지연배상")
                if any(kw in chunk_snippet for kw in ["임금", "급여", "지급일"]):
                    issue_keywords.append("임금지급일")
                if any(kw in chunk_snippet for kw in ["수습", "수습기간"]):
                    issue_keywords.append("수습기간")
                if any(kw in chunk_snippet for kw in ["연장근로", "야간근로", "휴일근로"]):
                    issue_keywords.append("연장근로수당")
                
                # snippet 핵심 내용 요약 (첫 100자)
                snippet_summary = chunk_snippet[:100].replace("\n", " ").strip()
                
                # 문서 타입에 따른 판단 포인트
                if issue_keywords:
                    issue_text = ", ".join(issue_keywords[:2])  # 최대 2개만
                    if "표준" in chunk.title and "계약" in chunk.title:
                        usage_reason = f"이 조항은 {issue_text}에 대한 규정을 포함하고 있어, 현재 사용자 계약서의 해당 조항이 불명확하거나 과도하게 설정되어 있는지 비교·판단하는 기준으로 사용했습니다."
                    elif "법" in chunk.title or "규칙" in chunk.title:
                        usage_reason = f"이 조항은 {issue_text}에 대한 법적 요건을 규정하고 있어, 현재 상황에서 해당 요건이 충족되었는지 판단하는 근거로 활용했습니다."
                    else:
                        usage_reason = f"이 조항은 {issue_text}에 대한 내용을 다루고 있어, 현재 사용자 상황/계약서에서 해당 부분을 평가하는 기준으로 사용했습니다."
                else:
                    # 키워드가 없으면 snippet 요약 기반으로 생성
                    if "표준" in chunk.title and "계약" in chunk.title:
                        usage_reason = f"이 조항은 '{snippet_summary}...'의 내용을 규정하고 있어, 현재 계약서의 관련 조항과 비교하여 적절성을 판단하는 기준으로 사용했습니다."
                    elif "법" in chunk.title or "규칙" in chunk.title:
                        usage_reason = f"이 조항은 '{snippet_summary}...'의 법적 요건을 명시하고 있어, 현재 상황에서 해당 요건 충족 여부를 판단하는 근거로 활용했습니다."
                    else:
                        usage_reason = f"이 조항은 '{snippet_summary}...'의 내용을 포함하고 있어, 현재 사용자 상황과 비교하여 평가하는 기준으로 사용했습니다."
            
            # 3. usageReason이 없으면 기본 메시지 생성 (최후의 수단)
            if not usage_reason:
                if "표준" in chunk.title and "계약" in chunk.title:
                    usage_reason = f"현재 계약서의 관련 조항이 불명확한 부분이 있어, {chunk.title}의 규정을 비교 기준으로 사용했습니다."
                elif "법" in chunk.title or "규칙" in chunk.title:
                    usage_reason = f"현재 상황과 관련하여 {chunk.title}의 법령 조항을 판단 기준으로 사용했습니다."
                else:
                    usage_reason = f"현재 상황과 관련하여 {chunk.title}의 내용을 법적 판단 기준으로 사용했습니다."
            
            criteria_item = {
                "documentTitle": chunk.title,
                "fileUrl": file_url,
                "sourceType": source_type,
                "similarityScore": float(chunk.score),
                "snippet": chunk.snippet,
                "usageReason": usage_reason,
            }
            criteria_items.append(criteria_item)
        
        # findings 처리: LLM이 생성한 findings를 그대로 사용하되, source 정보 보완
        findings_processed = []
        if findings:
            logger.info(f"[워크플로우] findings 처리 시작: {len(findings)}개")
            for idx, finding in enumerate(findings):
                if not isinstance(finding, dict):
                    logger.warning(f"[워크플로우] finding[{idx}]이 dict가 아님: {type(finding)}")
                    continue
                
                # source 정보 보완 (fileUrl이 없으면 생성)
                source = finding.get("source", {})
                if not isinstance(source, dict):
                    logger.warning(f"[워크플로우] finding[{idx}] source가 dict가 아님: {type(source)}")
                    source = {}
                
                document_title = source.get("documentTitle", "").strip()
                source_type = source.get("sourceType", "law")
                external_id = None
                
                # grounding_chunks에서 해당 문서 찾아서 external_id 및 fileUrl 보완
                for chunk in grounding_chunks:
                    if document_title and (chunk.title == document_title or document_title in chunk.title):
                        external_id = getattr(chunk, 'external_id', None)
                        source_type = chunk.source_type  # grounding_chunks의 source_type 사용
                        if not source.get("fileUrl") and external_id:
                            try:
                                from core.file_utils import get_document_file_url
                                file_url = get_document_file_url(
                                    external_id=external_id,
                                    source_type=source_type,
                                    expires_in=3600
                                )
                                source["fileUrl"] = file_url
                                logger.debug(f"[워크플로우] finding[{idx}] fileUrl 생성: {file_url[:50]}...")
                            except Exception as e:
                                logger.warning(f"[워크플로우] finding[{idx}] source fileUrl 생성 실패: {str(e)}")
                        # similarityScore가 없으면 chunk.score 사용
                        if not source.get("similarityScore"):
                            source["similarityScore"] = float(chunk.score)
                        # refinedSnippet이 없으면 chunk.snippet 사용 (다듬지 않은 원문)
                        if not source.get("refinedSnippet"):
                            source["refinedSnippet"] = chunk.snippet
                        break
                
                # sourceType 매핑 (guideline -> manual, statute -> law)
                if source.get("sourceType") == "guideline":
                    source["sourceType"] = "manual"
                elif source.get("sourceType") == "statute":
                    source["sourceType"] = "law"
                
                # source 정보 업데이트
                finding["source"] = source
                findings_processed.append(finding)
            
            logger.info(f"[워크플로우] findings 처리 완료: {len(findings_processed)}개")
        else:
            logger.warning("[워크플로우] findings가 비어있거나 None입니다.")
        
        final_output = {
            "classified_type": classification.get("classified_type", "unknown"),
            "risk_score": classification.get("risk_score", 50),
            "summary": summary_report,  # generate_action_guide에서 생성된 4개 섹션 마크다운
            "criteria": criteria_items,  # RAG 검색 결과 기반 (새로운 구조)
            "findings": findings_processed,  # 법적 쟁점 발견 항목
            "action_plan": action_plan,  # steps 구조
            "scripts": scripts,  # toCompany, toAdvisor
            "related_cases": formatted_related_cases,
            "grounding_chunks": formatted_sources,  # sources 형식으로 변환
            "organizations": organizations,  # 추천 기관 목록
        }
        
        return {
            **state,
            "final_output": final_output,
        }
```

**처리 내용**:
- `criteria` 생성: grounding_chunks를 기반으로 usageReason 생성
- `findings` 처리: source 정보 보완 (fileUrl, similarityScore 등)
- `related_cases` 포맷팅
- 최종 JSON 출력 구성

#### 3-7. 워크플로우 실행 메서드

```2402:2435:backend/core/situation_workflow.py
    async def run(self, initial_state: Dict[str, Any]) -> Dict[str, Any]:
        """워크플로우 실행"""
        logger.info("[워크플로우] 실행 시작")
        
        # State로 변환
        state: SituationWorkflowState = {
            "situation_text": initial_state.get("situation_text", ""),
            "category_hint": initial_state.get("category_hint"),
            "summary": initial_state.get("summary"),
            "details": initial_state.get("details"),
            "employment_type": initial_state.get("employment_type"),
            "work_period": initial_state.get("work_period"),
            "weekly_hours": initial_state.get("weekly_hours"),
            "is_probation": initial_state.get("is_probation"),
            "social_insurance": initial_state.get("social_insurance"),
            "query_text": None,
            "query_embedding": None,
            "classification": None,
            "filtered_categories": None,
            "grounding_chunks": None,
            "related_cases": None,
            "legal_basis": None,
            "action_plan": None,
            "scripts": None,
            "criteria": None,
            "summary_report": None,
            "final_output": None,
        }
        
        # 그래프 실행
        final_state = await self.graph.ainvoke(state)
        
        # 최종 출력 반환
        return final_state.get("final_output", {})
```

### 4단계: 결과 변환 및 DB 저장

**파일**: `backend/api/routes_legal_v2.py` (1266-1659줄)

**주요 처리 내용**:

1. **위험도 레벨 변환** (1267-1271줄):
   - risk_score를 기반으로 risk_level 계산 (low/medium/high)

2. **Scripts 변환** (1276-1318줄):
   - 워크플로우 결과의 scripts를 EmailTemplateV2 형식으로 변환

3. **RelatedCases 그룹핑** (1320-1483줄):
   - grounding_chunks를 문서 단위로 그룹핑
   - usageReason 매핑 및 생성
   - fileUrl 생성

4. **Sources 변환** (1487-1544줄):
   - grounding_chunks를 sources 형식으로 변환
   - snippet 분석 및 fileUrl 생성

5. **DB 저장** (1546-1594줄):
   - `storage_service.save_situation_analysis()` 호출
   - 분석 결과를 JSONB로 저장
   - 실패해도 응답은 정상 반환

6. **최종 응답 생성** (1634-1659줄):
   - v2 스펙에 맞춰 응답 구성
   - id, riskScore, riskLevel, tags, summary, findings, relatedCases, scripts, organizations 포함

## 워크플로우 그래프 구조

```
prepare_query
    ↓
classify_situation
    ↓
filter_rules
    ↓
retrieve_guides
    ↓
generate_all_fields (병렬 LLM 호출)
    ↓
merge_output
    ↓
END
```

## 주요 특징

### 1. 병렬 처리
- RAG 검색: 법령/가이드와 케이스 검색을 병렬로 수행
- LLM 호출: summary, findings, scripts, organizations를 병렬로 생성

### 2. 단계별 필터링
- 상황 분류 → 카테고리 필터링 → RAG 검색
- 불필요한 검색 범위 축소로 정확도 향상

### 3. 에러 처리
- 각 단계에서 예외 발생 시 기본값 반환
- 워크플로우 실패 시에도 기본 응답 반환

### 4. 데이터 변환
- grounding_chunks → criteria (usageReason 자동 생성)
- grounding_chunks → relatedCases (문서 단위 그룹핑)
- findings source 정보 보완

## 성능 최적화

1. **병렬 LLM 호출**: 4개 필드를 동시에 생성하여 총 소요 시간 단축
2. **카테고리 필터링**: 검색 범위 축소로 RAG 검색 속도 향상
3. **임베딩 캐싱**: 동일 텍스트에 대한 임베딩 재사용

## 데이터베이스 저장

**테이블**: `situation_analyses`

**저장 필드**:
- `situation`: 사용자 입력 상황 텍스트
- `category`: 카테고리
- `employment_type`, `work_period`, `company_size`, `has_written_contract`, `social_insurance`: 메타 정보
- `risk_score`, `risk_level`: 위험도 정보
- `analysis`: 전체 분석 결과 (JSONB)
- `related_cases`: 관련 사례 (JSONB)
- `user_id`: 사용자 ID

## 로깅

각 단계에서 상세한 로그를 출력하여 디버깅 및 모니터링이 가능합니다:
- 워크플로우 실행 시작/완료
- 각 노드 실행 시작/완료
- RAG 검색 결과 요약
- LLM 호출 소요 시간
- 에러 발생 시 상세 정보

## 참고 파일

- **API 엔드포인트**: `backend/api/routes_legal_v2.py`
- **서비스 레이어**: `backend/core/legal_rag_service.py`
- **워크플로우**: `backend/core/situation_workflow.py`
- **프롬프트**: `backend/core/prompts.py`
- **벡터 스토어**: `backend/core/supabase_vector_store.py`
- **스토리지**: `backend/core/contract_storage.py`

