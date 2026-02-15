# /legal 경로 페이지 종합 분석

## 📋 페이지 목록

### 1. `/legal` - 홈 페이지
**파일**: `src/app/legal/page.tsx`

**기능**:
- 서비스 소개 및 진입점
- 메인 카피: "첫 계약, AI와 함께 점검해보세요."
- 2개 CTA 버튼:
  - "계약서 업로드해서 분석 받기" → `/legal/contract`
  - "지금 겪는 상황부터 상담 받기" → `/legal/situation`
- 법률 자문 아님 안내 카드

**상태**: 없음 (정적 페이지)

**API 연결**: 없음

**문제점/개선사항**:
- ✅ 간단하고 명확한 구조
- ✅ 반응형 디자인 적용
- ⚠️ 레이아웃 헤더/푸터가 표시되는지 확인 필요

---

### 2. `/legal/contract` - 계약서 업로드 페이지
**파일**: `src/app/legal/contract/page.tsx`

**기능**:
- PDF/HWPX 파일 업로드 (드래그 앤 드롭 지원)
- 파일 선택 후 분석 시작
- 이전 분석 내역 표시 (히스토리)
- 분석 완료 후 `/legal/contract/[docId]`로 리다이렉트

**상태**:
- `file`: 선택된 파일
- `isAnalyzing`: 분석 중 여부
- `history`: 이전 분석 내역 배열
- `loadingHistory`: 히스토리 로딩 중 여부

**API 연결**:
- `analyzeContract(file)` → `/api/v1/legal/analyze-contract`
- `uploadContractFile(file)` → Supabase Storage
- `saveContractAnalysis(...)` → Supabase DB
- `getContractAnalysisHistory(10)` → Supabase DB

**데이터 흐름**:
1. 파일 업로드 → Supabase Storage (선택적, 실패해도 계속)
2. 계약서 분석 → 백엔드 API
3. 분석 결과 저장 → Supabase DB (선택적, 실패해도 계속)
4. 로컬 스토리지에 캐싱 (fallback)
5. 상세 페이지로 리다이렉트

**문제점/개선사항**:
- ✅ 파일 업로드 실패 시에도 분석 계속 진행 (graceful degradation)
- ✅ DB 저장 실패 시에도 로컬 스토리지 사용
- ✅ 히스토리 표시 기능
- ⚠️ Header/Footer 제거됨 (의도된 것)
- ✅ 반응형 디자인

---

### 3. `/legal/contract/[docId]` - 계약서 분석 상세 페이지
**파일**: `src/app/legal/contract/[docId]/page.tsx`

**기능**:
- 계약서 텍스트 표시 (왼쪽 패널)
- 위험 조항 하이라이트
- 분석 결과 표시 (오른쪽 패널)
- AI 법률 상담 챗 (하단, 접기/펼치기 가능)
- "해당 조항 보기" 기능
- "이 부분 질문하기" 기능

**상태**:
- `loading`: 데이터 로딩 중
- `analysisResult`: 분석 결과
- `selectedIssueId`: 선택된 이슈 ID
- `error`: 에러 메시지
- `chatIssueId`: 챗에서 다루는 이슈 ID
- `isChatOpen`: 챗 열림/닫힘 여부

**API 연결**:
- `GET /api/legal/contract-analysis/${docId}` → Supabase DB 조회
- `POST /api/rag/query` (mode: 'legal_contract_chat') → 법률 상담 챗

**데이터 로딩 우선순위**:
1. DB에서 조회 시도
2. 실패 시 로컬 스토리지에서 조회
3. 둘 다 실패 시 에러 표시

**레이아웃**:
- 상단: 위험 조항 개수 배너
- 왼쪽 (50%): 계약서 뷰어 (`ContractViewer`)
- 오른쪽 (50%): 분석 결과 패널 (`AnalysisPanel`)
- 하단: AI 법률 상담 챗 (`ContractChat`, 접기/펼치기 가능)

**문제점/개선사항**:
- ✅ 2-컬럼 레이아웃 (반응형)
- ✅ 채팅 토글 기능
- ✅ "해당 조항 보기" 스크롤 기능
- ✅ 줄바꿈 보존 (PDF 텍스트)
- ✅ DB 우선, 로컬 스토리지 fallback
- ⚠️ 카테고리 매핑 로직이 복잡함 (키워드 기반)
- ✅ 에러 이슈 필터링 ("분석 실패", "LLM 분석" 등)

---

### 4. `/legal/situation` - 상황 기반 진단 페이지
**파일**: `src/app/legal/situation/page.tsx`

**기능**:
- "3개만 하면 끝나는 폼" 구조
- 상황 템플릿 선택 (4개)
- 상황 유형 선택 (칩 버튼, 7개 옵션)
- 한 줄 요약 (필수)
- 자세한 설명 (선택)
- 고급 정보 입력 (아코디언, 선택)
- 분석 결과 표시:
  - 결과 요약 카드
  - 법적 판단 관점
  - 행동 가이드 (체크리스트)
  - 스크립트/템플릿
  - 유사한 사례 추천

