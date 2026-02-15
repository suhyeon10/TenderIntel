"""
기존 legal_chunks 데이터의 파일들을 Storage에 업로드하는 스크립트

1. legal_chunks 테이블에서 title, source_type, external_id 조회
2. external_id별로 그룹화하여 파일명 확인
3. backend/data/legal/ 폴더에서 원본 파일 찾기
4. Storage 버킷 "legal-sources"에 external_id 이름으로 업로드
"""

import os
import sys
import json
from pathlib import Path
from typing import Dict, List, Set, Optional, Tuple
from collections import defaultdict
from datetime import datetime
import hashlib

# 프로젝트 루트를 Python 경로에 추가
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from supabase import create_client
from config import settings
from core.logging_config import get_logger

logger = get_logger(__name__)

STORAGE_BUCKET = "legal-sources"


def get_supabase_client():
    """Supabase 클라이언트 싱글톤"""
    supabase_url = os.getenv("SUPABASE_URL") or settings.supabase_url
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or settings.supabase_service_role_key
    
    if not supabase_url or not supabase_key:
        raise ValueError("SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다")
    
    return create_client(supabase_url, supabase_key)


def get_file_hash(file_path: Path) -> str:
    """파일 경로 기반 해시 생성 (external_id와 동일한 방식)"""
    relative_path = str(file_path.relative_to(backend_dir))
    return hashlib.md5(relative_path.encode("utf-8")).hexdigest()


def find_file_by_external_id(
    external_id: str, 
    title: str, 
    source_type: str,
    file_path_hint: Optional[str] = None,
    metadata: Optional[Dict] = None
) -> Optional[Path]:
    """
    external_id와 여러 힌트를 기반으로 원본 파일 찾기
    
    우선순위:
    1. file_path_hint (DB에 저장된 file_path)
    2. metadata.filename 또는 metadata.original_file_name
    3. title로 직접 찾기 + 해시 확인
    4. 모든 파일 순회하며 해시 확인
    
    Args:
        external_id: 파일 해시
        title: 파일명 (한글 포함 가능)
        source_type: 'law' | 'manual' | 'case' | 'standard_contract'
        file_path_hint: DB에 저장된 file_path (예: "standard_contracts/5989a3a3....pdf")
        metadata: metadata JSON 객체
    
    Returns:
        파일 경로 또는 None
    """
    # source_type에 따른 폴더명 매핑
    folder_mapping = {
        "law": "laws",
        "manual": "manuals",
        "case": "cases",
        "standard_contract": "standard_contracts",
    }
    
    folder_name = folder_mapping.get(source_type, "other")
    legal_dir = backend_dir / "data" / "legal" / folder_name
    
    if not legal_dir.exists():
        logger.warning(f"  [WARN] 폴더가 없습니다: {legal_dir}")
        return None
    
    # 방법 1: file_path_hint 우선 사용 (가장 확실)
    if file_path_hint:
        # file_path가 "standard_contracts/5989a3a3....pdf" 형태면
        if "/" in file_path_hint:
            # 상대 경로로 해석
            candidate = backend_dir / "data" / "legal" / file_path_hint
        else:
            # 파일명만 있으면 해당 폴더에서 찾기
            candidate = legal_dir / file_path_hint
        
        if candidate.is_file():
            # 해시 확인 (안전장치)
            if get_file_hash(candidate) == external_id:
                return candidate
    
    # 방법 2: metadata.filename 사용
    if metadata:
        filename = metadata.get("filename") or metadata.get("original_file_name")
        if filename:
            candidate = legal_dir / filename
            if candidate.is_file():
                if get_file_hash(candidate) == external_id:
                    return candidate
    
    # 방법 3: title로 직접 찾기 + 해시 확인
    possible_files = list(legal_dir.glob(title))
    if possible_files:
        for file_path in possible_files:
            if get_file_hash(file_path) == external_id:
                return file_path
    
    # 방법 4: 모든 파일을 순회하며 해시 확인
    supported_extensions = ['.pdf', '.hwp', '.hwpx', '.txt', '.md']
    for ext in supported_extensions:
        for file_path in legal_dir.glob(f"*{ext}"):
            if get_file_hash(file_path) == external_id:
                return file_path
    
    # 방법 5: title과 유사한 파일명 찾기 (한글 파일명 문제 대비)
    title_without_ext = Path(title).stem
    for ext in supported_extensions:
        for file_path in legal_dir.glob(f"*{ext}"):
            if title_without_ext in file_path.stem or file_path.stem in title_without_ext:
                if get_file_hash(file_path) == external_id:
                    return file_path
    
    return None


