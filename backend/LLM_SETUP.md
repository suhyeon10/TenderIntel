# LLM 설정 가이드

이 프로젝트는 **Groq**와 **Ollama** 두 가지 LLM 제공자를 지원합니다. 환경변수로 쉽게 전환할 수 있습니다.

**적용 범위:**
- 계약서 분석 (`analyze_contract`)
- 법률 상담 (`chat`)
- 상황분석 (`analyze_situation`) - **LangGraph 워크플로우 및 기존 단일 스텝 방식 모두 지원**

## 설정 방법

### 1. .env 파일 생성

프로젝트 루트에 `.env` 파일을 생성하고 아래 내용을 추가하세요:

```env
# ============================================
# LLM Provider 선택 (필수)
# ============================================
# "groq" 또는 "ollama" 중 하나를 선택
LLM_PROVIDER=groq

# ============================================
# Groq 설정 (LLM_PROVIDER=groq일 때 사용)
# ============================================
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# ============================================
# Ollama 설정 (LLM_PROVIDER=ollama일 때 사용)
# ============================================
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# ============================================
# 기타 설정
# ============================================
LLM_TEMPERATURE=0.5
```

### 2. Groq 사용하기

`.env` 파일에서:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

**Groq API 키 발급:**
1. [Groq Console](https://console.groq.com/)에 접속
2. API 키 생성
3. `.env` 파일에 `GROQ_API_KEY`로 설정

### 3. Ollama 사용하기

`.env` 파일에서:

```env
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral
```

**Ollama 설치 및 실행:**
1. [Ollama 공식 사이트](https://ollama.ai/)에서 다운로드
2. 설치 후 터미널에서 실행:
   ```bash
   ollama serve
   ```
3. 모델 다운로드:
   ```bash
   ollama pull mistral
   # 또는
   ollama pull llama3
   ```

### 4. 설정 전환하기

Groq와 Ollama를 번갈아 사용하려면 `.env` 파일의 `LLM_PROVIDER` 값만 변경하면 됩니다:

**Groq로 전환:**
```env
LLM_PROVIDER=groq
```

**Ollama로 전환:**
```env
LLM_PROVIDER=ollama
```

변경 후 서버를 재시작하면 자동으로 적용됩니다.

## 지원 모델

### Groq 모델
- `llama-3.3-70b-versatile` (기본값, 추천)
- `llama-3.1-8b-instant`
- `llama-3.1-70b-versatile`
- `mixtral-8x7b-32768`

### Ollama 모델
- `mistral` (기본값, 한국어 성능 우수)
- `llama3`
- `phi3`
- 기타 Ollama에서 지원하는 모든 모델

## 확인 방법

서버 시작 시 콘솔에 다음과 같은 메시지가 표시됩니다:

```
[설정] LLM Provider: Groq (모델: llama-3.3-70b-versatile)
```

또는

```
[설정] LLM Provider: Ollama (모델: mistral)
```

## 문제 해결

### Groq 사용 시 에러
- `GROQ_API_KEY`가 올바르게 설정되었는지 확인
- API 키가 유효한지 확인
- 인터넷 연결 확인

### Ollama 사용 시 에러
- Ollama 서버가 실행 중인지 확인: `ollama serve`
- 모델이 다운로드되었는지 확인: `ollama list`
- `OLLAMA_BASE_URL`이 올바른지 확인 (기본값: `http://localhost:11434`)

