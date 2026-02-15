"""
로깅 설정 통합 모듈
"""

import logging
import os
from logging.handlers import RotatingFileHandler
from datetime import datetime
from pathlib import Path


class AccessLogFilter(logging.Filter):
    """
    access 로그 필터: OPTIONS 요청과 정상 응답(200)은 제외
    """
    def filter(self, record):
        message = record.getMessage()
        # OPTIONS 요청 제외
        if '"OPTIONS ' in message:
            return False
        # 200 응답 제외 (정상 요청)
        if '" 200' in message:
            return False
        # 나머지는 기록 (에러, 경고 등)
        return True


def setup_logging(
    log_dir: str = "./logs",
    log_level: int = logging.INFO,
    max_bytes: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5,
    enable_file_logging: bool = True,
    enable_console_logging: bool = True,
) -> dict:
    """
    로깅 설정 초기화
    
    Args:
        log_dir: 로그 파일 저장 디렉토리
        log_level: 로그 레벨 (logging.INFO, logging.DEBUG 등)
        max_bytes: 로그 파일 최대 크기 (바이트)
        backup_count: 백업 파일 개수
        enable_file_logging: 파일 로깅 활성화 여부
        enable_console_logging: 콘솔 로깅 활성화 여부
    
    Returns:
        uvicorn log_config 딕셔너리
    """
    # 로그 디렉토리 생성
    os.makedirs(log_dir, exist_ok=True)
    
    # 로그 파일 경로
    log_file = os.path.join(log_dir, f"server_{datetime.now().strftime('%Y%m%d')}.log")
    
    # 루트 로거 설정
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    
    # 기존 핸들러 제거 (중복 방지)
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
    
    # 포매터 설정
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # 콘솔 핸들러
    if enable_console_logging:
        import sys
        # Windows에서 UTF-8 인코딩 강제 설정 (cp949 인코딩 오류 방지)
        if sys.platform == "win32":
            if hasattr(sys.stdout, 'reconfigure'):
                sys.stdout.reconfigure(encoding='utf-8', errors='replace')
            if hasattr(sys.stderr, 'reconfigure'):
                sys.stderr.reconfigure(encoding='utf-8', errors='replace')
        
        console_handler = logging.StreamHandler()
        console_handler.setLevel(log_level)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
    
    # 파일 핸들러 (로테이션)
    if enable_file_logging:
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding='utf-8'
        )
        file_handler.setLevel(log_level)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    
    # uvicorn 로거 설정 (propagate=False로 중복 로그 방지)
    uvicorn_logger = logging.getLogger("uvicorn")
    uvicorn_logger.setLevel(log_level)
    uvicorn_logger.propagate = False  # 중복 로그 방지
    
    uvicorn_access_logger = logging.getLogger("uvicorn.access")
    # access 로그는 필터로 노이즈 제거 (OPTIONS, 200 응답 제외)
    uvicorn_access_logger.setLevel(logging.INFO)
    # 필터 추가
    access_filter = AccessLogFilter()
    uvicorn_access_logger.addFilter(access_filter)
    uvicorn_access_logger.propagate = False  # 중복 로그 방지
    
    uvicorn_error_logger = logging.getLogger("uvicorn.error")
    uvicorn_error_logger.setLevel(log_level)
    uvicorn_error_logger.propagate = False  # 중복 로그 방지
    
    # 불필요한 라이브러리 로그 필터링
    # watchfiles: 파일 변경 감지 로그 (WARNING 이상만)
    watchfiles_logger = logging.getLogger("watchfiles")
    watchfiles_logger.setLevel(logging.WARNING)
    watchfiles_logger.propagate = False
    
    # httpx: HTTP 클라이언트 로그 (WARNING 이상만)
    httpx_logger = logging.getLogger("httpx")
    httpx_logger.setLevel(logging.WARNING)
    httpx_logger.propagate = False
    
    # sentence_transformers: 모델 로딩 로그 (WARNING 이상만)
    sentence_transformers_logger = logging.getLogger("sentence_transformers")
    sentence_transformers_logger.setLevel(logging.WARNING)
    sentence_transformers_logger.propagate = False
    
    # transformers: 트랜스포머 라이브러리 로그 (WARNING 이상만)
    transformers_logger = logging.getLogger("transformers")
    transformers_logger.setLevel(logging.WARNING)
    transformers_logger.propagate = False
    
    # uvicorn log_config 생성
    log_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "filters": {
            "access_filter": {
                "()": AccessLogFilter,
            },
        },
        "formatters": {
            "default": {
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
                "style": "%",  # Python 3.2+ 기본값, 명시적으로 지정
            },
            "access": {
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S",
                "style": "%",  # Python 3.2+ 기본값, 명시적으로 지정
            },
        },
        "handlers": {
            "default": {
                "formatter": "default",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
            },
            "access": {
                "formatter": "access",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
                "filters": ["access_filter"],
            },
        },
        "loggers": {
            "uvicorn": {
                "handlers": ["default"],
                "level": logging.getLevelName(log_level),
                "propagate": False,
            },
            "uvicorn.error": {
                "handlers": ["default"],
                "level": logging.getLevelName(log_level),
                "propagate": False,
            },
            "uvicorn.access": {
                "handlers": ["access"],
                "level": "INFO",  # 필터로 노이즈 제거
                "propagate": False,
            },
            # 불필요한 라이브러리 로그 필터링
            "watchfiles": {
                "handlers": [],
                "level": "WARNING",
                "propagate": False,
            },
            "httpx": {
                "handlers": [],
                "level": "WARNING",
                "propagate": False,
            },
            "sentence_transformers": {
                "handlers": [],
                "level": "WARNING",
                "propagate": False,
            },
            "transformers": {
                "handlers": [],
                "level": "WARNING",
                "propagate": False,
            },
        },
    }
    
    # 파일 로깅 활성화 시 추가
    if enable_file_logging:
        log_config["handlers"]["file"] = {
            "formatter": "default",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": log_file,
            "maxBytes": max_bytes,
            "backupCount": backup_count,
            "encoding": "utf-8",
        }
        log_config["handlers"]["access_file"] = {
            "formatter": "access",
            "class": "logging.handlers.RotatingFileHandler",
            "filename": log_file,
            "maxBytes": max_bytes,
            "backupCount": backup_count,
            "encoding": "utf-8",
            "filters": ["access_filter"],
        }
        log_config["loggers"]["uvicorn"]["handlers"].append("file")
        log_config["loggers"]["uvicorn.error"]["handlers"].append("file")
        # access 로그는 필터로 노이즈 제거 (OPTIONS, 200 응답 제외)
        log_config["loggers"]["uvicorn.access"]["handlers"].append("access_file")
    
    return log_config


def get_logger(name: str) -> logging.Logger:
    """
    로거 인스턴스 가져오기
    
    Args:
        name: 로거 이름 (보통 __name__ 사용)
    
    Returns:
        Logger 인스턴스
    """
    return logging.getLogger(name)

