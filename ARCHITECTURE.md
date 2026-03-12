# LINKUS Public Architecture

이 문서는 `C:\Users\suhyeonjang\linkers-public` 저장소의 현재 구조를 기준으로 전체 아키텍처를 정리한 문서다.
기존 문서 중 일부는 과거 기능과 실험 코드가 섞여 있으므로, 이 문서는 "현재 코드가 실제로 어떻게 연결되어 있는가"에 초점을 둔다.

## 1. 한눈에 보는 구조

```text
사용자 브라우저
  -> Next.js App Router (src/app)
     -> UI / 페이지 / 클라이언트 상태 / 일부 BFF Route Handler
     -> Supabase Auth / Storage / 일부 직접 조회
     -> Python FastAPI 백엔드 호출
        -> Legal RAG Service
           -> 문서 파싱 / OCR / 청킹
           -> 임베딩 생성
           -> Supabase pgvector 검색
           -> LLM 기반 계약/상황 분석
           -> 결과 저장
              -> Supabase Postgres / Storage
```

핵심적으로는 다음 4계층이다.

1. 프론트엔드: `src/app`, `src/components`, `src/apis`
2. 백엔드 API: `backend/main.py`, `backend/api/*`
3. 분석 엔진: `backend/core/*`
4. 데이터 계층: Supabase Auth, Postgres, Storage, pgvector

## 2. 시스템 컨텍스트

이 저장소는 단일 리포지토리 안에 두 개의 런타임을 함께 둔다.

- 웹 앱: Next.js 14 + React 18 + TypeScript
- 분석 서버: FastAPI + Python

운영 관점에서 보면 Next.js가 사용자 접점이고, FastAPI가 법률 분석 엔진이다.

### 현재 서비스 축

현재 코드 기준 주요 서비스 축은 법률 도메인이다.

- 계약서 업로드 및 위험 분석
- 상황 설명 기반 법률 진단
- 법령/가이드/사례 검색
- 계약/상황 컨텍스트를 포함한 법률 채팅
- 관리자 조회 페이지

반면 아래 영역은 리포지토리에 남아 있지만 법률 기능보다 우선순위가 낮거나 과거 구조가 섞여 있다.

- `match`, `meeting`, `compare`, `upload` 등 과거 메이커/팀 매칭 흐름
- `frontend/streamlit_app.py` 기반 실험성 프론트
- `backend/api/routes_v2.py` 등 레거시 라우트

## 3. 프론트엔드 아키텍처

### 3.1 프레임워크

- Next.js 14 App Router
- React 18
- Tailwind CSS
- Radix UI 기반 공용 UI 컴포넌트
- Zustand 기반 일부 클라이언트 상태
- Supabase SSR/Auth 연동

### 3.2 진입 구조

루트 페이지는 [`src/app/page.tsx`](C:\Users\suhyeonjang\linkers-public\src\app\page.tsx)에서 `/legal`로 리다이렉트된다.

즉, 현재 사용자 메인 엔트리포인트는 법률 서비스 영역이다.

주요 레이아웃은 다음과 같다.

- 글로벌 레이아웃: [`src/app/layout.tsx`](C:\Users\suhyeonjang\linkers-public\src\app\layout.tsx)
- 법률 전용 레이아웃: [`src/app/legal/layout.tsx`](C:\Users\suhyeonjang\linkers-public\src\app\legal\layout.tsx)
- 관리자 레이아웃: [`src/app/admin/layout.tsx`](C:\Users\suhyeonjang\linkers-public\src\app\admin\layout.tsx)

### 3.3 주요 페이지 군

현재 구조를 큰 도메인 기준으로 묶으면 다음과 같다.

#### 법률 사용자 페이지

- `/legal`
- `/legal/contract`
- `/legal/contract/[docId]`
- `/legal/contract/[docId]/assist`
- `/legal/situation`
- `/legal/situation/[id]`
- `/legal/assist`
- `/legal/assist/quick`
- `/legal/assist/quick/report/[reportId]`
- `/legal/cases`
- `/legal/cases/[id]`
- `/legal/cases/assist`
- `/legal/search`
- `/legal/analysis`

#### 인증/관리자/기타 페이지