def upload_file_to_storage(supabase, file_path: Path, external_id: str, source_type: str) -> Tuple[bool, str]:
    """
    파일을 Storage에 업로드
    
    Args:
        supabase: Supabase 클라이언트
        file_path: 로컬 파일 경로
        external_id: 파일 ID (업로드 파일명으로 사용)
        source_type: 소스 타입 (폴더 구조용)
    
    Returns:
        (성공 여부, Storage 경로)
    """
    try:
        # 확장자 추출
        ext = file_path.suffix.lower() or ".pdf"
        
        # Storage object path: {source_type}/{external_id}{ext}
        folder_mapping = {
            "law": "laws",
            "manual": "manuals",
            "case": "cases",
            "standard_contract": "standard_contracts",
        }
        folder_name = folder_mapping.get(source_type, "other")
        object_path = f"{folder_name}/{external_id}{ext}"
        
        # content-type 매핑
        content_type_map = {
            ".pdf": "application/pdf",
            ".txt": "text/plain",
            ".md": "text/markdown",
            ".hwp": "application/x-hwp",
            ".hwpx": "application/x-hwpx",
        }
        content_type = content_type_map.get(ext, "application/octet-stream")
        
        # 파일 읽기
        with open(file_path, "rb") as f:
            file_data = f.read()
        
        # Storage에 업로드
        supabase.storage.from_(STORAGE_BUCKET).upload(
            object_path,
            file_data,
            {
                "content-type": content_type,
                "upsert": "true",  # 문자열로 전달
            }
        )
        
        logger.info(f"  ✅ 업로드 완료: {object_path}")
        return True, object_path
        
    except Exception as e:
        logger.error(f"  ❌ 업로드 실패: {str(e)}")
        return False, ""


def update_file_path_in_db(supabase, external_id: str, storage_path: str) -> bool:
    """
    legal_chunks 테이블의 file_path를 Storage 경로로 업데이트
    
    Args:
        supabase: Supabase 클라이언트
        external_id: 파일 ID
        storage_path: Storage 경로
    
    Returns:
        성공 여부
    """
    try:
        # external_id로 모든 청크 업데이트
        result = supabase.table("legal_chunks")\
            .update({"file_path": storage_path})\
            .eq("external_id", external_id)\
            .execute()
        
        logger.info(f"  ✅ DB 업데이트 완료: {len(result.data) if result.data else 0}개 청크")
        return True
        
    except Exception as e:
        logger.error(f"  ❌ DB 업데이트 실패: {str(e)}")
        return False


