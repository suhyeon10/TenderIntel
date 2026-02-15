# Agent API 테스트 예시 모음

## 📋 개요

`POST /api/v2/legal/agent/chat` 엔드포인트의 각 모드별 테스트 예시입니다.

**Base URL**: `http://localhost:8000` (또는 실제 서버 URL)

---

## 🔧 공통 설정

### Headers
```bash
X-User-Id: test-user-123
```

### Content-Type
```
multipart/form-data
```

---

## 📥 모드별 테스트 예시

### 1. `mode=plain` (일반 Q&A)

#### 첫 요청 (새 세션 생성)

**curl:**
```bash
curl -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: test-user-123" \
  -F "mode=plain" \
  -F "message=연차휴가는 어떻게 신청하나요?"
```

**JavaScript/TypeScript:**
```typescript
const formData = new FormData()
formData.append('mode', 'plain')
formData.append('message', '연차휴가는 어떻게 신청하나요?')

const response = await fetch('http://localhost:8000/api/v2/legal/agent/chat', {
  method: 'POST',
  headers: {
    'X-User-Id': 'test-user-123',
  },
  body: formData,
})

const result = await response.json()
console.log('Session ID:', result.sessionId)
console.log('Answer:', result.answerMarkdown)
```

**예상 응답:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "mode": "plain",
  "answerMarkdown": "## 연차휴가 신청 방법\n\n연차휴가는...",
  "usedReports": [],
  "usedSources": [
    {
      "documentTitle": "근로기준법 제60조",
      "sourceType": "law",
      "similarityScore": 0.95
    }
  ]
}
```

#### 후속 요청 (기존 세션 사용)

**curl:**
```bash
curl -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: test-user-123" \
  -F "mode=plain" \
  -F "message=연차휴가 일수는 어떻게 계산하나요?" \
  -F "sessionId=550e8400-e29b-41d4-a716-446655440000"
```

**JavaScript/TypeScript:**
```typescript
const formData = new FormData()
formData.append('mode', 'plain')
formData.append('message', '연차휴가 일수는 어떻게 계산하나요?')
formData.append('sessionId', '550e8400-e29b-41d4-a716-446655440000') // 첫 요청에서 받은 ID

const response = await fetch('http://localhost:8000/api/v2/legal/agent/chat', {
  method: 'POST',
  headers: {
    'X-User-Id': 'test-user-123',
  },
  body: formData,
})

const result = await response.json()
```

---

### 2. `mode=contract` (계약서 분석 + 챗)

#### 첫 요청 (파일 업로드)

**curl:**
```bash
curl -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: test-user-123" \
  -F "mode=contract" \
  -F "message=이 계약서의 위험도는 어느 정도인가요?" \
  -F "file=@/path/to/contract.pdf"
```

**JavaScript/TypeScript:**
```typescript
const fileInput = document.querySelector('input[type="file"]')
const file = fileInput.files[0]

const formData = new FormData()
formData.append('mode', 'contract')
formData.append('message', '이 계약서의 위험도는 어느 정도인가요?')
formData.append('file', file)

const response = await fetch('http://localhost:8000/api/v2/legal/agent/chat', {
  method: 'POST',
  headers: {
    'X-User-Id': 'test-user-123',
  },
  body: formData,
})

const result = await response.json()
console.log('Contract Analysis ID:', result.contractAnalysisId)
console.log('Risk Score:', result.contractAnalysis?.riskScore)
```

**예상 응답:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440001",
  "mode": "contract",
  "contractAnalysisId": "660e8400-e29b-41d4-a716-446655440001",
  "answerMarkdown": "## 계약서 위험도 분석\n\n이 계약서는...",
  "usedReports": [
    {
      "type": "contract",
      "analysisId": "660e8400-e29b-41d4-a716-446655440001"
    }
  ],
  "contractAnalysis": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "title": "contract.pdf",
    "riskScore": 65,
    "riskLevel": "medium",
    "summary": "계약서 분석 결과..."
  }
}
```

#### 후속 요청 (기존 분석 참고)

