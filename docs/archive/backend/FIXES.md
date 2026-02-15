# 수정 사항

## ✅ LangChain 모듈 경로 수정

### 문제
```
ModuleNotFoundError: No module named 'langchain.text_splitter'
```

### 원인
LangChain 최신 버전(1.0+)에서는 `text_splitter`가 별도 패키지로 분리되었습니다.

### 해결
`backend/core/document_processor.py` 파일 수정:

**변경 전:**
```python
from langchain.text_splitter import RecursiveCharacterTextSplitter
```

**변경 후:**
```python
from langchain_text_splitters import RecursiveCharacterTextSplitter
```

### 확인
`langchain-text-splitters` 패키지는 이미 설치되어 있습니다 (의존성에 포함됨).

## ✅ LangChain prompts 모듈 경로 수정

### 문제
```
ModuleNotFoundError: No module named 'langchain.prompts'
```

### 해결
`backend/core/generator.py` 및 `backend/core/bidding_rag.py` 파일 수정:

**변경 전:**
```python
from langchain.prompts import ChatPromptTemplate
from langchain.output_parsers import PydanticOutputParser
```

**변경 후:**
```python
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
```

## 📝 참고

LangChain 1.0+ 주요 변경사항:
- `langchain.text_splitter` → `langchain_text_splitters`
- `langchain.prompts` → `langchain_core.prompts`
- `langchain.output_parsers` → `langchain_core.output_parsers`
- `langchain.document_loaders` → `langchain_community.document_loaders`
- `langchain.vectorstores` → `langchain_community.vectorstores`

