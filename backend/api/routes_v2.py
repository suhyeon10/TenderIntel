"""
API Routes v2 - Legal RAG 전용

현재 프로젝트는 법률/계약서 RAG에 집중하고 있습니다.

현재 활성 엔드포인트:
- /api/v2/legal/* (법률/계약서 RAG) - routes_legal_v2.py 참조
"""

from fastapi import APIRouter
from core.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["RAG"])
router_v2 = APIRouter(prefix="/api/v2", tags=["RAG v2"])


@router.get("/health")
async def health_check():
    """헬스 체크"""
    return {"status": "ok", "message": "Linkus Legal RAG API is running"}


# ========== Legal RAG APIs ==========
# 주의: 법률 관련 엔드포인트는 routes_legal_v2.py에서 관리합니다.
# 중복을 방지하기 위해 이 파일의 법률 엔드포인트는 제거되었습니다.
# 법률 API는 /api/v2/legal/* 경로를 사용하세요.
