# 🚀 해커톤용 완전 무료 RAG 시스템

OpenAI 과금 없이 완전 무료로 RAG를 구축하는 방법입니다.

## ✨ 특징

- ✅ **완전 무료**: OpenAI API 키 불필요
- ✅ **로컬 실행**: Ollama + sentence-transformers
- ✅ **간단한 UI**: Streamlit 프론트엔드
- ✅ **유연한 저장소**: Supabase 또는 ChromaDB 선택 가능

## 📦 빠른 시작

### 1. 필수 설치

```bash
# Python 패키지
pip install -r backend/requirements.txt

# Ollama 설치: https://ollama.com/download
ollama pull llama3
```

### 2. Windows Long Path 활성화 (필수)

관리자 PowerShell:
```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

**재시작 필수!**

### 3. 환경 변수 설정

`backend/.env`:
```env
USE_HACKATHON_MODE=true
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-key
OLLAMA_MODEL=llama3
```

### 4. 문서 인덱싱

```bash
cd backend
python scripts/simple_ingest.py --docs-dir ./data/announcements
```

### 5. 서버 실행

```bash
# 백엔드
python -m uvicorn main:app --reload

# 프론트엔드 (새 터미널)
streamlit run frontend/streamlit_app.py
```

## 📁 프로젝트 구조

```
linkers-public/
├── backend/
│   ├── scripts/
│   │   ├── batch_ingest.py      # 배치 처리
│   │   └── simple_ingest.py     # 간단한 인덱싱
│   ├── data/
│   │   └── announcements/      # 문서 폴더
│   └── main.py                  # FastAPI 서버
│
└── frontend/
    └── streamlit_app.py         # Streamlit UI
```

## 🎯 사용 방법

### 문서 인덱싱

```bash
# Supabase 사용 (기본)
python scripts/simple_ingest.py

# ChromaDB 사용
python scripts/simple_ingest.py --chromadb
```

### API 사용

```bash
# 검색
curl "http://localhost:8000/api/v2/announcements/search?query=예산은%20얼마인가요"

# 업로드
curl -X POST http://localhost:8000/api/v2/announcements/upload \
  -F "file=@공고.pdf"
```

### Streamlit UI

브라우저에서 `http://localhost:8501` 접속:
- 💬 Q&A: 질문하기
- 📄 문서 업로드: PDF 업로드 및 인덱싱
- 📊 상태 확인: 시스템 상태 확인

## 💡 완전 무료 스택

| 구성 요소 | 기술 | 비용 |
|---------|------|------|
| **임베딩** | sentence-transformers (bge-m3) | 0원 |
| **LLM** | Ollama (llama3) | 0원 |
| **벡터 DB** | Supabase (무료 티어) 또는 ChromaDB | 0원 |
| **서버** | FastAPI | 0원 |
| **UI** | Streamlit | 0원 |

## 📚 상세 문서

- [해커톤 빠른 시작](./backend/HACKATHON_QUICK_START.md)
- [완전 무료 RAG 스택](./backend/COMPLETE_FREE_RAG.md)
- [해커톤 설정 가이드](./backend/HACKATHON_SETUP.md)

## 🎉 완성!

이제 완전 무료로 RAG 시스템을 사용할 수 있습니다!

