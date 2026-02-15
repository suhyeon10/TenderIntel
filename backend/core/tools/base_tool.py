"""
BaseTool - 모든 도구의 기본 클래스
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class BaseTool(ABC):
    """모든 도구의 기본 클래스"""
    
    @abstractmethod
    async def execute(self, **kwargs) -> Dict[str, Any]:
        """
        도구 실행
        
        Args:
            **kwargs: 도구별 입력 파라미터
        
        Returns:
            도구 실행 결과 딕셔너리
        """
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        """도구 이름"""
        pass
    
    @property
    @abstractmethod
    def description(self) -> str:
        """도구 설명"""
        pass
    
    def validate_input(self, required_params: list, **kwargs) -> None:
        """
        입력 파라미터 검증
        
        Args:
            required_params: 필수 파라미터 리스트
            **kwargs: 입력 파라미터
        
        Raises:
            ValueError: 필수 파라미터가 누락된 경우
        """
        missing = [param for param in required_params if param not in kwargs]
        if missing:
            raise ValueError(f"{self.name}: 필수 파라미터가 누락되었습니다: {missing}")
    
    def log_execution(self, **kwargs) -> None:
        """실행 로깅"""
        logger.info(f"[{self.name}] 실행 시작")
        logger.debug(f"[{self.name}] 입력 파라미터: {kwargs}")
    
    def log_result(self, result: Dict[str, Any]) -> None:
        """결과 로깅"""
        logger.info(f"[{self.name}] 실행 완료")
        logger.debug(f"[{self.name}] 결과: {result}")