def main():
    """메인 함수"""
    logger.info("=" * 60)
    logger.info("[시작] legal_chunks 파일들을 Storage에 업로드")
    logger.info("=" * 60)
    
    # Supabase 클라이언트 생성
    try:
        supabase = get_supabase_client()
        logger.info("✅ Supabase 클라이언트 연결 완료")
    except Exception as e:
        logger.error(f"❌ Supabase 연결 실패: {str(e)}")
        return
    
    # 버킷 확인
    try:
        buckets = supabase.storage.list_buckets()
        bucket_names = {b["name"] for b in buckets} if isinstance(buckets, list) else set()
        
        if STORAGE_BUCKET not in bucket_names:
            logger.warning(f"[WARN] '{STORAGE_BUCKET}' 버킷이 없습니다!")
            logger.info(f"\n[NOTE] 버킷 생성 방법:")
            logger.info(f"   1. Supabase 대시보드 접속")
            logger.info(f"   2. Storage > Buckets > New bucket")
            logger.info(f"   3. Name: {STORAGE_BUCKET}")
            logger.info(f"   4. Public: Yes (또는 Private + RLS 정책 설정)")
            return
        else:
            logger.info(f"[OK] '{STORAGE_BUCKET}' 버킷 확인됨")
    except Exception as e:
        logger.error(f"[FAIL] 버킷 확인 실패: {str(e)}")
        return
    
    # legal_chunks에서 title, source_type, external_id, file_path, metadata 조회
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
    
    # external_id별로 그룹화 (같은 파일의 여러 청크가 있을 수 있음)
    file_info: Dict[str, Dict] = {}
    missing_ext_id = 0
    
    for chunk in result.data:
        external_id = chunk.get("external_id")
        if not external_id:
            missing_ext_id += 1
            continue
        
        # external_id별로 첫 번째 정보만 저장 (같은 파일이므로)
        if external_id not in file_info:
            file_info[external_id] = {
                "title": chunk.get("title", ""),
                "source_type": chunk.get("source_type", "law"),
                "external_id": external_id,
                "file_path": chunk.get("file_path"),
                "metadata": chunk.get("metadata") or {},
            }
    
    if missing_ext_id > 0:
        logger.warning(f"[WARN] external_id 없는 청크 수: {missing_ext_id}개")
    
    logger.info(f"📁 고유 파일 개수: {len(file_info)}개")
    
    # 각 파일을 찾아서 업로드
    logger.info("\n📤 파일 업로드 시작...")
    logger.info("=" * 60)
    
    success_count = 0
    failed_count = 0
    not_found_count = 0
    
    # 결과 저장용 리스트
    success_files: List[Dict] = []
    failed_files: List[Dict] = []
    not_found_files: List[Dict] = []
    
    for idx, (external_id, info) in enumerate(file_info.items(), 1):
        title = info["title"]
        source_type = info["source_type"]
        
        logger.info(f"\n[{idx}/{len(file_info)}] {title}")
        logger.info(f"  📄 external_id: {external_id[:8]}...")
        logger.info(f"  📂 source_type: {source_type}")
        
        # 원본 파일 찾기
        file_path = find_file_by_external_id(external_id, title, source_type)
        
        if not file_path:
            logger.warning(f"  ⚠️  파일을 찾을 수 없습니다: {title}")
            not_found_count += 1
            not_found_files.append({
                "external_id": external_id,
                "title": title,
                "source_type": source_type,
                "reason": "파일을 찾을 수 없음"
            })
            continue
        
        logger.info(f"  ✅ 파일 찾음: {file_path.relative_to(backend_dir)}")
        
        # Storage에 업로드
        success, storage_path = upload_file_to_storage(supabase, file_path, external_id, source_type)
        
        if success:
            # DB의 file_path 업데이트
            if update_file_path_in_db(supabase, external_id, storage_path):
                success_count += 1
                success_files.append({
                    "external_id": external_id,
                    "title": title,
                    "source_type": source_type,
                    "storage_path": storage_path,
                    "local_path": str(file_path.relative_to(backend_dir))
                })
            else:
                failed_count += 1
                failed_files.append({
                    "external_id": external_id,
                    "title": title,
                    "source_type": source_type,
                    "storage_path": storage_path,
                    "local_path": str(file_path.relative_to(backend_dir)),
                    "reason": "DB 업데이트 실패"
                })
        else:
            failed_count += 1
            failed_files.append({
                "external_id": external_id,
                "title": title,
                "source_type": source_type,
                "local_path": str(file_path.relative_to(backend_dir)),
                "reason": "Storage 업로드 실패"
            })
    
    # 결과 요약
    logger.info("")
    logger.info("=" * 60)
    logger.info("[완료] 업로드 결과:")
    logger.info(f"  ✅ 성공: {success_count}개")
    logger.info(f"  ❌ 실패: {failed_count}개")
    logger.info(f"  ⚠️  파일 없음: {not_found_count}개")
    logger.info(f"  📊 총 파일: {len(file_info)}개")
    logger.info("=" * 60)
    
    # 결과를 JSON 파일로 저장
    output_dir = backend_dir / "output"
    output_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = output_dir / f"legal_files_upload_result_{timestamp}.json"
    
    result_data = {
        "summary": {
            "total_files": len(file_info),
            "success_count": success_count,
            "failed_count": failed_count,
            "not_found_count": not_found_count,
            "timestamp": datetime.now().isoformat()
        },
        "success_files": success_files,
        "failed_files": failed_files,
        "not_found_files": not_found_files
    }
    
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(result_data, f, ensure_ascii=False, indent=2)
    
    logger.info(f"\n📄 결과 파일 저장: {output_file.relative_to(backend_dir)}")
    logger.info(f"   - 성공: {len(success_files)}개")
    logger.info(f"   - 실패: {len(failed_files)}개")
    logger.info(f"   - 파일 없음: {len(not_found_files)}개")


if __name__ == "__main__":
    main()
