# Legal RAG 모드 가이드

법률/계약 문서를 RAG로 인덱싱하고 검색/분석할 수 있는 모드입니다.

## 📑 목차

1. [데이터 폴더 구조](#데이터-폴더-구조)
2. [인덱싱 방법](#인덱싱-방법)
3. [검색/분석 API](#검색분석-api)
4. [특징](#특징)

---

## 데이터 폴더 구조

```
backend/data/legal/
├── laws/              # 근로기준법, 노동법 요약, 청년 노동 가이드
├── standard_contracts/ # 표준 근로·용역·프리랜서·콘텐츠 계약서
├── manuals/           # 직장 내 괴롭힘/성희롭 등 매뉴얼
└── cases/             # 가공된 시나리오/케이스 텍스트 (직접 만든 md/txt)
```

---

## 인덱싱 방법

```bash
cd backend

# 법률 문서 인덱싱
python scripts/batch_ingest.py data/legal --mode legal

# 특정 폴더만 인덱싱 (예: laws 폴더만)
python scripts/batch_ingest.py data/legal/laws --mode legal

# 특정 형식만 처리 (예: PDF만)
python scripts/batch_ingest.py data/legal --mode legal --extensions .pdf
```

---

## 검색/분석 API

### 1. 법률 문서 검색

```bash
GET /api/v2/legal/search?q=근로시간&limit=5&doc_type=law
```

**응답:**
```json
{
  "results": [
    {
      "legal_document_id": "uuid",
      "section_title": "제1조 (목적)",
      "text": "청크 텍스트...",
      "score": 0.85,
      "source": "moel",
      "doc_type": "law",
      "title": "근로기준법"
    }
  ],
  "count": 5,
  "query": "근로시간"
}
```

### 2. 계약서 분석 (v2 API)

```bash
POST /api/v2/legal/analyze-contract
Content-Type: multipart/form-data
X-User-Id: [사용자 ID] (선택)
Authorization: Bearer [Supabase Access Token] (선택)

file: [계약서 PDF]
title: "프리랜서 계약서" (선택)
doc_type: "employment" | "freelance" (선택)
```

**응답 (v2 형식):**
```json
{
  "docId": "uuid",
  "title": "프리랜서 계약서",
  "riskScore": 65.5,
  "riskLevel": "high",
  "sections": {
    "working_hours": 70,
    "wage": 60,
    "probation_termination": 80,
    "stock_option_ip": 50
  },
  "issues": [
    {
      "id": "issue-1",
      "category": "probation_termination",
      "severity": "high",
      "summary": "계약 해지 조항",
      "originalText": "계약 해지 조항 원문...",
      "legalBasis": ["근로기준법 제1조"],
      "explanation": "일방적 해지 가능 조항이 포함되어 있습니다",
      "suggestedRevision": "수정 제안 텍스트..."
    }
  ],
  "summary": "전체 요약...",
  "retrievedContexts": [
    {
      "sourceType": "law",
      "title": "근로기준법",
      "snippet": "관련 법률 조문..."
    }
  ],
  "contractText": "계약서 전체 원문 텍스트...",
  "createdAt": "2025-11-18T00:00:00Z"
}
```

**중요 사항:**
- 백엔드 라우터 등록 순서: 더 구체적인 경로(`/api/v2/legal`)를 가진 라우터가 먼저 등록되어야 합니다
- `contractText` 필드에 계약서 전체 원문이 포함됩니다
- 사용자 인증이 필요한 경우 `X-User-Id`와 `Authorization` 헤더를 포함하세요

### 3. 상황별 법률 분석

```bash
POST /api/v2/legal/analyze-situation
Content-Type: application/json

{
  "situation": "인턴 기간 중 해고당했습니다",
  "category": "probation",
  "employment_type": "intern",
  "work_period": "under_3_months",
  "social_insurance": ["employment", "health"]
}
```

---

## 특징

- **제n조 기준 청킹**: 법률 문서를 조(제n조) 단위로 자동 분할
- **섹션 제목 보존**: 각 청크에 조문 제목(section_title) 포함
- **벡터 검색**: pgvector 기반 유사도 검색
- **계약서 분석**: 업로드한 계약서의 위험 조항 자동 분석
- **상황별 맞춤 분석**: 고용 형태, 근무 기간 등 상세 정보 기반 분석

---

## 추가 정보

- API 상세 설명은 [backend/API_REFERENCE.md](./backend/API_REFERENCE.md)를 참고하세요
- 환경 설정은 [SETUP.md](./SETUP.md)를 참고하세요

