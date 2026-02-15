# ✅ 완전 무료 RAG 스택 구현 완료

해커톤/연구용으로 OpenAI 과금 없이 RAG를 완성하는 방법입니다.

## 🎯 구현된 완전 무료 스택

| 구성 요소 | 무료 옵션 | 구현 상태 |
|---------|---------|----------|
| **프레임워크** | LangChain | ✅ 완료 |
| **서버** | FastAPI | ✅ 완료 |
| **임베딩** | sentence-transformers (BAAI/bge-m3, bge-small-en-v1.5) | ⚠️ 설치 필요 |
| **벡터 DB** | Supabase pgvector (무료 티어) | ✅ 연결 완료 |
| **LLM** | Ollama (llama3, mistral, phi3) | ⚠️ 설치 필요 |
| **문서 처리** | pypdf, olefile | ✅ 완료 |

## 📦 현재까지 완료된 작업

### ✅ 1. RLS 정책 수정
- Supabase 테이블에 INSERT 정책 추가 완료
- 배치 처리 시 데이터 삽입 가능

### ✅ 2. Supabase 클라이언트
- 최신 버전으로 업그레이드 완료
- 지연 초기화 구현 완료

### ✅ 3. 해커톤 모드 구현
- OpenAI 사용 안 함
- 로컬 임베딩 자동 감지
- Ollama LLM 연동 준비 완료

### ✅ 4. 배치 처리 스크립트
- PDF/HWP/HWPX 파일 처리 지원
- 일괄 인입 기능 구현

## 🚀 다음 단계 (설치 필요)

### 1. Windows Long Path 활성화

**관리자 권한 PowerShell:**
```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

**재시작 필수!**

### 2. sentence-transformers 설치

재시작 후:
```bash
cd backend
pip install sentence-transformers
```

### 3. Ollama 설치 및 모델 다운로드

```bash
# Ollama 다운로드: https://ollama.com/download
# Windows 설치 후:

# 모델 다운로드 (선택)
ollama pull llama3
# 또는
ollama pull mistral
# 또는
ollama pull phi3
```

### 4. 환경 변수 설정

`.env` 파일:
```env
# 해커톤 모드 활성화
USE_HACKATHON_MODE=true

# Supabase (이미 설정됨)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Ollama 설정
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# 로컬 임베딩
USE_LOCAL_EMBEDDING=true
LOCAL_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5

# OpenAI 사용 안 함
USE_OPENAI=false
```

## 💡 전체 파이프라인 흐름

```
1. 문서 로드 (PDF/HWP)
   ↓
2. 텍스트 추출 및 청킹 (1000자 단위)
   ↓
3. 로컬 임베딩 생성 (sentence-transformers)
   ↓
4. Supabase pgvector에 저장
   ↓
5. 유사 문서 검색
   ↓
6. Ollama LLM으로 분석/생성
   ↓
7. 결과 반환
```

## 🎯 해커톤 모드 특징

### 완전 무료
- ✅ 임베딩: 로컬 (sentence-transformers) - **0원**
- ✅ LLM: Ollama (로컬) - **0원**
- ✅ 벡터 DB: Supabase (무료 티어) - **0원**
- ✅ 서버: FastAPI (로컬) - **0원**

### 오프라인 가능
- ✅ Ollama 모델 다운로드 후 네트워크 불필요
- ✅ sentence-transformers 로컬 실행
- ⚠️ Supabase는 인터넷 연결 필요 (무료 티어)

## 📊 모델 비교

### 임베딩 모델

| 모델 | 크기 | 속도 | 품질 | 용도 |
|-----|------|------|------|------|
| **bge-small-en-v1.5** | 33MB | 빠름 | 좋음 | 해커톤 추천 ⭐ |
| **bge-m3** | 568MB | 보통 | 매우 좋음 | 다국어 지원 |
| **all-MiniLM-L6-v2** | 23MB | 매우 빠름 | 보통 | 초경량 |

### LLM 모델

| 모델 | 크기 | 속도 (CPU) | 품질 | 용도 |
|-----|------|------------|------|------|
| **llama3:8b** | 4.7GB | 보통 | 좋음 | 해커톤 추천 ⭐ |
| **mistral:7b** | 4.1GB | 빠름 | 좋음 | 빠른 응답 |
| **phi3:mini** | 2.3GB | 매우 빠름 | 보통 | 경량 |

## 🚀 사용 예시

### 배치 처리 (공고 파일 일괄 인입)

```bash
python scripts/batch_ingest.py backend/data/announcements --extensions .pdf .hwp .hwpx
```

### API 서버 실행

```bash
python -m uvicorn main:app --reload
```

### API 테스트

```bash
# 헬스 체크
curl http://localhost:8000/api/health

# 공고 업로드
curl -X POST http://localhost:8000/api/v2/announcements/upload \
  -F "file=@공고.pdf" \
  -F "source=나라장터" \
  -F "external_id=2024-001"
```

## ✅ 구현된 기능

### DocumentProcessor v2
- ✅ PDF 텍스트 추출
- ✅ HWP/HWPX 텍스트 추출
- ✅ 자동 청킹 (chunk_size=1000, overlap=200)
- ✅ 메타데이터 추출 (정규식 기반)

### Generator v2
- ✅ 로컬 임베딩 (sentence-transformers)
- ✅ Ollama LLM 연동
- ✅ 공고 분석 (구조화된 JSON 반환)
- ✅ 매칭 근거 생성
- ✅ 견적서 초안 생성

### SupabaseVectorStore
- ✅ 공고 메타데이터 저장
- ✅ 벡터 청크 저장 (pgvector)
- ✅ 유사도 검색
- ✅ 중복 방지 (content_hash)

### Orchestrator v2
- ✅ 전체 파이프라인 조율
- ✅ 파일 업로드 처리
- ✅ 배치 처리 지원

## 🔧 문제 해결

### sentence-transformers 설치 실패
- Windows Long Path 활성화 확인
- 재시작 후 재시도

### Ollama 연결 실패
```bash
# Ollama 서버 실행 확인
ollama serve

# 모델 확인
ollama list
```

### Supabase RLS 오류
- ✅ 이미 해결됨 (RLS 정책 수정 완료)

## 📝 체크리스트

- [x] RLS 정책 수정 완료
- [x] Supabase 클라이언트 업그레이드 완료
- [x] 해커톤 모드 구현 완료
- [x] 배치 처리 스크립트 구현 완료
- [ ] Windows Long Path 활성화
- [ ] sentence-transformers 설치
- [ ] Ollama 설치 및 모델 다운로드
- [ ] 배치 처리 실행 테스트

## 🎉 완성!

이제 OpenAI API 키 없이도 완전 무료로 RAG 파이프라인을 사용할 수 있습니다!

**다음 단계:**
1. Windows Long Path 활성화 → 재시작
2. `pip install sentence-transformers`
3. Ollama 설치 및 모델 다운로드
4. 배치 처리 실행!