**상태**:
- `categoryHint`: 상황 카테고리
- `summary`: 한 줄 요약
- `details`: 자세한 설명
- `showAdvanced`: 고급 정보 표시 여부
- `employmentType`, `workPeriod`, `weeklyHours`, `isProbation`, `socialInsurance`: 고급 정보
- `isAnalyzing`: 분석 중
- `analysisResult`: 분석 결과
- `checkedItems`: 체크리스트 완료 항목

**API 연결**:
- `POST /api/v1/legal/situation/analyze` → 상황 기반 진단

**데이터 흐름**:
1. `summary` + `details`를 합쳐서 `situationText` 생성
2. 백엔드에 요청 전송
3. 분석 결과 표시

**문제점/개선사항**:
- ✅ 진입 장벽 낮춤 (한 줄 요약만 필수)
- ✅ 상황 템플릿 제공
- ✅ 동적 placeholder (카테고리별)
- ✅ 고급 정보 아코디언 (기본 접힘)
- ✅ 체크리스트 기능
- ✅ 스크립트 복사 기능
- ✅ 유사 사례 추천
- ⚠️ 최소 글자수 제한 없음 (한 줄 요약만 필수)

---

### 5. `/legal/cases` - 케이스 갤러리 페이지
**파일**: `src/app/legal/cases/page.tsx`

**기능**:
- 케이스 카드 그리드 표시
- 검색 기능
- 카테고리 필터 (6개)
- 정렬 옵션 (추천순, 최근 추가, 심각도 높은 순)
- 케이스 상세 모달
- "내 상황으로 분석 받기" CTA

**상태**:
- `cases`: 케이스 배열
- `loading`: 로딩 중
- `searchQuery`: 검색어
- `categoryFilter`: 카테고리 필터
- `sortOption`: 정렬 옵션
- `selectedCase`: 선택된 케이스
- `isModalOpen`: 모달 열림 여부

**API 연결**:
- `GET /api/v1/legal/search-cases?query=...&limit=20` → 케이스 검색
- 실패 시 Mock 데이터 사용

**데이터**:
- Mock 데이터: 5개 케이스 (인턴 해고, 무급 야근, 스톡옵션, 프리랜서 대금, 직장 내 괴롭힘)
- 각 케이스에 `category`, `severity`, `keywords`, `legalIssues`, `learnings`, `actions` 포함

**문제점/개선사항**:
- ✅ 그리드 레이아웃 (반응형)
- ✅ 필터/검색/정렬 기능
- ✅ 모달 상세 보기
- ✅ Skeleton 로딩
- ✅ 빈 상태 처리
- ⚠️ 검색 버튼 클릭 시 실제 검색이 실행되지 않음 (검색어 변경 시 자동 검색)
- ⚠️ Mock 데이터 의존 (실제 API 연동 필요)

---

### 6. `/legal/cases/[id]` - 케이스 상세 페이지
**파일**: `src/app/legal/cases/[id]/page.tsx`

**기능**:
- 케이스 상세 정보 표시
- 상황 설명
- 법적 근거
- 추천 대응 방법
- 증거 수집 가이드
- 법률 상담 링크

**상태**:
- `caseId`: URL 파라미터에서 가져옴
- 하드코딩된 Mock 데이터 사용

**API 연결**: 없음 (Mock 데이터만 사용)

**문제점/개선사항**:
- ⚠️ 실제 API 연동 없음
- ⚠️ 모든 케이스에 동일한 데이터 표시
- ✅ UI 구조는 완성됨
- ⚠️ `/legal/cases` 페이지의 모달과 중복 기능

---

### 7. `/legal/analysis` - 분석 페이지 (레거시?)
**파일**: `src/app/legal/analysis/page.tsx`

**기능**:
- 파일 업로드 또는 텍스트 입력
- 계약서 분석 또는 상황 분석
- 분석 결과 표시

**상태**:
- `uploadedFile`: 업로드된 파일
- `textInput`: 텍스트 입력
- `isAnalyzing`: 분석 중
- `analysisResult`: 분석 결과
- `error`: 에러

**API 연결**:
- `analyzeContract(file)` → 계약서 분석
- `analyzeLegalSituation(text)` → 상황 분석

**문제점/개선사항**:
- ⚠️ 레거시 페이지로 보임
- ⚠️ `/legal/contract`와 `/legal/situation`으로 기능이 분리됨
- ⚠️ 현재 사용되지 않을 가능성
- ⚠️ 레이아웃에 포함되어 있는지 확인 필요

---

### 8. `/legal/search` - 검색 페이지 (레거시?)
**파일**: `src/app/legal/search/page.tsx`

**기능**:
- 법적 상황 검색
- 케이스 검색 + 상황 분석 결합
- 검색 결과 표시

