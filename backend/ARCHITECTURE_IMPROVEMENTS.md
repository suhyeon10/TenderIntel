# 백엔드 아키텍처 개선 보고서

## 개요
백엔드 코드에 공통 에러 핸들러, 로깅 설정 통합, 의존성 주입 패턴을 적용했습니다.

## 구현 내용

### 1. 공통 에러 핸들러 (`core/error_handler.py`)

#### 기능
- 모든 예외를 일관된 JSON 형식으로 처리
- 커스텀 예외 클래스 지원
- 상세한 에러 로깅
- FastAPI HTTP 예외 처리
- 유효성 검사 오류 처리

#### 사용 예시
```python
from core.exceptions import NotFoundError, ValidationError

# 커스텀 예외 사용
if not document:
    raise NotFoundError("문서를 찾을 수 없습니다", detail=f"doc_id: {doc_id}")

# 자동으로 JSON 응답으로 변환됨
# {
#   "status": "error",
#   "message": "문서를 찾을 수 없습니다",
#   "detail": "doc_id: abc123",
#   "path": "/api/v2/legal/contracts/abc123"
# }
```

#### 커스텀 예외 클래스 (`core/exceptions.py`)
- `BaseAPIException`: 기본 예외 클래스
- `ValidationError`: 유효성 검사 오류 (400)
- `NotFoundError`: 리소스 없음 (404)
- `UnauthorizedError`: 인증 오류 (401)
- `ForbiddenError`: 권한 오류 (403)
- `InternalServerError`: 내부 서버 오류 (500)
- `DocumentProcessingError`: 문서 처리 오류 (422)
- `LLMServiceError`: LLM 서비스 오류 (503)

### 2. 로깅 설정 통합 (`core/logging_config.py`)

#### 기능
- 중앙화된 로깅 설정
- 파일 및 콘솔 로깅 지원
- 로그 파일 로테이션
- uvicorn 로그 통합
- 환경 변수로 로그 레벨 제어

#### 사용 예시
```python
from core.logging_config import get_logger

logger = get_logger(__name__)

logger.info("정보 로그")
logger.warning("경고 로그")
logger.error("오류 로그", exc_info=True)
```

#### 설정
- 로그 디렉토리: `./logs`
- 로그 파일: `server_YYYYMMDD.log`
- 최대 파일 크기: 10MB
- 백업 파일 개수: 5개
- 로그 레벨: `LOG_LEVEL` 환경 변수로 제어 (기본값: INFO)

### 3. 의존성 주입 패턴 (`core/dependencies.py`)

#### 기능
- 싱글톤 패턴으로 서비스 인스턴스 관리
- FastAPI Depends 지원
- 레거시 코드 호환성 유지

#### 제공되는 의존성
- `get_orchestrator_dep()`: Orchestrator 인스턴스
- `get_legal_service_dep()`: Legal RAG Service 인스턴스
- `get_processor_dep()`: Document Processor 인스턴스
- `get_storage_service_dep()`: Contract Storage Service 인스턴스
- `get_task_manager_dep()`: Async Task Manager 인스턴스

#### 사용 예시

**방법 1: FastAPI Depends 사용 (권장)**
```python
from fastapi import Depends
from core.dependencies import get_orchestrator_dep
from core.orchestrator_v2 import Orchestrator

@router.post("/announcements/upload")
async def upload_announcement(
    orchestrator: Orchestrator = Depends(get_orchestrator_dep)
):
    result = orchestrator.process_file(...)
    return result
```

**방법 2: 직접 호출 (레거시 호환)**
```python
from core.dependencies import get_orchestrator

orchestrator = get_orchestrator()
result = orchestrator.process_file(...)
```

## 적용된 파일

### 새로 생성된 파일
- `backend/core/exceptions.py` - 커스텀 예외 클래스
- `backend/core/error_handler.py` - 에러 핸들러 미들웨어
- `backend/core/logging_config.py` - 로깅 설정 통합
- `backend/core/dependencies.py` - 의존성 주입 패턴

### 수정된 파일
- `backend/main.py` - 에러 핸들러 및 로깅 설정 적용
- `backend/api/routes_v2.py` - 의존성 주입 패턴 적용
- `backend/api/routes_legal_v2.py` - 의존성 주입 패턴 적용

## 마이그레이션 가이드

### 기존 코드에서 새 패턴으로 전환

#### 1. 에러 처리
**이전:**
```python
from fastapi import HTTPException

if not found:
    raise HTTPException(status_code=404, detail="찾을 수 없습니다")
```

**이후:**
```python
from core.exceptions import NotFoundError

if not found:
    raise NotFoundError("찾을 수 없습니다", detail=f"id: {id}")
```

#### 2. 로깅
**이전:**
```python
import logging
logger = logging.getLogger(__name__)
```

**이후:**
```python
from core.logging_config import get_logger
logger = get_logger(__name__)
```

#### 3. 서비스 인스턴스
**이전:**
```python
_orchestrator = None

def get_orchestrator():
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = Orchestrator()
    return _orchestrator
```

**이후:**
```python
from core.dependencies import get_orchestrator_dep
from fastapi import Depends

@router.post("/endpoint")
async def endpoint(orchestrator: Orchestrator = Depends(get_orchestrator_dep)):
    ...
```

## 장점

### 1. 에러 핸들러
- ✅ 일관된 에러 응답 형식
- ✅ 자동 에러 로깅
- ✅ 커스텀 예외로 명확한 에러 타입 구분
- ✅ 디버깅 용이성 향상

### 2. 로깅 통합
- ✅ 중앙화된 로깅 설정
- ✅ 일관된 로그 형식
- ✅ 환경 변수로 쉽게 제어
- ✅ 파일 및 콘솔 동시 출력

### 3. 의존성 주입
- ✅ 싱글톤 패턴으로 메모리 효율성
- ✅ 테스트 용이성 향상
- ✅ 코드 재사용성 증가
- ✅ 의존성 명시적 관리

## 향후 개선 사항

### 1. 완전한 의존성 주입 전환
현재는 레거시 호환성을 위해 두 가지 방식을 모두 지원합니다.
향후 모든 엔드포인트를 FastAPI Depends 패턴으로 전환하는 것을 권장합니다.

### 2. 에러 핸들러 확장
- 특정 예외 타입별 커스텀 처리
- 에러 알림 시스템 연동 (Slack, Email 등)
- 에러 통계 수집

### 3. 로깅 개선
- 구조화된 로깅 (JSON 형식)
- 로그 분석 도구 연동
- 성능 메트릭 로깅

## 참고 사항

- 모든 변경사항은 기존 코드와 호환되도록 설계되었습니다.
- 레거시 코드는 점진적으로 마이그레이션할 수 있습니다.
- 새로운 코드는 새로운 패턴을 사용하는 것을 권장합니다.

