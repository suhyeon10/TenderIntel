# 즉시상담 페이지 API 정리

## 개요
`src/app/legal/assist/quick/page.tsx` 페이지에서 사용 중인 API 목록입니다.

---

## 1. 상황 분석 API

### 1.1 `analyzeSituationV2`
- **용도**: 새로운 상황 분석 생성
- **엔드포인트**: `POST /api/v2/legal/analyze-situation`
- **사용 위치**: 
  - `handleSendMessage` 함수 (1388줄) - 컨텍스트가 없을 때 새로운 상황 분석 생성
- **요청 파라미터**:
  ```typescript
  {
    situation: string;
    category?: string;
    employmentType?: string;
    companySize?: string;
    workPeriod?: string;
    hasWrittenContract?: boolean;
    socialInsurance?: string[];
  }
  ```
- **응답**: `SituationResponseV2`

### 1.2 `getSituationAnalysisByIdV2`
- **용도**: 특정 상황 분석 결과 조회
- **엔드포인트**: `GET /api/v2/legal/situations/{situationId}`
- **사용 위치**:
  - `UserMessageWithContext` 컴포넌트 (251줄) - 리포트 정보 로드
  - `loadContextData` 함수 (633줄) - URL 파라미터로 전달된 상황 분석 로드
- **요청 파라미터**: `situationId: string`, `userId?: string | null`

### 1.3 `getSituationHistoryV2`
- **용도**: 사용자의 상황 분석 히스토리 조회
- **엔드포인트**: `GET /api/v2/legal/situations/history?limit={limit}&offset={offset}`
- **사용 위치**:
  - `loadReports` 함수 (917줄) - 상황 분석 아카이브 로드
  - `ContextSituationList` 컴포넌트 (1587줄) - 컨텍스트 선택용 상황 분석 목록
- **요청 파라미터**: `limit: number`, `offset: number`, `userId?: string | null`

---

## 2. 계약서 분석 API

### 2.1 `getContractAnalysisV2`
- **용도**: 특정 계약서 분석 결과 조회
- **엔드포인트**: `GET /api/v2/legal/contracts/{docId}`
- **사용 위치**:
  - `UserMessageWithContext` 컴포넌트 (260줄) - 리포트 정보 로드
- **요청 파라미터**: `docId: string`

### 2.2 `getContractHistoryV2`
- **용도**: 사용자의 계약서 분석 히스토리 조회
- **엔드포인트**: `GET /api/v2/legal/contracts/history?limit={limit}&offset={offset}`
- **사용 위치**:
  - `ContextContractList` 컴포넌트 (1686줄) - 컨텍스트 선택용 계약서 분석 목록
- **요청 파라미터**: `limit: number`, `offset: number`, `userId?: string | null`

---

## 3. 챗 API

### 3.1 `chatWithContractV2`
- **용도**: 법률 상담 챗 (Dual RAG 지원)
- **엔드포인트**: `POST /api/v2/legal/chat`
- **사용 위치**:
  - `handleSendMessage` 함수 (1145줄) - 상황 분석 결과가 있을 때
  - `handleSendMessage` 함수 (1216줄) - 상황 컨텍스트가 있을 때
  - `handleSendMessage` 함수 (1272줄) - 계약서 컨텍스트가 있을 때
  - `handleSendMessage` 함수 (1329줄) - 일반 챗 모드
- **요청 파라미터**:
  ```typescript
  {
    query: string;
    docIds: string[];
    selectedIssueId?: string;
    selectedIssue?: {...};
    analysisSummary?: string;
    riskScore?: number;
    totalIssues?: number;
    topK?: number;
    contextType?: 'none' | 'situation' | 'contract';
    contextId?: string | null;
  }
  ```
- **응답**: `LegalChatResponseV2` (answer, markdown 포함)

---

## 4. 챗 세션 관리 API

