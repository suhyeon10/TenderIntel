# API 사용 가이드

Linkus Legal Backend API 사용 가이드입니다. 상세한 API 참조는 [backend/API_REFERENCE.md](./backend/API_REFERENCE.md)를 참고하세요.

## 📑 목차

1. [주요 엔드포인트](#주요-엔드포인트)
2. [cURL 예제](#curl-예제)
3. [Swagger UI 사용](#swagger-ui-사용-권장)

---

## 주요 엔드포인트

### 법률 문서 검색
```bash
GET /api/v2/legal/search?q=근로시간&limit=5&doc_type=law
```

### 계약서 분석
```bash
POST /api/v2/legal/analyze-contract
Content-Type: multipart/form-data
file: [계약서 PDF]
```

### 계약서 조회
```bash
GET /api/v2/legal/contracts/{doc_id}
```

### 계약서 히스토리 조회
```bash
GET /api/v2/legal/contracts/history?limit=20&offset=0
X-User-Id: [사용자 ID] (필수)
```

### 계약서 비교
```bash
POST /api/v2/legal/compare-contracts
```

### 조항 리라이트
```bash
POST /api/v2/legal/rewrite-clause
```

### 상황별 법률 분석
```bash
POST /api/v2/legal/analyze-situation
```

---

## cURL 예제

### 헬스 체크
```bash
curl http://localhost:8000/api/health
```

### 법률 검색
```bash
curl "http://localhost:8000/api/v2/legal/search?q=근로시간&limit=5"
```

### 계약서 분석
```bash
curl -X POST "http://localhost:8000/api/v2/legal/analyze-contract" \
  -F "file=@contract.pdf" \
  -F "title=프리랜서 계약서" \
  -F "doc_type=employment" \
  -H "X-User-Id: [사용자 ID]"
```

---

## Swagger UI 사용 (권장)

1. 브라우저에서 http://localhost:8000/docs 접속
2. 각 API 엔드포인트를 클릭하여 "Try it out" 버튼 클릭
3. 필요한 파라미터 입력 후 "Execute" 버튼 클릭
4. 응답 결과 확인

---

## 추가 정보

- 상세한 API 참조: [backend/API_REFERENCE.md](./backend/API_REFERENCE.md)
- 테스트 가이드: [backend/TESTING.md](./backend/TESTING.md)

