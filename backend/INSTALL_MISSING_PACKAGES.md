# 누락된 패키지 설치 가이드

성능 테스트나 LLM 기능 사용 시 필요한 패키지가 누락된 경우 설치 방법입니다.

## 문제 증상

- `Client.generate() got an unexpected keyword argument 'think'` 에러
- `langchain_ollama` import 실패
- LLM 응답 생성 실패

## 해결 방법

### 방법 1: requirements.txt로 전체 설치 (권장)

```bash
cd backend
pip install -r requirements.txt
```

### 방법 2: 개별 패키지 설치

```bash
# Ollama LLM 지원 패키지
pip install langchain-ollama

# 또는 가상환경 사용 시
venv\Scripts\activate  # Windows
pip install langchain-ollama
```

### 방법 3: 가상환경에서 설치 (가장 안전)

```bash
# 가상환경 활성화
cd backend
venv\Scripts\activate  # Windows
# 또는
source venv/bin/activate  # Linux/Mac

# 패키지 설치
pip install langchain-ollama
```

## 확인 방법

설치가 완료되었는지 확인:

```bash
python -c "import langchain_ollama; print('OK')"
```

또는

```bash
python -c "from langchain_community.llms import Ollama; print('OK')"
```

## 참고

- `langchain-ollama`가 없으면 `langchain-community`의 `Ollama`를 fallback으로 사용합니다
- 하지만 최신 버전에서는 `langchain-ollama` 사용을 권장합니다
- `requirements.txt`에 이미 포함되어 있으므로 `pip install -r requirements.txt`로 설치하면 됩니다