- `/auth`
- `/auth/callback`
- `/admin`
- `/admin/legal`
- `/admin/contracts`
- `/guide`
- `/docs`

#### 레거시 또는 보조 페이지

- `/meeting`
- `/match`
- `/compare`
- `/upload`

### 3.4 프론트엔드 계층 분리

프론트 코드는 대략 다음 역할로 나뉜다.

#### 1) 화면 계층

- `src/app/*`
- `src/components/*`

화면 렌더링과 사용자 인터랙션을 담당한다.

#### 2) API 클라이언트 계층

- `src/apis/legal.service.ts`
- `src/apis/*.service.ts`

브라우저에서 FastAPI 또는 Supabase로 요청할 때 사용하는 클라이언트다.

#### 3) 인증/세션 계층

- `src/supabase/supabase-client.ts`
- `src/supabase/supabase-server.ts`
- `middleware.ts`

브라우저, 서버 컴포넌트, 미들웨어 환경별로 Supabase 클라이언트를 분리한다.

#### 4) 상태/유틸 계층

- `src/stores/*`
- `src/hooks/*`
- `src/utils/*`
- `src/lib/*`
- `src/types/*`

### 3.5 프론트엔드의 호출 패턴

현재 프론트는 두 가지 방식이 혼재한다.

#### A. 브라우저에서 FastAPI 직접 호출

예: [`src/apis/legal.service.ts`](C:\Users\suhyeonjang\linkers-public\src\apis\legal.service.ts)

- `NEXT_PUBLIC_BACKEND_API_URL` 기반으로 Python 백엔드 호출
- `X-User-Id`, `Authorization` 헤더를 조합해 전달

#### B. Next.js Route Handler를 통한 프록시/BFF 호출

예:

- [`src/app/api/legal/search/route.ts`](C:\Users\suhyeonjang\linkers-public\src\app\api\legal\search\route.ts)
- [`src/app/api/legal/analyze-situation/route.ts`](C:\Users\suhyeonjang\linkers-public\src\app\api\legal\analyze-situation\route.ts)
- [`src/app/api/legal/contract-analysis/[id]/route.ts`](C:\Users\suhyeonjang\linkers-public\src\app\api\legal\contract-analysis\[id]\route.ts)

이 구조 때문에 현재 프론트 API 계층은 "직접 호출"과 "프록시 호출"이 같이 존재한다.
아키텍처 관점에서는 장기적으로 하나로 통일하는 것이 바람직하다.

## 4. 백엔드 아키텍처

### 4.1 프레임워크 및 엔트리포인트

백엔드는 FastAPI 기반이며 엔트리포인트는 [`backend/main.py`](C:\Users\suhyeonjang\linkers-public\backend\main.py)다.

여기서 수행하는 역할은 다음과 같다.

- FastAPI 앱 생성
- CORS 설정
- 공통 에러 핸들러 등록
- 로깅 초기화
- 여러 라우터 등록

### 4.2 라우터 구성

현재 등록되는 주요 라우터는 다음과 같다.

- `api.routes_v2`
- `api.routes_legal`
- `api.routes_legal_v2`
- `api.routes_legal_agent`

실질적인 핵심은 법률 v2 라우터다.

주요 파일:

- [`backend/api/routes_legal_v2.py`](C:\Users\suhyeonjang\linkers-public\backend\api\routes_legal_v2.py)
- [`backend/api/routes_legal_agent.py`](C:\Users\suhyeonjang\linkers-public\backend\api\routes_legal_agent.py)

### 4.3 주요 API 기능

현재 중요도가 높은 백엔드 API는 다음과 같다.

#### 검색

- `GET /api/v2/legal/search`

역할:

- 법령, 가이드, 표준계약서, 사례 청크 검색

#### 계약 분석

- `POST /api/v2/legal/analyze-contract`
- `GET /api/v2/legal/contracts/{doc_id}` 계열

역할:

- 파일 업로드
- 텍스트 추출/OCR
- 조항 단위 청킹
- 계약 청크 저장
- 법률 근거 검색
- 위험도 분석
- 결과 저장 및 조회

#### 상황 분석

- `POST /api/v2/legal/analyze-situation`

역할:

- 사용자의 상황 서술을 기반으로 법적 위험과 대응 가이드 생성

#### 법률 채팅

