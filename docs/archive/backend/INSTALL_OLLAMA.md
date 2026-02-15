# 🤖 Ollama 설치 가이드 (Windows)

## 설치 방법

### 1단계: Ollama 다운로드

1. **공식 사이트**: https://ollama.ai/download
2. **Windows 버전 다운로드** 클릭
3. 설치 파일 실행 (`OllamaSetup.exe`)

### 2단계: 설치 확인

새 PowerShell 터미널을 열고:

```bash
ollama --version
```

버전이 표시되면 설치 완료!

### 3단계: 모델 다운로드

```bash
ollama pull llama3
```

또는 더 가벼운 모델:

```bash
ollama pull phi3      # 가장 가볍고 빠름 (2.3GB)
ollama pull mistral    # 한국어 성능 좋음 (4.1GB)
```

### 4단계: 테스트

```bash
ollama run llama3 "안녕하세요"
```

## ⚠️ 중요

- **설치 후 새 터미널을 열어야 PATH가 적용됩니다**
- **기존 터미널은 닫고 새로 열어주세요**

## 🔄 설치 후

1. 백엔드 서버 재시작
2. Streamlit에서 질문하면 LLM 답변이 생성됩니다

## 💡 Ollama 없이도 가능

Ollama가 없어도 **검색 기능은 작동합니다**:
- ✅ 벡터 검색 (문서 찾기)
- ✅ 관련 문서 표시
- ❌ LLM 답변 생성 (Ollama 필요)

Ollama 없이도 검색된 문서를 볼 수 있습니다!

