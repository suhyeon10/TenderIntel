"""
단순 폴더 구조 생성 스크립트
bids/와 companies/ 폴더 생성 및 파일 이동
"""

import os
import shutil
from pathlib import Path

def create_simple_structure():
    """단순 폴더 구조 생성"""
    
    base_dir = Path(__file__).parent.parent / "data"
    
    print("=" * 60)
    print("단순 폴더 구조 생성")
    print("=" * 60)
    
    # 1. 새 폴더 생성
    companies_dir = base_dir / "companies"
    bids_dir = base_dir / "bids"
    
    companies_dir.mkdir(parents=True, exist_ok=True)
    bids_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n[1단계] 폴더 생성 완료")
    print(f"  ✓ {companies_dir.relative_to(base_dir.parent)}")
    print(f"  ✓ {bids_dir.relative_to(base_dir.parent)}")
    
    # 2. 기존 파일들을 bids/로 복사
    sources = [
        base_dir / "raw" / "기타" / "입찰",
        base_dir / "announcements"
    ]
    
    moved_count = 0
    for source_dir in sources:
        if source_dir.exists():
            print(f"\n[2단계] {source_dir.name} 폴더에서 파일 복사...")
            for file_path in source_dir.glob("*"):
                if file_path.is_file() and file_path.name != "README.md":
                    dest_path = bids_dir / file_path.name
                    if not dest_path.exists():
                        shutil.copy2(file_path, dest_path)
                        print(f"  ✓ {file_path.name}")
                        moved_count += 1
    
    print(f"\n[완료] 총 {moved_count}개 파일을 bids/로 복사했습니다")
    print(f"\n[다음 단계]")
    print(f"  python scripts/batch_ingest.py data/bids")
    print("=" * 60)

if __name__ == "__main__":
    create_simple_structure()

