"""
데이터 폴더 구조 마이그레이션 스크립트
기존 announcements/ 폴더를 새로운 raw/ 구조로 이동
"""

import os
import shutil
from pathlib import Path
from datetime import datetime

def migrate_data_structure():
    """기존 데이터를 새로운 구조로 마이그레이션"""
    
    base_dir = Path(__file__).parent.parent / "data"
    
    print("=" * 60)
    print("데이터 폴더 구조 마이그레이션")
    print("=" * 60)
    
    # 1. 새 폴더 구조 생성
    raw_dir = base_dir / "raw"
    processed_dir = base_dir / "processed"
    indexed_dir = base_dir / "indexed"
    temp_dir = base_dir / "temp"
    
    # indexed 하위 폴더
    reports_dir = indexed_dir / "reports"
    exports_dir = indexed_dir / "exports"
    
    print("\n[1단계] 새 폴더 구조 생성...")
    for dir_path in [raw_dir, processed_dir, indexed_dir, temp_dir, reports_dir, exports_dir]:
        dir_path.mkdir(parents=True, exist_ok=True)
        print(f"  ✓ {dir_path.relative_to(base_dir.parent)}")
    
    # 2. 기존 announcements 폴더 확인
    announcements_dir = base_dir / "announcements"
    
    if not announcements_dir.exists():
        print("\n[2단계] announcements 폴더가 없습니다. 마이그레이션 불필요.")
        return
    
    print(f"\n[2단계] 기존 announcements 폴더 확인...")
    files = list(announcements_dir.rglob("*"))
    file_count = sum(1 for f in files if f.is_file() and f.name != "README.md")
    print(f"  발견: {file_count}개 파일")
    
    # 3. announcements를 raw/기타/입찰로 이동
    print(f"\n[3단계] 파일 이동 중...")
    
    # raw/기타/입찰 구조 생성
    raw_other_dir = raw_dir / "기타" / "입찰"
    raw_other_dir.mkdir(parents=True, exist_ok=True)
    
    moved_count = 0
    for file_path in announcements_dir.rglob("*"):
        if file_path.is_file() and file_path.name != "README.md":
            # 파일 이동
            dest_path = raw_other_dir / file_path.name
            
            # 중복 파일 처리
            if dest_path.exists():
                # 타임스탬프 추가
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                stem = dest_path.stem
                suffix = dest_path.suffix
                dest_path = raw_other_dir / f"{stem}_{timestamp}{suffix}"
            
            shutil.copy2(file_path, dest_path)
            print(f"  ✓ {file_path.name} → raw/기타/입찰/")
            moved_count += 1
    
    # 4. batch_reports를 indexed/reports로 이동
    batch_reports_dir = base_dir / "batch_reports"
    if batch_reports_dir.exists():
        print(f"\n[4단계] batch_reports 이동 중...")
        for report_file in batch_reports_dir.glob("*.json"):
            dest_path = reports_dir / report_file.name
            if not dest_path.exists():
                shutil.copy2(report_file, dest_path)
                print(f"  ✓ {report_file.name} → indexed/reports/")
    
    # 5. README.md 복사
    announcements_readme = announcements_dir / "README.md"
    if announcements_readme.exists():
        shutil.copy2(announcements_readme, raw_other_dir / "README.md")
        print(f"\n[5단계] README.md 복사 완료")
    
    print("\n" + "=" * 60)
    print(f"마이그레이션 완료!")
    print(f"  이동된 파일: {moved_count}개")
    print(f"  새 구조: {raw_dir.relative_to(base_dir.parent)}")
    print("\n[다음 단계]")
    print(f"  1. 기존 announcements 폴더 확인 후 삭제 가능")
    print(f"  2. python scripts/batch_ingest.py data/raw 실행")
    print("=" * 60)


if __name__ == "__main__":
    migrate_data_structure()

