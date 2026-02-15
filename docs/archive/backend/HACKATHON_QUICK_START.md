# 🚀 해커톤용 무료 RAG 시스템 빠른 시작

완전 무료 RAG 시스템 (Ollama + bge-m3 + Supabase/ChromaDB) 빠른 시작 가이드입니다.

## 📁 프로젝트 구조

```
linkers-public/
├── backend/
│   ├── scripts/
│   │   ├── batch_ingest.py      # 배치 처리 (기존)
│   │   └── simple_ingest.py     # 간단한 인덱싱 (새로 추가)
│   ├── data/
│   │   └── announcements/      # 문서 폴더
│   ├── main.py                  # FastAPI 서버
│   └── .env                     # 환경 변수
│
└── frontend/
    └── streamlit_app.py         # Streamlit UI (새로 추가)
```

## ⚙️ 1. 환경 설정

### 필수 패키지 설치

```bash
cd backend
pip install fastapi uvicorn langchain langchain-community chromadb sentence-transformers pypdf streamlit
```

### Ollama 설치 및 모델 다운로드

```bash
# Ollama 설치: https://ollama.com/download
# Windows: 다운로드 후 설치
# Mac: brew install ollama
# Linux: curl -fsSL https://ollama.com/install.sh | sh

# 모델 다운로드
ollama pull llama3
# 또는
ollama pull mistral
# 또는
ollama pull phi3
```

### Windows Long Path 활성화 (필수)

관리자 권한 PowerShell:
```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

**재시작 필수!**

## 🔧 2. 환경 변수 설정

`backend/.env` 파일:

```env
# 해커톤 모드 활성화
USE_HACKATHON_MODE=true

# Supabase (무료 티어)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 또는 ChromaDB 사용
# USE_CHROMADB=true
# CHROMA_PERSIST_DIR=./data/chroma_db

# Ollama 설정
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# 로컬 임베딩
USE_LOCAL_EMBEDDING=true
LOCAL_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5

# OpenAI 사용 안 함
USE_OPENAI=false
```

## 📦 3. 문서 인덱싱

### 방법 1: 간단한 인덱싱 스크립트 (추천)

```bash
cd backend
python scripts/simple_ingest.py --docs-dir ./data/announcements
```

### 방법 2: ChromaDB 사용

```bash
python scripts/simple_ingest.py --docs-dir ./data/announcements --chromadb
```

### 방법 3: 배치 처리 (기존)

```bash
python scripts/batch_ingest.py backend/data/announcements --extensions .pdf .hwp .hwpx
```

## 🚀 4. 백엔드 서버 실행

```bash
cd backend
python -m uvicorn main:app --reload
```

서버가 `http://localhost:8000`에서 실행됩니다.

### API 테스트

```bash
# 헬스 체크
curl http://localhost:8000/api/health

# 검색
curl "http://localhost:8000/api/v2/announcements/search?query=이%20문서의%20핵심%20내용은&limit=5"
```

## 🎨 5. 프론트엔드 실행 (선택사항)

```bash
# 새 터미널에서
streamlit run frontend/streamlit_app.py
```

브라우저에서 `http://localhost:8501`이 자동으로 열립니다.

## 💡 사용 예시

### 1. 문서 인덱싱

```bash
# PDF 파일을 data/announcements/ 폴더에 넣고
python scripts/simple_ingest.py
```

### 2. 질문하기

**Streamlit UI 사용:**
- 브라우저에서 질문 입력
- 자동으로 답변 생성

**API 직접 사용:**
```bash
curl "http://localhost:8000/api/v2/announcements/search?query=예산은%20얼마인가요&limit=3"
```

### 3. 문서 업로드

**Streamlit UI 사용:**
- 문서 업로드 탭에서 PDF 업로드
- 자동 인덱싱

**API 직접 사용:**
```bash
curl -X POST http://localhost:8000/api/v2/announcements/upload \
  -F "file=@공고.pdf" \
  -F "source=나라장터" \
  -F "external_id=2024-001"
```

## 🎯 완전 무료 스택

| 구성 요소 | 기술 | 비용 |
|---------|------|------|
| **임베딩** | sentence-transformers (bge-m3) | 0원 |
| **LLM** | Ollama (llama3) | 0원 |
| **벡터 DB** | Supabase (무료 티어) 또는 ChromaDB (로컬) | 0원 |
| **서버** | FastAPI (로컬) | 0원 |
| **UI** | Streamlit (로컬) | 0원 |

## 📊 전체 파이프라인

```
1. 문서 폴더 (PDF/TXT)
   ↓
2. 문서 로드 및 청킹
   ↓
3. 로컬 임베딩 생성 (sentence-transformers)
   ↓
4. 벡터 DB 저장 (Supabase/ChromaDB)
   ↓
5. 질문 입력
   ↓
6. 유사 문서 검색
   ↓
7. Ollama LLM으로 답변 생성
   ↓
8. 결과 반환
```

## ✅ 체크리스트

- [ ] Windows Long Path 활성화 및 재시작
- [ ] `pip install sentence-transformers` 완료
- [ ] Ollama 설치 및 모델 다운로드 (`ollama pull llama3`)
- [ ] `.env` 파일 설정 완료
- [ ] 문서 인덱싱 완료 (`python scripts/simple_ingest.py`)
- [ ] 백엔드 서버 실행 중 (`python -m uvicorn main:app --reload`)
- [ ] 프론트엔드 실행 중 (`streamlit run frontend/streamlit_app.py`)
- [ ] 질문 테스트 성공

## 🎉 완성!

이제 완전 무료로 RAG 시스템을 사용할 수 있습니다!

**다음 단계:**
1. 더 많은 문서 추가
2. Ollama 모델 변경 (mistral, phi3 등)
3. 임베딩 모델 변경 (bge-m3 등)
4. Streamlit UI 커스터마이징

