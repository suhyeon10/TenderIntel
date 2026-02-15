"""
backend/data/legal/ 폴더의 모든 파일을 처리하는 스크립트

모든 legal 데이터는 legal_chunks 테이블에 저장합니다.
- standard_contracts/ → legal_chunks (source_type: "standard_contract")
- laws/ → legal_chunks (source_type: "law")
- manuals/ → legal_chunks (source_type: "manual")
- cases/ → legal_chunks (source_type: "case")
"""

import os
import sys
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import uuid
import hashlib

# 프로젝트 루트를 Python 경로에 추가
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from core.document_processor_v2 import DocumentProcessor
from core.generator_v2 import LLMGenerator
from core.supabase_vector_store import SupabaseVectorStore
from core.logging_config import get_logger
from supabase import create_client, Client
from config import settings

logger = get_logger(__name__)

# Supabase Storage 설정
STORAGE_BUCKET = "legal-files"
_supabase_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """Supabase 클라이언트 싱글톤"""
    global _supabase_client
    if _supabase_client is None:
        supabase_url = os.getenv("SUPABASE_URL") or settings.supabase_url
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or settings.supabase_service_role_key
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다")
        
        _supabase_client = create_client(supabase_url, supabase_key)
    return _supabase_client


def make_external_id(file_path: Path) -> str:
    """파일 경로 기반 external_id 생성 (해시)"""
    relative_path = str(file_path.relative_to(backend_dir))
    return hashlib.md5(relative_path.encode("utf-8")).hexdigest()


def source_type_to_folder(source_type: str) -> str:
    """DB source_type을 Storage 폴더명으로 변환"""
    mapping = {
        "law": "laws",
        "manual": "manuals",
        "case": "cases",
        "standard_contract": "standard_contracts",
    }
    return mapping.get(source_type, "other")


def upload_legal_file(file_path: Path, source_type: str, external_id: str) -> Tuple[str, str]:
    """
    Supabase Storage에 파일 업로드하고 (bucket, object_path) 리턴
    
    Args:
        file_path: 로컬 파일 경로
        source_type: 'law' | 'manual' | 'case' | 'standard_contract'
        external_id: 파일 고유 ID (hash)
    
    Returns:
        (bucket, object_path) - 예: ("legal-files", "laws/abcd1234.pdf")
    """
    supabase = get_supabase_client()
    
    # 확장자 추출 (없으면 .pdf로 가정)
    ext = file_path.suffix.lower() or ".pdf"
    
    # Storage 폴더명으로 변환
    folder_name = source_type_to_folder(source_type)
    
    # Storage object path 생성 (한글/공백 없이 external_id + 확장자만 사용)
    object_path = f"{folder_name}/{external_id}{ext}"
    
    try:
        # 파일 읽기
        with open(file_path, "rb") as f:
            file_data = f.read()
        
        # Storage에 업로드 (upsert=True로 덮어쓰기 허용)
        supabase.storage.from_(STORAGE_BUCKET).upload(
            object_path,
            file_data,
            file_options={"upsert": True, "content-type": f"application/{ext[1:]}" if ext else "application/pdf"}
        )
        
        logger.info(f"  📤 Storage 업로드 완료: {object_path}")
        return STORAGE_BUCKET, object_path
        
    except Exception as e:
        logger.error(f"  ❌ Storage 업로드 실패: {str(e)}")
        # 업로드 실패해도 계속 진행 (file_path는 None으로 설정)
        raise


def get_source_type_from_path(file_path: Path) -> str:
    """파일 경로에서 source_type 추출"""
    path_str = str(file_path)
    if "standard_contracts" in path_str:
        return "standard_contract"
    elif "laws" in path_str:
        return "law"
    elif "manuals" in path_str:
        return "manual"
    elif "cases" in path_str:
        return "case"
    else:
        return "unknown"




