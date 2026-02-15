# 🚀 Ollama 빠른 설치 (5분)

## Windows 설치

### 1단계: 다운로드
https://ollama.ai/download → Windows 버전 다운로드

### 2단계: 설치
- 다운로드한 `OllamaSetup.exe` 실행
- 설치 완료

### 3단계: 새 터미널 열기
**중요**: 기존 터미널을 닫고 새 PowerShell 터미널을 열어주세요!

### 4단계: 모델 다운로드
```bash
ollama pull llama3
```

다운로드 시간: 약 5-10분 (인터넷 속도에 따라 다름)

### 5단계: 테스트
```bash
ollama run llama3 "안녕하세요"
```

### 6단계: 서버 재시작
백엔드 서버를 재시작하면 LLM 답변이 생성됩니다!

## 더 가벼운 모델 (빠른 다운로드)

```bash
ollama pull phi3      # 2.3GB, 매우 빠름
ollama pull mistral   # 4.1GB, 한국어 성능 좋음
```

그리고 `.env` 파일에서:
```env
OLLAMA_MODEL=phi3  # 또는 mistral
```

## 완료 후

Streamlit에서 같은 질문을 다시 입력하면:
- ✅ 검색 결과
- ✅ LLM이 생성한 자연어 답변
- ✅ 문서 내용 요약

둘 다 받을 수 있습니다!

