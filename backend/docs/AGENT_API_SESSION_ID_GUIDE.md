# Agent API에서 SessionID 확인 방법 (Quick 페이지 기준)

## 📍 Quick 페이지에서 SessionID 확인 방법

### 1. 현재 선택된 대화의 SessionID 가져오기

Quick 페이지에서는 다음과 같이 sessionID를 확인할 수 있습니다:

```typescript
// 현재 선택된 대화 찾기
const selectedConversation = conversations.find(
  c => c.id === selectedConversationId
)

// 실제 DB의 sessionId (legal_chat_sessions.id)
const sessionId = selectedConversation?.sessionId
```

### 2. 코드 위치

**파일**: `src/app/legal/assist/quick/page.tsx`

**관련 변수:**
- `selectedConversationId`: 프론트엔드에서 사용하는 로컬 ID (예: `"session-uuid"`)
- `conversations`: 대화 세션 배열
- `conversations[].sessionId`: 실제 DB의 `legal_chat_sessions.id` (Agent API에서 사용)

### 3. SessionID 구조

```typescript
interface ConversationSession {
  id: string              // 프론트엔드 로컬 ID: "session-{uuid}"
  sessionId: string       // 실제 DB ID (legal_chat_sessions.id): "{uuid}"
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}
```

### 4. Agent API 호출 예시

```typescript
// handleSendMessage 함수 내에서
const handleSendMessage = async () => {
  // 1. 현재 선택된 대화 찾기
  const selectedConversation = conversations.find(
    c => c.id === selectedConversationId
  )
  
  // 2. SessionID 가져오기
  const sessionId = selectedConversation?.sessionId || null
  
  // 3. Agent API 호출
  const formData = new FormData()
  formData.append('mode', 'plain')
  formData.append('message', inputMessage)
  
  if (sessionId) {
    formData.append('sessionId', sessionId)  // ✅ 실제 DB ID 사용
  }
  
  const response = await fetch('/api/v2/legal/agent/chat', {
    method: 'POST',
    headers: {
      'X-User-Id': userId,
    },
    body: formData,
  })
  
  const result = await response.json()
  
  // 4. 응답에서 받은 sessionId로 업데이트 (첫 요청인 경우)
  if (result.sessionId && !sessionId) {
    // conversations 배열 업데이트
    const updatedConversation = {
      ...selectedConversation,
      sessionId: result.sessionId,  // 새로 생성된 sessionId 저장
    }
    // ... 상태 업데이트
  }
}
```

### 5. 주의사항

1. **첫 요청**: `sessionId`가 없으면 Agent API가 자동으로 새 세션을 생성하고 `sessionId`를 반환합니다.
2. **후속 요청**: 같은 `sessionId`를 사용하여 대화 이력을 유지합니다.
3. **로컬 ID vs DB ID**: 
   - `selectedConversationId`: 프론트엔드에서만 사용 (`"session-{uuid}"`)
   - `sessionId`: Agent API에 전달하는 실제 DB ID (`"{uuid}"`)

### 6. 세션 생성 흐름

```typescript
// 첫 메시지 전송 시
if (!selectedConversationId) {
  // 1. Agent API 호출 (sessionId 없음)
  const response = await fetch('/api/v2/legal/agent/chat', {
    method: 'POST',
    body: formData,  // sessionId 없음
  })
  
  const result = await response.json()
  
  // 2. 응답에서 받은 sessionId로 대화 세션 생성
  const newConversation: ConversationSession = {
    id: `session-${result.sessionId}`,  // 프론트엔드 ID
    sessionId: result.sessionId,         // 실제 DB ID
    title: generateTitle(inputMessage),
    messages: [...],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  
  setConversations([...conversations, newConversation])
  setSelectedConversationId(newConversation.id)
}

// 후속 메시지 전송 시
else {
  const selectedConversation = conversations.find(
    c => c.id === selectedConversationId
  )
  
  // 기존 sessionId 사용
  formData.append('sessionId', selectedConversation.sessionId)
  
  const response = await fetch('/api/v2/legal/agent/chat', {
    method: 'POST',
    body: formData,  // sessionId 포함
  })
}
```

### 7. 디버깅 팁

```typescript
// 콘솔에서 확인
console.log('Selected Conversation ID:', selectedConversationId)
console.log('Actual Session ID:', 
  conversations.find(c => c.id === selectedConversationId)?.sessionId
)

// Agent API 호출 전 확인
if (!sessionId) {
  console.log('새 세션 생성 예정')
} else {
  console.log('기존 세션 사용:', sessionId)
}
```

---

## 🔄 Quick 페이지와 Agent API 통합 예시

### 전체 흐름

```typescript
// 1. 사용자가 메시지 입력
const handleSendMessage = async () => {
  const message = inputMessage.trim()
  if (!message) return
  
  // 2. 현재 세션 찾기
  let currentSession = conversations.find(
    c => c.id === selectedConversationId
  )
  
  // 3. SessionID 준비
  let sessionId: string | null = null
  if (currentSession) {
    sessionId = currentSession.sessionId || null
  }
  
  // 4. Agent API 호출
  const formData = new FormData()
  formData.append('mode', 'plain')  // 또는 'contract', 'situation'
  formData.append('message', message)
  
  if (sessionId) {
    formData.append('sessionId', sessionId)
  }
  
  // 5. API 호출
  const response = await fetch(`${API_BASE}/api/v2/legal/agent/chat`, {
    method: 'POST',
    headers: {
      'X-User-Id': userId,
    },
    body: formData,
  })
  
  const result = await response.json()
  
  // 6. 세션 업데이트
  if (result.sessionId) {
    if (!currentSession) {
      // 새 세션 생성
      const newSession: ConversationSession = {
        id: `session-${result.sessionId}`,
        sessionId: result.sessionId,
        title: generateTitle(message),
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setConversations([...conversations, newSession])
      setSelectedConversationId(newSession.id)
      currentSession = newSession
    } else if (currentSession.sessionId !== result.sessionId) {
      // sessionId 업데이트 (첫 요청에서 생성된 경우)
      currentSession.sessionId = result.sessionId
    }
  }
  
  // 7. 메시지 추가
  const userMessage: ChatMessage = {
    id: `msg-${Date.now()}`,
    role: 'user',
    content: message,
    timestamp: new Date(),
  }
  
  const assistantMessage: ChatMessage = {
    id: `msg-${Date.now() + 1}`,
    role: 'assistant',
    content: result.answerMarkdown,
    timestamp: new Date(),
  }
  
  currentSession.messages.push(userMessage, assistantMessage)
  setConversations([...conversations])
}
```

---

## ✅ 체크리스트

Agent API 통합 시 확인사항:

- [ ] `selectedConversationId`로 현재 대화 찾기
- [ ] `conversations[].sessionId`로 실제 DB ID 가져오기
- [ ] 첫 요청 시 `sessionId` 없이 호출 (자동 생성)
- [ ] 후속 요청 시 `sessionId` 포함하여 호출
- [ ] 응답의 `sessionId`로 대화 세션 업데이트
- [ ] 메시지 히스토리 자동 로드 (최근 30개)

