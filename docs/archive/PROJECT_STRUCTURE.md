# Linkus Public - 전체 프로젝트 구조

## 📋 프로젝트 개요

**Linkus Public**은 기업과 프리랜서를 연결하는 IT 프로젝트 매칭 플랫폼으로, RAG 기반 AI를 활용한 공공입찰 자동 분석 및 팀 매칭 시스템입니다.

## 🏗️ 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Pages      │  │  Components  │  │   API Routes │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         │                 │                  │              │
│         └─────────────────┼──────────────────┘              │
│                           │                                  │
└───────────────────────────┼──────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                    │
┌────────▼────────┐  ┌──────▼──────┐  ┌─────────▼─────────┐
│  Supabase      │  │  Backend    │  │   OpenAI API     │
│  (PostgreSQL)  │  │  (FastAPI)  │  │   (GPT-4o-mini)  │
│  + pgvector    │  │  + RAG      │  │   + Embeddings  │
└────────────────┘  └─────────────┘  └──────────────────┘
```

## 📁 전체 디렉토리 구조

```
linkers-public/
├── backend/                    # FastAPI 백엔드 서버
│   ├── api/                    # API 라우터
│   │   ├── __init__.py
│   │   └── routes.py          # REST API 엔드포인트
│   ├── core/                   # 핵심 RAG 모듈
│   │   ├── document_processor.py  # PDF 처리
│   │   ├── vector_store.py        # ChromaDB 벡터 저장소
│   │   ├── retriever.py           # 검색 엔진
│   │   ├── generator.py           # LLM 생성
│   │   └── orchestrator.py        # RAG 통합
│   ├── models/                 # 데이터 모델
│   │   ├── __init__.py
│   │   └── schemas.py          # Pydantic 스키마
│   ├── data/                   # 데이터 저장소
│   │   ├── chroma_db/          # 벡터 DB (자동 생성)
│   │   ├── temp/               # 임시 파일
│   │   └── sample_data/        # 샘플 데이터
│   ├── main.py                 # FastAPI 메인 앱
│   ├── config.py               # 설정 관리
│   ├── requirements.txt       # Python 의존성
│   ├── README.md              # 백엔드 문서
│   ├── QUICK_START.md         # 빠른 시작 가이드
│   ├── run.sh                 # 실행 스크립트 (Linux/Mac)
│   └── run.bat                # 실행 스크립트 (Windows)
│
├── src/                        # Next.js 프론트엔드
│   ├── app/                   # Next.js App Router
│   │   ├── (home)/            # 홈페이지 및 일반 사용자 페이지
│   │   │   ├── page.tsx       # 랜딩 페이지
│   │   │   ├── my/            # 마이페이지
│   │   │   ├── profile/       # 프로필 페이지
│   │   │   ├── search-makers/ # 메이커 검색
│   │   │   ├── search-projects/ # 프로젝트 검색
│   │   │   └── team/         # 팀 페이지
│   │   ├── enterprise/        # 기업 고객 전용
│   │   │   ├── counsel-form/  # 상담 신청
│   │   │   ├── my-counsel/   # 상담 목록
│   │   │   ├── (dashboard)/  # 대시보드
│   │   │   └── ...
│   │   ├── upload/            # 공고 업로드
│   │   ├── analysis/[docId]/  # AI 분석 결과
│   │   ├── match/[docId]/     # 팀 매칭
│   │   ├── compare/[docId]/   # 견적 비교
│   │   ├── contract/[docId]/  # 계약 진행
│   │   ├── api/               # Next.js API Routes
│   │   │   ├── rag/           # RAG API (프론트엔드용)
│   │   │   │   ├── ingest/    # 문서 인덱싱
│   │   │   │   ├── query/     # RAG 질의
│   │   │   │   └── teams/     # 팀 임베딩
│   │   │   ├── subscription/  # 구독 API
│   │   │   ├── payments/      # 결제 API
│   │   │   └── ...
│   │   └── auth/              # 인증 페이지
│   │
│   ├── components/            # React 컴포넌트
│   │   ├── ui/                # 기본 UI 컴포넌트
│   │   │   ├── button.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ...
│   │   ├── rag/               # RAG 관련 컴포넌트
│   │   │   ├── UploadCard.tsx
│   │   │   ├── AnalysisSummaryCard.tsx
│   │   │   ├── TeamRecommendationList.tsx
│   │   │   └── EstimateCompareBar.tsx
│   │   ├── layout/            # 레이아웃 컴포넌트
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── SubHeader.tsx
│   │   └── ...
│   │
│   ├── lib/                   # 유틸리티 및 라이브러리
│   │   ├── rag/               # RAG 라이브러리 (프론트엔드용)
│   │   │   ├── extractor.ts   # 문서 추출
│   │   │   ├── chunker.ts    # 청킹
│   │   │   ├── embedder.ts   # 임베딩
│   │   │   ├── retriever.ts  # 검색
│   │   │   ├── prompts.ts    # 프롬프트
│   │   │   └── scoring.ts    # 스코어링
│   │   └── utils.ts
│   │
│   ├── apis/                  # API 서비스 함수
│   │   ├── counsel.service.ts
│   │   ├── estimate.service.ts
│   │   ├── profile.service.ts
│   │   ├── team.service.ts
│   │   └── ...
│   │
│   ├── stores/                # 상태 관리 (Zustand)
│   │   ├── useAccoutStore.ts
│   │   ├── useProfileStore.js
│   │   └── useTeamProfileStore.ts
│   │
│   ├── hooks/                 # 커스텀 훅
│   │   ├── use-hydrate.tsx
│   │   ├── use-maker-filter.ts
│   │   └── use-toast.ts
│   │
│   ├── types/                 # TypeScript 타입
│   │   ├── rag.ts
│   │   └── supabase.ts
│   │
│   ├── supabase/              # Supabase 클라이언트
│   │   ├── supabase-client.ts
│   │   ├── supabase-server.ts
│   │   └── supabase-storage.ts
│   │
│   └── constants/             # 상수
│       └── job-options.ts
│
├── public/                    # 정적 파일
│   ├── icon.svg
│   └── images/
│
├── supabase/                  # Supabase 설정 (마이그레이션 등)
│
├── scripts/                   # 유틸리티 스크립트
│   └── update-notion-daily.js
│
├── package.json               # Node.js 의존성
├── next.config.mjs            # Next.js 설정
├── tailwind.config.js         # Tailwind CSS 설정
├── tsconfig.json              # TypeScript 설정
├── vercel.json                # Vercel 배포 설정
│
├── README.md                  # 프로젝트 메인 README
├── RAG_ARCHITECTURE.md        # RAG 아키텍처 문서
├── SUPABASE_PROJECT_INFO.md   # Supabase 프로젝트 정보
└── PROJECT_STRUCTURE.md      # 이 문서
```

## 🔄 데이터 플로우

### 1. 공고 업로드 및 분석 플로우

```
사용자 → [Frontend] → [Next.js API] → [Supabase]
                              ↓
                        [Backend FastAPI]
                              ↓
                    [PDF 처리 → 벡터화 → ChromaDB]
                              ↓
                        [OpenAI API]
                              ↓
                    [분석 결과 → Supabase]
                              ↓
                        [Frontend 표시]
