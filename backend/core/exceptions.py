"""
커스텀 예외 클래스
"""


class BaseAPIException(Exception):
    """기본 API 예외 클래스"""
    def __init__(self, message: str, status_code: int = 500, detail: str = None):
        self.message = message
        self.status_code = status_code
        self.detail = detail or message
        super().__init__(self.message)


class ValidationError(BaseAPIException):
    """유효성 검사 오류"""
    def __init__(self, message: str, detail: str = None):
        super().__init__(message, status_code=400, detail=detail)


class NotFoundError(BaseAPIException):
    """리소스를 찾을 수 없음"""
    def __init__(self, message: str, detail: str = None):
        super().__init__(message, status_code=404, detail=detail)


class UnauthorizedError(BaseAPIException):
    """인증 오류"""
    def __init__(self, message: str = "인증이 필요합니다", detail: str = None):
        super().__init__(message, status_code=401, detail=detail)


class ForbiddenError(BaseAPIException):
    """권한 오류"""
    def __init__(self, message: str = "권한이 없습니다", detail: str = None):
        super().__init__(message, status_code=403, detail=detail)


class InternalServerError(BaseAPIException):
    """내부 서버 오류"""
    def __init__(self, message: str = "내부 서버 오류가 발생했습니다", detail: str = None):
        super().__init__(message, status_code=500, detail=detail)


class DocumentProcessingError(BaseAPIException):
    """문서 처리 오류"""
    def __init__(self, message: str, detail: str = None):
        super().__init__(message, status_code=422, detail=detail)


class LLMServiceError(BaseAPIException):
    """LLM 서비스 오류"""
    def __init__(self, message: str, detail: str = None):
        super().__init__(message, status_code=503, detail=detail)

