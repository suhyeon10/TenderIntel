# 🚀 빠른 시작 가이드

서버가 실행되었으니 이제 테스트해보세요!

## 1️⃣ API 문서 확인 (가장 쉬움)

브라우저에서 열기:
```
http://localhost:8000/docs
```

여기서:
- ✅ 모든 API 엔드포인트 확인
- ✅ 직접 테스트 가능
- ✅ 요청/응답 형식 확인

## 2️⃣ 간단한 헬스 체크

터미널에서:
```bash
curl http://localhost:8000/api/health
```

또는 브라우저에서:
```
http://localhost:8000/api/health
```

## 3️⃣ 해커톤 모드 설정 (선택사항)

**Ollama를 사용하려면:**

1. Ollama 설치: https://ollama.com
2. 모델 다운로드:
```bash
ollama pull llama3
```

3. `.env` 파일에 추가:
```env
USE_HACKATHON_MODE=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3
USE_LOCAL_EMBEDDING=true
LOCAL_EMBEDDING_MODEL=BAAI/bge-small-en-v1.5
```

4. 서버 재시작

## 4️⃣ 공고 업로드 테스트

### 방법 1: API 문서에서 테스트
1. `http://localhost:8000/docs` 접속
2. `POST /api/announcements/upload` 클릭
3. "Try it out" 클릭
4. PDF 파일 업로드
5. "Execute" 클릭

### 방법 2: curl 사용
```bash
curl -X POST "http://localhost:8000/api/announcements/upload" \
  -F "file=@your_announcement.pdf" \
  -F "title=테스트 공고" \
  -F "source=manual"
```

### 방법 3: Python 스크립트
```python
import requests

url = "http://localhost:8000/api/announcements/upload"
files = {"file": open("announcement.pdf", "rb")}
data = {
    "title": "테스트 공고",
    "source": "manual"
}

response = requests.post(url, files=files, data=data)
print(response.json())
```

## 5️⃣ 현재 사용 중인 설정 확인

서버 로그를 보면:
- ✅ Supabase 연결됨
- ⚠️ ChromaDB 사용 안 함 (정상, Supabase 사용 중)

## 📋 체크리스트

- [ ] API 문서 확인 (`/docs`)
- [ ] 헬스 체크 성공 (`/api/health`)
- [ ] 해커톤 모드 설정 (선택)
- [ ] 공고 업로드 테스트

## 🎯 추천 순서

1. **지금 바로**: `http://localhost:8000/docs` 열어보기
2. **다음**: 헬스 체크 테스트
3. **그 다음**: 해커톤 모드 설정 (Ollama 사용 시)
4. **마지막**: 실제 공고 파일 업로드 테스트

## 💡 팁

- API 문서(`/docs`)에서 모든 것을 테스트할 수 있습니다
- 해커톤 모드는 나중에 설정해도 됩니다
- 지금은 기본 설정으로도 작동합니다