**curl:**
```bash
curl -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: test-user-123" \
  -F "mode=contract" \
  -F "message=이 조항은 법적으로 문제가 있나요?" \
  -F "contractAnalysisId=660e8400-e29b-41d4-a716-446655440001" \
  -F "sessionId=550e8400-e29b-41d4-a716-446655440001"
```

**JavaScript/TypeScript:**
```typescript
const formData = new FormData()
formData.append('mode', 'contract')
formData.append('message', '이 조항은 법적으로 문제가 있나요?')
formData.append('contractAnalysisId', '660e8400-e29b-41d4-a716-446655440001') // 첫 요청에서 받은 ID
formData.append('sessionId', '550e8400-e29b-41d4-a716-446655440001') // 같은 세션 ID

const response = await fetch('http://localhost:8000/api/v2/legal/agent/chat', {
  method: 'POST',
  headers: {
    'X-User-Id': 'test-user-123',
  },
  body: formData,
})

const result = await response.json()
```

---

### 3. `mode=situation` (상황 분석 + 챗)

#### 첫 요청 (상황 폼 제출)

**curl:**
```bash
curl -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: test-user-123" \
  -F "mode=situation" \
  -F "message=이 상황에서 어떻게 해야 하나요?" \
  -F "situationTemplateKey=employment_issue" \
  -F "situationForm={\"situation\":\"회사에서 무단으로 연차휴가를 거부했습니다.\",\"category\":\"leave\",\"employmentType\":\"regular\",\"workPeriod\":\"1년 이상\",\"socialInsurance\":[\"health\",\"employment\"]}"
```

**JavaScript/TypeScript:**
```typescript
const situationForm = {
  situation: "회사에서 무단으로 연차휴가를 거부했습니다.",  // 필수
  category: "leave",  // 선택
  employmentType: "regular",  // 선택
  workPeriod: "1년 이상",  // 선택
  socialInsurance: ["health", "employment"]  // 선택
}

const formData = new FormData()
formData.append('mode', 'situation')
formData.append('message', '이 상황에서 어떻게 해야 하나요?')
formData.append('situationTemplateKey', 'employment_issue')
formData.append('situationForm', JSON.stringify(situationForm))

const response = await fetch('http://localhost:8000/api/v2/legal/agent/chat', {
  method: 'POST',
  headers: {
    'X-User-Id': 'test-user-123',
  },
  body: formData,
})

const result = await response.json()
console.log('Situation Analysis ID:', result.situationAnalysisId)
console.log('Risk Score:', result.situationAnalysis?.riskScore)
```

**예상 응답:**
```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440002",
  "mode": "situation",
  "situationAnalysisId": "770e8400-e29b-41d4-a716-446655440002",
  "answerMarkdown": "## 상황 분석 결과\n\n이 상황은...",
  "usedReports": [
    {
      "type": "situation",
      "analysisId": "770e8400-e29b-41d4-a716-446655440002"
    }
  ],
  "situationAnalysis": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "riskScore": 70,
    "riskLevel": "high",
    "summary": "상황 분석 결과..."
  }
}
```

#### 후속 요청 (기존 분석 참고)

**curl:**
```bash
curl -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: test-user-123" \
  -F "mode=situation" \
  -F "message=이 상황에서 회사에 어떻게 말해야 하나요?" \
  -F "situationAnalysisId=770e8400-e29b-41d4-a716-446655440002" \
  -F "sessionId=550e8400-e29b-41d4-a716-446655440002"
```

**JavaScript/TypeScript:**
```typescript
const formData = new FormData()
formData.append('mode', 'situation')
formData.append('message', '이 상황에서 회사에 어떻게 말해야 하나요?')
formData.append('situationAnalysisId', '770e8400-e29b-41d4-a716-446655440002') // 첫 요청에서 받은 ID
formData.append('sessionId', '550e8400-e29b-41d4-a716-446655440002') // 같은 세션 ID

const response = await fetch('http://localhost:8000/api/v2/legal/agent/chat', {
  method: 'POST',
  headers: {
    'X-User-Id': 'test-user-123',
  },
  body: formData,
})

const result = await response.json()
```

---

## 📝 상황 분석 폼 데이터 예시

