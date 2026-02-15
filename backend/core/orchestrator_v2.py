"""
Orchestrator v2 - 실전형 파이프라인
공고 인입 → 정규화 → 임베딩/인덱싱 → 분석
"""

from typing import Dict, Any, Optional, List
from .document_processor_v2 import DocumentProcessor
from .supabase_vector_store import SupabaseVectorStore
from .generator_v2 import LLMGenerator
from config import settings


class Orchestrator:
    """RAG 파이프라인 오케스트레이터"""
    
    def __init__(self):
        self.processor = DocumentProcessor(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap
        )
        self.store = SupabaseVectorStore()
        self.generator = LLMGenerator()
    
    def process_announcement(
        self,
        meta: Dict[str, Any],
        text: str
    ) -> str:
        """
        공고 처리 전체 파이프라인
        
        프로세스:
        1. 중복/버전 판별 (content_hash)
        2. 메타데이터 및 본문 저장
        3. 텍스트 → 청크 분할
        4. 청크 → 임베딩 생성
        5. 벡터 저장 (pgvector)
        6. LLM 구조화 분석
        7. 분석 결과 저장
        
        Args:
            meta: {
                source: str,           # '나라장터', '조달청', '수기', etc.
                external_id: str,       # 원천 시스템 ID
                title: str,
                agency: str,            # 발주기관
                budget_min: int,         # 최소 예산
                budget_max: int,         # 최대 예산
                start_date: str,        # ISO 형식
                end_date: str,          # ISO 형식
                ...
            }
            text: 공고 본문 텍스트
        
        Returns:
            announcement_id (uuid)
        """
        try:
            # 텍스트 유효성 검사
            if text is None:
                raise ValueError("공고 텍스트가 None입니다.")
            
            if not isinstance(text, str):
                raise ValueError(f"공고 텍스트가 문자열이 아닙니다. 타입: {type(text)}")
            
            text_stripped = text.strip()
            if not text_stripped:
                raise ValueError("공고 텍스트가 비어있습니다.")
            
            # 1) 중복/버전 판별 및 저장
            announcement_id = self.store.upsert_announcement(meta, text)
            
            # 2) 텍스트 → 청크 분할
            base_meta = {
                "source": meta.get("source", "unknown"),
                "external_id": meta.get("external_id", ""),
                "title": meta.get("title", "")
            }
            
            try:
                chunks = self.processor.to_chunks(text, base_meta)
            except Exception as chunk_error:
                raise Exception(f"청크 생성 실패: {str(chunk_error)}")
            
            if not chunks:
                raise Exception("청크 생성 실패: 청크 리스트가 비어있습니다.")
            
            # 3) 청크 → 임베딩 생성
            chunk_texts = [chunk.content for chunk in chunks]
            embeddings = self.generator.embed(chunk_texts)
            
            # 4) 벡터 저장 (pgvector)
            chunk_payload = [
                {
                    "chunk_index": chunk.index,
                    "content": chunk.content,
                    "embedding": embeddings[i],
                    "metadata": chunk.metadata
                }
                for i, chunk in enumerate(chunks)
            ]
            
            self.store.bulk_upsert_chunks(announcement_id, chunk_payload)
            
            # 5) 정규식으로 초기 메타데이터 추출
            seed_meta = self.processor.extract_structured_meta(text)
            
            # 6) LLM 구조화 분석
            analysis_result = self.generator.analyze_announcement(text, seed_meta)
            
            # 7) 분석 결과 저장
            score = self._calculate_score(analysis_result)
            self.store.save_analysis(announcement_id, analysis_result, score)
            
            return announcement_id
            
        except Exception as e:
            raise Exception(f"공고 처리 실패: {str(e)}")
    
    def process_file(
        self,
        file_path: str,
        file_type: str = None,
        meta: Dict[str, Any] = None
    ) -> str:
        """
        파일 업로드 처리
        
        Args:
            file_path: 파일 경로
            file_type: 'pdf', 'text', 'hwp', 'hwpx' (None이면 자동 감지)
            meta: 공고 메타데이터
        
        Returns:
            announcement_id
        """
        # 파일 → 텍스트 (자동 타입 감지)
        try:
            text, _ = self.processor.process_file(file_path, file_type)
        except Exception as e:
            raise Exception(f"파일에서 텍스트 추출 실패: {str(e)}")
        
        # 추출된 텍스트 검증
        if text is None:
            raise Exception("파일에서 텍스트를 추출하지 못했습니다. 파일이 손상되었거나 지원하지 않는 형식일 수 있습니다.")
        
        if not isinstance(text, str):
            raise Exception(f"추출된 텍스트가 문자열이 아닙니다. 타입: {type(text)}")
        
        text_stripped = text.strip()
        if not text_stripped:
            raise Exception("파일에서 추출된 텍스트가 비어있습니다. 파일이 비어있거나 텍스트 추출에 실패했습니다.")
        
        if len(text_stripped) < 10:
            raise Exception(f"추출된 텍스트가 너무 짧습니다 (길이: {len(text_stripped)}자). 최소 10자 이상의 텍스트가 필요합니다.")
        
        # 메타데이터가 없으면 기본값
        if meta is None:
            from pathlib import Path
            filename = Path(file_path).stem
            meta = {
                "source": "batch_upload",
                "external_id": filename,
                "title": filename,
            }
        
        # 파이프라인 실행
        return self.process_announcement(meta, text)
    
    def _calculate_score(self, analysis_result: Dict[str, Any]) -> Optional[float]:
        """
        분석 결과에서 난이도/적합도 점수 계산
        
        Args:
            analysis_result: LLM 분석 결과
        
        Returns:
            점수 (0.0 ~ 1.0)
        """
        # 간단한 점수 계산 로직
        # 실제로는 더 복잡한 알고리즘 사용 가능
        
        score = 0.5  # 기본값
        
        # 예산 범위가 명확하면 점수 증가
        if analysis_result.get("budget_min") and analysis_result.get("budget_max"):
            score += 0.1
        
        # 필수 기술이 명확하면 점수 증가
        if analysis_result.get("essential_skills"):
            score += 0.1
        
        # 기간이 명확하면 점수 증가
        if analysis_result.get("duration_months"):
            score += 0.1
        
        # 마감일이 명확하면 점수 증가
        if analysis_result.get("deadline"):
            score += 0.1
        
        return min(score, 1.0)
    
    def search_similar_announcements(
        self,
        query: str,
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        유사 공고 검색
        
        Args:
            query: 검색 쿼리 텍스트
            top_k: 반환할 최대 개수
            filters: 필터 조건
        
        Returns:
            유사 공고 리스트
        """
        # 쿼리 임베딩 생성
        query_embedding = self.generator.embed_one(query)
        
        # 벡터 검색
        results = self.store.search_similar_chunks(
            query_embedding,
            top_k=top_k,
            filters=filters
        )
        
        return results
    
    def get_announcement_analysis(
        self,
        announcement_id: str
    ) -> Optional[Dict[str, Any]]:
        """공고 분석 결과 조회"""
        # Supabase에서 직접 조회
        from supabase import create_client
        import os
        
        supabase_url = os.getenv("SUPABASE_URL") or settings.supabase_url
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or settings.supabase_service_role_key
        
        sb = create_client(supabase_url, supabase_key)
        
        result = sb.table("announcement_analysis")\
            .select("*")\
            .eq("announcement_id", announcement_id)\
            .order("created_at", desc=True)\
            .limit(1)\
            .execute()
        
        if result.data and len(result.data) > 0:
            return result.data[0]
        
        return None
    
    def match_teams_for_announcement(
        self,
        announcement_id: str,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        공고에 맞는 팀 매칭
        
        Args:
            announcement_id: 공고 ID
            top_k: 반환할 최대 팀 수
        
        Returns:
            매칭된 팀 리스트 (유사도 순)
        """
        try:
            # 1. 공고 분석 결과 조회
            analysis = self.get_announcement_analysis(announcement_id)
            
            if not analysis:
                # 분석 결과가 없으면 공고 본문으로 검색
                text = self.store.get_announcement_body(announcement_id)
                if not text:
                    return []
                
                # 공고 본문 요약 (간단히 처음 500자 사용)
                query_text = text[:500]
            else:
                # 분석 결과에서 요구사항 추출
                result = analysis.get("result", {})
                requirements = []
                
                if result.get("essential_skills"):
                    requirements.extend(result["essential_skills"])
                if result.get("preferred_skills"):
                    requirements.extend(result["preferred_skills"])
                if result.get("project_name"):
                    requirements.append(result["project_name"])
                
                query_text = " ".join(requirements) if requirements else result.get("summary", "")
            
            if not query_text:
                return []
            
            # 2. 쿼리 임베딩 생성
            query_embedding = self.generator.embed_one(query_text)
            
            # 3. 유사 팀 검색
            matched_teams = self.store.search_similar_teams(
                query_embedding=query_embedding,
                top_k=top_k
            )
            
            return matched_teams
            
        except Exception as e:
            print(f"[팀 매칭] 오류: {str(e)}")
            return []