### 4.1 `createChatSession`
- **용도**: 새로운 챗 세션 생성
- **엔드포인트**: `POST /api/v2/legal/chat/sessions`
- **사용 위치**:
  - `handleSendMessage` 함수 (1079줄) - 새 대화 시작 시
  - `loadContextData` 함수 (647줄) - URL 파라미터로 전달된 컨텍스트로 세션 생성
- **요청 파라미터**:
  ```typescript
  {
    initial_context_type?: 'none' | 'situation' | 'contract';
    initial_context_id?: string | null;
    title?: string | null;
  }
  ```
- **응답**: `{ id: string; success: boolean }`

### 4.2 `getChatSessions`
- **용도**: 사용자의 챗 세션 목록 조회
- **엔드포인트**: `GET /api/v2/legal/chat/sessions?limit={limit}&offset={offset}`
- **사용 위치**:
  - `loadConversations` 함수 (421줄) - 페이지 로드 시 대화 내역 로드
- **요청 파라미터**: `userId: string`, `limit: number`, `offset: number`
- **응답**: `ChatSession[]`

### 4.3 `getChatSession`
- **용도**: 특정 챗 세션 조회
- **엔드포인트**: `GET /api/v2/legal/chat/sessions/{sessionId}`
- **사용 위치**: 현재 코드에서 직접 사용되지 않음 (타입 정의만 존재)

### 4.4 `getChatMessages`
- **용도**: 특정 세션의 메시지 목록 조회
- **엔드포인트**: `GET /api/v2/legal/chat/sessions/{sessionId}/messages`
- **사용 위치**:
  - `loadConversations` 함수 (426줄) - 각 세션의 메시지 로드
  - `loadLatestMessages` 함수 (691줄) - 선택된 대화의 최신 메시지 로드
  - `handleSendMessage` 함수 (1173줄, 1236줄, 1292줄, 1347줄) - 메시지 저장 전 시퀀스 번호 확인
- **요청 파라미터**: `sessionId: string`, `userId?: string | null`
- **응답**: `ChatMessage[]`

### 4.5 `saveChatMessage`
- **용도**: 챗 메시지 저장
- **엔드포인트**: `POST /api/v2/legal/chat/sessions/{sessionId}/messages`
- **사용 위치**:
  - `handleSendMessage` 함수 (1181줄, 1194줄) - 상황 분석 결과 기반 챗
  - `handleSendMessage` 함수 (1243줄, 1255줄) - 상황 컨텍스트 챗
  - `handleSendMessage` 함수 (1299줄, 1311줄) - 계약서 컨텍스트 챗
  - `handleSendMessage` 함수 (1354줄, 1366줄) - 일반 챗
- **요청 파라미터**:
  ```typescript
  {
    sender_type: 'user' | 'assistant';
    message: string;
    sequence_number: number;
    context_type?: 'none' | 'situation' | 'contract';
    context_id?: string | null;
  }
  ```
- **응답**: `{ id: string; success: boolean }`

### 4.6 `updateChatSession`
- **용도**: 챗 세션 업데이트 (제목 변경 등)
- **엔드포인트**: `PUT /api/v2/legal/chat/sessions/{sessionId}`
- **사용 위치**: 현재 코드에서 직접 사용되지 않음 (타입 정의만 존재)

### 4.7 `deleteChatSession`
- **용도**: 챗 세션 삭제
- **엔드포인트**: `DELETE /api/v2/legal/chat/sessions/{sessionId}`
- **사용 위치**:
  - `handleDeleteConversation` 함수 (873줄) - 대화 삭제 시
- **요청 파라미터**: `sessionId: string`, `userId: string`
- **응답**: `{ success: boolean }`

---

## 5. 직접 호출하는 API

### 5.1 챗 세션 생성 (직접 fetch)
- **엔드포인트**: `POST /api/v2/legal/chat/sessions`
- **사용 위치**: `loadContextData` 함수 (647줄)
- **용도**: URL 파라미터로 전달된 컨텍스트로 세션 생성
- **요청 헤더**: 
  - `Authorization: Bearer {token}`
  - `X-User-Id: {userId}`
  - `Content-Type: application/json`