**상태**:
- `searchQuery`: 검색어
- `isSearching`: 검색 중
- `searchResults`: 검색 결과
- `error`: 에러

**API 연결**:
- `searchLegalCases(query, 5)` → 케이스 검색
- `analyzeLegalSituation(query)` → 상황 분석

**문제점/개선사항**:
- ⚠️ 레거시 페이지로 보임
- ⚠️ `/legal/cases` 페이지에 검색 기능이 통합됨
- ⚠️ 현재 사용되지 않을 가능성
- ⚠️ 레이아웃에 포함되어 있는지 확인 필요

---

### 9. `/legal/layout.tsx` - 레이아웃
**파일**: `src/app/legal/layout.tsx`

**기능**:
- 공통 헤더 (로고 + 네비게이션)
- 공통 푸터
- 모든 `/legal/*` 페이지에 적용

**네비게이션 항목**:
- 홈 (`/legal`)
- 계약서 분석 (`/legal/contract`)
- 상황 분석 (`/legal/situation`)
- 유사 케이스 (`/legal/cases`)

**문제점/개선사항**:
- ✅ Active 상태 표시
- ✅ 반응형 네비게이션
- ⚠️ `/legal/analysis`, `/legal/search`는 네비게이션에 없음 (레거시로 추정)
- ⚠️ 일부 페이지에서 Header/Footer 제거됨 (예: `/legal/contract`)

---

## 🔄 페이지 간 라우팅 흐름

```
/legal (홈)
  ├─→ /legal/contract (계약서 업로드)
  │     └─→ /legal/contract/[docId] (분석 상세)
  │
  └─→ /legal/situation (상황 진단)
        └─→ /legal/cases/[id] (유사 케이스 상세)

/legal/cases (케이스 갤러리)
  ├─→ /legal/cases/[id] (케이스 상세)
  └─→ /legal/situation (내 상황으로 분석)
```

---

## 📊 API 엔드포인트 요약

### 프론트엔드 API Routes
- `POST /api/rag/query` - RAG 쿼리 (법률 상담 챗 포함)
- `GET /api/legal/contract-analysis/[id]` - 계약서 분석 결과 조회

### 백엔드 API Routes
- `POST /api/v1/legal/analyze-contract` - 계약서 분석
- `POST /api/v1/legal/analyze-situation` - 상황 분석 (레거시)
- `POST /api/v1/legal/situation/analyze` - 상황 기반 진단 (새로운)
- `POST /api/v1/legal/chat` - 법률 상담 챗
- `GET /api/v1/legal/search-cases` - 케이스 검색

### Supabase
- Storage: `attach_file` 버킷 (우선), `announcements` 버킷 (fallback)
- Database: `contract_analyses` 테이블

---

## ⚠️ 발견된 문제점 및 개선 필요 사항

### 1. 레거시 페이지
- `/legal/analysis`: 현재 사용되지 않을 가능성
- `/legal/search`: 현재 사용되지 않을 가능성
- **권장**: 삭제 또는 명확한 용도 정의

### 2. 케이스 상세 페이지
- `/legal/cases/[id]`: Mock 데이터만 사용, 실제 API 연동 없음
- `/legal/cases` 모달과 기능 중복
- **권장**: 모달로 통합하거나 실제 API 연동

### 3. 검색 기능
- `/legal/cases` 페이지의 검색 버튼이 실제로 검색을 실행하지 않음
- 검색어 변경 시 자동 검색됨 (`useEffect` 의존성)
- **권장**: 검색 버튼 클릭 시 검색 실행하도록 수정

### 4. 데이터 일관성
- 일부 페이지는 DB 우선, 일부는 로컬 스토리지 우선
- **권장**: 데이터 로딩 전략 통일

### 5. 에러 처리
- 대부분의 페이지에서 에러 처리가 있으나, 사용자 피드백 개선 가능
- **권장**: Toast 메시지 통일

---

## ✅ 잘 구현된 부분

1. **반응형 디자인**: 모든 페이지가 모바일/데스크톱 대응
2. **Graceful Degradation**: 파일 업로드/DB 저장 실패 시에도 기능 계속 작동
3. **사용자 경험**: 
   - 상황 템플릿 제공
   - 동적 placeholder
   - 체크리스트 기능
   - 스크립트 복사 기능
4. **데이터 캐싱**: 로컬 스토리지 fallback
5. **접근성**: ARIA 속성, 키보드 네비게이션

---

## 📝 권장 개선 사항

1. **레거시 페이지 정리**: `/legal/analysis`, `/legal/search` 삭제 또는 통합
2. **케이스 상세 페이지**: 실제 API 연동 또는 모달로 통합
3. **검색 기능**: 검색 버튼 클릭 시 실제 검색 실행
4. **에러 처리**: Toast 메시지 통일 및 개선
5. **데이터 로딩 전략**: DB 우선 → 로컬 스토리지 fallback 전략 통일

