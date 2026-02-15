# Agent API 로직 절차 및 설명

## 📋 개요

`POST /api/v2/legal/agent/chat` 엔드포인트는 세 가지 모드(plain, contract, situation)를 통합한 Agent 기반 법률 상담 챗 API입니다. 각 모드별로 다른 처리 절차를 거치며, 최종적으로 RAG 검색과 LLM을 활용하여 답변을 생성합니다.

---

## 🔄 전체 처리 흐름

```
1. 요청 검증 및 세션 관리
   ↓
2. 모드별 컨텍스트 준비
   ├─ plain: 컨텍스트 없음
   ├─ contract: 계약서 분석 실행 또는 기존 분석 조회
   └─ situation: 상황 분석 실행 또는 기존 분석 조회
   ↓
3. 대화 히스토리 로드 (최근 30개)
   ↓
4. RAG 검색 및 답변 생성
   ├─ 계약서 내부 검색 (contract 모드인 경우)
   ├─ 외부 법령 검색
   └─ LLM으로 답변 생성
   ↓
5. 메시지 저장 (사용자 질문 + AI 답변)
   ↓
6. 응답 반환
```

---

## 📝 단계별 상세 설명

### 1단계: 요청 검증 및 세션 관리

**위치**: `backend/api/routes_legal_v2.py:2235-2279`

#### 1-1. 사용자 인증 확인
```python
if not x_user_id:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="사용자 ID가 필요합니다. X-User-Id 헤더를 제공해주세요.",
    )
```

#### 1-2. 세션 로드 또는 생성
- **기존 세션 사용**: `sessionId`가 제공된 경우
  - DB에서 세션 조회 (`storage_service.get_chat_session`)
  - 세션이 없으면 404 에러 반환
  
- **새 세션 생성**: `sessionId`가 없는 경우
  - 새 세션 생성 (`storage_service.create_chat_session`)
  - 생성된 `sessionId`를 응답에 포함

**코드 위치**: ```2266:2279:backend/api/routes_legal_v2.py```

---

### 2단계: 모드별 컨텍스트 준비

**위치**: `backend/api/routes_legal_v2.py:2281-2618`

각 모드에 따라 다른 컨텍스트를 준비합니다.

#### 2-1. Plain 모드 (일반 Q&A)

**특징**:
- 추가 컨텍스트 없음
- RAG 검색만으로 답변 생성

**처리**:
- `contract_analysis = None`
- `situation_analysis = None`
- 바로 3단계로 진행

---

#### 2-2. Contract 모드 (계약서 분석)

**위치**: `backend/api/routes_legal_v2.py:2298-2424`

##### 첫 요청 (파일 업로드)

**입력 조건**:
- `file` 필수
- `contractAnalysisId` 없음

**처리 절차**:

1. **파일 업로드 및 텍스트 추출**
   ```python
   # 임시 파일 저장
   temp_file = tempfile.NamedTemporaryFile(...)
   content = await file.read()
   temp_file.write(content)
   
   # 텍스트 추출 (OCR)
   processor = get_processor()
   extracted_text, _ = processor.process_file(
       temp_path,
       file_type=None,
       mode="contract"
   )
   ```

2. **계약서 분석 실행**
   ```python
   # 조항 추출
   clauses = extract_clauses(extracted_text)
   
   # 계약서 분석 (위험도, 이슈, 요약 생성)
   result = await legal_service.analyze_contract(
       extracted_text=extracted_text,
       description=None,
       doc_id=doc_id,
       clauses=clauses,
   )
   ```
   
   **분석 결과**:
   - `risk_score`: 위험도 점수 (0-100)
   - `risk_level`: 위험도 등급 ("low" | "medium" | "high")
   - `issues`: 발견된 법적 이슈 목록
   - `summary`: 분석 요약

3. **DB에 분석 결과 저장**
   ```python
   await storage_service.save_contract_analysis(
       doc_id=doc_id,
       title=file.filename or "계약서",
       risk_score=result.risk_score,
       risk_level=result.risk_level,
       summary=result.summary,
       issues=[...],
       user_id=user_id,
       contract_text=extracted_text,
   )
   ```

4. **분석 ID 저장**
   - 저장된 분석의 `id`를 `contract_analysis_id`에 저장
   - 후속 요청에서 이 ID를 사용

##### 후속 요청 (기존 분석 참고)

**입력 조건**:
- `contractAnalysisId` 제공
- `file` 없음

**처리 절차**:

1. **기존 분석 결과 조회**
   ```python
   saved_analysis = await storage_service.get_contract_analysis(
       contract_analysis_id, 
       user_id
   )
   ```

