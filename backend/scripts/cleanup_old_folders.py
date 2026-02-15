"""
기존 폴더 정리 스크립트
bids/와 companies/ 외 불필요한 폴더 삭제
"""

import shutil
from pathlib import Path

def cleanup_old_folders():
    """기존 폴더 정리"""
    
    base_dir = Path(__file__).parent.parent / "data"
    
    print("=" * 60)
    print("기존 폴더 정리")
    print("=" * 60)
    
    # 삭제할 폴더 목록
    folders_to_delete = [
        "announcements",
        "raw",
        "batch_reports",
        "processed"
    ]
    
    deleted_count = 0
    for folder_name in folders_to_delete:
        folder_path = base_dir / folder_name
        if folder_path.exists():
            try:
                shutil.rmtree(folder_path)
                print(f"  ✓ 삭제: {folder_name}/")
                deleted_count += 1
            except Exception as e:
                print(f"  ✗ 삭제 실패: {folder_name}/ - {str(e)}")
        else:
            print(f"  - 없음: {folder_name}/")
    
    print(f"\n[완료] {deleted_count}개 폴더 삭제")
    print("\n[유지된 폴더]")
    print("  ✓ bids/ (견적서 RAG용)")
    print("  ✓ companies/ (기업 추천용)")
    print("  ✓ indexed/ (리포트 저장용)")
    print("  ✓ temp/ (임시 파일용)")
    print("=" * 60)

if __name__ == "__main__":
    cleanup_old_folders()

