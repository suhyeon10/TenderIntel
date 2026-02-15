# 테스트 가이드

## 🧪 테스트 실행 방법

### 1. Frontend RAG 테스트

#### 수동 테스트
```typescript
// 브라우저 콘솔 또는 개발자 도구에서
import { FrontendRAG } from '@/lib/rag/frontend-rag'

const rag = new FrontendRAG()

// 메타데이터 추출 테스트
const metadata = await rag.extractMetadata('doc_123')
console.log('메타데이터:', metadata)

// 빠른 검색 테스트
const results = await rag.quickSearch('React 프로젝트', {
  budgetMin: 10000000,
  budgetMax: 50000000,
})
console.log('검색 결과:', results)
```

#### API 테스트
```bash
# 메타데이터 추출 API 테스트
curl -X POST http://localhost:3000/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "summary",
    "query": "이 공고의 핵심 요구사항을 요약해주세요",
    "docIds": [1]
  }'
```

### 2. Backend RAG 테스트

#### 서버 실행
```bash
cd backend
python main.py
```

#### API 테스트 (Swagger UI)
1. 브라우저에서 http://localhost:8000/docs 접속
2. 각 API 엔드포인트 클릭
3. "Try it out" 버튼 클릭
4. 파라미터 입력 후 "Execute" 클릭

#### cURL 테스트
```bash
# 헬스 체크
curl http://localhost:8000/api/health

# 공고 업로드
curl -X POST "http://localhost:8000/api/announcements/upload" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample.pdf"

# 분석 작업 시작
curl -X POST "http://localhost:8000/api/analysis/start" \
  -H "Content-Type: application/json" \
  -d '{"doc_id": "doc_123"}'

# 진행 상황 조회
curl "http://localhost:8000/api/analysis/status/{job_id}"
```

### 3. 통합 워크플로우 테스트

#### Frontend에서 테스트
```typescript
import { BiddingWorkflow } from '@/lib/workflows/bidding-workflow'

const workflow = new BiddingWorkflow()

// 진행 상황 콜백
const result = await workflow.processAnnouncement(
  file,
  (progress) => {
    console.log(`진행률: ${progress.progress}%`)
    console.log(`단계: ${progress.phase}`)
    console.log(`메시지: ${progress.message}`)
  }
)

console.log('결과:', result)
```

### 4. 데이터베이스 테스트

#### 테이블 확인
```sql
-- Supabase SQL Editor에서 실행

-- 공고 메타데이터 확인
SELECT * FROM announcement_metadata LIMIT 5;

-- 입찰 이력 확인
SELECT * FROM bidding_history LIMIT 5;

-- 견적 템플릿 확인
SELECT * FROM estimate_templates LIMIT 5;
```

#### RLS 정책 테스트
```sql
-- 현재 사용자로 조회 테스트
SELECT * FROM announcement_metadata;
-- 자신의 문서만 조회되는지 확인
```

## 📊 테스트 체크리스트

### Frontend
- [ ] Frontend RAG 메타데이터 추출
- [ ] 빠른 검색 기능
- [ ] 에러 처리
- [ ] 진행 상황 표시 컴포넌트

### Backend
- [ ] 서버 시작 확인
- [ ] 헬스 체크
- [ ] 공고 업로드
- [ ] 분석 작업 시작
- [ ] 진행 상황 스트리밍
- [ ] 팀 매칭
- [ ] 견적서 생성

### 통합
- [ ] 전체 워크플로우
- [ ] 데이터베이스 연동
- [ ] 에러 복구

## 🐛 문제 해결

### Frontend 오류
- **환경 변수 로드 안됨**: `.env.local` 파일 확인
- **API 호출 실패**: CORS 설정 확인
- **타입 오류**: `npm run build`로 타입 체크

### Backend 오류
- **모듈을 찾을 수 없음**: 가상환경 활성화 확인
- **API 키 오류**: `.env` 파일 확인
- **포트 충돌**: 다른 포트 사용

### 데이터베이스 오류
- **테이블 없음**: 마이그레이션 실행 확인
- **RLS 오류**: 정책 확인
- **권한 오류**: 사용자 권한 확인