2. **분석 요약 구성**
   ```python
   contract_analysis = ContractAnalysisSummary(
       id=saved_analysis.get("id"),
       title=saved_analysis.get("title"),
       riskScore=saved_analysis.get("riskScore"),
       riskLevel=saved_analysis.get("riskLevel"),
       summary=saved_analysis.get("summary"),
   )
   ```

**코드 위치**: ```2298:2424:backend/api/routes_legal_v2.py```

---

#### 2-3. Situation 모드 (상황 분석)

**위치**: `backend/api/routes_legal_v2.py:2426-2618`

##### 첫 요청 (상황 폼 제출)

**입력 조건**:
- `situationTemplateKey` 필수
- `situationForm` 필수 (JSON 문자열)
- `situationAnalysisId` 없음

**처리 절차**:

1. **상황 폼 JSON 파싱**
   ```python
   situation_form = json.loads(situation_form_json)
   situation_request = SituationRequestV2(
       situation=situation_form.get("situation", ""),
       category=situation_form.get("category"),
       employmentType=situation_form.get("employmentType"),
       workPeriod=situation_form.get("workPeriod"),
       socialInsurance=situation_form.get("socialInsurance", []),
   )
   ```

2. **상황 분석 실행 (LangGraph 워크플로우)**
   ```python
   result = await legal_service.analyze_situation_detailed(
       category_hint=situation_request.category or "unknown",
       situation_text=situation_request.situation,
       employment_type=situation_request.employmentType,
       work_period=situation_request.workPeriod,
       social_insurance=", ".join(situation_request.socialInsurance),
       use_workflow=True,  # LangGraph 워크플로우 사용
   )
   ```

   **워크플로우 단계** (`backend/core/situation_workflow.py`):
   
   ```
   1. prepare_query: 상황 텍스트로 검색 쿼리 생성
      ↓
   2. classify_situation: 상황 분류 (카테고리, 위험도)
      ↓
   3. filter_rules: 관련 법령 카테고리 필터링
      ↓
   4. retrieve_guides: RAG 검색 (법령, 가이드, 케이스)
      ↓
   5. generate_all_fields: 병렬로 모든 필드 생성
      ├─ summary: 상황 요약
      ├─ criteria: 법적 판단 기준
      ├─ findings: 발견 사항
      ├─ scripts: 대화 스크립트
      └─ organizations: 관련 기관
      ↓
   6. merge_output: 최종 출력 병합
   ```

   **분석 결과**:
   - `classified_type`: 분류된 상황 타입
   - `risk_score`: 위험도 점수 (0-100)
   - `summary`: 상황 요약
   - `criteria`: 법적 판단 기준
   - `findings`: 발견 사항 목록
   - `scripts`: 대화 스크립트
   - `organizations`: 관련 기관 목록
   - `grounding_chunks`: RAG 검색 결과

3. **DB에 분석 결과 저장**
   ```python
   situation_id = await storage_service.save_situation_analysis(
       situation=situation_request.situation,
       category=situation_request.category,
       employment_type=situation_request.employmentType,
       work_period=situation_request.workPeriod,
       social_insurance=situation_request.socialInsurance,
       risk_score=float(result.get("risk_score", 0)),
       risk_level=risk_level,
       analysis=analysis_json,  # 전체 분석 결과
       related_cases=related_cases,
       user_id=user_id,
   )
   ```

##### 후속 요청 (기존 분석 참고)

**입력 조건**:
- `situationAnalysisId` 제공
- `situationForm` 없음

**처리 절차**:

1. **기존 분석 결과 조회**
   ```python
   saved_analysis = await storage_service.get_situation_analysis(
       situation_analysis_id, 
       user_id
   )
   ```

2. **분석 요약 구성**
   ```python
   situation_analysis = SituationAnalysisSummary(
       id=saved_analysis.get("id"),
       title=saved_analysis.get("title"),
       riskScore=saved_analysis.get("riskScore"),
       riskLevel=saved_analysis.get("riskLevel"),
       summary=saved_analysis.get("summary"),
   )
   ```

**코드 위치**: ```2426:2618:backend/api/routes_legal_v2.py```

**워크플로우 코드 위치**: `backend/core/situation_workflow.py`

---

### 3단계: 대화 히스토리 로드

**위치**: `backend/api/routes_legal_v2.py:2620-2623`

```python
history_messages = await storage_service.get_chat_messages(session_id, user_id)
# 최근 30개만 사용
history_messages = history_messages[-30:] if len(history_messages) > 30 else history_messages
```

**용도**:
- LLM 프롬프트에 대화 컨텍스트 포함
- 이전 대화 내용을 참고하여 일관성 있는 답변 생성

---

