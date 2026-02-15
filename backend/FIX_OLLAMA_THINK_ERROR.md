# Ollama `think` 파라미터 에러 해결 방법

## 문제
```
TypeError: Client.generate() got an unexpected keyword argument 'think'
```

## 원인
`langchain-ollama` 1.0.0 버전과 `ollama` 패키지 간의 호환성 문제입니다.

## 해결 방법

### 방법 1: 가상환경에서 올바른 버전 설치 (권장)

```bash
# 1. 가상환경 활성화
cd backend
venv\Scripts\activate  # Windows

# 2. 호환되는 버전으로 설치
pip install langchain-ollama==1.0.0
pip install ollama==0.6.1

# 3. 또는 requirements.txt로 설치
pip install -r requirements.txt
```

### 방법 2: langchain-community 사용 (대안)

`langchain-ollama` 대신 `langchain-community`의 `Ollama`를 사용하도록 코드가 자동으로 fallback합니다.

하지만 명시적으로 사용하려면:

```bash
pip install langchain-community==0.4.1
```

## 확인 방법

가상환경에서 버전 확인:

```bash
venv\Scripts\activate
pip show langchain-ollama ollama
```

## 참고

- 가상환경을 사용하지 않으면 시스템 Python에 설치되어 버전 충돌이 발생할 수 있습니다
- 반드시 `venv\Scripts\activate`로 가상환경을 활성화한 후 실행하세요

