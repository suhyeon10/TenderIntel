# 설치 문제 해결 가이드

## 🔴 발생한 문제

### chroma-hnswlib 빌드 오류
```
error: Microsoft Visual C++ 14.0 or greater is required.
```

**원인**: Windows에서 C++ 확장 모듈을 빌드하려면 Visual C++ Build Tools가 필요합니다.

## ✅ 해결 방법

### 방법 1: Microsoft C++ Build Tools 설치 (권장)

1. **다운로드**
   - https://visualstudio.microsoft.com/visual-cpp-build-tools/ 접속
   - "Build Tools for Visual Studio 2022" 다운로드

2. **설치**
   - 다운로드한 설치 프로그램 실행
   - "C++ build tools" 워크로드 선택
   - 설치 (약 3-6GB)

3. **재설치**
   ```bash
   cd backend
   venv\Scripts\activate
   pip install -r requirements.txt
   ```

### 방법 2: ChromaDB 없이 사용 (임시 해결)

현재 프로젝트는 Supabase pgvector를 사용하므로 ChromaDB는 선택사항입니다.

**requirements.txt 수정**:
```txt
# chromadb==0.4.22  # 주석 처리
```

**의존성 재설치**:
```bash
cd backend
venv\Scripts\activate
pip install -r requirements.txt
```

### 방법 3: Pre-built Wheel 사용

```bash
# 먼저 다른 패키지 설치
pip install fastapi uvicorn langchain langchain-openai pypdf python-dotenv pydantic

# ChromaDB는 나중에 필요할 때 설치
# pip install chromadb --no-build-isolation
```

## 📝 현재 상태

- ✅ Python 3.12.10 설치 완료
- ✅ 가상환경 생성 완료
- ⚠️ 의존성 설치 중 chroma-hnswlib 빌드 오류
- ✅ 다른 패키지는 정상 설치됨

## 🚀 다음 단계

### 옵션 A: Build Tools 설치 후 계속
1. Microsoft C++ Build Tools 설치
2. `pip install -r requirements.txt` 재실행

### 옵션 B: ChromaDB 없이 진행
1. `requirements.txt`에서 chromadb 주석 처리
2. `pip install -r requirements.txt` 재실행
3. Backend RAG는 Supabase pgvector 사용 (이미 구현됨)

## 💡 권장 사항

**해커톤/빠른 시작**: 옵션 B (ChromaDB 제외)
- Supabase pgvector로 충분히 작동
- 추가 설치 시간 절약

**프로덕션**: 옵션 A (Build Tools 설치)
- ChromaDB의 추가 기능 활용 가능