### 4단계: RAG 검색 및 답변 생성

**위치**: `backend/api/routes_legal_v2.py:2625-2671`

#### 4-1. 컨텍스트 데이터 준비

```python
context_type = _context_type_from_mode(mode)  # "none" | "contract" | "situation"

if contract_analysis:
    context_data = {
        "type": "contract",
        "analysis": saved_analysis,  # 계약서 분석 리포트 전체
    }
elif situation_analysis:
    context_data = {
        "type": "situation",
        "analysis": saved_analysis,  # 상황 분석 리포트 전체
    }
```

#### 4-2. RAG 검색 및 답변 생성

**위치**: `backend/core/legal_rag_service.py:453-584`

```python
chat_result = await legal_service.chat_with_context(
    query=message,
    doc_ids=[contract_analysis.id] if contract_analysis else [],
    analysis_summary=contract_analysis.summary if contract_analysis else (situation_analysis.summary if situation_analysis else None),
    risk_score=contract_analysis.riskScore if contract_analysis else (situation_analysis.riskScore if situation_analysis else None),
    top_k=8,
    context_type=context_type,
    context_data=context_data,
)
```

**처리 절차**:

1. **Dual RAG 검색 (병렬 실행)**

   a. **계약서 내부 검색** (contract 모드인 경우)
   ```python
   contract_chunks = self.vector_store.search_similar_contract_chunks(
       contract_id=doc_id,
       query_embedding=query_embedding,
       top_k=3,
   )
   ```
   - 계약서 텍스트에서 유사한 조항 검색
   - 이슈가 선택된 경우 해당 조항 부스팅

   b. **외부 법령 검색**
   ```python
   legal_chunks = await self._search_legal_chunks(
       query=query,
       top_k=8,
       category=issue_category,  # 이슈 카테고리가 있으면 필터링
       ensure_diversity=True,  # 타입 다양성 확보
   )
   ```
   
   **검색 소스**:
   - `laws/`: 법령
   - `manuals/`: 가이드/매뉴얼
   - `cases/`: 유사 케이스
   - `standard_contract/`: 표준 계약서
   
   **타입 다양성 확보**:
   - 최소 1개: 법령 (law)
   - 최소 1개: 가이드/표준계약 (manual, standard_contract)
   - 있으면 1개: 판례/케이스 (case)
   - 나머지는 유사도 순으로 채움

2. **LLM으로 답변 생성**

   **프롬프트 구성** (`backend/core/prompts.py`):
   - 사용자 질문
   - 계약서 분석 리포트 또는 상황 분석 리포트 (컨텍스트)
   - 계약서 내부 검색 결과 (contract 모드)
   - 외부 법령 검색 결과
   - 대화 히스토리 (최근 30개)

   **답변 형식**: 마크다운 형식

**코드 위치**: 
- RAG 검색: ```453:584:backend/core/legal_rag_service.py```
- 답변 생성: `backend/core/legal_rag_service.py:_llm_chat_response`

---

### 5단계: 메시지 저장

**위치**: `backend/api/routes_legal_v2.py:2673-2699`

```python
# 시퀀스 번호 계산
if history_messages:
    max_seq = max(msg.get("sequence_number", 0) for msg in history_messages)
    next_seq = max_seq + 1
else:
    next_seq = 1

# 사용자 메시지 저장
await storage_service.save_chat_message(
    session_id=session_id,
    user_id=user_id,
    sender_type="user",
    message=message,
    sequence_number=next_seq,
    context_type=context_type,
    context_id=contract_analysis_id or situation_analysis_id,
)

# AI 답변 저장
await storage_service.save_chat_message(
    session_id=session_id,
    user_id=user_id,
    sender_type="assistant",
    message=answer_markdown,
    sequence_number=next_seq + 1,
    context_type=context_type,
    context_id=contract_analysis_id or situation_analysis_id,
)
```

**저장 정보**:
- `session_id`: 대화 세션 ID
- `sender_type`: "user" 또는 "assistant"
- `message`: 메시지 내용
- `sequence_number`: 메시지 순서
- `context_type`: 컨텍스트 타입 ("none" | "contract" | "situation")
- `context_id`: 분석 리포트 ID

---

### 6단계: 응답 반환

**위치**: `backend/api/routes_legal_v2.py:2701-2712`

```python
return LegalChatAgentResponse(
    sessionId=session_id,
    mode=mode,
    contractAnalysisId=contract_analysis_id,
    situationAnalysisId=situation_analysis_id,
    answerMarkdown=answer_markdown,
    usedReports=used_reports,  # 사용된 분석 리포트 목록
    usedSources=used_sources,  # 사용된 RAG 검색 결과 목록
    contractAnalysis=contract_analysis,  # 계약서 분석 요약 (contract 모드)
    situationAnalysis=situation_analysis,  # 상황 분석 요약 (situation 모드)
)
```

