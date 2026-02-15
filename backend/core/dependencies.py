"""
의존성 주입 패턴
FastAPI의 Depends를 사용한 서비스 인스턴스 관리
"""

from functools import lru_cache
from typing import Generator

from core.orchestrator_v2 import Orchestrator
from core.legal_rag_service import LegalRAGService
from core.document_processor_v2 import DocumentProcessor
from core.contract_storage import ContractStorageService
from core.async_tasks import AsyncTaskManager


# ========== Orchestrator 의존성 ==========

_orchestrator_instance: Orchestrator = None


def get_orchestrator() -> Orchestrator:
    """
    Orchestrator 인스턴스 가져오기 (싱글톤)
    
    Returns:
        Orchestrator 인스턴스
    """
    global _orchestrator_instance
    if _orchestrator_instance is None:
        _orchestrator_instance = Orchestrator()
    return _orchestrator_instance


# ========== Legal RAG Service 의존성 ==========

_legal_service_instance: LegalRAGService = None


def get_legal_service() -> LegalRAGService:
    """
    Legal RAG Service 인스턴스 가져오기 (싱글톤)
    
    Returns:
        LegalRAGService 인스턴스
    """
    global _legal_service_instance
    if _legal_service_instance is None:
        from config import settings
        _legal_service_instance = LegalRAGService(
            embedding_cache_size=settings.embedding_cache_size
        )
    return _legal_service_instance


# ========== Document Processor 의존성 ==========

_processor_instance: DocumentProcessor = None


def get_processor() -> DocumentProcessor:
    """
    Document Processor 인스턴스 가져오기 (싱글톤)
    
    Returns:
        DocumentProcessor 인스턴스
    """
    global _processor_instance
    if _processor_instance is None:
        _processor_instance = DocumentProcessor()
    return _processor_instance


# ========== Contract Storage Service 의존성 ==========

_storage_service_instance: ContractStorageService = None


def get_storage_service() -> ContractStorageService:
    """
    Contract Storage Service 인스턴스 가져오기 (싱글톤)
    
    Returns:
        ContractStorageService 인스턴스
    """
    global _storage_service_instance
    if _storage_service_instance is None:
        _storage_service_instance = ContractStorageService()
    return _storage_service_instance


# ========== Async Task Manager 의존성 ==========

_task_manager_instance: AsyncTaskManager = None


def get_task_manager() -> AsyncTaskManager:
    """
    Async Task Manager 인스턴스 가져오기 (싱글톤)
    
    Returns:
        AsyncTaskManager 인스턴스
    """
    global _task_manager_instance
    if _task_manager_instance is None:
        _task_manager_instance = AsyncTaskManager()
    return _task_manager_instance


# ========== FastAPI Depends를 위한 래퍼 ==========

from fastapi import Depends

# FastAPI의 Depends를 사용할 수 있는 의존성 함수들
def get_orchestrator_dep() -> Orchestrator:
    """FastAPI Depends용 Orchestrator 의존성"""
    return get_orchestrator()


def get_legal_service_dep() -> LegalRAGService:
    """FastAPI Depends용 Legal RAG Service 의존성"""
    return get_legal_service()


def get_processor_dep() -> DocumentProcessor:
    """FastAPI Depends용 Document Processor 의존성"""
    return get_processor()


def get_storage_service_dep() -> ContractStorageService:
    """FastAPI Depends용 Contract Storage Service 의존성"""
    return get_storage_service()


def get_task_manager_dep() -> AsyncTaskManager:
    """FastAPI Depends용 Async Task Manager 의존성"""
    return get_task_manager()