- `POST /api/v2/legal/chat`
- 세션/메시지 CRUD API

역할:

- 계약 분석 결과 또는 상황 분석 결과를 컨텍스트로 활용한 후속 질의응답

#### Agent 통합 채팅

- `POST /api/v2/legal/agent/chat`

역할:

- plain / contract / situation 모드를 통합해 하나의 대화 인터페이스로 연결

## 5. 분석 엔진 아키텍처

분석 엔진의 핵심은 [`backend/core`](C:\Users\suhyeonjang\linkers-public\backend\core)에 있다.

### 5.1 핵심 컴포넌트

#### `LegalRAGService`

파일:

- [`backend/core/legal_rag_service.py`](C:\Users\suhyeonjang\linkers-public\backend\core\legal_rag_service.py)

역할:

- 계약 분석
- 상황 분석
- 법률 검색
- 채팅용 컨텍스트 구성
- 임베딩 캐시 관리
- 벡터 검색과 LLM 응답 생성의 조합

사실상 백엔드 도메인 서비스의 중심이다.

#### `DocumentProcessor`

파일:

- [`backend/core/document_processor_v2.py`](C:\Users\suhyeonjang\linkers-public\backend\core\document_processor_v2.py)

역할:

- PDF/HWPX 파일 파싱
- OCR fallback
- 텍스트 추출
- 계약 조항 단위 청킹

#### `LLMGenerator`

파일:

- [`backend/core/generator_v2.py`](C:\Users\suhyeonjang\linkers-public\backend\core\generator_v2.py)

역할:

- 임베딩 생성
- Groq/Ollama/OpenAI 계열 LLM 호출 추상화

#### `SupabaseVectorStore`

파일:

- [`backend/core/supabase_vector_store.py`](C:\Users\suhyeonjang\linkers-public\backend\core\supabase_vector_store.py)

역할:

- `legal_chunks`, `contract_chunks` 검색
- pgvector 기반 유사도 검색
- 계약 청크 upsert

#### `ContractStorageService`

파일:

- [`backend/core/contract_storage.py`](C:\Users\suhyeonjang\linkers-public\backend\core\contract_storage.py)

역할:

- 계약 분석 결과 저장/조회
- 상황 분석 결과 저장/조회
- 채팅 세션 및 메시지 저장/조회

### 5.2 DI와 싱글턴

파일:

- [`backend/core/dependencies.py`](C:\Users\suhyeonjang\linkers-public\backend\core\dependencies.py)

현재 백엔드는 간단한 싱글턴 + DI 패턴을 사용한다.

- `get_legal_service()`
- `get_processor()`
- `get_storage_service()`
- `get_task_manager()`

즉, 무거운 객체를 요청마다 새로 만들기보다 프로세스 내 재사용하는 방식이다.

### 5.3 도구형 분석 모듈

`backend/core/tools`는 계약 분석 세부 기능을 분리한 툴 계층이다.

예:

- `document_parser_tool.py`
- `vector_search_tool.py`
- `risk_scoring_tool.py`
- `rewrite_tool.py`
- `highlight_tool.py`
- `clause_labeling_tool.py`

이 레이어는 "한 파일에 모든 로직을 몰아넣지 않기 위한 분석 서브모듈" 역할을 한다.

## 6. 데이터 아키텍처

### 6.1 인증

인증은 Supabase Auth를 사용한다.

프론트:

- 브라우저: [`src/supabase/supabase-client.ts`](C:\Users\suhyeonjang\linkers-public\src\supabase\supabase-client.ts)
- 서버/미들웨어: [`src/supabase/supabase-server.ts`](C:\Users\suhyeonjang\linkers-public\src\supabase\supabase-server.ts)

현재 미들웨어는 세션 파싱은 하지만 모든 경로를 강하게 보호하는 구조는 아니다.

### 6.2 저장소 종류

이 프로젝트는 사실상 Supabase를 중심으로 저장 계층을 구성한다.

#### Postgres 테이블

대표적으로 다음 성격의 데이터를 저장한다.

- 계약 분석 메타/요약
- 계약 이슈 목록
- 상황 분석 결과
- 채팅 세션/메시지

문서와 코드상에 등장하는 주요 테이블은 다음과 같다.

