# Agent 기반 통합 챗 API 명세서

## 📋 개요

`POST /api/v2/legal/agent/chat` 엔드포인트는 일반 Q&A, 계약서 분석, 상황 분석을 통합한 Agent 기반 챗 API입니다.

---

## 🔧 공통 입력 (모든 모드)

### Headers
- `X-User-Id` (필수): 사용자 ID

### Form Data (multipart/form-data)
- `mode` (필수): `"plain"` | `"contract"` | `"situation"`
- `message` (필수): 사용자 질문 텍스트
- `sessionId` (선택): 기존 `linkus_legal_chat_sessions.id` (없으면 새 세션 생성)

---

## 📥 모드별 입력

### 1. `mode=plain` (일반 Q&A)

**입력:**
```typescript
{
  mode: "plain",
  message: "연차휴가는 어떻게 신청하나요?",
  sessionId?: string  // 선택
}
```

**특징:**
- 추가 입력 없음
- RAG 기반 일반 법률 상담

---

### 2. `mode=contract` (계약서 분석 + 챗)

#### 첫 요청 (파일 업로드)

**입력:**
```typescript
{
  mode: "contract",
  message: "이 계약서의 위험도는 어느 정도인가요?",
  file: File,  // PDF/HWPX/이미지 파일
  sessionId?: string
}
```

**처리 과정:**
1. 파일 업로드 → 텍스트 추출 (OCR)
2. 계약서 분석 실행 (위험도, 이슈, 조항 분석)
3. DB에 분석 결과 저장
4. 분석 결과를 컨텍스트로 활용하여 답변 생성

#### 후속 요청 (기존 분석 참고)

**입력:**
```typescript
{
  mode: "contract",
  message: "이 조항은 법적으로 문제가 있나요?",
  contractAnalysisId: "uuid-string",  // 첫 요청에서 받은 ID
  sessionId: "uuid-string"  // 같은 세션 ID
}
```

**처리 과정:**
1. 기존 분석 결과 조회
2. 분석 결과를 컨텍스트로 활용하여 답변 생성

---

### 3. `mode=situation` (상황 분석 + 챗)

#### 첫 요청 (상황 폼 제출)

**입력:**
```typescript
{
  mode: "situation",
  message: "이 상황에서 어떻게 해야 하나요?",
  situationTemplateKey: "employment_issue",  // 템플릿 키
  situationForm: JSON.stringify({  // JSON 문자열
    situation: "회사에서 무단으로 연차휴가를 거부했습니다.",
    category: "leave",
    employmentType: "regular",
    workPeriod: "1년 이상",
    socialInsurance: ["health", "employment"]
  }),
  sessionId?: string
}
```

**situationForm 구조:**
```typescript
{
  situation: string;  // 상황 설명 (필수)
  category?: string;  // 카테고리 힌트
  employmentType?: string;  // 고용 형태
  workPeriod?: string;  // 근무 기간
  socialInsurance?: string[];  // 사회보험 가입 현황
}
```

**처리 과정:**
1. 폼 데이터로 상황 분석 실행 (LangGraph 워크플로우)
2. 유사 케이스 RAG 검색
3. 법적 판단 기준, 행동 가이드 생성
4. DB에 분석 결과 저장
5. 분석 결과를 컨텍스트로 활용하여 답변 생성

#### 후속 요청 (기존 분석 참고)

**입력:**
```typescript
{
  mode: "situation",
  message: "이 상황에서 회사에 어떻게 말해야 하나요?",
  situationAnalysisId: "uuid-string",  // 첫 요청에서 받은 ID
  sessionId: "uuid-string"  // 같은 세션 ID
}
```

**처리 과정:**
1. 기존 분석 결과 조회
2. 분석 결과를 컨텍스트로 활용하여 답변 생성

---

## 📤 출력 (모든 모드 공통)

### 응답 구조