- **요청 본문**:
  ```json
  {
    "initial_context_type": "situation",
    "initial_context_id": "{contextId}",
    "title": "{title}"
  }
  ```

---

## 6. API 호출 흐름

### 6.1 페이지 초기 로드
1. `loadConversations` → `getChatSessions` (세션 목록)
2. 각 세션에 대해 → `getChatMessages` (메시지 로드)
3. URL 파라미터가 있으면 → `loadContextData` → `getSituationAnalysisByIdV2` + 세션 생성

### 6.2 메시지 전송
1. 세션이 없으면 → `createChatSession` (새 세션 생성)
2. 컨텍스트에 따라 분기:
   - 상황 분석 결과가 있음 → `chatWithContractV2` (analysisSummary 포함)
   - 상황 컨텍스트 → `chatWithContractV2` (contextType: 'situation')
   - 계약서 컨텍스트 → `chatWithContractV2` (contextType: 'contract', docIds 포함)
   - 일반 챗 → `chatWithContractV2` (contextType: 'none')
   - 컨텍스트 없음 → `analyzeSituationV2` (새로운 상황 분석 생성)
3. 응답 받은 후 → `getChatMessages` (시퀀스 번호 확인)
4. 사용자 메시지 저장 → `saveChatMessage`
5. AI 메시지 저장 → `saveChatMessage`

### 6.3 컨텍스트 선택
1. 상황 분석 선택 → `getSituationHistoryV2` (목록 조회)
2. 계약서 분석 선택 → `getContractHistoryV2` (목록 조회)
3. 선택 후 → `getSituationAnalysisByIdV2` 또는 `getContractAnalysisV2` (상세 조회)

### 6.4 대화 삭제
1. `deleteChatSession` (DB에서 삭제)
2. 로컬 상태에서 제거

---

## 7. 인증

모든 API 호출은 다음 헤더를 포함합니다:
- `Authorization: Bearer {supabase_access_token}` (선택적)
- `X-User-Id: {user_id}` (사용자 ID가 있는 경우)
- `Content-Type: application/json` (POST/PUT 요청)

인증 헤더는 `getAuthHeaders()` 함수를 통해 자동으로 추가됩니다.

---

## 8. 에러 처리

- 모든 API 호출은 try-catch로 감싸져 있음
- 에러 발생 시 `toast`를 통해 사용자에게 알림
- 일부 API는 실패해도 로컬 스토리지로 fallback (예: 세션 생성 실패 시 로컬 세션 사용)

---

## 9. 데이터 저장 위치

- **DB (Supabase)**:
  - `legal_chat_sessions`: 챗 세션 정보
  - `legal_chat_messages`: 챗 메시지
  - `situation_analyses`: 상황 분석 결과
  - `contract_analyses`: 계약서 분석 결과

- **로컬 스토리지 (localStorage)**:
  - `legal_assist_conversations`: 대화 내역 (DB와 병합하여 사용)

---

## 10. 주요 타입 정의

```typescript
// 챗 메시지
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  reportId?: string;
  context_type?: 'none' | 'situation' | 'contract';
  context_id?: string | null;
}

// 대화 세션
interface ConversationSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  sessionId: string; // legal_chat_sessions의 ID
}

// 컨텍스트
interface ChatContext {
  type: 'none' | 'situation' | 'contract';
  id: string | null;
  label?: string;
}
```

---

## 11. 컴포넌트 구조

### 11.1 `UserMessageWithContext` 컴포넌트

**위치**: `src/app/legal/assist/quick/page.tsx` (217-337줄)

**용도**: 사용자 메시지에 컨텍스트 정보(상황 분석 또는 계약서 분석 리포트)를 표시하는 컴포넌트

