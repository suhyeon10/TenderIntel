# Ollama 설정 확인 체크리스트

## ✅ 확인 완료된 항목

1. **Ollama 서버 실행 중** ✅
   - `ollama serve` 에러는 이미 실행 중이라는 의미 (정상)
   - `curl http://localhost:11434/api/tags` 응답 확인 완료

2. **모델 설치 완료** ✅
   - `mistral:latest` 설치됨
   - `llama3:latest` 설치됨

## 🔍 추가 확인 필요

### 1. .env 파일 설정 확인

`.env` 파일에서 다음 설정이 올바른지 확인:

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
```

또는 `mistral:latest`로 명시:

```env
OLLAMA_MODEL=mistral:latest
```

### 2. 최종 테스트

다음 명령으로 전체 설정 확인:

```bash
python scripts/test_ollama_setup.py
```

또는 성능 테스트 실행:

```bash
python scripts/performance_test.py
```

## 문제 해결

### 만약 여전히 에러가 발생한다면:

1. **langchain-ollama 설치 확인**
   ```bash
   pip install langchain-ollama
   ```

2. **가상환경 확인**
   ```bash
   venv\Scripts\activate  # Windows
   ```

3. **서버 재시작** (필요시)
   - Ollama 서버가 실행 중인지 확인
   - 다른 터미널에서 `ollama serve` 실행 중인지 확인

## 정상 작동 확인

다음이 모두 성공하면 정상입니다:

- ✅ `ollama list`에서 모델 목록 확인
- ✅ `curl http://localhost:11434/api/tags` 응답 확인
- ✅ `python scripts/test_ollama_setup.py` 모든 체크 통과
- ✅ `python scripts/performance_test.py` 정상 실행

