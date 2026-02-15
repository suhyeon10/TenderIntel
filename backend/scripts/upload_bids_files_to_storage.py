"""
backend/data/bids 폴더의 파일들을 처리하여 announcements를 생성하고 Storage에 업로드

사용법:
    python scripts/upload_bids_files_to_storage.py --bucket announcements
"""

import os
import sys
from pathlib import Path
from typing import List, Dict, Any
import mimetypes

# 상위 디렉토리를 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from supabase import create_client
from config import settings
from core.orchestrator_v2 import Orchestrator


class BidsFileUploader:
    """bids 폴더의 파일들을 처리하고 Storage에 업로드"""
    
    def __init__(self, bucket_name: str = "announcements"):
        self.bucket_name = bucket_name
        self.supabase_url = os.getenv("SUPABASE_URL") or settings.supabase_url
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or settings.supabase_service_role_key
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY 환경 변수가 필요합니다")
        
        self.sb = create_client(self.supabase_url, self.supabase_key)
        self.orchestrator = Orchestrator()
        
        # 버킷 확인
        self._ensure_bucket_exists()
    
    def _ensure_bucket_exists(self):
        """Storage 버킷이 존재하는지 확인"""
        try:
            buckets_response = self.sb.storage.list_buckets()
            bucket_names = [b.name for b in buckets_response] if buckets_response else []
            
            if self.bucket_name not in bucket_names:
                print(f"[경고] '{self.bucket_name}' 버킷이 없습니다.")
                print(f"[팁] Supabase 대시보드에서 '{self.bucket_name}' 버킷을 생성해주세요.")
                print(f"     - Storage > Buckets > New bucket")
                print(f"     - Name: {self.bucket_name}")
                print(f"     - Public: Yes (공개 읽기)")
            else:
                print(f"[버킷 확인] '{self.bucket_name}' 버킷이 존재합니다.")
        except Exception as e:
            print(f"[경고] 버킷 확인 중 오류: {str(e)}")
            print(f"[팁] Supabase 대시보드에서 '{self.bucket_name}' 버킷을 수동으로 생성해주세요.")
    
    def get_mime_type(self, file_path: Path) -> str:
        """파일의 MIME 타입 감지"""
        mime_type, _ = mimetypes.guess_type(str(file_path))
        if mime_type is None:
            ext = file_path.suffix.lower()
            mime_map = {
                '.pdf': 'application/pdf',
                '.txt': 'text/plain',
                '.hwp': 'application/x-hwp',
                '.hwpx': 'application/x-hwp',
                '.hwps': 'application/x-hwp',
                '.html': 'text/html',
                '.htm': 'text/html',
                '.csv': 'text/csv'
            }
            mime_type = mime_map.get(ext, 'application/octet-stream')
        return mime_type
    
    def sanitize_filename(self, filename: str) -> str:
        """파일명을 Storage에 안전한 형식으로 변환 (해시 기반)"""
        import hashlib
        import base64
        
        # 파일명을 해시로 변환하여 안전한 파일명 생성
        # 원본 파일명의 해시 + 확장자
        file_stem = Path(filename).stem
        file_ext = Path(filename).suffix
        
        # 해시 생성 (짧게)
        hash_obj = hashlib.md5(file_stem.encode('utf-8'))
        hash_hex = hash_obj.hexdigest()[:12]  # 12자리만 사용
        
        # 안전한 파일명: 해시_원본파일명(최대20자).확장자
        # 하지만 한글이 문제가 되므로 해시만 사용
        safe_name = f"{hash_hex}{file_ext}"
        
        return safe_name
    
    def upload_to_storage(self, announcement_id: str, file_path: Path) -> str:
        """Storage에 파일 업로드"""
        # 파일명을 안전하게 변환
        safe_filename = self.sanitize_filename(file_path.name)
        # Storage 경로: {announcement_id}/{safe_file_name}
        storage_path = f"{announcement_id}/{safe_filename}"
        mime_type = self.get_mime_type(file_path)
        
        print(f"[Storage 업로드] {file_path.name} → {self.bucket_name}/{storage_path}")
        
        # Storage에 업로드
        with open(file_path, 'rb') as f:
            upload_result = self.sb.storage.from_(self.bucket_name).upload(
                path=storage_path,
                file=f,
                file_options={
                    "content-type": mime_type,
                    "upsert": "true"
                }
            )
        
        if not upload_result:
            raise Exception(f"파일 업로드 실패: {storage_path}")
        
        print(f"[Storage 업로드 성공] {storage_path}")
        return storage_path
    
    def update_announcement_storage_info(
        self,
        announcement_id: str,
        storage_path: str,
        file_path: Path
    ):
        """announcement의 Storage 정보 업데이트"""
        mime_type = self.get_mime_type(file_path)
        
        update_result = self.sb.table("announcements").update({
            "storage_file_path": storage_path,
            "storage_bucket": self.bucket_name,
            "file_name": file_path.name,
            "file_mime_type": mime_type
        }).eq("id", announcement_id).execute()
        
        if update_result.data:
            print(f"[DB 업데이트 성공] announcement_id: {announcement_id}")
        else:
            raise Exception(f"DB 업데이트 실패: announcement_id={announcement_id}")
    
    def process_file(self, file_path: Path) -> Dict[str, Any]:
        """파일 처리: 텍스트 추출 → announcement 생성 → Storage 업로드"""
        print(f"\n[처리 시작] {file_path.name}")
        
        try:
            # 파일명에서 메타데이터 추출
            file_stem = file_path.stem
            file_name = file_path.name
            
            # 메타데이터 구성
            meta = {
                "source": "batch_upload",
                "external_id": file_stem,
                "title": file_stem,
                "file_name": file_name
            }
            
            # 파일 처리 및 announcement 생성
            announcement_id = self.orchestrator.process_file(
                file_path=str(file_path),
                file_type=None,  # 자동 감지
                meta=meta
            )
            
            print(f"[Announcement 생성] ID: {announcement_id}")
            
            # Storage에 파일 업로드
            storage_path = self.upload_to_storage(announcement_id, file_path)
            
            # DB에 Storage 정보 업데이트
            self.update_announcement_storage_info(
                announcement_id,
                storage_path,
                file_path
            )
            
            return {
                "success": True,
                "announcement_id": announcement_id,
                "file_name": file_name,
                "storage_path": storage_path
            }
            
        except Exception as e:
            print(f"[오류] {file_path.name} 처리 실패: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "file_name": file_path.name,
                "error": str(e)
            }
    
    def process_bids_folder(self, bids_folder: Path):
        """bids 폴더의 모든 파일 처리"""
        if not bids_folder.exists():
            raise FileNotFoundError(f"폴더를 찾을 수 없습니다: {bids_folder}")
        
        # 지원하는 파일 확장자
        supported_extensions = ['.pdf', '.txt', '.hwp', '.hwpx', '.hwps', '.html', '.htm']
        # CSV는 제외 (별도 처리 필요)
        
        files = [
            f for f in bids_folder.iterdir()
            if f.is_file() and f.suffix.lower() in supported_extensions
        ]
        
        print(f"[발견] {len(files)}개의 파일 발견")
        
        results = []
        for i, file_path in enumerate(files, 1):
            print(f"\n[{i}/{len(files)}] 처리 중...")
            result = self.process_file(file_path)
            results.append(result)
        
        # 결과 요약
        success_count = sum(1 for r in results if r.get("success"))
        fail_count = len(results) - success_count
        
        print(f"\n{'='*60}")
        print(f"[완료] 총 {len(results)}개 파일 처리")
        print(f"  - 성공: {success_count}개")
        print(f"  - 실패: {fail_count}개")
        print(f"{'='*60}")
        
        if fail_count > 0:
            print("\n[실패한 파일]")
            for result in results:
                if not result.get("success"):
                    print(f"  - {result.get('file_name')}: {result.get('error')}")
        
        return results


def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description="backend/data/bids 폴더의 파일들을 처리하고 Storage에 업로드"
    )
    parser.add_argument(
        "--bucket",
        type=str,
        default="announcements",
        help="Storage 버킷 이름 (기본값: announcements)"
    )
    parser.add_argument(
        "--folder",
        type=str,
        default="backend/data/bids",
        help="처리할 폴더 경로 (기본값: backend/data/bids)"
    )
    
    args = parser.parse_args()
    
    try:
        uploader = BidsFileUploader(bucket_name=args.bucket)
        bids_folder = Path(args.folder)
        
        if not bids_folder.is_absolute():
            # 상대 경로인 경우 backend 폴더 기준으로
            # args.folder가 이미 "backend/data/bids"를 포함하면 제거
            folder_path = args.folder.replace("backend/", "").replace("backend\\", "")
            bids_folder = Path(__file__).parent.parent / folder_path
        
        uploader.process_bids_folder(bids_folder)
        
    except Exception as e:
        print(f"[오류] {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