**응답 구조**:
- `sessionId`: 대화 세션 ID (후속 요청에 사용)
- `mode`: 요청 모드
- `contractAnalysisId` / `situationAnalysisId`: 분석 리포트 ID (후속 요청에 사용)
- `answerMarkdown`: AI 답변 (마크다운 형식)
- `usedReports`: 사용된 분석 리포트 목록
- `usedSources`: 사용된 RAG 검색 결과 목록
- `contractAnalysis` / `situationAnalysis`: 분석 리포트 요약

---

## 🔍 주요 컴포넌트 설명

### 1. 세션 관리

**목적**: 대화 이력 유지 및 컨텍스트 관리

**저장 위치**: `legal_chat_sessions` 테이블

**주요 필드**:
- `id`: 세션 ID (UUID)
- `user_id`: 사용자 ID
- `created_at`: 생성 시간
- `updated_at`: 최종 업데이트 시간

**메시지 저장**: `legal_chat_messages` 테이블
- 최근 30개만 컨텍스트로 사용

---

### 2. 계약서 분석

**서비스**: `legal_service.analyze_contract()`

**엔드포인트**: `POST /api/v2/legal/analyze-contract`

**코드 위치**: 
- API 엔드포인트: `backend/api/routes_legal_v2.py:146-540`
- 분석 서비스: `backend/core/legal_rag_service.py:111-181`
- LLM 분석: `backend/core/legal_rag_service.py:1199-1507`

---

#### 📋 계약서 분석 전체 절차

```
[1] 파일 업로드 및 검증
    ↓
[2] 텍스트 추출 (OCR/파싱)
    - DocumentProcessor.process_file()
    - PDF/HWPX → 텍스트 변환
    ↓
[3] 조항 추출 (Clause Extraction)
    - extract_clauses() → LegalChunker.split_by_article()
    - "제n조" 패턴 또는 키워드 기반 분할
    ↓
[4] 계약서 청킹 및 벡터 저장
    - processor.to_contract_chunks()
    - 임베딩 생성 (BAAI/bge-m3)
    - contract_chunks 테이블에 저장
    ↓
[5] Dual RAG 검색 (병렬 실행)
    ├─ 계약서 내부 검색 (contract_chunks)
    │  - 벡터 유사도 검색 (top_k=5)
    │  - 조항 번호 기반 boosting
    └─ 외부 법령 검색 (legal_chunks)
       - 법령/가이드/케이스 검색 (top_k=8)
       - 타입 다양성 확보 (law, manual, case, standard_contract)
    ↓
[6] 위험 패턴 감지 (프리프로세싱)
    - 법정 수당 청구권 포기 패턴 감지
    - 위험 힌트 생성
    ↓
[7] LLM 위험 분석
    - build_contract_analysis_prompt()로 프롬프트 생성
    - Groq/Ollama로 위험 조항 식별
    - JSON 형식 응답 파싱
    ↓
[8] 결과 변환 및 검증
    - clause_id 기반으로 original_text 매핑
    - legal_basis 구조화
    - issues 배열 구성
    ↓
[9] DB 저장
    - contract_analyses 테이블
    - contract_issues 테이블
    ↓
[10] 응답 반환
    - ContractAnalysisResponseV2 형식
```

---

#### 🔍 단계별 상세 설명

##### 1단계: 파일 업로드 및 검증

**위치**: `backend/api/routes_legal_v2.py:164-196`

**처리 내용**:
- 파일명 검증 (`file.filename` 필수)
- 캐시 조회 (현재 개발 모드로 비활성화)
- 임시 파일 저장 (`tempfile.NamedTemporaryFile`)

**코드**:
```python
if not file.filename:
    raise HTTPException(status_code=400, detail="파일이 필요합니다.")

# 임시 파일 저장
temp_file = tempfile.NamedTemporaryFile(
    delete=False,
    suffix=suffix,
    dir=TEMP_DIR
)
content = await file.read()
temp_file.write(content)
temp_file.close()
```

---

##### 2단계: 텍스트 추출 (OCR/파싱)

**위치**: `backend/api/routes_legal_v2.py:216-233`

**처리 내용**:
- `DocumentProcessor.process_file()` 호출
- `mode="contract"` 설정 시 자동으로 `prefer_ocr=True` 적용
- 이미지 기반 PDF도 OCR로 처리

