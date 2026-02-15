# 테스트 가이드

Linkus Public RAG Backend API를 테스트하는 방법을 안내합니다.

## 📑 목차

1. [Swagger UI를 사용한 테스트](#swagger-ui를-사용한-테스트-권장)
2. [cURL을 사용한 테스트 예제](#curl을-사용한-테스트-예제)
3. [Python 클라이언트를 사용한 테스트 예제](#python-클라이언트를-사용한-테스트-예제)

---

## Swagger UI를 사용한 테스트 (권장)

가장 간편한 방법은 Swagger UI를 사용하는 것입니다.

### 사용 방법

1. 서버를 실행합니다
2. 브라우저에서 http://localhost:8000/docs 접속
3. 각 API 엔드포인트를 클릭하여 "Try it out" 버튼 클릭
4. 필요한 파라미터 입력 후 "Execute" 버튼 클릭
5. 응답 결과 확인

### 장점

- 별도의 도구 설치 불필요
- API 문서와 함께 테스트 가능
- 요청/응답 형식을 시각적으로 확인 가능

---

## cURL을 사용한 테스트 예제

### 1. 헬스 체크

```bash
curl http://localhost:8000/api/health
```

**예상 응답:**
```json
{
  "status": "ok",
  "message": "Linkus Public RAG API is running"
}
```

---

### 2. 공고 업로드 및 분석

```bash
curl -X POST "http://localhost:8000/api/announcements/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_announcement.pdf"
```

**응답 예시:**
```json
{
  "status": "success",
  "message": "공고 분석 완료",
  "data": {
    "announcement_id": "anno_abc123",
    "analysis": {
      "project_name": "프로젝트명",
      "budget_range": "5억 원",
      "duration": "6개월",
      "essential_skills": ["React", "Node.js"],
      "preferred_skills": ["AWS", "Docker"],
      "summary": "프로젝트 요약..."
    }
  }
}
```

---

### 3. 팀 매칭

```bash
curl "http://localhost:8000/api/announcements/anno_abc123/match"
```

**응답 예시:**
```json
{
  "status": "success",
  "message": "3개 팀 매칭 완료",
  "data": {
    "matched_teams": [
      {
        "team_id": "team_001",
        "name": "프론트엔드 전문팀",
        "match_score": 85.5,
        "rationale": "✓ React 전문 경력 5년\n✓ 유사 프로젝트 경험 다수\n✓ 높은 평점(4.8/5.0)",
        "skills": ["React", "TypeScript", "Next.js"],
        "rating": 4.8,
        "experience_years": 5
      }
    ]
  }
}
```

---

### 4. 견적서 생성

```bash
curl -X POST "http://localhost:8000/api/estimates/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "announcement_id": "anno_abc123",
    "team_id": "team_001"
  }'
```

**응답 예시:**
```json
{
  "status": "success",
  "message": "견적서 생성 완료",
  "data": {
    "estimate": "## 1. 사업 개요\n...\n## 2. 투입 인력 및 비용\n...\n## 3. 세부 견적 내역\n...\n## 4. 총 예상 금액\n..."
  }
}
```

---

### 5. 계약서 분석

```bash
curl -X POST "http://localhost:8000/api/v2/legal/analyze-contract" \
  -H "X-User-Id: user-123" \
  -F "file=@contract.pdf" \
  -F "title=근로계약서" \
  -F "doc_type=employment"
```

**응답 예시:**
```json
{
  "docId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "근로계약서",
  "contractText": "제1조 (근로기간)...",
  "riskScore": 65.5,
  "riskLevel": "medium",
  "summary": "이 계약서는 전반적으로...",
  "issues": [
    {
      "id": "issue-1",
      "category": "working_hours",
      "severity": "high",
      "summary": "근로시간 조항에 문제가 있습니다",
      "explanation": "주 52시간 근무를 초과하는 조항이...",
      "legalBasis": ["근로기준법 제50조..."],
      "suggestedRevision": "주 40시간을 초과하지 않도록..."
    }
  ],
  "clauses": [...],
  "highlightedTexts": [...],
  "createdAt": "2024-01-01T00:00:00Z"
}
```

---

### 6. 계약서 히스토리 조회

```bash
curl "http://localhost:8000/api/v2/legal/contracts/history?limit=10&offset=0" \
  -H "X-User-Id: user-123"
```

**응답 예시:**
```json
[
  {
    "doc_id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "근로계약서",
    "original_filename": "contract.pdf",
    "risk_score": 65.5,
    "risk_level": "medium",
    "summary": "이 계약서는 전반적으로...",
    "created_at": "2024-01-01T00:00:00Z",
    "issue_count": 5
  }
]
```

---

## Python 클라이언트를 사용한 테스트 예제

Python `requests` 라이브러리를 사용한 예제입니다.

```python
import requests

BASE_URL = "http://localhost:8000"

# 1. 공고 업로드
with open('sample_announcement.pdf', 'rb') as f:
    response = requests.post(
        f'{BASE_URL}/api/announcements/upload',
        files={'file': f}
    )
    result = response.json()
    announcement_id = result['data']['announcement_id']
    print(f"공고 ID: {announcement_id}")

# 2. 팀 매칭
response = requests.get(
    f'{BASE_URL}/api/announcements/{announcement_id}/match'
)
matched_teams = response.json()
print(f"매칭된 팀 수: {len(matched_teams['data']['matched_teams'])}")

# 3. 견적 생성
response = requests.post(
    f'{BASE_URL}/api/estimates/generate',
    json={
        'announcement_id': announcement_id,
        'team_id': 'team_001'
    }
)
estimate = response.json()
print(f"견적서 생성 완료: {estimate['message']}")

# 4. 계약서 분석
with open('contract.pdf', 'rb') as f:
    response = requests.post(
        f'{BASE_URL}/api/v2/legal/analyze-contract',
        headers={'X-User-Id': 'user-123'},
        files={'file': f},
        data={
            'title': '근로계약서',
            'doc_type': 'employment'
        }
    )
    contract_analysis = response.json()
    print(f"위험도 점수: {contract_analysis['riskScore']}")

# 5. 계약서 히스토리 조회
response = requests.get(
    f'{BASE_URL}/api/v2/legal/contracts/history',
    headers={'X-User-Id': 'user-123'},
    params={'limit': 10, 'offset': 0}
)
history = response.json()
print(f"히스토리 항목 수: {len(history)}")
```

---

## 테스트 팁

1. **서버 실행 확인**: 테스트 전에 서버가 정상적으로 실행 중인지 확인하세요
2. **파일 경로 확인**: 파일 업로드 시 파일 경로가 올바른지 확인하세요
3. **환경 변수 확인**: 필요한 환경 변수가 설정되어 있는지 확인하세요
4. **에러 응답 확인**: 에러가 발생하면 응답 본문을 확인하여 원인을 파악하세요

---

## 추가 정보

- API 엔드포인트 상세 설명은 [API_REFERENCE.md](./API_REFERENCE.md)를 참고하세요
- 문제 해결은 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)를 참고하세요