**Props**:
```typescript
{
  message: ChatMessage;  // 표시할 메시지
  reportCache: Map<string, { title: string; summary: string; type: 'situation' | 'contract' }>;  // 리포트 정보 캐시
  setReportCache: React.Dispatch<React.SetStateAction<Map<...>>>;  // 캐시 업데이트 함수
}
```

**주요 기능**:
1. **리포트 정보 로드**:
   - `message.context_id`와 `message.context_type`을 확인
   - 캐시에 정보가 있으면 캐시에서 가져옴
   - 캐시에 없으면 API 호출:
     - `context_type === 'situation'` → `getSituationAnalysisByIdV2` 호출
     - `context_type === 'contract'` → `getContractAnalysisV2` 호출
   - 로드한 정보를 캐시에 저장

2. **UI 표시**:
   - 사용자 메시지 내용 표시
   - 컨텍스트가 있는 경우:
     - 로딩 중: "리포트 정보 로딩 중..." 표시
     - 로드 완료: 리포트 타입 아이콘 + 제목 + 요약 표시
     - 로드 실패: 리포트 타입만 표시

**사용 위치**:
- 메시지 렌더링 부분 (1976줄) - 사용자 메시지 표시 시

**상태 관리**:
- `isLoadingReport`: 리포트 정보 로딩 상태
- `reportInfo`: 로드된 리포트 정보 (title, summary, type)

---

### 11.2 `ContextSituationList` 컴포넌트

**위치**: `src/app/legal/assist/quick/page.tsx` (1562-1690줄)

**용도**: 컨텍스트 선택 모달에서 상황 분석 리포트 목록을 표시하고 선택할 수 있게 하는 컴포넌트

**Props**:
```typescript
{
  onSelect: (situation: { id: string; situation: string }) => void;  // 상황 분석 선택 시 호출되는 콜백
  currentContextId: string | null;  // 현재 선택된 컨텍스트 ID (하이라이트용)
}
```

**주요 기능**:
1. **상황 분석 목록 로드**:
   - `useEffect`에서 컴포넌트 마운트 시 자동 실행
   - `getSituationHistoryV2(20, 0, userId)` 호출하여 최근 20개 상황 분석 가져오기
   - 30초 타임아웃 설정
   - 취소 가능한 비동기 요청 (cleanup 함수로 취소 처리)

2. **상태 관리**:
   - `situations`: 상황 분석 목록
   - `loading`: 로딩 상태
   - `error`: 에러 메시지

3. **UI 표시**:
   - **로딩 중**: 스피너 + "로딩 중..." 메시지
   - **에러 발생**: 빨간색 경고 박스에 에러 메시지 표시
   - **빈 목록**: "저장된 상황 분석이 없습니다" 메시지
   - **목록 표시**: 각 상황 분석을 버튼으로 표시
     - 선택된 항목: 파란색 테두리 + 배경
     - 미선택 항목: 회색 테두리, 호버 시 파란색 테두리
     - 각 항목: 제목(최대 50자) + 생성일 표시

**사용 위치**:
- 컨텍스트 선택 모달 (2263줄) - 상황 분석 리포트 선택 탭

**데이터 형식**:
```typescript
Array<{
  id: string;              // 상황 분석 ID
  situation: string;       // 상황 설명 (제목으로 사용)
  created_at: string;      // 생성일 (ISO 문자열)
}>
```

**에러 처리**:
- 로그인 필요 시: "로그인이 필요합니다" 에러 표시
- API 호출 실패: 에러 메시지 표시
- 타임아웃: "요청 시간이 초과되었습니다" 메시지

**참고**:
- `ContextContractList` 컴포넌트와 유사한 구조 (1692-1809줄)
- 계약서 분석 리포트 목록을 표시하는 용도

---

## 참고 파일

- API 서비스: `src/apis/legal.service.ts`
- 페이지 컴포넌트: `src/app/legal/assist/quick/page.tsx`
- 백엔드 라우트: `backend/api/routes_legal_v2.py`

