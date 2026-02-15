"""
공통 에러 핸들러 미들웨어
"""

from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
import traceback

from .exceptions import BaseAPIException

logger = logging.getLogger(__name__)


async def exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    전역 예외 핸들러
    
    모든 예외를 일관된 형식으로 처리합니다.
    """
    # 커스텀 예외 처리
    if isinstance(exc, BaseAPIException):
        logger.warning(
            f"API 예외 발생: {exc.message}",
            extra={
                "status_code": exc.status_code,
                "path": request.url.path,
                "method": request.method,
            }
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "status": "error",
                "message": exc.message,
                "detail": exc.detail,
                "path": request.url.path,
            }
        )
    
    # FastAPI HTTP 예외 처리
    if isinstance(exc, StarletteHTTPException):
        logger.warning(
            f"HTTP 예외 발생: {exc.detail}",
            extra={
                "status_code": exc.status_code,
                "path": request.url.path,
                "method": request.method,
            }
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "status": "error",
                "message": exc.detail,
                "detail": exc.detail,
                "path": request.url.path,
            }
        )
    
    # 유효성 검사 오류 처리
    if isinstance(exc, RequestValidationError):
        errors = exc.errors()
        logger.warning(
            f"유효성 검사 오류: {errors}",
            extra={
                "path": request.url.path,
                "method": request.method,
            }
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "status": "error",
                "message": "입력 데이터 유효성 검사 실패",
                "detail": errors,
                "path": request.url.path,
            }
        )
    
    # 예상치 못한 예외 처리
    error_traceback = traceback.format_exc()
    logger.error(
        f"예상치 못한 예외 발생: {str(exc)}",
        extra={
            "path": request.url.path,
            "method": request.method,
            "traceback": error_traceback,
        },
        exc_info=True
    )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "status": "error",
            "message": "내부 서버 오류가 발생했습니다",
            "detail": "서버 로그를 확인해주세요" if logger.level <= logging.DEBUG else None,
            "path": request.url.path,
        }
    )


def setup_error_handlers(app):
    """
    FastAPI 앱에 에러 핸들러 등록
    
    Args:
        app: FastAPI 앱 인스턴스
    """
    app.add_exception_handler(BaseAPIException, exception_handler)
    app.add_exception_handler(StarletteHTTPException, exception_handler)
    app.add_exception_handler(RequestValidationError, exception_handler)
    app.add_exception_handler(Exception, exception_handler)