### 예시 1: 직장 내 괴롭힘
```json
{
  "situation": "상사가 반복적으로 사적 심부름을 지시하고, 업무 능력을 부당하게 깎아내리는 발언을 합니다.",
  "category": "harassment",
  "employmentType": "regular",
  "workPeriod": "6개월 이상",
  "socialInsurance": ["health", "employment", "pension"]
}
```

### 예시 2: 임금 체불
```json
{
  "situation": "3개월째 월급을 제대로 받지 못하고 있습니다. 연장근무 수당도 지급되지 않습니다.",
  "category": "wage",
  "employmentType": "regular",
  "workPeriod": "1년 이상",
  "socialInsurance": ["health", "employment"]
}
```

### 예시 3: 부당해고
```json
{
  "situation": "회사에서 통보 없이 계약을 해지했습니다. 사전 통보도 없었고 해고 사유도 명확하지 않습니다.",
  "category": "dismissal",
  "employmentType": "regular",
  "workPeriod": "2년 이상",
  "socialInsurance": ["health", "employment", "pension"]
}
```

### 예시 4: 연차휴가 거부
```json
{
  "situation": "연차휴가 신청을 했는데 회사에서 업무가 바쁘다는 이유로 거부했습니다.",
  "category": "leave",
  "employmentType": "regular",
  "workPeriod": "1년 이상",
  "socialInsurance": ["health", "employment"]
}
```

### 예시 5: 초과근무 수당 미지급
```json
{
  "situation": "주 50시간 이상 근무하는데 초과근무 수당이 제대로 지급되지 않습니다.",
  "category": "overtime",
  "employmentType": "regular",
  "workPeriod": "6개월 이상",
  "socialInsurance": ["health", "employment"]
}
```

**참고:** `SituationRequestV2` 스키마에 따라 다음 필드만 사용 가능합니다:
- `situation` (필수): 상황 설명
- `category` (선택): 카테고리 힌트
- `employmentType` (선택): 고용 형태
- `workPeriod` (선택): 근무 기간
- `companySize` (선택): 회사 규모
- `hasWrittenContract` (선택): 서면 계약서 보유 여부
- `socialInsurance` (선택): 사회보험 가입 현황 (배열)

---

## 🧪 테스트 시나리오

### 시나리오 1: 일반 Q&A 대화 흐름

```bash
# 1. 첫 질문
curl -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: test-user-123" \
  -F "mode=plain" \
  -F "message=연차휴가는 어떻게 신청하나요?"

# 응답에서 sessionId 저장: "550e8400-e29b-41d4-a716-446655440000"

# 2. 후속 질문 (같은 세션)
curl -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: test-user-123" \
  -F "mode=plain" \
  -F "message=연차휴가 일수는 어떻게 계산하나요?" \
  -F "sessionId=550e8400-e29b-41d4-a716-446655440000"

# 3. 추가 질문
curl -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: test-user-123" \
  -F "mode=plain" \
  -F "message=연차휴가를 사용하지 않으면 어떻게 되나요?" \
  -F "sessionId=550e8400-e29b-41d4-a716-446655440000"
```

### 시나리오 2: 계약서 분석 후 질문

```bash
# 1. 계약서 업로드 및 분석
curl -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: test-user-123" \
  -F "mode=contract" \
  -F "message=이 계약서의 위험도는 어느 정도인가요?" \
  -F "file=@contract.pdf"

# 응답에서 sessionId와 contractAnalysisId 저장

# 2. 특정 조항 질문
curl -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: test-user-123" \
  -F "mode=contract" \
  -F "message=이 조항은 법적으로 문제가 있나요?" \
  -F "contractAnalysisId=660e8400-e29b-41d4-a716-446655440001" \
  -F "sessionId=550e8400-e29b-41d4-a716-446655440001"

# 3. 위험 조항 상세 질문
curl -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: test-user-123" \
  -F "mode=contract" \
  -F "message=이 위험 조항을 어떻게 수정해야 하나요?" \
  -F "contractAnalysisId=660e8400-e29b-41d4-a716-446655440001" \
  -F "sessionId=550e8400-e29b-41d4-a716-446655440001"
```

### 시나리오 3: 상황 분석 후 질문

