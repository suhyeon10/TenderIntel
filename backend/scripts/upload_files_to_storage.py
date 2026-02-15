"""
기존 announcements 데이터의 파일을 Supabase Storage에 업로드하고 DB 경로 업데이트

사용법:
    # 방법 1: 특정 폴더의 파일들을 announcements와 매칭하여 업로드
    python scripts/upload_files_to_storage.py --folder backend/data/bids --bucket announcements

    # 방법 2: 특정 announcement ID에 파일 업로드
    python scripts/upload_files_to_storage.py --announcement-id <uuid> --file path/to/file.pdf --bucket announcements

    # 방법 3: 모든 announcements에 대해 파일 매칭 시도
    python scripts/upload_files_to_storage.py --auto-match --folder backend/data/bids --bucket announcements
"""

import os
import sys
import argparse
from pathlib import Path
from typing import Optional, Dict, Any
import mimetypes

# 상위 디렉토리를 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from supabase import create_client
from config import settings


class StorageUploader:
    """Supabase Storage에 파일 업로드 및 DB 업데이트"""
    
    def __init__(self, bucket_name: str = "announcements"):
        self.bucket_name = bucket_name
        self.supabase_url = os.getenv("SUPABASE_URL") or settings.supabase_url
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or settings.supabase_service_role_key
        
        if not self.supabase_url or not self.supabase_key:
            raise ValueError("SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY 환경 변수가 필요합니다")
        
        self.sb = create_client(self.supabase_url, self.supabase_key)
        
        # 버킷이 없으면 생성 시도
        self._ensure_bucket_exists()
    
    def _ensure_bucket_exists(self):
        """Storage 버킷이 존재하는지 확인하고 없으면 생성"""
        try:
            # 버킷 목록 조회
            buckets_response = self.sb.storage.list_buckets()
            bucket_names = [b.name for b in buckets_response] if buckets_response else []
            
            if self.bucket_name not in bucket_names:
                print(f"[버킷 생성] '{self.bucket_name}' 버킷이 없습니다.")
                print(f"[팁] Supabase 대시보드에서 '{self.bucket_name}' 버킷을 수동으로 생성해주세요.")
                print(f"     - Storage > Buckets > New bucket")
                print(f"     - Name: {self.bucket_name}")
                print(f"     - Public: Yes (공개 읽기)")
            else:
                print(f"[버킷 확인] '{self.bucket_name}' 버킷이 존재합니다.")
        except Exception as e:
            print(f"[경고] 버킷 확인 중 오류: {str(e)}")
            print(f"[팁] Supabase 대시보드에서 '{self.bucket_name}' 버킷을 수동으로 생성해주세요.")
    
    def upload_file_for_announcement(
        self,
        announcement_id: str,
        file_path: Path,
        file_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        특정 announcement에 파일 업로드
        
        Args:
            announcement_id: announcement UUID
            file_path: 업로드할 파일 경로
            file_name: Storage에 저장할 파일명 (None이면 원본 파일명 사용)
        
        Returns:
            업로드 결과
        """
        if not file_path.exists():
            raise FileNotFoundError(f"파일을 찾을 수 없습니다: {file_path}")
        
        # 파일명 결정
        if file_name is None:
            file_name = file_path.name
        
        # Storage 경로: announcements/{announcement_id}/{file_name}
        storage_path = f"{announcement_id}/{file_name}"
        
        # MIME 타입 감지
        mime_type, _ = mimetypes.guess_type(str(file_path))
        if mime_type is None:
            # 기본값 설정
            ext = file_path.suffix.lower()
            mime_map = {
                '.pdf': 'application/pdf',
                '.txt': 'text/plain',
                '.hwp': 'application/x-hwp',
                '.hwpx': 'application/x-hwp',
                '.hwps': 'application/x-hwp',
                '.html': 'text/html',
                '.htm': 'text/html'
            }
            mime_type = mime_map.get(ext, 'application/octet-stream')
        
        print(f"[업로드 중] {file_path.name} → {self.bucket_name}/{storage_path}")
        
        # Storage에 업로드 (파일 객체 직접 전달)
        with open(file_path, 'rb') as f:
            upload_result = self.sb.storage.from_(self.bucket_name).upload(
                path=storage_path,
                file=f,
                file_options={
                    "content-type": mime_type,
                    "upsert": "true"  # 기존 파일이 있으면 덮어쓰기
                }
            )
        
        if upload_result:
            print(f"[업로드 성공] {storage_path}")
        else:
            raise Exception(f"파일 업로드 실패: {storage_path}")
        
        # DB 업데이트
        update_result = self.sb.table("announcements").update({
            "storage_file_path": storage_path,
            "storage_bucket": self.bucket_name,
            "file_name": file_path.name,
            "file_mime_type": mime_type
        }).eq("id", announcement_id).execute()
        
        if update_result.data:
            print(f"[DB 업데이트 성공] announcement_id: {announcement_id}")
            return {
                "success": True,
                "announcement_id": announcement_id,
                "storage_path": storage_path,
                "file_name": file_path.name,
                "mime_type": mime_type
            }
        else:
            raise Exception(f"DB 업데이트 실패: announcement_id={announcement_id}")
    
    def auto_match_and_upload(
        self,
        folder_path: Path,
        match_by: str = "external_id"  # "external_id" 또는 "title"
    ):
        """
        폴더의 파일들을 announcements와 자동 매칭하여 업로드
        
        Args:
            folder_path: 파일이 있는 폴더 경로
            match_by: 매칭 기준 ("external_id" 또는 "title")
        """
        # announcements 조회
        announcements_result = self.sb.table("announcements")\
            .select("id, title, external_id, storage_file_path")\
            .eq("status", "active")\
            .execute()
        
        if not announcements_result.data:
            print("[경고] 활성화된 announcement가 없습니다.")
            return
        
        announcements = announcements_result.data
        print(f"[발견] {len(announcements)}개의 활성 announcement")
        
        # 이미 Storage에 파일이 있는 announcement 제외
        announcements_without_file = [
            a for a in announcements 
            if not a.get("storage_file_path")
        ]
        print(f"[대상] {len(announcements_without_file)}개의 announcement에 파일이 없습니다.")
        
        # 폴더의 파일 목록
        supported_extensions = ['.pdf', '.txt', '.hwp', '.hwpx', '.hwps', '.html', '.htm']
        files = [
            f for f in folder_path.iterdir() 
            if f.is_file() and f.suffix.lower() in supported_extensions
        ]
        print(f"[파일] {len(files)}개의 파일 발견")
        
        # 매칭 및 업로드
        matched_count = 0
        for announcement in announcements_without_file:
            # 매칭 키 생성
            if match_by == "external_id":
                match_key = announcement.get("external_id", "").lower()
            else:
                match_key = announcement.get("title", "").lower()
            
            if not match_key:
                continue
            
            # 파일명과 매칭 시도
            for file_path in files:
                file_stem = file_path.stem.lower()
                file_name_lower = file_path.name.lower()
                
                # 파일명이나 파일명(확장자 제거)이 매칭 키와 일치하는지 확인
                if (match_key in file_stem or 
                    match_key in file_name_lower or
                    file_stem in match_key):
                    try:
                        self.upload_file_for_announcement(
                            announcement["id"],
                            file_path
                        )
                        matched_count += 1
                        files.remove(file_path)  # 매칭된 파일 제거
                        break
                    except Exception as e:
                        print(f"[오류] {file_path.name} 업로드 실패: {str(e)}")
        
        print(f"\n[완료] {matched_count}개의 파일이 업로드되었습니다.")


def main():
    parser = argparse.ArgumentParser(
        description="기존 announcements 데이터의 파일을 Supabase Storage에 업로드"
    )
    parser.add_argument(
        "--bucket",
        type=str,
        default="announcements",
        help="Storage 버킷 이름 (기본값: announcements)"
    )
    parser.add_argument(
        "--announcement-id",
        type=str,
        help="특정 announcement ID에 파일 업로드"
    )
    parser.add_argument(
        "--file",
        type=str,
        help="업로드할 파일 경로 (--announcement-id와 함께 사용)"
    )
    parser.add_argument(
        "--folder",
        type=str,
        help="파일이 있는 폴더 경로 (자동 매칭 모드)"
    )
    parser.add_argument(
        "--auto-match",
        action="store_true",
        help="자동 매칭 모드 활성화 (--folder와 함께 사용)"
    )
    parser.add_argument(
        "--match-by",
        type=str,
        choices=["external_id", "title"],
        default="external_id",
        help="자동 매칭 기준 (기본값: external_id)"
    )
    
    args = parser.parse_args()
    
    try:
        uploader = StorageUploader(bucket_name=args.bucket)
        
        if args.announcement_id and args.file:
            # 특정 announcement에 파일 업로드
            file_path = Path(args.file)
            if not file_path.exists():
                print(f"[오류] 파일을 찾을 수 없습니다: {file_path}")
                return
            
            result = uploader.upload_file_for_announcement(
                args.announcement_id,
                file_path
            )
            print(f"\n[성공] 파일 업로드 완료:")
            print(f"  - Announcement ID: {result['announcement_id']}")
            print(f"  - Storage Path: {result['storage_path']}")
            print(f"  - File Name: {result['file_name']}")
        
        elif args.auto_match and args.folder:
            # 자동 매칭 모드
            folder_path = Path(args.folder)
            if not folder_path.exists():
                print(f"[오류] 폴더를 찾을 수 없습니다: {folder_path}")
                return
            
            uploader.auto_match_and_upload(folder_path, match_by=args.match_by)
        
        else:
            parser.print_help()
            print("\n[사용 예시]")
            print("  # 특정 announcement에 파일 업로드:")
            print("  python scripts/upload_files_to_storage.py --announcement-id <uuid> --file path/to/file.pdf")
            print("\n  # 폴더의 파일들을 자동 매칭하여 업로드:")
            print("  python scripts/upload_files_to_storage.py --auto-match --folder backend/data/bids")
    
    except Exception as e:
        print(f"[오류] {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

