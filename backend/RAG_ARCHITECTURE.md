# RAG 구성 핵심 정리 (Linkus Public)

## 1️⃣ 데이터 (Retrieval Source)

### ① 공공조달 관련 데이터
- **조달청 나라장터 입찰 공고 CSV**
  - `UI-ADODAA-008R.입찰공고 내역.csv`
  - `UI-ADODAA-010R.통합 입찰공고 내역.csv`
- **공고 문서**
  - 공고문, 과업지시서, 제안요청서, 협약서 (PDF/HWPX)
- **NTIS R&D 과제 데이터** (추가 API 연동 가능)

**저장 위치**: `backend/data/bids/`

### ② 기업·프리랜서 데이터
- **Linkus 플랫폼 내부 DB**
  - 기업명, 수행이력, 기술스택, 평점
  - R&D 참여 이력, 기술역량 태그, 지역 정보

**저장 위치**: `backend/data/companies/`

### 데이터 구분 방식
- **방법 1**: 별도 벡터스토어에 저장 (권장)
  - `announcement_chunks` 테이블: 공고문
  - `team_embeddings` 테이블: 기업/팀
- **방법 2**: 하나의 컬렉션으로 `type` 필드로 구분

## 2️⃣ 임베딩 (Embedding)

| 구분 | 모델 | 설명 | 차원 |
|------|------|------|------|
| **문서 임베딩** | `BAAI/bge-m3` | 공고문·제안요청서·과업지시서 의미 벡터화 | 1024 |
| **기업 임베딩** | `multilingual-e5-large` 또는 `text-embedding-3-small` | 기업/팀 기술스택 및 수행이력 벡터화 | 1024 / 1536 |

### 현재 설정
- **기본 모델**: `BAAI/bge-small-en-v1.5` (384차원, 빠름)
- **업그레이드 옵션**: `BAAI/bge-m3` (1024차원, 다국어 지원)

### 환경 변수
```bash
# 문서 임베딩 (공고문용)
DOC_EMBED_MODEL=BAAI/bge-m3

# 기업 임베딩 (팀/기업용)
COMPANY_EMBED_MODEL=multilingual-e5-large
# 또는
COMPANY_EMBED_MODEL=text-embedding-3-small
```

## 3️⃣ 벡터DB (Vector Store)

| 종류 | 역할 | 상태 |
|------|------|------|
| **Supabase pgvector** | 메인 벡터 저장소 (무료 + SQL 기반) | ✅ 사용 중 |
| **Chroma / Qdrant** (선택) | 로컬 실험 또는 빠른 검색용 | 선택사항 |

### 테이블 구조
- `announcement_chunks`: 공고문 청크 및 임베딩
- `team_embeddings`: 팀/기업 임베딩

## 4️⃣ 검색 (Retrieval)

### Hybrid Search 구조
- **키워드 검색** + **의미 기반 검색** 병행
- 예: "클라우드 플랫폼 개발" 검색 시
  - "클라우드" 키워드 매칭
  - 임베딩 유사도 검색

### RAG 파이프라인 예시
```python
query = "AI 플랫폼 구축 관련 최근 공고"
docs = retriever.similarity_search(query, top_k=5)
context = "\n".join([d.page_content for d in docs])
answer = llm.generate(f"다음 자료를 참고해 요약:\n{context}")
```

## 5️⃣ 생성 (Generation)

| 단계 | 모델 | 출력 예시 |
|------|------|----------|
| **공고 분석** | Llama3 / GPT-4 | 요구기술, 예산, 기간 요약 |
| **매칭 추천** | Llama3 / GPT-4 | 상위 3개 팀 및 추천 사유 |
| **견적 생성** | Llama3 / GPT-4 | 표준 견적서 초안 자동 생성 |

### 현재 설정
- **LLM**: Ollama (로컬, 무료)
  - 기본 모델: `mistral` (한국어 성능 우수)
  - 대안: `llama3`, `phi3`

## 6️⃣ 폴더 구조 (간단형)

```
backend/data/
├── bids/           # 조달청 공고 관련 (RAG 입력)
│   ├── 008R_입찰공고.csv
│   ├── 010R_통합공고.csv
│   ├── 공고문.hwpx
│   ├── 과업지시서.hwpx
│   ├── 제안요청서.hwpx
│   └── 협약서.pdf
│
└── companies/      # 기업 추천용 데이터
    ├── 기업등록.csv
    ├── R&D_과제.csv
    └── 수행이력.csv
```

## 🚀 사용 방법

### 견적서 RAG 처리
```bash
cd backend
python scripts/batch_ingest.py data/bids
```

### 기업 추천 처리 (추후 구현)
```bash
python scripts/batch_ingest.py data/companies
```

## 📊 처리 파이프라인

```
bids/ → 텍스트 추출 → 청킹 → 임베딩 → Supabase 저장
companies/ → CSV 파싱 → 임베딩 → Supabase 저장
```

## 🔧 확장 옵션

파일이 많아질 경우 하위 폴더 추가:

```
backend/data/bids/
├── raw/          # 원본 파일
├── processed/    # 전처리 완료
└── ...
```