```typescript
{
  sessionId: string;  // linkus_legal_chat_sessions.id
  mode: "plain" | "contract" | "situation";
  
  // 분석 ID (해당 모드에서만 값 있음)
  contractAnalysisId?: string;
  situationAnalysisId?: string;
  
  // AI 답변 (마크다운 형식)
  answerMarkdown: string;
  
  // 사용된 리포트 목록
  usedReports: Array<{
    type: "contract" | "situation";
    analysisId: string;
    findingsIds?: string[];
  }>;
  
  // 사용된 소스 목록 (RAG 검색 결과)
  usedSources: Array<{
    documentTitle: string;
    fileUrl?: string;
    sourceType: "law" | "case" | "standard_contract" | ...;
    similarityScore?: number;
  }>;
  
  // 분석 요약 (해당 모드에서만 값 있음)
  contractAnalysis?: {
    id: string;
    title?: string;
    riskScore?: number;
    riskLevel?: "low" | "medium" | "high";
    summary?: string;
  };
  
  situationAnalysis?: {
    id: string;
    title?: string;
    riskScore?: number;
    riskLevel?: "low" | "medium" | "high";
    summary?: string;
  };
}
```

---

## 📝 사용 예시

### 예시 1: 일반 Q&A

**요청:**
```bash
curl -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: user-123" \
  -F "mode=plain" \
  -F "message=연차휴가는 어떻게 신청하나요?"
```

**응답:**
```json
{
  "sessionId": "session-uuid",
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

### 예시 2: 계약서 분석 (첫 요청)

**요청:**
```bash
curl -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: user-123" \
  -F "mode=contract" \
  -F "message=이 계약서의 위험도는 어느 정도인가요?" \
  -F "file=@contract.pdf"
```

**응답:**
```json
{
  "sessionId": "session-uuid",
  "mode": "contract",
  "contractAnalysisId": "analysis-uuid",
  "answerMarkdown": "## 계약서 위험도 분석\n\n이 계약서는...",
  "usedReports": [
    {
      "type": "contract",
      "analysisId": "analysis-uuid"
    }
  ],
  "contractAnalysis": {
    "id": "analysis-uuid",
    "title": "contract.pdf",
    "riskScore": 65,
    "riskLevel": "medium",
    "summary": "계약서 분석 결과..."
  }
}
```

### 예시 3: 상황 분석 (첫 요청)

**요청:**
```bash
curl -X POST "http://localhost:8000/api/v2/legal/agent/chat" \
  -H "X-User-Id: user-123" \
  -F "mode=situation" \
  -F "message=이 상황에서 어떻게 해야 하나요?" \
  -F "situationTemplateKey=employment_issue" \
  -F "situationForm={\"situation\":\"회사에서 무단으로 연차휴가를 거부했습니다.\",\"category\":\"leave\"}"
```

**응답:**
```json
{
  "sessionId": "session-uuid",
  "mode": "situation",
  "situationAnalysisId": "analysis-uuid",
  "answerMarkdown": "## 상황 분석 결과\n\n이 상황은...",
  "usedReports": [
    {
      "type": "situation",
      "analysisId": "analysis-uuid"
    }
  ],
  "situationAnalysis": {
    "id": "analysis-uuid",
    "riskScore": 70,
    "riskLevel": "high",
    "summary": "상황 분석 결과..."
  }
}
```

---

## 🔄 세션 관리

- **첫 요청**: `sessionId` 없으면 자동으로 새 세션 생성
- **후속 요청**: 같은 `sessionId` 사용하여 대화 이력 유지
- **대화 히스토리**: 최근 30개 메시지만 컨텍스트로 사용

---

## ⚠️ 주의사항

1. **파일 업로드**: `mode=contract` 첫 요청 시 `file` 필수
2. **상황 폼**: `mode=situation` 첫 요청 시 `situationTemplateKey`와 `situationForm` 필수
3. **사용자 인증**: `X-User-Id` 헤더 필수
4. **세션 ID**: 후속 요청 시 첫 요청에서 받은 `sessionId` 사용 권장

---

## 📊 모드별 비교표

| 항목 | plain | contract | situation |
|------|-------|----------|-----------|
| 파일 업로드 | ❌ | ✅ (첫 요청) | ❌ |
| 폼 데이터 | ❌ | ❌ | ✅ (첫 요청) |
| 분석 실행 | ❌ | ✅ | ✅ |
| 분석 ID 반환 | ❌ | ✅ | ✅ |
| RAG 검색 | ✅ | ✅ | ✅ |
| 대화 히스토리 | ✅ | ✅ | ✅ |

