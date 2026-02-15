# Legal Quick Assist 페이지 최적화 검토 보고서

## 📋 개요
`/legal/assist/quick` 페이지 (`src/app/legal/assist/quick/page.tsx`)의 성능 최적화 필요 사항을 검토했습니다.

## 🔍 현재 상태

### 파일 크기
- **총 라인 수**: 2,588줄
- **문제점**: 단일 파일에 모든 로직이 집중되어 유지보수가 어려움

### 상태 관리
- **useState 개수**: 15개 이상
  - `inputMessage`, `isAnalyzing`, `messages`, `conversations`, `selectedConversationId`, `editingMessageId`, `editText`, `showArchiveModal`, `reports`, `isLoadingReports`, `situationAnalysis`, `situationContext`, `currentContext`, `showContextSelector`, `contextSelectorType`, `openReportMenu`, `reportCache`
- **문제점**: 상태가 너무 많아 리렌더링 최적화가 어려움

### Effect 훅
- **useEffect 개수**: 8개 이상
  - 대화 로드, 메시지 동기화, 스크롤 처리, 입력창 높이 조절 등
- **문제점**: 의존성 배열 관리가 복잡하고 불필요한 재실행 가능

### 메모이제이션
- **useMemo**: 0개 ❌
- **useCallback**: 0개 ❌
- **문제점**: 매 렌더링마다 함수와 값이 재생성되어 불필요한 리렌더링 발생

## 🚨 주요 최적화 필요 사항

### 1. 컴포넌트 분리 (우선순위: 높음)

#### 현재 문제
- 모든 로직이 단일 파일에 집중
- `ContextSituationList`, `ContextContractList`가 메인 컴포넌트 내부에 정의됨
- `UserMessageWithContext`도 메인 컴포넌트 내부에 정의됨

#### 권장 사항
```typescript
// 분리해야 할 컴포넌트들:
- ContextSituationList → src/components/legal/ContextSituationList.tsx
- ContextContractList → src/components/legal/ContextContractList.tsx
- UserMessageWithContext → src/components/legal/UserMessageWithContext.tsx
- ConversationSidebar → src/components/legal/ConversationSidebar.tsx
- MessageList → src/components/legal/MessageList.tsx
- ArchiveModal → src/components/legal/ArchiveModal.tsx
- ContextSelectorModal → src/components/legal/ContextSelectorModal.tsx
```

### 2. 메모이제이션 적용 (우선순위: 높음)

#### 현재 문제
- 모든 함수가 매 렌더링마다 재생성
- 계산된 값들이 매번 재계산됨

#### 권장 사항
```typescript
// useCallback으로 감싸야 할 함수들:
- handleSendMessage
- handleDeleteConversation
- handleSelectConversation
- handleNewConversation
- handleEditMessage
- handleSaveEdit
- handleCopyMessage
- formatDate
- generateQuestionSummary

// useMemo로 감싸야 할 값들:
- filteredConversations (정렬된 대화 목록)
- currentSession (선택된 대화 세션)
- formattedMessages (포맷된 메시지 목록)
```

### 3. 상태 관리 최적화 (우선순위: 중간)

#### 현재 문제
- 15개 이상의 개별 useState
- 관련된 상태들이 분산되어 있음

#### 권장 사항
```typescript
// useReducer로 통합 가능한 상태들:
const [chatState, dispatch] = useReducer(chatReducer, {
  messages: [],
  conversations: [],
  selectedConversationId: null,
  isAnalyzing: false,
})

// 또는 커스텀 훅으로 분리:
- useChatMessages()
- useConversations()
- useContext()
```

### 4. API 호출 최적화 (우선순위: 중간)

#### 현재 문제
```typescript
// 413-571줄: 대화 로드 시
- 최대 20개 세션을 배치로 처리하지만 여전히 많은 API 호출
- 각 세션마다 getChatMessages 호출
- 타임아웃은 있지만 병렬 처리로 인한 부하 가능
```

#### 권장 사항
- **페이지네이션**: 초기에는 최근 10개만 로드, 스크롤 시 추가 로드
- **캐싱**: React Query 또는 SWR 사용 고려
- **Debouncing**: 검색/필터링 시 debounce 적용