```

### 2. 팀 매칭 플로우

```
공고 분석 결과 → [Backend RAG] → [ChromaDB 팀 검색]
                                      ↓
                                [유사도 계산]
                                      ↓
                                [LLM 사유 생성]
                                      ↓
                                [매칭 결과 반환]
```

### 3. 견적서 생성 플로우

```
공고 + 팀 선택 → [Backend RAG] → [과거 견적 검색]
                                      ↓
                                [LLM 견적 생성]
                                      ↓
                                [견적서 반환]
```

## 🛠️ 기술 스택

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI**: React 18, Tailwind CSS
- **State Management**: Zustand
- **UI Components**: Radix UI
- **Charts**: Recharts
- **File Processing**: pdf-parse, jszip

### Backend
- **Framework**: FastAPI
- **Language**: Python 3.9+
- **RAG**: LangChain
- **Vector DB**: ChromaDB
- **LLM**: OpenAI (GPT-4o-mini, text-embedding-3-small)
- **Document Processing**: PyPDF, pdfplumber

### Database & Storage
- **Database**: Supabase (PostgreSQL)
- **Vector Search**: pgvector (Supabase)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage

### Payment
- **Payment Gateway**: PortOne (포트원)

### Deployment
- **Frontend**: Vercel
- **Backend**: (독립 서버 또는 Vercel Serverless)

## 📊 주요 기능 모듈

### 1. RAG 시스템 (이중 구현)

#### Frontend RAG (`src/lib/rag/`)
- Supabase pgvector 기반
- Next.js API Routes로 구현
- 실시간 문서 업로드 및 분석

#### Backend RAG (`backend/core/`)
- ChromaDB 기반
- FastAPI로 독립 서버
- 대용량 처리 및 배치 작업

### 2. 사용자 관리
- **인증**: Supabase Auth
- **프로필**: accounts 테이블
- **권한**: RLS (Row Level Security)

### 3. 프로젝트 매칭
- **상담**: counsel 테이블
- **견적**: estimate 테이블
- **팀**: teams, team_members 테이블

### 4. 결제 시스템
- **구독**: subscriptions 테이블
- **결제**: payments 테이블
- **포트원**: PortOne V2 API

## 🔌 API 구조

### Frontend API Routes (`src/app/api/`)
- `/api/rag/ingest` - 문서 인덱싱
- `/api/rag/query` - RAG 질의
- `/api/rag/teams` - 팀 임베딩
- `/api/subscription/*` - 구독 관리
- `/api/payments/*` - 결제 처리

### Backend API (`backend/api/routes.py`)
- `POST /api/announcements/upload` - 공고 업로드
- `GET /api/announcements/{id}/match` - 팀 매칭
- `POST /api/estimates/generate` - 견적 생성
- `GET /api/health` - 헬스 체크

## 📝 주요 페이지

### 일반 사용자
- `/` - 랜딩 페이지
- `/search-projects` - 프로젝트 검색
- `/search-makers` - 메이커 검색
- `/profile/[username]` - 프로필 보기
- `/my/profile` - 내 프로필 관리

### 기업 고객
- `/enterprise` - 기업 홈
- `/enterprise/counsel-form` - 상담 신청
- `/enterprise/my-counsel` - 상담 목록
- `/enterprise/(dashboard)/estimate-list/[counselId]` - 견적서 목록

### RAG 기능
- `/upload` - 공고 업로드
- `/analysis/[docId]` - AI 분석
- `/match/[docId]` - 팀 매칭
- `/compare/[docId]` - 견적 비교
- `/contract/[docId]` - 계약 진행

## 🔐 보안 구조

### Row Level Security (RLS)
- `docs`, `doc_chunks`: 소유자만 조회
- `doc_owners`: 자신의 소유권만 조회
- `team_embeddings`: 모든 인증 사용자 조회 가능
- `rag_audit_logs`: 자신의 로그만 조회

### API 보안
- Supabase Auth 토큰 검증
- CORS 설정
- 환경 변수 관리

## 🚀 실행 방법

### Frontend 실행
```bash
npm install
npm run dev
# http://localhost:3000
```

### Backend 실행
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
# http://localhost:8000
```

## 📦 의존성 관리

### Frontend (`package.json`)
- Next.js 14.2.21
- React 18
- Supabase 2.42.0
- OpenAI 4.20.0

### Backend (`backend/requirements.txt`)
- FastAPI 0.109.0
- LangChain 0.1.5
- ChromaDB 0.4.22
- OpenAI (via langchain-openai)

## 🔄 향후 개선 사항

1. **RAG 통합**: Frontend와 Backend RAG 통합
2. **OCR 지원**: 스캔 PDF 처리
3. **캐싱**: 성능 최적화
4. **비동기 처리**: 대용량 파일 처리
5. **모니터링**: 로깅 및 모니터링 시스템

## 📚 관련 문서

- [README.md](./README.md) - 프로젝트 메인 문서
- [RAG_ARCHITECTURE.md](./RAG_ARCHITECTURE.md) - RAG 아키텍처 상세
- [backend/README.md](./backend/README.md) - 백엔드 문서
- [SUPABASE_PROJECT_INFO.md](./SUPABASE_PROJECT_INFO.md) - Supabase 정보