```bash
# 1. 상황 분석 요청
curl -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: test-user-123" \
  -F "mode=situation" \
  -F "message=이 상황에서 어떻게 해야 하나요?" \
  -F "situationTemplateKey=employment_issue" \
  -F "situationForm={\"situation\":\"회사에서 무단으로 연차휴가를 거부했습니다.\",\"category\":\"leave\",\"employmentType\":\"regular\",\"workPeriod\":\"1년 이상\"}"

# 응답에서 sessionId와 situationAnalysisId 저장

# 2. 행동 가이드 질문
curl -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: test-user-123" \
  -F "mode=situation" \
  -F "message=이 상황에서 회사에 어떻게 말해야 하나요?" \
  -F "situationAnalysisId=770e8400-e29b-41d4-a716-446655440002" \
  -F "sessionId=550e8400-e29b-41d4-a716-446655440002"

# 3. 법적 근거 질문
curl -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: test-user-123" \
  -F "mode=situation" \
  -F "message=이 상황의 법적 근거는 무엇인가요?" \
  -F "situationAnalysisId=770e8400-e29b-41d4-a716-446655440002" \
  -F "sessionId=550e8400-e29b-41d4-a716-446655440002"
```

---

## ⚠️ 주의사항

1. **파일 업로드**: `mode=contract` 첫 요청 시 `file` 필수
2. **상황 폼**: `mode=situation` 첫 요청 시 `situationTemplateKey`와 `situationForm` 필수
   - `situationForm`은 JSON 문자열로 전달해야 함
   - `situation` 필드는 필수 (빈 문자열 불가)
   - `weeklyHours`, `isProbation` 등은 지원하지 않음 (스키마에 없음)
3. **사용자 인증**: `X-User-Id` 헤더 필수
4. **세션 ID**: 후속 요청 시 첫 요청에서 받은 `sessionId` 사용 권장
5. **분석 ID**: 후속 요청 시 첫 요청에서 받은 `contractAnalysisId` 또는 `situationAnalysisId` 사용

## 🔧 Validation 오류 해결

### 상황 분석 모드에서 발생하는 오류

**오류 원인:**
- `situationForm`에 `weeklyHours`, `isProbation` 등 지원하지 않는 필드 포함
- `situation` 필드가 빈 문자열이거나 누락

**해결 방법:**
```typescript
// ❌ 잘못된 예시
const situationForm = {
  situation: "상황 설명",
  weeklyHours: 40,  // 지원하지 않는 필드
  isProbation: false  // 지원하지 않는 필드
}

// ✅ 올바른 예시
const situationForm = {
  situation: "상황 설명",  // 필수
  category: "leave",  // 선택
  employmentType: "regular",  // 선택
  workPeriod: "1년 이상",  // 선택
  socialInsurance: ["health", "employment"]  // 선택
}
```

**지원되는 필드 목록:**
- `situation` (필수): 상황 설명
- `category` (선택): 카테고리 힌트
- `employmentType` (선택): 고용 형태
- `workPeriod` (선택): 근무 기간
- `companySize` (선택): 회사 규모
- `hasWrittenContract` (선택): 서면 계약서 보유 여부
- `socialInsurance` (선택): 사회보험 가입 현황 (배열)

---

## 🔍 디버깅 팁

### curl로 디버깅
```bash
# 상세 로그 출력
curl -v -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: test-user-123" \
  -F "mode=plain" \
  -F "message=테스트 메시지" \
  -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n"
```

### JavaScript/TypeScript 디버깅
```typescript
const formData = new FormData()
formData.append('mode', 'plain')
formData.append('message', '테스트 메시지')

console.log('Request:', {
  mode: 'plain',
  message: '테스트 메시지',
})

const response = await fetch('http://localhost:8000/api/v2/legal/agent/chat', {
  method: 'POST',
  headers: {
    'X-User-Id': 'test-user-123',
  },
  body: formData,
})

console.log('Response Status:', response.status)
const result = await response.json()
console.log('Response:', JSON.stringify(result, null, 2))
```

---

## 📚 관련 문서

- [Agent API 명세서](./AGENT_API_SPEC.md)
- [Session ID 가이드](./AGENT_API_SESSION_ID_GUIDE.md)

