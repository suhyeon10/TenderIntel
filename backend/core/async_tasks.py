# backend/core/async_tasks.py

"""
비동기 작업 처리
Celery 또는 FastAPI BackgroundTasks 사용
"""

from typing import Dict, Any, Optional
from fastapi import BackgroundTasks
from .orchestrator_v2 import Orchestrator
import asyncio
from datetime import datetime


class AsyncTaskManager:
    """비동기 작업 관리자"""
    
    def __init__(self):
        self._orchestrator = None  # 지연 초기화
        self.tasks: Dict[str, Dict[str, Any]] = {}  # job_id -> task_info
    
    @property
    def orchestrator(self):
        """Orchestrator 지연 초기화"""
        if self._orchestrator is None:
            self._orchestrator = Orchestrator()
        return self._orchestrator
    
    async def start_analysis_task(
        self,
        doc_id: str,
        background_tasks: BackgroundTasks
    ) -> str:
        """
        비동기 공고 분석 작업 시작
        
        Returns:
            job_id: 작업 ID
        """
        job_id = f"analysis_{doc_id}_{datetime.now().timestamp()}"
        
        # 작업 정보 저장
        self.tasks[job_id] = {
            'status': 'pending',
            'progress': 0,
            'doc_id': doc_id,
            'created_at': datetime.now().isoformat(),
        }
        
        # 백그라운드 작업 시작
        background_tasks.add_task(
            self._run_analysis_task,
            job_id,
            doc_id
        )
        
        return job_id
    
    async def _run_analysis_task(self, job_id: str, doc_id: str):
        """실제 분석 작업 실행"""
        try:
            # 진행 상황 업데이트
            self._update_task(job_id, {
                'status': 'progress',
                'progress': 10,
                'message': '문서 로드 중...',
            })
            
            # 1. 문서 로드 (orchestrator_v2 사용)
            announcement_data = self.orchestrator.store.get_announcement_by_id(doc_id)
            if not announcement_data:
                raise ValueError(f"문서를 찾을 수 없습니다: {doc_id}")
            
            self._update_task(job_id, {
                'progress': 30,
                'message': '요구사항 추출 중...',
            })
            
            # 2. 문서 본문 가져오기
            text = self.orchestrator.store.get_announcement_body(doc_id)
            if not text:
                text = announcement_data.get('content', '') or announcement_data.get('text', '')
            
            if not text:
                raise ValueError("문서 내용이 없습니다")
            
            # 3. 분석 결과 조회 (이미 분석된 경우)
            analysis = self.orchestrator.get_announcement_analysis(doc_id)
            
            self._update_task(job_id, {
                'progress': 50,
                'message': '유사 입찰 검색 중...',
            })
            
            # 4. 유사 입찰 검색 (orchestrator_v2 사용)
            similar_announcements = self.orchestrator.search_similar_announcements(
                query=text[:1000],
                top_k=5
            )
            
            self._update_task(job_id, {
                'progress': 70,
                'message': '결과 정리 중...',
            })
            
            # 5. 결과 저장
            result = {
                'analysis': analysis,
                'similar_announcements': similar_announcements,
                'announcement_id': doc_id,
                'announcement_data': announcement_data,
            }
            
            self._update_task(job_id, {
                'status': 'completed',
                'progress': 100,
                'message': '분석 완료',
                'result': result,
            })
            
        except Exception as e:
            self._update_task(job_id, {
                'status': 'failed',
                'error': str(e),
            })
    
    def _update_task(self, job_id: str, updates: Dict[str, Any]):
        """작업 상태 업데이트"""
        if job_id in self.tasks:
            self.tasks[job_id].update(updates)
            self.tasks[job_id]['updated_at'] = datetime.now().isoformat()
    
    def get_task_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """작업 상태 조회"""
        return self.tasks.get(job_id)
    
    def get_all_tasks(self) -> Dict[str, Dict[str, Any]]:
        """모든 작업 조회"""
        return self.tasks


# 전역 인스턴스 (지연 초기화)
_task_manager = None

def get_task_manager() -> AsyncTaskManager:
    """TaskManager 인스턴스 가져오기 (지연 초기화)"""
    global _task_manager
    if _task_manager is None:
        _task_manager = AsyncTaskManager()
    return _task_manager

# 호환성을 위한 별칭
task_manager = None  # 실제로는 get_task_manager() 사용