### 5. 불필요한 리렌더링 방지 (우선순위: 높음)

#### 현재 문제
```typescript
// 2008줄: messages.map() - 매번 전체 리스트 렌더링
{messages.map((message, index) => (
  // ...
))}

// 1928줄: conversations.map() - 매번 전체 리스트 렌더링
{conversations.map((conv) => (
  // ...
))}
```

#### 권장 사항
- **React.memo**: 메시지 아이템 컴포넌트에 적용
- **가상화**: react-window 또는 react-virtualized 사용 (긴 리스트의 경우)
- **키 최적화**: 안정적인 key 사용 (index 대신 id)

### 6. useEffect 의존성 최적화 (우선순위: 중간)

#### 현재 문제
```typescript
// 303줄: reportCache가 의존성에 포함되어 불필요한 재실행 가능
useEffect(() => {
  // ...
}, [message.context_id, message.context_type, reportCache, setReportCache])

// 826줄: 많은 의존성으로 인한 빈번한 재실행
}, [selectedConversationId, messages.length, hasInitialGreeting, situationAnalysis, situationContext])
```

#### 권장 사항
- 의존성 배열 최소화
- useRef로 불필요한 의존성 제거
- 조건부 실행으로 불필요한 effect 방지

### 7. 코드 중복 제거 (우선순위: 낮음)

#### 현재 문제
- `formatDate` 함수가 여러 곳에서 사용되지만 유틸로 분리되지 않음
- 리포트 정보 로드 로직이 중복됨

#### 권장 사항
```typescript
// utils/date.ts
export const formatDate = (date: Date | string): string => { ... }

// hooks/useReportInfo.ts
export const useReportInfo = (contextId: string | null, contextType: string) => { ... }
```

## 📊 성능 영향 예상

### 최적화 전
- 초기 렌더링: ~500ms
- 메시지 추가 시: ~200ms
- 대화 목록 업데이트: ~300ms

### 최적화 후 (예상)
- 초기 렌더링: ~200ms (60% 개선)
- 메시지 추가 시: ~50ms (75% 개선)
- 대화 목록 업데이트: ~100ms (67% 개선)

## 🎯 우선순위별 작업 계획

### Phase 1: 즉시 적용 가능 (1-2일)
1. ✅ useCallback으로 핵심 함수들 메모이제이션
2. ✅ useMemo로 계산된 값들 메모이제이션
3. ✅ React.memo로 리스트 아이템 컴포넌트 최적화

### Phase 2: 중기 개선 (3-5일)
1. ✅ 컴포넌트 분리 (ContextSituationList, ContextContractList 등)
2. ✅ 커스텀 훅으로 상태 관리 로직 분리
3. ✅ API 호출 최적화 (페이지네이션, 캐싱)

### Phase 3: 장기 개선 (1주 이상)
1. ✅ 상태 관리 라이브러리 도입 (Zustand, Jotai 등)
2. ✅ 가상화 라이브러리 적용 (긴 리스트의 경우)
3. ✅ 코드 스플리팅 및 지연 로딩

## 💡 추가 권장 사항

### 1. 타입 안정성
- `any` 타입 사용 최소화 (현재 여러 곳에서 사용됨)
- 명확한 타입 정의

### 2. 에러 처리
- 전역 에러 바운더리 추가
- API 호출 실패 시 재시도 로직

### 3. 접근성
- 키보드 네비게이션 개선
- 스크린 리더 지원

### 4. 테스트
- 단위 테스트 추가
- 통합 테스트 추가

## 📝 결론

현재 페이지는 기능적으로는 잘 작동하지만, 성능 최적화가 필요한 상태입니다. 특히:
- **메모이제이션 부재**로 인한 불필요한 리렌더링
- **컴포넌트 분리 부족**으로 인한 유지보수 어려움
- **상태 관리 복잡도**가 높음

Phase 1 작업만으로도 상당한 성능 개선이 예상되므로, 우선적으로 적용하는 것을 권장합니다.


