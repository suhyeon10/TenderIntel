"""
VectorSearchTool - 벡터 검색 도구
법령 + 표준계약 + 가이드라인 검색, Hybrid Search, MMR 재랭킹
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import logging
import re

from .base_tool import BaseTool
from ..supabase_vector_store import SupabaseVectorStore
from ..generator_v2 import LLMGenerator

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """검색 결과"""
    id: str
    external_id: str
    source_type: str  # "law", "standard_contract", "manual", "case"
    title: str
    content: str
    chunk_index: int
    file_path: Optional[str]
    metadata: Dict[str, Any]
    score: float  # 유사도 점수 (0-1)
    search_type: str  # "vector" | "hybrid" | "mmr"


class VectorSearchTool(BaseTool):
    """벡터 검색 도구 - 법령/표준계약/가이드라인 검색"""
    
    def __init__(self):
        """도구 초기화"""
        self.vector_store = SupabaseVectorStore()
        self.generator = LLMGenerator()
    
    @property
    def name(self) -> str:
        return "VectorSearchTool"
    
    @property
    def description(self) -> str:
        return "법령 + 표준계약 + 가이드라인 검색 (Hybrid Search, MMR 재랭킹 지원)"
    
    async def execute(
        self,
        query: str,
        doc_types: Optional[List[str]] = None,
        top_k: int = 5,
        use_hybrid: bool = False,
        use_mmr: bool = False,
        mmr_diversity: float = 0.5,
        **kwargs
    ) -> Dict[str, Any]:
        """
        벡터 검색 실행
        
        Args:
            query: 검색 쿼리
            doc_types: 문서 타입 필터 (["law", "standard_contract", "manual", "case"])
            top_k: 검색 결과 개수
            use_hybrid: Hybrid Search 사용 여부 (키워드 + 벡터)
            use_mmr: MMR 재랭킹 사용 여부
            mmr_diversity: MMR 다양성 파라미터 (0-1, 높을수록 다양)
            **kwargs: 추가 옵션
        
        Returns:
            {
                "results": List[SearchResult],
                "count": int,
                "query": str,
                "search_type": str
            }
        """
        self.log_execution(
            query=query[:100],  # 로그에는 일부만
            doc_types=doc_types,
            top_k=top_k,
            use_hybrid=use_hybrid,
            use_mmr=use_mmr
        )
        
        # 입력 검증
        self.validate_input(["query"], query=query)
        
        try:
            # 1. 쿼리 임베딩 생성
            query_embedding = self.generator.embed_one(query)
            
            # 2. 필터 구성
            filters = {}
            if doc_types:
                filters["source_type"] = doc_types[0] if len(doc_types) == 1 else doc_types
            
            # 3. 검색 전략 선택
            if use_hybrid:
                results = await self._hybrid_search(
                    query=query,
                    query_embedding=query_embedding,
                    filters=filters,
                    top_k=top_k
                )
                search_type = "hybrid"
            else:
                results = await self._vector_search(
                    query_embedding=query_embedding,
                    filters=filters,
                    top_k=top_k * 2 if use_mmr else top_k  # MMR을 위해 더 많이 검색
                )
                search_type = "vector"
            
            # 4. MMR 재랭킹 (선택적)
            if use_mmr and results:
                results = self._mmr_rerank(
                    query_embedding=query_embedding,
                    results=results,
                    top_k=top_k,
                    diversity=mmr_diversity
                )
                search_type = "mmr"
            
            # 5. 결과 변환
            search_results = [
                SearchResult(
                    id=r["id"],
                    external_id=r.get("external_id", ""),
                    source_type=r.get("source_type", "law"),
                    title=r.get("title", ""),
                    content=r.get("content", ""),
                    chunk_index=r.get("chunk_index", 0),
                    file_path=r.get("file_path"),
                    metadata=r.get("metadata", {}),
                    score=r.get("score", 0.0),
                    search_type=search_type
                )
                for r in results[:top_k]
            ]
            
            result = {
                "results": [
                    {
                        "id": r.id,
                        "external_id": r.external_id,
                        "source_type": r.source_type,
                        "title": r.title,
                        "content": r.content,
                        "chunk_index": r.chunk_index,
                        "file_path": r.file_path,
                        "metadata": r.metadata,
                        "score": r.score,
                        "search_type": r.search_type
                    }
                    for r in search_results
                ],
                "count": len(search_results),
                "query": query,
                "search_type": search_type
            }
            
            self.log_result(result)
            return result
            
        except Exception as e:
            logger.error(f"[{self.name}] 실행 실패: {str(e)}", exc_info=True)
            raise
    
    async def _vector_search(
        self,
        query_embedding: List[float],
        filters: Optional[Dict[str, Any]],
        top_k: int
    ) -> List[Dict[str, Any]]:
        """벡터 검색 (의미 기반)"""
        results = self.vector_store.search_similar_legal_chunks(
            query_embedding=query_embedding,
            top_k=top_k,
            filters=filters
        )
        return results
    
    async def _hybrid_search(
        self,
        query: str,
        query_embedding: List[float],
        filters: Optional[Dict[str, Any]],
        top_k: int
    ) -> List[Dict[str, Any]]:
        """
        Hybrid Search (키워드 + 벡터)
        
        가중치:
        - 벡터 검색: 0.7
        - 키워드 검색: 0.3
        """
        # 1. 벡터 검색
        vector_results = await self._vector_search(
            query_embedding=query_embedding,
            filters=filters,
            top_k=top_k * 2  # 더 많이 검색
        )
        
        # 2. 키워드 검색 (간단한 구현)
        keyword_results = await self._keyword_search(
            query=query,
            filters=filters,
            top_k=top_k * 2
        )
        
        # 3. 결과 병합 및 가중치 적용
        combined = self._merge_results(
            vector_results=vector_results,
            keyword_results=keyword_results,
            vector_weight=0.7,
            keyword_weight=0.3
        )
        
        # 4. 상위 top_k 반환
        combined.sort(key=lambda x: x.get("score", 0), reverse=True)
        return combined[:top_k]
    
    async def _keyword_search(
        self,
        query: str,
        filters: Optional[Dict[str, Any]],
        top_k: int
    ) -> List[Dict[str, Any]]:
        """
        키워드 검색 (간단한 구현)
        
        실제로는 Supabase의 full-text search를 사용하거나
        클라이언트 사이드에서 키워드 매칭을 수행
        """
        # 간단한 구현: 벡터 검색 결과를 재사용하되 키워드 매칭 점수 추가
        # 실제로는 Supabase의 full-text search 기능을 사용하는 것이 좋음
        
        # 쿼리에서 키워드 추출
        keywords = re.findall(r'\w+', query.lower())
        
        # 벡터 검색 결과를 가져와서 키워드 매칭 점수 계산
        query_embedding = self.generator.embed_one(query)
        vector_results = await self._vector_search(
            query_embedding=query_embedding,
            filters=filters,
            top_k=top_k * 3  # 더 많이 가져와서 필터링
        )
        
        # 키워드 매칭 점수 계산
        keyword_results = []
        for result in vector_results:
            content_lower = result.get("content", "").lower()
            title_lower = result.get("title", "").lower()
            
            # 키워드 매칭 개수
            keyword_matches = sum(1 for kw in keywords if kw in content_lower or kw in title_lower)
            keyword_score = keyword_matches / len(keywords) if keywords else 0
            
            result_copy = result.copy()
            result_copy["keyword_score"] = keyword_score
            keyword_results.append(result_copy)
        
        # 키워드 점수 순으로 정렬
        keyword_results.sort(key=lambda x: x.get("keyword_score", 0), reverse=True)
        return keyword_results[:top_k]
    
    def _merge_results(
        self,
        vector_results: List[Dict[str, Any]],
        keyword_results: List[Dict[str, Any]],
        vector_weight: float = 0.7,
        keyword_weight: float = 0.3
    ) -> List[Dict[str, Any]]:
        """벡터 검색과 키워드 검색 결과 병합"""
        # 결과를 ID로 그룹화
        result_map = {}
        
        # 벡터 검색 결과 추가
        for r in vector_results:
            result_id = r.get("id")
            if result_id:
                result_map[result_id] = {
                    **r,
                    "vector_score": r.get("score", 0),
                    "keyword_score": 0
                }
        
        # 키워드 검색 결과 병합
        for r in keyword_results:
            result_id = r.get("id")
            if result_id:
                if result_id in result_map:
                    result_map[result_id]["keyword_score"] = r.get("keyword_score", 0)
                else:
                    result_map[result_id] = {
                        **r,
                        "vector_score": 0,
                        "keyword_score": r.get("keyword_score", 0)
                    }
        
        # 가중치 적용하여 최종 점수 계산
        merged = []
        for result_id, result in result_map.items():
            final_score = (
                result.get("vector_score", 0) * vector_weight +
                result.get("keyword_score", 0) * keyword_weight
            )
            result["score"] = final_score
            merged.append(result)
        
        return merged
    
    def _mmr_rerank(
        self,
        query_embedding: List[float],
        results: List[Dict[str, Any]],
        top_k: int,
        diversity: float = 0.5
    ) -> List[Dict[str, Any]]:
        """
        MMR (Maximum Marginal Relevance) 재랭킹
        
        다양성과 관련성을 균형있게 고려하여 재랭킹
        
        Args:
            query_embedding: 쿼리 임베딩
            results: 검색 결과
            top_k: 반환할 개수
            diversity: 다양성 파라미터 (0-1, 높을수록 다양)
        
        Returns:
            재랭킹된 결과
        """
        if not results:
            return []
        
        import numpy as np
        
        # 첫 번째 결과는 가장 유사한 것으로 선택
        selected = [results[0]]
        remaining = results[1:]
        
        query_vec = np.array(query_embedding, dtype=np.float32)
        
        while len(selected) < top_k and remaining:
            best_score = -1
            best_idx = -1
            
            for i, candidate in enumerate(remaining):
                # 관련성 점수 (쿼리와의 유사도)
                candidate_embedding = candidate.get("embedding")
                if candidate_embedding:
                    try:
                        candidate_vec = np.array(candidate_embedding, dtype=np.float32)
                        relevance = np.dot(query_vec, candidate_vec) / (
                            np.linalg.norm(query_vec) * np.linalg.norm(candidate_vec)
                        )
                    except:
                        relevance = candidate.get("score", 0)
                else:
                    relevance = candidate.get("score", 0)
                
                # 다양성 점수 (이미 선택된 결과와의 최소 유사도)
                min_similarity = 1.0
                for selected_item in selected:
                    selected_embedding = selected_item.get("embedding")
                    if selected_embedding:
                        try:
                            selected_vec = np.array(selected_embedding, dtype=np.float32)
                            similarity = np.dot(candidate_vec, selected_vec) / (
                                np.linalg.norm(candidate_vec) * np.linalg.norm(selected_vec)
                            )
                            min_similarity = min(min_similarity, similarity)
                        except:
                            pass
                
                # MMR 점수 = λ * relevance - (1 - λ) * max_similarity
                mmr_score = diversity * relevance - (1 - diversity) * min_similarity
                
                if mmr_score > best_score:
                    best_score = mmr_score
                    best_idx = i
            
            if best_idx >= 0:
                selected.append(remaining.pop(best_idx))
            else:
                break
        
        # 점수 업데이트
        for i, item in enumerate(selected):
            item["score"] = item.get("score", 0) * (1 - i * 0.05)  # 순위에 따라 약간 감소
        
        return selected
    
    # 편의 메서드
    async def search(
        self,
        query: str,
        doc_types: Optional[List[str]] = None,
        top_k: int = 5,
        use_hybrid: bool = False,
        use_mmr: bool = False
    ) -> Dict[str, Any]:
        """search 메서드 (execute의 별칭)"""
        return await self.execute(
            query=query,
            doc_types=doc_types,
            top_k=top_k,
            use_hybrid=use_hybrid,
            use_mmr=use_mmr
        )