**코드**:
```python
processor = get_processor()
extracted_text, _ = processor.process_file(
    temp_path, 
    file_type=None, 
    mode="contract"  # OCR 우선 사용
)

if not extracted_text or extracted_text.strip() == "":
    raise HTTPException(
        status_code=400,
        detail="업로드된 파일에서 텍스트를 추출할 수 없습니다."
    )
```

**출력**: 계약서 원문 텍스트 (`extracted_text`)

---

##### 3단계: 조항 추출 (Clause Extraction)

**위치**: `backend/api/routes_legal_v2.py:290-292`

**처리 내용**:
- `extract_clauses()` 함수 호출
- 내부적으로 `LegalChunker.split_by_article()` 사용
- "제n조" 패턴 또는 키워드 기반 섹션 분할

**조항 인식 방법**:
1. **"제n조" 패턴** (우선순위 1)
   - 정규식: `^제\s*\d+\s*조\b.*`
   - 예: "제1조 (목적)", "제 2 조"

2. **키워드 기반** (패턴이 없을 때)
   - 섹션 키워드: `근로계약기간`, `근무 장소`, `업무의 내용`, `소정근로시간`, `휴게시간`, `임금`, `특약사항`, `수습 기간`, `연차유급휴가`, `사회보험 적용`, `근로계약서 교부`, `기타`

**출력 형식**:
```python
[
    {
        "id": "clause-1",
        "title": "제1조 (목적)",
        "content": "조항 본문...",
        "articleNumber": 1,
        "startIndex": 0,
        "endIndex": 150,
        "category": None  # LLM 라벨링 이후 채움
    },
    ...
]
```

**코드 위치**: `backend/core/clause_extractor.py:13-125`

---

##### 4단계: 계약서 청킹 및 벡터 저장

**위치**: `backend/api/routes_legal_v2.py:240-288`

**처리 내용**:
1. **조항 단위 청킹**
   ```python
   contract_chunks = processor.to_contract_chunks(
       text=extracted_text,
       base_meta={
           "contract_id": doc_id,
           "title": doc_title,
           "filename": file.filename,
       }
   )
   ```

2. **임베딩 생성** (비동기)
   ```python
   generator = LLMGenerator()
   chunk_texts = [chunk.content for chunk in contract_chunks]
   embeddings = await asyncio.to_thread(generator.embed, chunk_texts)
   ```

3. **contract_chunks 테이블에 저장**
   ```python
   vector_store.bulk_upsert_contract_chunks(
       contract_id=doc_id,
       chunks=chunk_payload
   )
   ```

**용도**: Dual RAG의 계약서 내부 검색에 사용

**저장 위치**: `contract_chunks` 테이블

---

##### 5단계: Dual RAG 검색

**위치**: `backend/core/legal_rag_service.py:128-155`

**처리 내용**:

**5-1. 쿼리 생성**
```python
query = self._build_query_from_contract(extracted_text, description)
# 계약서 앞부분 2000자 또는 조항 제목만 사용
```

**5-2. 계약서 내부 검색** (contract_chunks)
- `doc_id`가 있으면 계약서 내부 청크 검색
- 벡터 유사도 검색 (top_k=5)
- 조항 번호 기반 boosting 지원

```python
if doc_id:
    contract_chunks = await self._search_contract_chunks(
        doc_id=doc_id,
        query=query,
        top_k=5,
        selected_issue=None
    )
```

**5-3. 외부 법령 검색** (legal_chunks)
- 법령/가이드/케이스 검색 (top_k=8)
- source_type: `law`, `manual`, `case`, `standard_contract`
- 타입 다양성 확보:
  - 최소 1개: 법령 (law)
  - 최소 1개: 가이드/표준계약 (manual, standard_contract)
  - 있으면 1개: 판례/케이스 (case)
  - 나머지는 유사도 순으로 채움

```python
legal_chunks = await self._search_legal_chunks(
    query=query, 
    top_k=8,
    category=None,  # 전체 계약서 분석이므로 category 필터 없음
    ensure_diversity=True,  # 타입 다양성 확보
)
```

**검색 소스**:
- `laws/`: 법령 (근로기준법, 최저임금법 등)
- `manuals/`: 가이드/매뉴얼 (계약서 작성 가이드 등)
- `cases/`: 유사 케이스 (시나리오 문서)
- `standard_contract/`: 표준 계약서

---

##### 6단계: 위험 패턴 감지 (프리프로세싱)

**위치**: `backend/core/legal_rag_service.py:157-167`

**처리 내용**:
- 법정 수당 청구권 포기 패턴 감지
- 위험 힌트 생성하여 LLM에 전달

**감지 패턴**:
- "추가 수당을 사업주에게 청구하지 않기로 합의한다"
- "법에서 정한 연장·야간·휴일근로 수당 등 법정 임금 청구권을 미리 포기"

