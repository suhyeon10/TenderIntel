# 🔄 재시작 후 설치 가이드

Long Path 활성화 후 **반드시 재시작**해야 합니다.

## ✅ 재시작 후 확인

### 1. Long Path 활성화 확인

```powershell
reg query "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled
```

값이 `0x1`이어야 합니다.

### 2. sentence-transformers 설치

```bash
pip install sentence-transformers
```

### 3. 설치 확인

```bash
python -c "from sentence_transformers import SentenceTransformer; print('설치 완료!')"
```

## 🚀 다음 단계

설치 완료 후:

### 1. 문서 인덱싱

```bash
cd backend
python scripts/simple_ingest.py --docs-dir backend/data/announcements
```

### 2. 백엔드 서버 실행

```bash
python -m uvicorn main:app --reload
```

### 3. 프론트엔드 실행 (새 터미널)

```bash
streamlit run frontend/streamlit_app.py
```

## 🎉 완성!

이제 완전 무료 RAG 시스템을 사용할 수 있습니다!

