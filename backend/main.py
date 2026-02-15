# backend/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes_v2 import router, router_v2  # v2 라우터 사용
from api.routes_legal import router_legal  # 법률 RAG 라우터
from api.routes_legal_v2 import router as router_legal_v2  # 법률 RAG 라우터 v2
from api.routes_legal_agent import router as router_legal_agent  # Agent 기반 통합 챗 라우터
from config import settings
import uvicorn
import os
import logging

# 로깅 설정 통합
from core.logging_config import setup_logging

# 에러 핸들러 설정
from core.error_handler import setup_error_handlers

# 로깅 초기화
log_config = setup_logging(
    log_dir="./logs",
    log_level=logging.INFO if os.getenv("LOG_LEVEL", "INFO").upper() == "INFO" else logging.DEBUG,
    enable_file_logging=True,
    enable_console_logging=True,
)

# FastAPI 앱 생성
app = FastAPI(
    title="Linkus Public RAG API",
    description="공공입찰 자동 분석 및 팀 매칭 시스템 + 법률 리스크 분석",
    version="1.0.0"
)

# 에러 핸들러 설정
setup_error_handlers(app)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인만 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
# 중요: 더 구체적인 경로를 가진 라우터를 먼저 등록해야 함
app.include_router(router)
app.include_router(router_legal_agent)  # Agent 기반 통합 챗 엔드포인트 - 먼저 등록 (더 구체적)
app.include_router(router_legal_v2)  # 법률 RAG 엔드포인트 (v2 - 가이드 스펙)
app.include_router(router_legal)  # 법률 RAG 엔드포인트 (v1)
app.include_router(router_v2)  # v2 엔드포인트 - 나중에 등록 (덜 구체적)


@app.get("/")
async def root():
    return {
        "message": "Linkus Public RAG API",
        "docs": "/docs",
        "health": "/api/health",
        "legal_v2_health": "/api/v2/legal/health"
    }

@app.get("/api/health")
async def health():
    """헬스 체크 (공통)"""
    return {
        "status": "ok",
        "message": "Linkus Public RAG API is running"
    }


if __name__ == "__main__":
    # 로그 파일 경로 출력
    log_file = log_config.get("handlers", {}).get("file", {}).get("filename", "./logs/server.log")
    print(f"[로그] 서버 로그가 저장됩니다: {os.path.abspath(log_file)}")
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
        log_config=log_config
    )