**코드**:
```python
if self._detect_wage_waiver_phrases(extracted_text):
    risk_hint = (
        f"{description or ''}\n\n"
        "※ 시스템 힌트: 이 계약서에는 "
        "'추가 수당을 사업주에게 청구하지 않기로 합의한다' 와 같이 "
        "근로자가 법에서 정한 연장·야간·휴일근로 수당 등 법정 임금 청구권을 "
        "미리 포기하는 취지의 문구가 포함되어 있습니다. "
        "이 조항의 위법 가능성과 위험도를 반드시 별도의 이슈로 평가하세요."
    ).strip()
```

---

##### 7단계: LLM 위험 분석

**위치**: `backend/core/legal_rag_service.py:1199-1507`

**처리 내용**:

**7-1. 프롬프트 생성**
```python
prompt = build_contract_analysis_prompt(
    contract_text=contract_text or "",
    grounding_chunks=grounding_chunks,  # 외부 법령 검색 결과
    contract_chunks=contract_chunks,      # 계약서 내부 검색 결과
    description=concerns or query,
    clauses=clauses,                      # 조항 리스트
    contract_type=contract_type,
    user_role=user_role,
    field=field,
    concerns=concerns,
)
```

**프롬프트 구조**:
- 시스템 프롬프트: 한국 노동법 전문가 역할 정의
- 분석 대상 계약서: 전체 텍스트 (3000자 이하) 또는 샘플링 (앞/중간/뒤)
- 계약서 주요 조항: contract_chunks (상위 5개, 각 400자)
- 참고 법령/가이드라인: grounding_chunks (8개, 각 200자)
- JSON 형식 응답 요청

**7-2. LLM 호출**
- Groq 우선 사용 (환경변수 설정)
- Ollama 대체 사용 (레거시)
- 최대 토큰: 8192 (긴 JSON 응답 대응)

**7-3. JSON 파싱**
- 코드 블록 제거 (```json, ```)
- 정규식으로 JSON 객체 추출
- JSON 유효성 검사 및 파싱
- 파싱 실패 시 복구 시도

**출력 형식**:
```json
{
    "risk_score": 65,
    "risk_level": "medium",
    "summary": "전체 위험도 요약",
    "issues": [
        {
            "name": "이슈 이름",
            "description": "위험 조항 설명",
            "clause_id": "clause-1",
            "original_text": "계약서 원문의 실제 텍스트",
            "severity": "high",
            "category": "wage",
            "legal_basis": [
                {
                    "title": "근로기준법 제XX조",
                    "snippet": "법령 조문...",
                    "sourceType": "law"
                }
            ],
            "suggested_text": "개선된 조항",
            "rationale": "왜 위험한지",
            "suggested_questions": ["협상 질문"]
        }
    ],
    "recommendations": [...]
}
```

**코드 위치**: `backend/core/prompts.py:848-1098` (프롬프트 빌더)

---

##### 8단계: 결과 변환 및 검증

**위치**: `backend/api/routes_legal_v2.py:330-500`

**처리 내용**:

**8-1. clause_id 기반 original_text 매핑**
```python
clauses_by_id = {c["id"]: c for c in clauses}

for issue in result.issues:
    clause_id = getattr(issue, 'clause_id', None)
    if clause_id and clause_id in clauses_by_id:
        clause = clauses_by_id[clause_id]
        original_text = clause.get("content", "")
```

**8-2. legal_basis 구조화**
- `LegalBasisItemV2` 형식으로 변환
- Dict 형식이면 구조화된 형식으로 변환

**8-3. issues 배열 구성**
- `clause_id`, `category`, `severity`, `description` 추출
- `legal_basis` 배열 구조화
- `original_text` 매핑

---

##### 9단계: DB 저장

**위치**: `backend/api/routes_legal_v2.py:500-540`

**처리 내용**:

**9-1. contract_analyses 테이블 저장**
```python
await storage_service.save_contract_analysis(
    doc_id=doc_id,
    title=file.filename or "계약서",
    risk_score=result.risk_score,
    risk_level=result.risk_level,
    summary=result.summary,
    issues=issues,
    user_id=user_id,
    contract_text=extracted_text,
    clauses=clauses,
    sections=sections,
    retrieved_contexts=retrieved_contexts,
)
```

**저장 필드**:
- `doc_id`: 고유 문서 ID (UUID)
- `title`: 계약서 제목
- `risk_score`: 위험도 점수 (0-100)
- `risk_level`: 위험도 등급 ("low" | "medium" | "high")
- `summary`: 분석 요약
- `contract_text`: 계약서 원문 텍스트
- `clauses`: 조항 목록 (JSONB)
- `sections`: 영역별 점수 (JSONB)
- `retrieved_contexts`: RAG 검색 결과 (JSONB)

