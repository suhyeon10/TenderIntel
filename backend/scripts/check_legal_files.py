"""
legal_chunks 테이블에 있는 파일 이름 확인 스크립트
"""

import os
import sys
from pathlib import Path
from collections import defaultdict

# 프로젝트 루트를 Python 경로에 추가
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from supabase import create_client
from config import settings
from core.logging_config import get_logger

logger = get_logger(__name__)


def get_supabase_client():
    """Supabase 클라이언트 싱글톤"""
    supabase_url = os.getenv("SUPABASE_URL") or settings.supabase_url
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or settings.supabase_service_role_key
    
    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다")
    
    return create_client(supabase_url, supabase_key)


def main():
    """메인 함수"""
    logger.info("=" * 60)
    logger.info("[시작] legal_chunks 파일 목록 확인")
    logger.info("=" * 60)
    
    # Supabase 클라이언트 생성
    try:
        supabase = get_supabase_client()
        logger.info("[OK] Supabase 클라이언트 연결 완료")
    except Exception as e:
        logger.error(f"[FAIL] Supabase 연결 실패: {str(e)}")
        return
    
    # legal_chunks에서 데이터 조회 (file_path, metadata도 함께 조회)
    logger.info("\n[INFO] legal_chunks 테이블에서 데이터 조회 중...")
    try:
        result = supabase.table("legal_chunks")\
            .select("title, source_type, external_id, file_path, metadata")\
            .range(0, 9999)\
            .execute()
        
        if not result.data:
            logger.warning("legal_chunks에 데이터가 없습니다.")
            return
        
        logger.info(f"[OK] {len(result.data)}개 청크 데이터 조회 완료")
        
    except Exception as e:
        logger.error(f"[FAIL] 데이터 조회 실패: {str(e)}")
        return
    
    # external_id별로 그룹화
    file_info: dict = defaultdict(lambda: {
        "title": "",
        "source_type": "",
        "external_id": "",
        "file_path": None,
        "metadata": {},
        "chunk_count": 0
    })
    
    missing_ext_id = 0
    
    for chunk in result.data:
        external_id = chunk.get("external_id")
        if not external_id:
            missing_ext_id += 1
            continue
        
        if external_id not in file_info:
            metadata = chunk.get("metadata") or {}
            file_info[external_id] = {
                "title": chunk.get("title", ""),
                "source_type": chunk.get("source_type", ""),
                "external_id": external_id,
                "file_path": chunk.get("file_path"),
                "metadata": metadata,
                "chunk_count": 0
            }
        
        file_info[external_id]["chunk_count"] += 1
    
    if missing_ext_id > 0:
        logger.warning(f"[WARN] external_id 없는 청크 수: {missing_ext_id}개")
    
    # source_type별 통계
    stats = defaultdict(lambda: {"files": 0, "chunks": 0})
    for info in file_info.values():
        st = info["source_type"]
        stats[st]["files"] += 1
        stats[st]["chunks"] += info["chunk_count"]
    
    # 결과 출력
    logger.info("\n" + "=" * 60)
    logger.info("[통계] source_type별 파일 현황")
    logger.info("=" * 60)
    for source_type in sorted(stats.keys()):
        s = stats[source_type]
        logger.info(f"{source_type:20s}: {s['files']:3d}개 파일, {s['chunks']:5d}개 청크")
    
    total_files = sum(s["files"] for s in stats.values())
    total_chunks = sum(s["chunks"] for s in stats.values())
    logger.info("-" * 60)
    logger.info(f"{'전체':20s}: {total_files:3d}개 파일, {total_chunks:5d}개 청크")
    
    # external_id 패턴 분석
    logger.info("\n" + "=" * 60)
    logger.info("[분석] external_id 패턴")
    logger.info("=" * 60)
    
    md5_count = 0  # 32자 MD5 해시
    filename_count = 0  # 파일명 그대로
    other_count = 0
    
    for info in file_info.values():
        ext_id = info["external_id"]
        ext_id_lower = ext_id.lower()
        
        # MD5 해시 판별 (소문자 변환 후 체크)
        if len(ext_id_lower) == 32 and all(c in '0123456789abcdef' for c in ext_id_lower):
            md5_count += 1
        # 파일명 그대로인 경우만 체크 (== 비교만)
        elif ext_id == info["title"]:
            filename_count += 1
        else:
            other_count += 1
    
    logger.info(f"MD5 해시 (32자): {md5_count}개")
    logger.info(f"파일명 그대로: {filename_count}개")
    logger.info(f"기타: {other_count}개")
    
    # 파일 목록 출력
    logger.info("\n" + "=" * 60)
    logger.info("[파일 목록] source_type별 상세 목록")
    logger.info("=" * 60)
    
    for source_type in sorted(stats.keys()):
        logger.info(f"\n[{source_type}]")
        logger.info("-" * 60)
        
        files = [info for info in file_info.values() if info["source_type"] == source_type]
        files.sort(key=lambda x: x["title"])
        
        for idx, info in enumerate(files, 1):
            ext_id = info["external_id"]
            ext_id_preview = ext_id[:16] + "..." if len(ext_id) > 16 else ext_id
            file_path = info.get("file_path")
            metadata = info.get("metadata", {})
            filename = metadata.get("filename") or metadata.get("original_file_name")
            
            logger.info(f"{idx:2d}. {info['title']}")
            logger.info(f"    external_id: {ext_id_preview} ({len(ext_id)}자)")
            logger.info(f"    청크 수: {info['chunk_count']}개")
            if file_path:
                logger.info(f"    file_path: {file_path}")
            if filename:
                logger.info(f"    metadata.filename: {filename}")
    
    logger.info("\n" + "=" * 60)
    logger.info("[완료] 파일 목록 확인 완료")
    logger.info("=" * 60)


if __name__ == "__main__":
    main()

