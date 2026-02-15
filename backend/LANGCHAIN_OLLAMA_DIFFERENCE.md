# langchain-community vs langchain-ollama 차이점

## 차이점 요약

### langchain-community.llms.Ollama
- **상태**: Deprecated (LangChain 0.3.1부터, 1.0.0에서 제거 예정)
- **장점**: 
  - 안정적이고 검증됨
  - `think` 파라미터 에러 없음
  - 호환성 문제 적음
- **단점**: 
  - Deprecated 경고 메시지 출력
  - 향후 버전에서 제거될 예정
  - 최신 Ollama 기능 지원이 느릴 수 있음

### langchain-ollama.OllamaLLM
- **상태**: 최신 공식 패키지 (권장)
- **장점**: 
  - 공식 지원
  - 최신 Ollama 기능 빠르게 지원
  - Deprecated 경고 없음
- **단점**: 
  - `ollama` 0.6.1과 호환성 문제 (`think` 파라미터 에러)
  - 일부 버전에서 불안정할 수 있음

## 현재 문제

- `langchain-ollama` 1.0.0 + `ollama` 0.6.1 조합에서 `think` 파라미터 에러 발생
- `langchain-community` 사용 시 Deprecated 경고 메시지 출력

## 해결 방법

### 방법 1: Deprecated 경고 무시 (현재 적용됨)

`langchain-community`를 사용하되 경고를 필터링:

```python
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning, module="langchain")
```

### 방법 2: langchain-ollama 사용 (think 에러 처리)

`langchain-ollama`를 사용하되, `think` 에러 발생 시 `langchain-community`로 fallback (현재 코드에 구현됨)

### 방법 3: ollama 패키지 업그레이드 (시도해볼 수 있음)

```bash
pip install --upgrade ollama
```

하지만 이 방법은 다른 호환성 문제를 일으킬 수 있습니다.

## 권장 사항

현재는 **`langchain-community`를 우선 사용**하되, Deprecated 경고를 필터링하는 것이 가장 안정적입니다.

향후 `langchain-ollama`가 안정화되면 전환할 수 있습니다.