**9-2. contract_issues 테이블 저장** (선택적)
- 각 이슈별로 별도 테이블에 저장 가능

---

##### 10단계: 응답 반환

**위치**: `backend/api/routes_legal_v2.py:540-600`

**응답 형식**: `ContractAnalysisResponseV2`

**주요 필드**:
- `docId`: 문서 ID
- `contractText`: 계약서 원문 텍스트
- `riskScore`: 위험도 점수 (0-100)
- `riskLevel`: 위험도 등급
- `summary`: 분석 요약
- `issues`: 위험 이슈 목록
- `clauses`: 조항 목록
- `sections`: 영역별 점수
- `retrievedContexts`: RAG 검색 결과

---

#### 🔧 주요 컴포넌트

**1. 조항 추출기**
- 파일: `backend/core/clause_extractor.py`
- 함수: `extract_clauses()`
- 내부: `LegalChunker.split_by_article()`

**2. RAG 서비스**
- 파일: `backend/core/legal_rag_service.py`
- 클래스: `LegalRAGService`
- 메서드: `analyze_contract()`, `_search_contract_chunks()`, `_search_legal_chunks()`

**3. LLM 분석**
- 파일: `backend/core/legal_rag_service.py`
- 메서드: `_llm_summarize_risk()`
- 프롬프트: `build_contract_analysis_prompt()` (`backend/core/prompts.py`)

**4. 벡터 스토어**
- 파일: `backend/core/supabase_vector_store.py`
- 클래스: `SupabaseVectorStore`
- 메서드: `bulk_upsert_contract_chunks()`, `search_similar_contract_chunks()`, `search_similar_legal_chunks()`

**5. 문서 처리기**
- 파일: `backend/core/document_processor_v2.py`
- 클래스: `DocumentProcessor`
- 메서드: `process_file()`, `to_contract_chunks()`

---

#### 📊 성능 최적화

**1. 프롬프트 길이 최적화**
- `legal_context`: 8개 × 300자 → 5개 × 200자
- `contract_context`: 상위 5개만 사용 (각 400자)
- 응답 규칙 간소화

**2. 텍스트 샘플링**
- 긴 계약서는 앞/중간/뒤 부분만 샘플링
- 최대 9000자까지 전달 (3000자 × 3)

**3. 비동기 처리**
- 임베딩 생성: `asyncio.to_thread()`
- contract_chunks 저장 후 분석 시작 (Race condition 방지)

**4. 임베딩 캐싱**
- LRU 캐시 사용 (`LRUEmbeddingCache`)
- 최대 100개 항목 캐싱

---

#### ⚠️ 에러 처리

**1. 텍스트 추출 실패**
- `extracted_text`가 비어있으면 400 에러 반환

**2. 조항 추출 실패**
- `clauses`가 비어있으면 전체를 하나의 clause로 생성

**3. contract_chunks 저장 실패**
- 경고 로그만 남기고 분석 계속 진행
- `doc_id=None`으로 전달하여 내부 검색 비활성화

**4. LLM 호출 실패**
- Groq 실패 시 Ollama로 fallback
- JSON 파싱 실패 시 복구 시도

**5. DB 저장 실패**
- 경고 로그만 남기고 응답은 반환
- 사용자는 결과를 볼 수 있음

---

**저장 위치**: `contract_analyses` 테이블

---

### 3. 상황 분석 (LangGraph 워크플로우)

**서비스**: `legal_service.analyze_situation_detailed(use_workflow=True)`

**워크플로우 그래프** (`backend/core/situation_workflow.py`):

```
prepare_query → classify_situation → filter_rules → retrieve_guides 
    → generate_all_fields → merge_output → END
```

**각 노드 역할**:

1. **prepare_query**: 상황 텍스트로 검색 쿼리 생성
2. **classify_situation**: 상황 분류 및 위험도 평가
3. **filter_rules**: 관련 법령 카테고리 필터링
4. **retrieve_guides**: RAG 검색 (법령, 가이드, 케이스)
5. **generate_all_fields**: 병렬로 모든 필드 생성
   - summary: 상황 요약
   - criteria: 법적 판단 기준
   - findings: 발견 사항
   - scripts: 대화 스크립트
   - organizations: 관련 기관
6. **merge_output**: 최종 출력 병합

**저장 위치**: `situation_analyses` 테이블

---

### 4. RAG 검색

**벡터 스토어**: `SupabaseVectorStore`

