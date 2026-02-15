"""
Supabase Vector Store 어댑터
pgvector 기반 벡터 저장 및 검색
"""

from typing import List, Dict, Any, Optional
import hashlib
import os
from supabase import create_client, Client
from config import settings


class SupabaseVectorStore:
    """Supabase pgvector 기반 벡터 저장소"""
    
    def __init__(self):
        self.sb: Optional[Client] = None
        self._initialized = False
    
    def _ensure_initialized(self):
        """Supabase 클라이언트 지연 초기화"""
        if self._initialized:
            return
        
        supabase_url = os.getenv("SUPABASE_URL") or settings.supabase_url
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or settings.supabase_service_role_key
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다")
        
        # proxy 관련 문제를 피하기 위해 환경 변수에서 proxy 제거
        # supabase-py는 내부적으로 httpx를 사용하는데, httpx가 환경 변수의 proxy를 자동으로 사용함
        proxy_vars = ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy']
        original_proxies = {}
        for var in proxy_vars:
            if var in os.environ:
                original_proxies[var] = os.environ.pop(var)
        
        try:
            # Supabase 클라이언트 생성
            # supabase-py 2.x 버전에서는 기본 방식 사용
            self.sb = create_client(supabase_url, supabase_key)
            self._initialized = True
            # 성공 시 proxy 값 복원하지 않음 (Supabase 연결에는 필요 없음)
        except Exception as e:
            # 실패 시 원래 proxy 값 복원
            for var, value in original_proxies.items():
                os.environ[var] = value
            
            error_msg = str(e)
            if "'dict' object has no attribute 'headers'" in error_msg:
                # supabase 패키지 버전 문제일 수 있음
                raise ValueError(
                    f"Supabase 클라이언트 초기화 실패: {error_msg}\n"
                    f"[해결] supabase 패키지를 재설치하세요: pip install --upgrade supabase"
                )
            elif "proxy" in error_msg.lower():
                raise ValueError(
                    f"Supabase 클라이언트 초기화 실패 (proxy 오류): {error_msg}\n"
                    f"[해결] 환경 변수의 proxy 설정을 확인하거나 제거하세요."
                )
            else:
                raise ValueError(f"Supabase 클라이언트 초기화 실패: {error_msg}")
    
    def _reinitialize_client(self):
        """Supabase 클라이언트 재초기화 (스키마 캐시 갱신용)"""
        self._initialized = False
        self.sb = None
        self._ensure_initialized()
    
    @staticmethod
    def content_hash(text: str) -> str:
        """텍스트 해시 생성 (중복 감지용)"""
        return hashlib.sha256(text.encode("utf-8")).hexdigest()
    
    def upsert_announcement(
        self,
        meta: Dict[str, Any],
        text: str
    ) -> str:
        """
        공고 메타데이터 및 본문 저장 (중복/버전 관리)
        
        Args:
            meta: {
                source: str,
                external_id: str,
                title: str,
                agency: str,
                budget_min: int,
                budget_max: int,
                start_date: str,
                end_date: str,
                ...
            }
            text: 공고 본문 텍스트
        
        Returns:
            announcement_id (uuid)
        """
        self._ensure_initialized()
        content_hash = self.content_hash(text)
        
        # 기존 최신 버전 조회
        existing = self.sb.table("announcements")\
            .select("*")\
            .eq("source", meta["source"])\
            .eq("external_id", meta.get("external_id", ""))\
            .order("version", desc=True)\
            .limit(1)\
            .execute()
        
        # 버전 결정
        if existing.data and len(existing.data) > 0:
            prev_hash = existing.data[0].get("content_hash")
            if prev_hash == content_hash:
                # 동일 내용이면 기존 ID 반환
                return existing.data[0]["id"]
            version = existing.data[0]["version"] + 1
        else:
            version = 1
        
        # 공고 메타데이터 삽입
        # 날짜 필드 처리: 문자열을 적절한 형식으로 변환하거나 None 처리
        insert_data = {
            "source": meta.get("source"),
            "external_id": meta.get("external_id", ""),
            "title": meta.get("title", ""),
            "agency": meta.get("agency"),
            "budget_min": meta.get("budget_min"),
            "budget_max": meta.get("budget_max"),
            "version": version,
            "content_hash": content_hash,
            "status": "active",
            # Storage 파일 정보 (meta에 포함된 경우)
            "storage_file_path": meta.get("storage_file_path"),
            "storage_bucket": meta.get("storage_bucket", "announcements"),
            "file_name": meta.get("file_name"),
            "file_mime_type": meta.get("file_mime_type")
        }
        
        # Storage 파일 정보는 별도로 업데이트 (스키마 캐시 문제 방지)
        # insert_data에 포함하지 않고 나중에 update로 처리
        
        # 날짜 필드 처리 (None이거나 빈 문자열이면 제외)
        from datetime import datetime
        if meta.get("start_date"):
            try:
                # ISO 형식 문자열을 datetime으로 변환
                if isinstance(meta["start_date"], str):
                    # ISO 형식인지 확인
                    if "T" in meta["start_date"] or len(meta["start_date"]) > 10:
                        insert_data["start_date"] = meta["start_date"]
                    else:
                        # YYYY-MM-DD 형식이면 시간 추가
                        insert_data["start_date"] = f"{meta['start_date']}T00:00:00+00:00"
                else:
                    insert_data["start_date"] = meta["start_date"]
            except Exception as e:
                print(f"[경고] start_date 변환 실패: {str(e)}, 원본: {meta.get('start_date')}")
        
        if meta.get("end_date"):
            try:
                if isinstance(meta["end_date"], str):
                    if "T" in meta["end_date"] or len(meta["end_date"]) > 10:
                        insert_data["end_date"] = meta["end_date"]
                    else:
                        insert_data["end_date"] = f"{meta['end_date']}T23:59:59+00:00"
                else:
                    insert_data["end_date"] = meta["end_date"]
            except Exception as e:
                print(f"[경고] end_date 변환 실패: {str(e)}, 원본: {meta.get('end_date')}")
        
        # None 값 제거
        insert_data = {k: v for k, v in insert_data.items() if v is not None}
        
        result = self.sb.table("announcements")\
            .insert(insert_data)\
            .execute()
        
        if not result.data or len(result.data) == 0:
            raise Exception("공고 저장 실패")
        
        announcement_id = result.data[0]["id"]
        
        # 본문 저장
        self.sb.table("announcement_bodies")\
            .insert({
                "announcement_id": announcement_id,
                "text": text,
                "mime": "text/plain",
                "language": "ko"
            })\
            .execute()
        
        return announcement_id
    
    def bulk_upsert_chunks(
        self,
        announcement_id: str,
        chunks: List[Dict[str, Any]]
    ):
        """
        청크 및 임베딩 일괄 저장
        
        Args:
            announcement_id: 공고 ID
            chunks: [{
                chunk_index: int,
                content: str,
                embedding: List[float],
                metadata: Dict
            }]
        """
        self._ensure_initialized()
        if not chunks:
            return
        
        # Supabase는 vector 타입을 배열로 받음
        payload = [
            {
                "announcement_id": announcement_id,
                "chunk_index": c["chunk_index"],
                "content": c["content"],
                "embedding": c["embedding"],  # float[] 배열
                "metadata": c.get("metadata", {})
            }
            for c in chunks
        ]
        
        # 배치 삽입 (성능을 위해 나중에 RPC로 전환 가능)
        self.sb.table("announcement_chunks")\
            .insert(payload)\
            .execute()
    
    def search_similar_chunks(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        유사 청크 검색 (벡터 코사인 유사도)
        
        Args:
            query_embedding: 쿼리 임베딩 벡터
            top_k: 반환할 최대 개수
            filters: 메타데이터 필터 (예: {"budget_min": 10000000})
        
        Returns:
            [{
                announcement_id: str,
                chunk_index: int,
                content: str,
                similarity: float,
                metadata: Dict
            }]
        """
        self._ensure_initialized()
        # Supabase RPC 함수 사용
        rpc_params = {
            "query_embedding": query_embedding,
            "match_threshold": 0.7,
            "match_count": top_k,
            "filters": filters or {}
        }
        
        try:
            result = self.sb.rpc(
                "match_announcement_chunks",
                rpc_params
            ).execute()
            
            return result.data if result.data else []
        except Exception as e:
            # RPC 함수가 없거나 오류 발생 시 빈 리스트 반환
            print(f"벡터 검색 오류: {str(e)}")
            print("[팁] Supabase RPC 함수 'match_announcement_chunks'가 필요합니다.")
            return []
    
    def get_announcement_by_id(self, announcement_id: str) -> Optional[Dict[str, Any]]:
        """공고 정보 조회"""
        self._ensure_initialized()
        result = self.sb.table("announcements")\
            .select("*")\
            .eq("id", announcement_id)\
            .eq("status", "active")\
            .single()\
            .execute()
        
        return result.data if result.data else None
    
    def get_announcement_body(self, announcement_id: str) -> Optional[str]:
        """공고 본문 조회"""
        self._ensure_initialized()
        result = self.sb.table("announcement_bodies")\
            .select("text")\
            .eq("announcement_id", announcement_id)\
            .single()\
            .execute()
        
        return result.data.get("text") if result.data else None
    
    def save_analysis(
        self,
        announcement_id: str,
        analysis_result: Dict[str, Any],
        score: Optional[float] = None
    ):
        """분석 결과 저장"""
        self._ensure_initialized()
        self.sb.table("announcement_analysis")\
            .insert({
                "announcement_id": announcement_id,
                "result": analysis_result,
                "score": score
            })\
            .execute()
    
    def upsert_team_embedding(
        self,
        team_id: int,
        summary: str,
        meta: Dict[str, Any] = None,
        embedding: Optional[List[float]] = None
    ):
        """
        팀 임베딩 저장/업데이트
        
        Args:
            team_id: 팀 ID
            summary: 팀 요약 텍스트 (임베딩 생성용)
            meta: 팀 메타데이터 (기술 스택, 지역, 평점 등)
            embedding: 임베딩 벡터 (None이면 자동 생성)
        
        Returns:
            성공 여부
        """
        self._ensure_initialized()
        
        # 임베딩이 없으면 생성 (generator 사용)
        if embedding is None:
            from .generator_v2 import LLMGenerator
            generator = LLMGenerator()
            embedding = generator.embed_one(summary)
        
        # 팀 임베딩 저장/업데이트
        payload = {
            "team_id": team_id,
            "summary": summary,
            "meta": meta or {},
            "embedding": embedding,
            "updated_at": "now()"
        }
        
        self.sb.table("team_embeddings")\
            .upsert(payload, on_conflict="team_id")\
            .execute()
        
        return True
    
    def search_similar_teams(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        유사 팀 검색 (벡터 코사인 유사도)
        
        Args:
            query_embedding: 쿼리 임베딩 벡터
            top_k: 반환할 최대 개수
            filters: 메타데이터 필터 (예: {"specialty": ["웹개발"]})
        
        Returns:
            [{
                team_id: int,
                summary: str,
                similarity: float,
                meta: Dict
            }]
        """
        self._ensure_initialized()
        
        # Supabase RPC 함수 사용 (있으면)
        try:
            rpc_params = {
                "query_embedding": query_embedding,
                "match_threshold": 0.7,
                "match_count": top_k,
                "filters": filters or {}
            }
            
            result = self.sb.rpc(
                "match_team_embeddings",
                rpc_params
            ).execute()
            
            return result.data if result.data else []
        except Exception as e:
            # RPC 함수가 없으면 직접 SQL 쿼리 (간단한 버전)
            print(f"[경고] 팀 벡터 검색 RPC 함수가 없습니다: {str(e)}")
            print("[팁] Supabase에 'match_team_embeddings' RPC 함수를 생성하거나 직접 쿼리를 구현하세요.")
            
            # 기본 검색 (모든 팀 조회 후 클라이언트 사이드에서 필터링)
            # 실제로는 RPC 함수를 사용하는 것이 권장됩니다
            result = self.sb.table("team_embeddings")\
                .select("team_id, summary, meta, embedding")\
                .limit(100)\
                .execute()
            
            if not result.data:
                return []
            
            # 간단한 유사도 계산 (코사인 유사도)
            import numpy as np
            
            query_vec = np.array(query_embedding)
            similarities = []
            
            for team in result.data:
                if team.get("embedding"):
                    team_vec = np.array(team["embedding"])
                    # 코사인 유사도
                    similarity = np.dot(query_vec, team_vec) / (
                        np.linalg.norm(query_vec) * np.linalg.norm(team_vec)
                    )
                    similarities.append({
                        "team_id": team["team_id"],
                        "summary": team["summary"],
                        "similarity": float(similarity),
                        "meta": team.get("meta", {})
                    })
            
            # 유사도 순으로 정렬하고 top_k 반환
            similarities.sort(key=lambda x: x["similarity"], reverse=True)
            return similarities[:top_k]
    
    def get_team_embedding(self, team_id: int) -> Optional[Dict[str, Any]]:
        """팀 임베딩 조회"""
        self._ensure_initialized()
        result = self.sb.table("team_embeddings")\
            .select("*")\
            .eq("team_id", team_id)\
            .single()\
            .execute()
        
        return result.data if result.data else None
    
    # ========== Legal Chunks Methods (새 스키마) ==========
    
    def upsert_legal_chunk(
        self,
        content: str,
        embedding: List[float],
        metadata: Dict[str, Any]
    ) -> str:
        """
        법률 청크 단일 저장/업데이트 (새 스키마)
        
        Args:
            content: 청크 텍스트
            embedding: 임베딩 벡터 (384차원)
            metadata: {
                source_type: 'law' | 'manual' | 'case',
                external_id: str,  # 파일명/케이스 ID
                title: str,
                chunk_index: int,
                file_path: str,
                ... (나머지는 metadata JSONB에 저장)
            }
        
        Returns:
            chunk_id (uuid)
        """
        self._ensure_initialized()
        
        # metadata에서 컬럼으로 매핑할 필드 추출
        source_type = metadata.get("source_type", "law")
        external_id = metadata.get("external_id", "")
        title = metadata.get("title", "")
        chunk_index = metadata.get("chunk_index", 0)
        file_path = metadata.get("file_path", "")
        
        # 나머지는 metadata JSONB에 저장
        metadata_json = {k: v for k, v in metadata.items() 
                        if k not in ["source_type", "external_id", "title", "chunk_index", "file_path"]}
        
        # 기존 청크 조회 (external_id + chunk_index로)
        try:
            existing = self.sb.table("legal_chunks")\
                .select("id")\
                .eq("external_id", external_id)\
                .eq("chunk_index", chunk_index)\
                .limit(1)\
                .execute()
        except Exception as e:
            error_msg = str(e)
            if "Could not find the table" in error_msg or "PGRST205" in error_msg:
                print(f"[경고] 스키마 캐시 문제 감지, 클라이언트 재초기화 중...")
                self._reinitialize_client()
                existing = self.sb.table("legal_chunks")\
                    .select("id")\
                    .eq("external_id", external_id)\
                    .eq("chunk_index", chunk_index)\
                    .limit(1)\
                    .execute()
            else:
                raise
        
        insert_data = {
            "external_id": external_id,
            "source_type": source_type,
            "title": title,
            "content": content,
            "chunk_index": chunk_index,
            "file_path": file_path,
            "metadata": metadata_json,
            "embedding": embedding,
        }
        
        # 기존 청크가 있으면 업데이트, 없으면 삽입
        if existing.data and len(existing.data) > 0:
            chunk_id = existing.data[0]["id"]
            try:
                self.sb.table("legal_chunks")\
                    .update(insert_data)\
                    .eq("id", chunk_id)\
                    .execute()
            except Exception as e:
                error_msg = str(e)
                if "Could not find the table" in error_msg or "PGRST205" in error_msg:
                    self._reinitialize_client()
                    self.sb.table("legal_chunks")\
                        .update(insert_data)\
                        .eq("id", chunk_id)\
                        .execute()
                else:
                    raise
            return chunk_id
        else:
            # 새 청크 삽입
            try:
                result = self.sb.table("legal_chunks")\
                    .insert(insert_data)\
                    .execute()
            except Exception as e:
                error_msg = str(e)
                if "Could not find the table" in error_msg or "PGRST205" in error_msg:
                    self._reinitialize_client()
                    result = self.sb.table("legal_chunks")\
                        .insert(insert_data)\
                        .execute()
                else:
                    raise
            
            if not result.data or len(result.data) == 0:
                raise Exception("법률 청크 저장 실패")
            
            return result.data[0]["id"]
    
    def check_legal_chunks_exist(self, external_id: str) -> bool:
        """
        특정 external_id로 이미 청크가 존재하는지 확인
        
        Args:
            external_id: 문서 ID
            
        Returns:
            존재 여부 (True: 존재함, False: 없음)
        """
        self._ensure_initialized()
        try:
            result = self.sb.table("legal_chunks")\
                .select("id", count="exact")\
                .eq("external_id", external_id)\
                .limit(1)\
                .execute()
            
            return result.count > 0 if result.count is not None else len(result.data) > 0
        except Exception as e:
            # 오류 발생 시 False 반환 (안전하게 처리)
            print(f"[경고] 중복 체크 실패: {str(e)}")
            return False
    
    def get_legal_chunk_by_id(self, chunk_id: str) -> Optional[Dict[str, Any]]:
        """
        legal_chunks 테이블에서 id로 청크 정보 조회
        
        Args:
            chunk_id: legal_chunks.id (UUID)
            
        Returns:
            {
                "id": str,
                "external_id": str,
                "source_type": str,
                "title": str,
                ...
            } 또는 None
        """
        self._ensure_initialized()
        if not chunk_id:
            return None
        
        try:
            result = self.sb.table("legal_chunks")\
                .select("id, external_id, source_type, title, file_path")\
                .eq("id", chunk_id)\
                .limit(1)\
                .single()\
                .execute()
            
            return result.data if result.data else None
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"legal_chunk 조회 실패 (id={chunk_id}): {str(e)}")
            return None
    
    def get_legal_chunk_by_title(self, title: str) -> Optional[Dict[str, Any]]:
        """
        legal_chunks 테이블에서 title로 문서 정보 조회 (첫 번째 매칭되는 문서)
        
        Args:
            title: 문서 제목 (부분 매칭 가능)
            
        Returns:
            {
                "external_id": str,
                "source_type": str,
                "title": str,
                ...
            } 또는 None
        """
        self._ensure_initialized()
        if not title:
            return None
        
        try:
            # 정확한 제목 매칭 시도
            result = self.sb.table("legal_chunks")\
                .select("external_id, source_type, title")\
                .eq("title", title)\
                .limit(1)\
                .execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            
            # 부분 매칭 시도 (ILIKE 사용)
            result = self.sb.table("legal_chunks")\
                .select("external_id, source_type, title")\
                .ilike("title", f"%{title}%")\
                .limit(1)\
                .execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            
            return None
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"legal_chunk title 조회 실패 (title={title}): {str(e)}")
            return None
    
    def bulk_upsert_legal_chunks(
        self,
        chunks: List[Dict[str, Any]]
    ):
        """
        법률 청크 및 임베딩 일괄 저장 (새 스키마)
        
        Args:
            chunks: [{
                content: str,
                embedding: List[float],
                metadata: {
                    source_type: 'law' | 'manual' | 'case',
                    external_id: str,
                    title: str,
                    chunk_index: int,
                    file_path: str,
                    ... (나머지는 metadata JSONB에 저장)
                }
            }]
        """
        self._ensure_initialized()
        if not chunks:
            return
        
        payload = []
        for c in chunks:
            metadata = c.get("metadata", {})
            source_type = metadata.get("source_type", "law")
            external_id = metadata.get("external_id", "")
            title = metadata.get("title", "")
            chunk_index = metadata.get("chunk_index", 0)
            file_path = metadata.get("file_path", "")
            
            # 나머지는 metadata JSONB에 저장
            metadata_json = {k: v for k, v in metadata.items() 
                            if k not in ["source_type", "external_id", "title", "chunk_index", "file_path"]}
            
            payload.append({
                "external_id": external_id,
                "source_type": source_type,
                "title": title,
                "content": c["content"],
                "chunk_index": chunk_index,
                "file_path": file_path,
                "metadata": metadata_json,
                "embedding": c["embedding"],
            })
        
        try:
            # 기존 청크 삭제 후 삽입 (external_id 기준)
            if payload:
                external_ids = list(set([p["external_id"] for p in payload]))
                for ext_id in external_ids:
                    try:
                        self.sb.table("legal_chunks")\
                            .delete()\
                            .eq("external_id", ext_id)\
                            .execute()
                    except Exception as e:
                        error_msg = str(e)
                        if "Could not find the table" in error_msg or "PGRST205" in error_msg:
                            self._reinitialize_client()
                            self.sb.table("legal_chunks")\
                                .delete()\
                                .eq("external_id", ext_id)\
                                .execute()
                        else:
                            print(f"[경고] 기존 청크 삭제 실패: {str(e)}")
            
            # 새 청크 삽입
            self.sb.table("legal_chunks")\
                .insert(payload)\
                .execute()
        except Exception as e:
            error_msg = str(e)
            if "Could not find the table" in error_msg or "PGRST205" in error_msg:
                print(f"[경고] 스키마 캐시 문제 감지, 클라이언트 재초기화 중...")
                self._reinitialize_client()
                self.sb.table("legal_chunks")\
                    .insert(payload)\
                    .execute()
            else:
                raise
    
    def search_similar_legal_chunks(
        self,
        query_embedding: List[float],
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """
        유사 법률 청크 검색 (pgvector RPC 함수 사용)
        
        DB에서 벡터 연산 + 정렬 + top_k까지 한 방에 처리하여 성능 최적화.
        Python에서는 결과만 받아서 사용.
        
        Args:
            query_embedding: 쿼리 임베딩 벡터 (1024차원, list[float])
            top_k: 반환할 최대 개수
            filters: 필터 (예: {"topic_main": "wage"})
        
        Returns:
            [{
                id: str,
                external_id: str,
                source_type: str,
                title: str,
                content: str,
                chunk_index: int,
                file_path: str,
                metadata: Dict,
                score: float (similarity, 이미 정렬됨)
            }]
        """
        self._ensure_initialized()
        
        try:
            # category 필터 추출 (topic_main)
            category = None
            if filters and "topic_main" in filters:
                category = filters["topic_main"]
            
            # match_threshold 설정
            # Python에서 최종 threshold(0.4) 체크를 하므로, RPC에서는 낮게 설정하여 후보를 더 받음
            match_threshold = 0.3
            
            # RPC 함수 호출 - DB에서 벡터 연산 + 정렬 + top_k 처리
            response = self.sb.rpc(
                "match_legal_chunks",
                {
                    "query_embedding": query_embedding,  # vector(1024)와 매핑
                    "match_threshold": match_threshold,
                    "match_count": top_k,
                    "category": category,  # NULL이면 필터링 안 함 (topic_main 필터)
                }
            ).execute()
            
            # RPC 함수가 반환한 결과를 그대로 사용
            # 이미 score 포함, 유사도 순으로 정렬됨, top_k만큼만 반환됨
            return response.data if response.data else []
                
        except Exception as e:
            # RPC 함수가 없거나 오류 발생 시 fallback
            error_msg = str(e)
            if "match_legal_chunks" in error_msg or "does not exist" in error_msg.lower():
                print(f"[경고] match_legal_chunks RPC 함수가 없습니다. SQL 스크립트를 실행하세요: {error_msg}")
                print("[팁] backend/scripts/create_match_legal_chunks_rpc.sql 파일을 Supabase SQL Editor에서 실행하세요.")
            else:
                print(f"[경고] legal 벡터 검색 실패: {error_msg}")
            return []
    
    def get_storage_file_url(
        self,
        external_id: str,
        source_type: str,
        expires_in: int = 3600,  # 1시간 (Public URL에서는 사용하지 않지만 호환성을 위해 유지)
        bucket_name: Optional[str] = None,  # 버킷 이름 (무시됨, 항상 legal-sources 사용)
        file_path_override: Optional[str] = None  # 직접 경로 지정 (우선순위 높음)
    ) -> Optional[str]:
        """
        스토리지에서 파일 다운로드 Public URL 생성
        
        모든 자료(case, manual, law, standard_contract)는 legal-sources 버킷에 저장되어 있으므로
        bucket_name 파라미터는 무시되고 항상 legal-sources 버킷을 사용합니다.
        
        Args:
            external_id: 파일 ID (legal_chunks.external_id 또는 related_cases.id)
            source_type: 소스 타입 ('law' | 'manual' | 'case' | 'standard_contract')
            expires_in: URL 만료 시간 (초, Public URL에서는 사용하지 않지만 호환성을 위해 유지)
            bucket_name: 버킷 이름 (무시됨, 항상 legal-sources 사용)
            file_path_override: 직접 경로 지정 (예: "standard_contracts/5989a3a317ccd827176b60367c1374a8.pdf")
        
        Returns:
            Public URL 또는 None (파일이 없거나 오류 발생 시)
        """
        self._ensure_initialized()
        
        if not external_id:
            return None
        
        # 모든 자료(case, manual, law, standard_contract)는 legal-sources 버킷에 있음
        # 버킷 이름을 legal-sources로 고정
        bucket_name = "legal-sources"
        
        # file_path_override가 있으면 직접 사용
        if file_path_override:
            file_path = file_path_override
        else:
            # source_type에 따른 버킷 경로 매핑
            bucket_map = {
                'law': 'laws',
                'manual': 'manuals',
                'case': 'cases',
                'standard_contract': 'standard_contracts',
            }
            bucket_folder = bucket_map.get(source_type, 'laws')
            # external_id에 이미 .pdf가 포함되어 있으면 추가하지 않음
            if external_id.lower().endswith('.pdf'):
                file_path = f"{bucket_folder}/{external_id}"
            else:
                file_path = f"{bucket_folder}/{external_id}.pdf"
        
        try:
            # 방법 1: Supabase Python SDK의 get_public_url 메서드 사용 시도
            try:
                public_url = self.sb.storage.from_(bucket_name).get_public_url(file_path)
                if public_url:
                    return public_url
            except (AttributeError, Exception) as sdk_error:
                # get_public_url 메서드가 없거나 실패한 경우 직접 URL 조합
                pass
            
            # 방법 2: 직접 Public URL 조합
            supabase_url = os.getenv("SUPABASE_URL") or settings.supabase_url
            if not supabase_url:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"SUPABASE_URL이 설정되지 않아 Public URL 생성 실패")
                return None
            
            # Public URL 형식: {supabase_url}/storage/v1/object/public/{bucket}/{path}
            public_url = f"{supabase_url.rstrip('/')}/storage/v1/object/public/{bucket_name}/{file_path}"
            return public_url
            
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"스토리지 Public URL 생성 실패 (external_id={external_id}, source_type={source_type}, bucket={bucket_name}): {str(e)}")
            return None
    
    def search_similar_contract_chunks(
        self,
        contract_id: str,
        query_embedding: List[float],
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
        boost_article: Optional[int] = None,
        boost_factor: float = 1.5
    ) -> List[Dict[str, Any]]:
        """
        계약서 내부 청크 검색 (벡터 코사인 유사도)
        
        Args:
            contract_id: 계약서 ID (doc_id)
            query_embedding: 쿼리 임베딩 벡터
            top_k: 반환할 최대 개수
            filters: 필터 (예: {"article_number": 5})
            boost_article: 가점을 줄 조항 번호 (issue 기반 boosting)
            boost_factor: 가점 배율 (기본값: 1.5)
        
        Returns:
            [{
                id: str,
                contract_id: str,
                article_number: int,
                paragraph_index: int (optional),
                content: str,
                chunk_index: int,
                metadata: Dict,
                score: float (similarity, boosting 적용)
            }]
        """
        self._ensure_initialized()
        
        try:
            # 필터 조건 구성
            query = self.sb.table("contract_chunks")\
                .select("id, contract_id, article_number, paragraph_index, content, chunk_index, metadata, embedding")\
                .eq("contract_id", contract_id)
            
            # article_number 필터
            if filters and "article_number" in filters:
                query = query.eq("article_number", filters["article_number"])
            
            # 모든 청크 조회
            result = query.limit(1000).execute()
            
            if not result.data:
                return []
            
            # 벡터 유사도 계산
            import numpy as np
            import json
            
            # query_embedding을 numpy 배열로 변환
            try:
                if isinstance(query_embedding, str):
                    try:
                        query_embedding = json.loads(query_embedding)
                    except json.JSONDecodeError:
                        try:
                            import ast
                            query_embedding = ast.literal_eval(query_embedding)
                        except:
                            print(f"[경고] 쿼리 임베딩 파싱 실패")
                            return []
                
                if not isinstance(query_embedding, (list, np.ndarray)):
                    print(f"[경고] 쿼리 임베딩이 리스트가 아닙니다: {type(query_embedding)}")
                    return []
                
                query_vec = np.array(query_embedding, dtype=np.float32)
                
                if len(query_vec) == 0:
                    print(f"[경고] 쿼리 임베딩이 비어있습니다.")
                    return []
                
            except Exception as e:
                print(f"[경고] 쿼리 임베딩 변환 실패: {str(e)}")
                return []
            
            # 각 청크와의 유사도 계산
            results = []
            for chunk in result.data:
                if not chunk.get("embedding"):
                    continue
                
                try:
                    chunk_embedding = chunk["embedding"]
                    if isinstance(chunk_embedding, str):
                        chunk_embedding = json.loads(chunk_embedding)
                    
                    chunk_vec = np.array(chunk_embedding, dtype=np.float32)
                    
                    # 코사인 유사도 계산
                    dot_product = np.dot(query_vec, chunk_vec)
                    norm_query = np.linalg.norm(query_vec)
                    norm_chunk = np.linalg.norm(chunk_vec)
                    
                    if norm_query == 0 or norm_chunk == 0:
                        continue
                    
                    similarity = float(dot_product / (norm_query * norm_chunk))
                    
                    # Issue 기반 boosting: 같은 조항이면 가점
                    if boost_article is not None:
                        chunk_article = chunk.get("article_number")
                        if chunk_article == boost_article:
                            similarity *= boost_factor
                    
                    # 최소 유사도 임계값 (0.5)
                    if similarity > 0.5:
                        results.append({
                            "id": chunk.get("id"),
                            "contract_id": chunk.get("contract_id"),
                            "article_number": chunk.get("article_number"),
                            "paragraph_index": chunk.get("paragraph_index"),
                            "content": chunk.get("content", ""),
                            "chunk_index": chunk.get("chunk_index", 0),
                            "metadata": chunk.get("metadata", {}),
                            "score": similarity
                        })
                
                except Exception as e:
                    print(f"[경고] 청크 유사도 계산 실패: {str(e)}")
                    continue
            
            # 유사도 순 정렬
            results.sort(key=lambda x: x["score"], reverse=True)
            
            return results[:top_k]
        
        except Exception as e:
            error_msg = str(e)
            # 테이블이 없는 경우 재시도
            if "Could not find the table" in error_msg or "PGRST205" in error_msg:
                print(f"[경고] contract_chunks 테이블을 찾을 수 없습니다. 스키마 캐시 갱신 중...")
                self._reinitialize_client()
                try:
                    # 재시도
                    query = self.sb.table("contract_chunks")\
                        .select("id, contract_id, article_number, paragraph_index, content, chunk_index, metadata, embedding")\
                        .eq("contract_id", contract_id)
                    
                    if filters and "article_number" in filters:
                        query = query.eq("article_number", filters["article_number"])
                    
                    result = query.limit(1000).execute()
                    
                    if not result.data:
                        return []
                    
                    # 벡터 유사도 계산 (위의 로직과 동일)
                    import numpy as np
                    import json
                    
                    try:
                        if isinstance(query_embedding, str):
                            try:
                                query_embedding = json.loads(query_embedding)
                            except json.JSONDecodeError:
                                try:
                                    import ast
                                    query_embedding = ast.literal_eval(query_embedding)
                                except:
                                    print(f"[경고] 쿼리 임베딩 파싱 실패")
                                    return []
                        
                        if not isinstance(query_embedding, (list, np.ndarray)):
                            print(f"[경고] 쿼리 임베딩이 리스트가 아닙니다: {type(query_embedding)}")
                            return []
                        
                        query_vec = np.array(query_embedding, dtype=np.float32)
                        
                        if len(query_vec) == 0:
                            print(f"[경고] 쿼리 임베딩이 비어있습니다.")
                            return []
                        
                    except Exception as e2:
                        print(f"[경고] 쿼리 임베딩 변환 실패: {str(e2)}")
                        return []
                    
                    results = []
                    for chunk in result.data:
                        if not chunk.get("embedding"):
                            continue
                        
                        try:
                            chunk_embedding = chunk["embedding"]
                            if isinstance(chunk_embedding, str):
                                chunk_embedding = json.loads(chunk_embedding)
                            
                            chunk_vec = np.array(chunk_embedding, dtype=np.float32)
                            
                            dot_product = np.dot(query_vec, chunk_vec)
                            norm_query = np.linalg.norm(query_vec)
                            norm_chunk = np.linalg.norm(chunk_vec)
                            
                            if norm_query == 0 or norm_chunk == 0:
                                continue
                            
                            similarity = float(dot_product / (norm_query * norm_chunk))
                            
                            if boost_article is not None:
                                chunk_article = chunk.get("article_number")
                                if chunk_article == boost_article:
                                    similarity *= boost_factor
                            
                            if similarity > 0.5:
                                results.append({
                                    "id": chunk.get("id"),
                                    "contract_id": chunk.get("contract_id"),
                                    "article_number": chunk.get("article_number"),
                                    "paragraph_index": chunk.get("paragraph_index"),
                                    "content": chunk.get("content", ""),
                                    "chunk_index": chunk.get("chunk_index", 0),
                                    "metadata": chunk.get("metadata", {}),
                                    "score": similarity
                                })
                        
                        except Exception as e2:
                            print(f"[경고] 청크 유사도 계산 실패: {str(e2)}")
                            continue
                    
                    results.sort(key=lambda x: x["score"], reverse=True)
                    return results[:top_k]
                    
                except Exception as e2:
                    print(f"[경고] 계약서 청크 검색 재시도 실패: {str(e2)}")
                    print(f"[해결] contract_chunks 테이블이 생성되어 있는지 확인하세요.")
                    print(f"[해결] backend/scripts/create_contract_chunks_table.sql 파일을 Supabase SQL Editor에서 실행하세요.")
                    return []
            else:
                print(f"[경고] 계약서 청크 검색 오류: {error_msg}")
                return []
    
    def bulk_upsert_contract_chunks(
        self,
        contract_id: str,
        chunks: List[Dict[str, Any]]
    ):
        """
        계약서 청크 및 임베딩 일괄 저장
        
        Args:
            contract_id: 계약서 ID (doc_id)
            chunks: [{
                content: str,
                embedding: List[float],
                article_number: int,
                paragraph_index: int (optional),
                chunk_index: int,
                chunk_type: str ('article' | 'paragraph'),
                metadata: Dict (optional)
            }]
        """
        self._ensure_initialized()
        if not chunks:
            return
        
        # 기존 청크 삭제 (contract_id 기준)
        try:
            self.sb.table("contract_chunks")\
                .delete()\
                .eq("contract_id", contract_id)\
                .execute()
        except Exception as e:
            error_msg = str(e)
            if "Could not find the table" in error_msg or "PGRST205" in error_msg:
                self._reinitialize_client()
                try:
                    self.sb.table("contract_chunks")\
                        .delete()\
                        .eq("contract_id", contract_id)\
                        .execute()
                except:
                    print(f"[경고] contract_chunks 테이블이 없습니다. 먼저 SQL 스크립트를 실행하세요.")
                    return
            else:
                print(f"[경고] 기존 청크 삭제 실패: {str(e)}")
        
        # 새 청크 삽입
        payload = []
        for c in chunks:
            payload.append({
                "contract_id": contract_id,
                "article_number": c.get("article_number"),
                "paragraph_index": c.get("paragraph_index"),
                "content": c["content"],
                "chunk_index": c.get("chunk_index", 0),
                "chunk_type": c.get("chunk_type", "article"),
                "embedding": c["embedding"],
                "metadata": c.get("metadata", {})
            })
        
        try:
            self.sb.table("contract_chunks")\
                .insert(payload)\
                .execute()
        except Exception as e:
            error_msg = str(e)
            if "Could not find the table" in error_msg or "PGRST205" in error_msg:
                print(f"[경고] contract_chunks 테이블이 없습니다. 먼저 SQL 스크립트를 실행하세요.")
                print(f"[해결] backend/scripts/create_contract_chunks_table.sql 파일을 Supabase SQL Editor에서 실행하세요.")
            else:
                raise Exception(f"계약서 청크 저장 실패: {str(e)}")