- `contract_analyses`
- `contract_issues`
- `situation_analyses`
- `legal_chat_sessions`
- `legal_chat_messages`
- `legal_chunks`
- `contract_chunks`

#### Storage

역할:

- 업로드한 원본 파일 보관
- 법률 원문 파일 제공
- 증빙 파일 저장

#### pgvector

역할:

- 법령/가이드/사례 임베딩 검색
- 계약 청크 임베딩 검색

즉, Supabase 하나 안에 Auth, RDB, 파일 저장소, 벡터 검색이 함께 붙어 있는 구조다.

## 7. 대표 요청 흐름

### 7.1 계약서 분석 플로우

```text
브라우저
  -> src/apis/legal.service.ts
  -> POST /api/v2/legal/analyze-contract
  -> 파일 임시 저장
  -> DocumentProcessor.process_file()
  -> 계약 조항 추출 / clauses 생성
  -> contract_chunks 임베딩 생성 및 저장
  -> LegalRAGService.analyze_contract()
     -> contract_chunks 검색
     -> legal_chunks 검색
     -> LLM 기반 위험 분석
  -> ContractStorageService.save_contract_analysis()
  -> 프론트에 분석 결과 반환
```

핵심 포인트:

- 업로드 파일에서 텍스트 추출이 먼저 이뤄진다.
- 계약 자체 청크와 법률 근거 청크를 함께 활용하는 Dual RAG 구조다.
- 결과는 DB에 저장되어 이후 조회/채팅 컨텍스트로 재사용된다.

### 7.2 상황 분석 플로우

```text
브라우저
  -> 상황 입력
  -> POST /api/v2/legal/analyze-situation
  -> LegalRAGService.analyze_situation_detailed()
  -> 법령/가이드/사례 검색
  -> LLM 진단 및 액션 플랜 생성
  -> 결과 저장
  -> 프론트에 진단 결과 반환
```

핵심 포인트:

- 계약 파일 없이 텍스트 상황만으로 진단 가능
- 사례, 법령, 가이드 문서를 함께 검색
- 결과 구조에는 요약, 체크리스트, 권고사항, 스크립트, 관련 사례가 포함된다

### 7.3 채팅 플로우

```text
브라우저
  -> POST /api/v2/legal/chat 또는 /agent/chat
  -> contextType / contextId 확인
  -> 기존 계약 또는 상황 분석 결과 조회
  -> 관련 contract/legal chunks 재검색
  -> LLM 응답 생성
  -> 필요 시 세션/메시지 저장
  -> 답변 + used sources 반환
```

핵심 포인트:

- 단순 채팅이 아니라 "기존 분석 결과를 컨텍스트로 재활용"한다
- used chunks / used sources를 함께 반환해 근거 기반 응답을 의도한다

## 8. 디렉터리별 책임

### 최상위

- `src/`: 현재 메인 웹앱 코드
- `backend/`: 현재 메인 분석 서버 코드
- `supabase/`: SQL 및 마이그레이션
- `public/`: 정적 자산
- `docs/`: 과거 포함 문서 아카이브
- `frontend/`: Streamlit 기반 과거 실험 프론트

### 프론트

- `src/app/`: 라우트, 페이지, route handler
- `src/components/`: UI 및 도메인 컴포넌트
- `src/apis/`: 프론트 API 클라이언트
- `src/supabase/`: Supabase 클라이언트 팩토리
- `src/types/`: 타입 정의
- `src/stores/`: Zustand 스토어
- `src/hooks/`: 커스텀 훅
- `src/utils/`, `src/lib/`: 공용 유틸

### 백엔드

- `backend/api/`: FastAPI 라우터
- `backend/core/`: 서비스, 워크플로, 도구, 인프라 어댑터
- `backend/models/`: Pydantic 스키마
- `backend/scripts/`: 인덱싱, 업로드, 마이그레이션, 점검 스크립트
- `backend/docs/`: 백엔드 관련 상세 문서

## 9. 설정과 런타임 의존성

### 프론트 주요 환경 변수