async def process_legal_file(
    file_path: Path,
    processor: DocumentProcessor,
    generator: LLMGenerator,
    vector_store: SupabaseVectorStore,
    upload_to_storage: bool = False,
) -> Dict[str, Any]:
    """
    모든 legal 파일을 처리하여 legal_chunks에 저장
    
    Returns:
        {
            "file": str,
            "status": "success" | "failed",
            "external_id": str,
            "chunks_count": int,
            "error": str (optional)
        }
    """
    file_name = file_path.name
    source_type = get_source_type_from_path(file_path)
    
    # external_id 생성 (파일 경로 기반 해시)
    external_id = make_external_id(file_path)
    
    try:
        # 0. 중복 체크: 이미 존재하는 파일인지 확인
        logger.info(f"  📄 소스 타입: {source_type}")
        logger.info(f"  🔍 중복 체크 중... (external_id: {external_id[:8]}...)")
        
        if vector_store.check_legal_chunks_exist(external_id):
            logger.info(f"  ⏭️  이미 존재하는 파일입니다. 스킵합니다.")
            # 기존 청크 개수 확인
            try:
                result = vector_store.sb.table("legal_chunks")\
                    .select("id", count="exact")\
                    .eq("external_id", external_id)\
                    .execute()
                existing_count = result.count if result.count is not None else len(result.data) if result.data else 0
                logger.info(f"  ℹ️  기존 청크 개수: {existing_count}개")
            except:
                existing_count = 0
            
            return {
                "file": file_name,
                "status": "skipped",
                "external_id": external_id,
                "chunks_count": existing_count,
                "error": None
            }
        
        logger.info(f"  ✓ 신규 파일입니다. 처리 시작...")
        
        # 0-1. 파일 경로 설정 (로컬 경로 또는 Storage 경로)
        relative_path = str(file_path.relative_to(backend_dir))
        storage_path = None
        storage_bucket = None
        
        if upload_to_storage:
            # Storage에 파일 업로드 (선택 사항)
            logger.info(f"  📤 Storage 업로드 중...")
            try:
                storage_bucket, storage_path = upload_legal_file(
                    file_path=file_path,
                    source_type=source_type,
                    external_id=external_id,
                )
                logger.info(f"  ✓ Storage 업로드 완료: {storage_path}")
            except Exception as storage_err:
                logger.warning(f"  ⚠️  Storage 업로드 실패 (로컬 경로 사용): {str(storage_err)}")
                # Storage 업로드 실패 시 로컬 경로 사용
                storage_path = relative_path
        else:
            # 기본값: 로컬 파일 경로 사용
            storage_path = relative_path
            logger.info(f"  📁 로컬 파일 경로 사용: {relative_path}")
        
        # 1. 텍스트 추출
        logger.info(f"  🔍 텍스트 추출 중...")
        extracted_text, _ = processor.process_file(str(file_path), file_type=None)
        
        if not extracted_text or extracted_text.strip() == "":
            return {
                "file": file_name,
                "status": "failed",
                "external_id": external_id,
                "chunks_count": 0,
                "error": "텍스트 추출 실패 (빈 파일)"
            }
        
        logger.info(f"  ✓ 텍스트 추출 완료: {len(extracted_text):,}자")
        
        # 2. 청킹 (표준계약서는 조항 단위, 나머지는 일반 청킹)
        logger.info(f"  ✂️  청킹 중...")
        # file_path는 Storage 경로를 사용 (없으면 None)
        file_path_for_chunks = storage_path if storage_path else None
        
        if source_type == "standard_contract":
            # 표준계약서는 조항 단위 청킹 시도
            try:
                chunks = processor.to_contract_chunks(
                    text=extracted_text,
                    base_meta={
                        "external_id": external_id,
                        "source_type": source_type,
                        "title": file_name,  # 한글 파일명 (UI 표시용)
                        "filename": file_name,
                        "file_path": file_path_for_chunks,  # Storage 경로
                    }
                )
                # 조항 단위 청킹 성공 시 메타데이터에 article_number 등 포함
            except:
                # 조항 단위 청킹 실패 시 일반 청킹으로 폴백
                chunks = processor.to_chunks(
                    text=extracted_text,
                    base_meta={
                        "external_id": external_id,
                        "source_type": source_type,
                        "title": file_name,
                        "filename": file_name,
                        "file_path": file_path_for_chunks,
                    }
                )
        else:
            # 법령/매뉴얼/케이스는 일반 청킹
            chunks = processor.to_chunks(
                text=extracted_text,
                base_meta={
                    "external_id": external_id,
                    "source_type": source_type,
                    "title": file_name,
                    "filename": file_name,
                    "file_path": file_path_for_chunks,
                }
            )
        
        if not chunks:
            return {
                "file": file_name,
                "status": "failed",
                "external_id": external_id,
                "chunks_count": 0,
                "error": "청크 생성 실패"
            }
        
        logger.info(f"  ✓ 청킹 완료: {len(chunks)}개 청크")
        
        # 3. 임베딩 생성 (배치 처리로 속도 개선)
        import time
        start_time = time.time()
        logger.info(f"  🧮 임베딩 생성 중... ({len(chunks)}개 청크)")
        logger.info(f"     ⏱️  예상 시간: 약 {len(chunks) * 0.3:.0f}~{len(chunks) * 1.0:.0f}초 (CPU 모드)")
        chunk_texts = [chunk.content for chunk in chunks]
        
        # 임베딩 생성 (진행 상황은 sentence-transformers가 자동으로 표시)
        embeddings = generator.embed(chunk_texts)
        
        elapsed_time = time.time() - start_time
        logger.info(f"  ✓ 임베딩 생성 완료: {len(embeddings)}개")
        logger.info(f"     ⏱️  소요 시간: {elapsed_time:.1f}초 (평균: {elapsed_time/len(chunks):.3f}초/청크)")
        
        # 4. legal_chunks 테이블에 저장
        logger.info(f"  💾 DB 저장 중...")
        # bulk_upsert_legal_chunks는 metadata 안에 정보를 넣어야 함
        chunk_payload = []
        for idx, chunk in enumerate(chunks):
            # metadata에 모든 정보 포함 (bulk_upsert_legal_chunks가 metadata에서 추출)
            chunk_metadata = {
                **chunk.metadata,
                # 이 5개는 컬럼으로 빠져감
                "external_id": external_id,
                "source_type": source_type,
                "title": file_name,  # 한글 파일명 (UI 표시용)
                "file_path": storage_path,  # Storage 경로 (예: "laws/abcd1234.pdf")
                "chunk_index": chunk.index,
                # 이 아래는 metadata JSONB에 들어감
                "storage_bucket": storage_bucket,
                "original_file_name": file_name,  # 원본 한글 파일명
                "filename": file_name,  # 하위 호환성
            }
            
            chunk_payload.append({
                "content": chunk.content,
                "embedding": embeddings[idx],
                "metadata": chunk_metadata,
            })
        
        vector_store.bulk_upsert_legal_chunks(chunk_payload)
        
        logger.info(f"  ✓ 저장 완료: external_id={external_id[:8]}...")
        
        return {
            "file": file_name,
            "status": "success",
            "external_id": external_id,
            "chunks_count": len(chunk_payload),
            "error": None
        }
        
    except Exception as e:
        logger.error(f"[처리 실패] {file_name}: {str(e)}", exc_info=True)
        return {
            "file": file_name,
            "status": "failed",
            "external_id": external_id if 'external_id' in locals() else None,
            "chunks_count": 0,
            "error": str(e)
        }


