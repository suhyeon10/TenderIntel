# 문제 해결 가이드

Linkus Public RAG Backend에서 발생할 수 있는 문제와 해결 방법을 안내합니다.

## 📑 목차

1. [일반적인 문제](#일반적인-문제)
2. [ChromaDB 관련 문제](#chromadb-관련-문제)
3. [OpenAI API 관련 문제](#openai-api-관련-문제)
4. [PDF 처리 관련 문제](#pdf-처리-관련-문제)
5. [기타 문제](#기타-문제)
6. [추가 도움말](#추가-도움말)

---

## 일반적인 문제

### 서버가 시작되지 않는 경우

#### 1. 포트가 이미 사용 중인 경우

**Windows:**
```bash
# 포트 사용 중인 프로세스 확인
netstat -ano | findstr :8000

# 프로세스 종료 (PID 확인 후)
taskkill /PID [PID번호] /F
```

**Linux/Mac:**
```bash
# 포트 사용 중인 프로세스 확인
lsof -i :8000

# 프로세스 종료
kill -9 [PID번호]
```

**해결 방법:**
- 다른 포트 사용: `.env` 파일에서 `PORT=8001`로 변경

---

#### 2. Python 버전 오류

**증상:**
- Python 버전 관련 에러 메시지

**해결 방법:**
- Python 3.9 이상이 필요합니다
- `python --version`으로 버전 확인
- 필요시 Python 업그레이드

---

#### 3. 의존성 설치 오류

**해결 방법:**
```bash
# pip 업그레이드
pip install --upgrade pip

# 의존성 재설치
pip install -r requirements.txt --force-reinstall
```

**추가 확인:**
- 가상환경이 활성화되어 있는지 확인
- 인터넷 연결 확인
- 방화벽 설정 확인

---

## ChromaDB 관련 문제

### 벡터 DB 디렉토리 생성 실패

**증상:**
- 디렉토리 생성 권한 오류

**해결 방법:**
```bash
# 수동으로 디렉토리 생성
mkdir -p data/chroma_db
mkdir -p data/temp

# 권한 확인 (Linux/Mac)
chmod -R 755 data/
```

---

### ChromaDB 버전 호환성 문제

**증상:**
- ChromaDB 관련 import 오류
- 버전 충돌 메시지

**해결 방법:**
```bash
# ChromaDB 재설치
pip uninstall chromadb
pip install chromadb==0.4.22
```

---

## OpenAI API 관련 문제

### API 키 오류

**증상:**
- `Invalid API key` 에러
- API 호출 실패

**해결 방법:**
1. `.env` 파일에 `OPENAI_API_KEY`가 올바르게 설정되었는지 확인
2. API 키 앞뒤 공백 제거
3. 환경 변수 로드 확인:
   ```python
   from config import settings
   print(settings.openai_api_key[:10] + "...")  # 키 일부만 출력
   ```

---

### API 사용량 제한

**증상:**
- Rate limit 오류
- 사용량 초과 메시지

**해결 방법:**
- OpenAI 대시보드에서 사용량 확인
- 필요시 더 높은 등급의 API 키 사용
- Rate limit 오류 시 재시도 로직 추가 고려

---

### 모델 이름 오류

**증상:**
- `Model not found` 에러

**해결 방법:**
- `EMBEDDING_MODEL`과 `LLM_MODEL`이 올바른지 확인
- 사용 가능한 모델 목록: https://platform.openai.com/docs/models
- `.env` 파일에서 모델 이름 확인

---

## PDF 처리 관련 문제

### PDF 파일을 읽을 수 없는 경우

**증상:**
- PDF 파싱 오류
- 텍스트 추출 실패

**해결 방법:**
1. PDF 파일이 손상되지 않았는지 확인
2. 다른 PDF 뷰어로 파일 열기 테스트
3. 스캔된 PDF의 경우 OCR이 필요할 수 있음
4. PDF 버전 확인 (너무 오래된 버전은 지원하지 않을 수 있음)

---

### 메모리 부족 오류

**증상:**
- 메모리 부족 에러
- 큰 파일 처리 시 오류

**해결 방법:**
- 큰 PDF 파일의 경우 청크 크기 조정:
  ```env
  CHUNK_SIZE=500
  CHUNK_OVERLAP=100
  ```
- 서버 메모리 확인 및 증설 고려

---

## 기타 문제

### 모듈을 찾을 수 없는 경우

**증상:**
- `ModuleNotFoundError`
- Import 오류

**해결 방법:**
```bash
# 현재 디렉토리 확인
pwd  # Linux/Mac
cd   # Windows

# backend 디렉토리에서 실행하는지 확인
ls main.py  # 파일 존재 확인

# 가상환경 활성화 확인
# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

---

### 가상환경이 활성화되지 않은 경우

**증상:**
- 패키지를 찾을 수 없음
- 시스템 Python과 혼동

**해결 방법:**
```bash
# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

# 활성화 확인 (프롬프트에 (venv) 표시됨)
```

---

### CORS 오류 (프론트엔드 연동 시)

**증상:**
- 브라우저 콘솔에 CORS 에러
- 프론트엔드에서 API 호출 실패

**해결 방법:**
1. `main.py`의 CORS 설정 확인
2. 프론트엔드 도메인을 `allow_origins`에 추가:
   ```python
   allow_origins=["http://localhost:3000", "https://your-domain.com"]
   ```
3. 개발 환경에서는 `allow_origins=["*"]` 사용 가능 (프로덕션에서는 권장하지 않음)

---

## 추가 도움말

### 로그 확인

**로그 파일 위치:**
- `./logs/server_YYYYMMDD.log`

**로그 레벨 변경:**
- `.env` 파일에서 `LOG_LEVEL=DEBUG` 설정

**실시간 로그 확인:**
- 터미널 출력 또는 로그 파일 모니터링

---

### 에러 처리

**에러 응답 형식:**
모든 에러는 일관된 JSON 형식으로 반환됩니다:
```json
{
  "status": "error",
  "message": "에러 메시지",
  "detail": "상세 정보",
  "path": "/api/endpoint"
}
```

---

### 문제 해결 체크리스트

문제가 지속되면 다음을 확인하세요:

1. **로그 확인**: `./logs/` 디렉토리의 로그 파일 확인
2. **API 문서 확인**: http://localhost:8000/docs
3. **아키텍처 문서 확인**: [ARCHITECTURE_IMPROVEMENTS.md](./ARCHITECTURE_IMPROVEMENTS.md)
4. **환경 변수 확인**: `.env` 파일의 모든 필수 변수 확인
5. **의존성 확인**: `requirements.txt`의 모든 패키지가 설치되었는지 확인
6. **이슈 리포트**: GitHub Issues에 문제 상세 내용 작성

---

## 추가 정보

- 설정 관련 상세 내용은 [CONFIGURATION.md](./CONFIGURATION.md)를 참고하세요
- API 사용법은 [API_REFERENCE.md](./API_REFERENCE.md)를 참고하세요
- 테스트 방법은 [TESTING.md](./TESTING.md)를 참고하세요

