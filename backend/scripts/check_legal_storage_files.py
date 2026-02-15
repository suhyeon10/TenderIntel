"""
Supabase Storage에 업로드된 법령 파일 확인 스크립트
"""

import os
import sys
from pathlib import Path
from supabase import create_client

# 프로젝트 루트를 Python 경로에 추가
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

# config는 backend 디렉토리에서 import
import importlib.util
config_path = backend_dir / "config.py"
spec = importlib.util.spec_from_file_location("config", config_path)
config = importlib.util.module_from_spec(spec)
spec.loader.exec_module(config)
settings = config.settings

STORAGE_BUCKET = "legal-files"


def check_storage_files():
    """Storage에 업로드된 파일 목록 확인"""
    
    # Supabase 클라이언트 생성
    supabase_url = os.getenv("SUPABASE_URL") or settings.supabase_url
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or settings.supabase_service_role_key
    
    if not supabase_url or not supabase_key:
        print("❌ SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY 환경 변수가 필요합니다")
        return
    
    try:
        supabase = create_client(supabase_url, supabase_key)
        
        # 버킷 존재 확인
        print(f"🔍 '{STORAGE_BUCKET}' 버킷 확인 중...")
        try:
            buckets = supabase.storage.list_buckets()
            bucket_names = [b.name for b in buckets] if buckets else []
            
            if STORAGE_BUCKET not in bucket_names:
                print(f"❌ '{STORAGE_BUCKET}' 버킷이 없습니다!")
                print(f"\n📝 버킷 생성 방법:")
                print(f"   1. Supabase 대시보드 접속")
                print(f"   2. Storage > Buckets > New bucket")
                print(f"   3. Name: {STORAGE_BUCKET}")
                print(f"   4. Public: Yes (또는 Private + RLS 정책 설정)")
                return
            else:
                print(f"✅ '{STORAGE_BUCKET}' 버킷이 존재합니다")
        except Exception as e:
            print(f"⚠️  버킷 확인 중 오류: {str(e)}")
            print(f"   Supabase 대시보드에서 '{STORAGE_BUCKET}' 버킷을 수동으로 확인해주세요")
            return
        
        # 폴더별 파일 목록 조회
        folders = ["laws", "manuals", "cases", "standard_contracts"]
        total_files = 0
        
        print(f"\n📁 폴더별 파일 목록:")
        print("=" * 60)
        
        for folder in folders:
            try:
                # Storage에서 폴더 내 파일 목록 가져오기
                files = supabase.storage.from_(STORAGE_BUCKET).list(folder)
                
                if files:
                    print(f"\n📂 {folder}/ ({len(files)}개 파일)")
                    for file in files[:10]:  # 최대 10개만 표시
                        size_kb = file.get("metadata", {}).get("size", 0) / 1024
                        print(f"   - {file['name']} ({size_kb:.1f} KB)")
                    if len(files) > 10:
                        print(f"   ... 외 {len(files) - 10}개 파일")
                    total_files += len(files)
                else:
                    print(f"\n📂 {folder}/ (파일 없음)")
            except Exception as e:
                print(f"\n📂 {folder}/ (조회 실패: {str(e)})")
        
        print("=" * 60)
        print(f"\n📊 총 파일 개수: {total_files}개")
        
        if total_files == 0:
            print("\n💡 파일이 없습니다. 인덱싱 스크립트를 실행하세요:")
            print("   python scripts/index_contracts_from_data.py")
        
    except Exception as e:
        print(f"❌ 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    check_storage_files()