**검색 소스**:
- `laws/`: 법령 (근로기준법, 최저임금법 등)
- `manuals/`: 가이드/매뉴얼 (계약서 작성 가이드 등)
- `cases/`: 유사 케이스 (시나리오 문서)
- `standard_contract/`: 표준 계약서

**검색 방식**:
1. 쿼리 임베딩 생성 (캐싱 지원)
2. 벡터 유사도 검색 (Supabase pgvector)
3. 메타데이터 필터링 (카테고리, 소스 타입)
4. 타입 다양성 확보 (법령, 가이드, 케이스 균형)

**코드 위치**: `backend/core/legal_rag_service.py:_search_legal_chunks`

---

### 5. 답변 생성

**LLM**: Groq 또는 Ollama (환경변수 설정)

**프롬프트 구성**:
- 시스템 프롬프트: 법률 전문가 역할 정의
- 사용자 질문
- 컨텍스트: 분석 리포트 (contract/situation 모드)
- RAG 검색 결과: 계약서 내부 + 외부 법령
- 대화 히스토리: 최근 30개 메시지

**답변 형식**: 마크다운

**코드 위치**: `backend/core/legal_rag_service.py:_llm_chat_response`

---

## 📊 모드별 비교

| 항목 | Plain | Contract | Situation |
|------|-------|----------|-----------|
| **첫 요청 입력** | message | message + file | message + situationForm |
| **후속 요청 입력** | message + sessionId | message + sessionId + contractAnalysisId | message + sessionId + situationAnalysisId |
| **분석 실행** | ❌ | ✅ (계약서 분석) | ✅ (상황 분석) |
| **분석 저장** | ❌ | ✅ (contract_analyses) | ✅ (situation_analyses) |
| **컨텍스트 타입** | "none" | "contract" | "situation" |
| **RAG 검색** | ✅ (외부 법령만) | ✅ (계약서 내부 + 외부 법령) | ✅ (외부 법령만) |
| **대화 히스토리** | ✅ | ✅ | ✅ |

---

## 🔄 후속 요청 흐름

### Plain 모드
```
1. sessionId로 세션 조회
2. 대화 히스토리 로드
3. RAG 검색 (외부 법령)
4. 답변 생성
5. 메시지 저장
```

### Contract 모드 (후속)
```
1. sessionId로 세션 조회
2. contractAnalysisId로 분석 리포트 조회
3. 대화 히스토리 로드
4. RAG 검색 (계약서 내부 + 외부 법령)
5. 답변 생성 (계약서 분석 리포트 컨텍스트 포함)
6. 메시지 저장
```

### Situation 모드 (후속)
```
1. sessionId로 세션 조회
2. situationAnalysisId로 분석 리포트 조회
3. 대화 히스토리 로드
4. RAG 검색 (외부 법령)
5. 답변 생성 (상황 분석 리포트 컨텍스트 포함)
6. 메시지 저장
```

---

## ⚠️ 주의사항

1. **첫 요청과 후속 요청 구분**
   - Contract 모드: 첫 요청은 `file` 필수, 후속 요청은 `contractAnalysisId` 필수
   - Situation 모드: 첫 요청은 `situationForm` 필수, 후속 요청은 `situationAnalysisId` 필수

2. **세션 ID 관리**
   - 첫 요청: `sessionId` 없으면 자동 생성
   - 후속 요청: 첫 요청에서 받은 `sessionId` 사용

3. **분석 ID 관리**
   - 첫 요청: 분석 실행 후 `contractAnalysisId` 또는 `situationAnalysisId` 반환
   - 후속 요청: 첫 요청에서 받은 분석 ID 사용

4. **대화 히스토리 제한**
   - 최근 30개 메시지만 컨텍스트로 사용
   - 토큰 제한을 고려한 제한

5. **RAG 검색 결과 제한**
   - 외부 법령: 최대 8개 (타입 다양성 확보)
   - 계약서 내부: 최대 3개

---

## 📚 관련 파일

- **API 엔드포인트**: `backend/api/routes_legal_v2.py:2230-2712`
- **상황 분석 워크플로우**: `backend/core/situation_workflow.py`
- **RAG 서비스**: `backend/core/legal_rag_service.py`
- **프롬프트**: `backend/core/prompts.py`
- **벡터 스토어**: `backend/core/supabase_vector_store.py`
- **API 명세서**: `backend/docs/AGENT_API_SPEC.md`
- **세션 ID 가이드**: `backend/docs/AGENT_API_SESSION_ID_GUIDE.md`

---

## 🔗 참고

- [Agent API 명세서](./AGENT_API_SPEC.md)
- [세션 ID 가이드](./AGENT_API_SESSION_ID_GUIDE.md)
- [테스트 예시](./AGENT_API_TEST_EXAMPLES.md)