- `NEXT_PUBLIC_BACKEND_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 결제/웹훅 관련 키들

### 백엔드 주요 환경 변수

파일:

- [`backend/config.py`](C:\Users\suhyeonjang\linkers-public\backend\config.py)

주요 설정:

- Supabase URL / Service Role Key
- 임베딩 모델
- LLM Provider
- Groq/Ollama 설정
- chunk size / overlap
- 포트와 호스트

현재 기본 방향은 다음과 같다.

- 벡터 저장소: Supabase 우선
- 임베딩: 로컬 모델 사용
- LLM: Groq 또는 Ollama 전환 가능

## 10. 현재 구조의 장점

### 1) 역할이 비교적 명확하다

- Next.js는 사용자 경험과 인증 연결
- FastAPI는 분석 로직과 RAG 오케스트레이션
- Supabase는 데이터 중심 허브

### 2) 분석 파이프라인이 모듈화되어 있다

- 문서 처리
- 벡터 검색
- 위험 분석
- 저장/조회

이 흐름이 적어도 파일 레벨에서는 분리되어 있다.

### 3) 결과 재사용성이 있다

한 번 분석한 계약/상황을 조회, 관리자 화면, 후속 채팅에서 재사용할 수 있다.

## 11. 현재 구조의 주의 포인트

현재 코드를 읽으며 확인한 구조적 포인트는 다음과 같다.

### 1) 직접 호출과 프록시 호출이 혼재

프론트가 어떤 API는 FastAPI를 직접 호출하고, 어떤 API는 Next Route Handler를 거친다.

영향:

- 인증 헤더 전달 방식이 분산됨
- 디버깅 경로가 길어짐
- CORS/BFF 정책이 일관되지 않음

### 2) 레거시 도메인과 현재 도메인이 한 리포지토리에 공존

법률 서비스가 현재 중심이지만 메이커/매칭 관련 코드가 같이 남아 있다.

영향:

- 신규 개발자가 진입점을 파악하기 어렵다
- 살아 있는 기능과 보관용 코드의 경계가 흐리다

### 3) 백엔드 서비스가 비대해진 구간이 있다

특히 `routes_legal_v2.py`, `legal_rag_service.py`, `contract_storage.py`는 역할이 넓고 길다.

영향:

- 변경 영향 범위 예측이 어려움
- 테스트 포인트가 넓어짐
- 리팩터링 비용 상승

### 4) 저장 계층 접근 방식이 완전히 통일되어 있지 않다

어떤 데이터는 백엔드 서비스 경유, 어떤 데이터는 Next Route Handler에서 Supabase 직접 접근한다.

영향:

- 권한 정책과 책임 경계가 흔들릴 수 있다

## 12. 추천 정리 방향

전체 아키텍처를 더 선명하게 만들려면 다음 순서가 좋다.

### 1) "현재 주력 도메인" 명시

문서와 README에서 법률 서비스를 1순위 도메인으로 고정한다.

### 2) API 진입 경로 통일

둘 중 하나로 정하는 것이 좋다.

- 프론트 -> Next BFF -> FastAPI
- 프론트 -> FastAPI 직접

운영/보안/헤더 일관성을 생각하면 BFF 패턴으로 통일하는 편이 관리에 유리하다.

### 3) 백엔드 도메인 서비스 분리

권장 분리 예시:

- `contract_analysis_service`
- `situation_analysis_service`
- `legal_chat_service`
- `analysis_repository`

### 4) 레거시 코드 경계 표시

즉시 삭제가 어렵다면 아래처럼 구분하면 된다.

- `legacy/` 이동
- README에 "active" / "legacy" 표기
- 라우트/문서에 deprecated 표시

## 13. 요약

현재 이 저장소는 "Next.js 웹앱 + FastAPI 법률 RAG 엔진 + Supabase 데이터 허브" 구조다.

가장 중요한 실행 흐름은 다음 하나로 요약된다.

1. 사용자가 웹에서 계약서 또는 상황을 입력한다.
2. Next.js 프론트가 인증과 UI를 담당한다.
3. FastAPI가 문서 처리, 검색, LLM 분석을 수행한다.
4. Supabase가 결과와 원본, 벡터 데이터를 저장한다.
5. 저장된 결과는 조회, 관리자 화면, 후속 채팅에서 재사용된다.

즉, 이 프로젝트의 본체는 "법률 분석 워크플로를 제공하는 웹 서비스"이며, 현재 아키텍처도 그 목적을 중심으로 수렴하고 있다.