async def main():
    """메인 함수: data/legal/ 폴더의 모든 파일 처리"""
    
    # 명령줄 인자 파싱
    import argparse
    parser = argparse.ArgumentParser(description="법령 파일 인덱싱 스크립트")
    parser.add_argument(
        "--upload-to-storage",
        action="store_true",
        help="Supabase Storage에 파일 업로드 (기본값: 로컬 파일 경로 사용)"
    )
    parser.add_argument(
        "--files",
        nargs="+",
        help="특정 파일만 처리 (파일명 또는 경로, 여러 개 지정 가능). 예: --files '파일명.pdf' '다른파일.pdf'"
    )
    parser.add_argument(
        "--pattern",
        type=str,
        help="파일명 패턴으로 필터링 (glob 패턴). 예: --pattern '*표준계약서*.pdf'"
    )
    parser.add_argument(
        "--folder",
        type=str,
        choices=["standard_contracts", "laws", "manuals", "cases"],
        help="특정 폴더만 처리"
    )
    args = parser.parse_args()
    upload_to_storage = args.upload_to_storage
    
    if upload_to_storage:
        logger.info("📤 Storage 업로드 모드: 파일을 Supabase Storage에 업로드합니다")
    else:
        logger.info("📁 로컬 파일 모드: 로컬 파일 경로를 사용합니다 (기본값)")
    
    # 데이터 폴더 경로
    legal_dir = backend_dir / "data" / "legal"
    
    if not legal_dir.exists():
        logger.error(f"데이터 폴더가 없습니다: {legal_dir}")
        return
    
    # 지원 파일 형식
    supported_extensions = ['.pdf', '.hwp', '.hwpx', '.txt', '.md']
    
    # 파일 목록 수집
    all_files = []
    
    # 특정 파일 지정된 경우
    if args.files:
        logger.info(f"[INFO] 특정 파일만 처리: {len(args.files)}개")
        for file_spec in args.files:
            # 절대 경로인지 확인
            if Path(file_spec).is_absolute():
                file_path = Path(file_spec)
            else:
                # 상대 경로면 legal_dir 기준으로 찾기
                file_path = None
                # 모든 하위 폴더에서 찾기
                for subfolder in ["standard_contracts", "laws", "manuals", "cases"]:
                    subfolder_dir = legal_dir / subfolder
                    if subfolder_dir.exists():
                        candidate = subfolder_dir / file_spec
                        if candidate.is_file():
                            file_path = candidate
                            break
                
                if not file_path:
                    logger.warning(f"  [WARN] 파일을 찾을 수 없습니다: {file_spec}")
                    continue
            
            if file_path.is_file():
                all_files.append(file_path)
                logger.info(f"  [OK] {file_path.relative_to(backend_dir)}")
            else:
                logger.warning(f"  [WARN] 파일이 아닙니다: {file_path}")
    
    # 패턴 지정된 경우
    elif args.pattern:
        logger.info(f"[INFO] 패턴으로 필터링: {args.pattern}")
        folders_to_search = [args.folder] if args.folder else ["standard_contracts", "laws", "manuals", "cases"]
        
        for subfolder in folders_to_search:
            subfolder_dir = legal_dir / subfolder
            if subfolder_dir.exists():
                for ext in supported_extensions:
                    # 패턴에 확장자가 없으면 추가
                    pattern = args.pattern if args.pattern.endswith(ext) else f"{args.pattern}{ext}"
                    all_files.extend(list(subfolder_dir.glob(pattern)))
    
    # 폴더만 지정된 경우
    elif args.folder:
        logger.info(f"[INFO] 특정 폴더만 처리: {args.folder}")
        subfolder_dir = legal_dir / args.folder
        if subfolder_dir.exists():
            for ext in supported_extensions:
                all_files.extend(list(subfolder_dir.glob(f"*{ext}")))
                all_files.extend(list(subfolder_dir.glob(f"**/*{ext}")))
    
    # 모든 파일 처리 (기본값)
    else:
        # 모든 하위 폴더에서 파일 수집
        for subfolder in ["standard_contracts", "laws", "manuals", "cases"]:
            subfolder_dir = legal_dir / subfolder
            if subfolder_dir.exists():
                for ext in supported_extensions:
                    all_files.extend(list(subfolder_dir.glob(f"*{ext}")))
                    all_files.extend(list(subfolder_dir.glob(f"**/*{ext}")))
    
    # 중복 제거
    all_files = list(set(all_files))
    
    if not all_files:
        logger.warning(f"처리할 파일이 없습니다: {legal_dir}")
        return
    
    logger.info("=" * 60)
    logger.info(f"[시작] data/legal/ 폴더 전체 처리")
    logger.info(f"  - 총 파일: {len(all_files)}개 (모두 legal_chunks에 저장)")
    logger.info("=" * 60)
    
    # 서비스 초기화 (한 번만 초기화하여 속도 개선)
    logger.info("[초기화 중] DocumentProcessor, LLMGenerator, SupabaseVectorStore...")
    processor = DocumentProcessor()
    generator = LLMGenerator()  # 임베딩 모델 로딩 (처음에만 느림)
    vector_store = SupabaseVectorStore()
    logger.info("[초기화 완료]")
    
    # 결과 저장
    results = []
    
    # 모든 파일 처리
    logger.info(f"\n[처리 시작] 총 {len(all_files)}개 파일")
    logger.info("=" * 60)
    
    for idx, file_path in enumerate(all_files, 1):
        progress_percent = (idx / len(all_files)) * 100
        logger.info("")
        logger.info(f"[{idx}/{len(all_files)}] ({progress_percent:.1f}%) {file_path.name}")
        logger.info(f"  └─ 경로: {file_path.relative_to(backend_dir)}")
        
        result = await process_legal_file(
            file_path=file_path,
            processor=processor,
            generator=generator,
            vector_store=vector_store,
            upload_to_storage=upload_to_storage,
        )
        
        results.append({
            **result,
            "type": get_source_type_from_path(file_path),
            "target_table": "legal_chunks"
        })
        
        if result["status"] == "success":
            logger.info(f"  ✅ 성공: {result['chunks_count']}개 청크 저장 완료")
        elif result["status"] == "skipped":
            logger.info(f"  ⏭️  스킵: 이미 존재함 ({result['chunks_count']}개 청크)")
        else:
            logger.error(f"  ❌ 실패: {result.get('error', '알 수 없는 오류')}")
        
        # 진행 상황 요약 (10개마다 또는 마지막 파일)
        if idx % 10 == 0 or idx == len(all_files):
            success_so_far = sum(1 for r in results if r["status"] == "success")
            skipped_so_far = sum(1 for r in results if r["status"] == "skipped")
            failed_so_far = sum(1 for r in results if r["status"] == "failed")
            logger.info(f"  📊 현재까지: 성공 {success_so_far}개, 스킵 {skipped_so_far}개, 실패 {failed_so_far}개")
    
    logger.info("")
    logger.info("=" * 60)
    
    # 결과 요약 (source_type별)
    success_count = sum(1 for r in results if r["status"] == "success")
    skipped_count = sum(1 for r in results if r["status"] == "skipped")
    failed_count = sum(1 for r in results if r["status"] == "failed")
    total_chunks = sum(r["chunks_count"] for r in results if r["status"] == "success")
    
    # source_type별 통계
    type_stats = {}
    for r in results:
        source_type = r.get("type", "unknown")
        if source_type not in type_stats:
            type_stats[source_type] = {"total": 0, "success": 0, "skipped": 0, "failed": 0, "chunks": 0}
        type_stats[source_type]["total"] += 1
        if r["status"] == "success":
            type_stats[source_type]["success"] += 1
            type_stats[source_type]["chunks"] += r["chunks_count"]
        elif r["status"] == "skipped":
            type_stats[source_type]["skipped"] += 1
        else:
            type_stats[source_type]["failed"] += 1
    
    logger.info("=" * 60)
    logger.info(f"[완료] 처리 결과:")
    logger.info(f"  - 총 파일: {len(results)}개")
    for source_type, stats in type_stats.items():
        logger.info(f"    * {source_type}: {stats['total']}개 (성공: {stats['success']}개, 스킵: {stats['skipped']}개, 실패: {stats['failed']}개, 청크: {stats['chunks']}개)")
    logger.info(f"  - 성공: {success_count}개")
    logger.info(f"  - 스킵: {skipped_count}개 (이미 존재)")
    logger.info(f"  - 실패: {failed_count}개")
    logger.info(f"  - 신규 저장 청크: {total_chunks}개")
    logger.info("=" * 60)
    
    # 실패한 파일 목록
    if failed_count > 0:
        logger.warning("실패한 파일 목록:")
        for r in results:
            if r["status"] == "failed":
                logger.warning(f"  - {r['file']} ({r.get('target_table', 'unknown')}): {r.get('error', '알 수 없는 오류')}")
    
    # 결과를 JSON 파일로 저장
    import json
    from datetime import datetime
    
    report_dir = backend_dir / "data" / "indexed" / "reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    
    report_file = report_dir / f"legal_data_indexing_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    
    report = {
        "total": len(results),
        "by_source_type": type_stats,
        "summary": {
            "success": success_count,
            "skipped": skipped_count,
            "failed": failed_count,
            "total_chunks": total_chunks
        },
        "results": results,
        "processed_at": datetime.now().isoformat()
    }
    
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    logger.info(f"[리포트 저장] {report_file}")


if __name__ == "__main__":
    asyncio.run(main())

