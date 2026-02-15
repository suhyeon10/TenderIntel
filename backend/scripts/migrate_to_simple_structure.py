"""
데이터 폴더 구조 단순화 스크립트
목적별로 간단하게 정리: companies/ (기업 추천), bids/ (견적서 RAG)
"""

import os
import shutil
from pathlib import Path
from datetime import datetime

def migrate_to_simple_structure():
    """기존 데이터를 단순한 구조로 마이그레이션"""
    
    base_dir = Path(__file__).parent.parent / "data"
    
    print("=" * 60)
    print("데이터 폴더 구조 단순화")
    print("=" * 60)
    
    # 1. 새 폴더 구조 생성
    companies_dir = base_dir / "companies"
    bids_dir = base_dir / "bids"
    
    print("\n[1단계] 새 폴더 구조 생성...")
    companies_dir.mkdir(parents=True, exist_ok=True)
    bids_dir.mkdir(parents=True, exist_ok=True)
    print(f"  ✓ companies/ (기업 추천용)")
    print(f"  ✓ bids/ (견적서 RAG용)")
    
    # 2. 기존 raw/기타/입찰 폴더 확인
    raw_dir = base_dir / "raw" / "기타" / "입찰"
    
    if raw_dir.exists():
        print(f"\n[2단계] 기존 파일 확인...")
        files = list(raw_dir.glob("*"))
        file_count = sum(1 for f in files if f.is_file() and f.name != "README.md")
        print(f"  발견: {file_count}개 파일")
        
        # 3. 입찰 관련 파일들을 bids/로 이동
        print(f"\n[3단계] 입찰 파일을 bids/로 이동 중...")
        
        moved_count = 0
        for file_path in raw_dir.glob("*"):
            if file_path.is_file() and file_path.name != "README.md":
                # 파일 이동
                dest_path = bids_dir / file_path.name
                
                # 중복 파일 처리
                if dest_path.exists():
                    # 타임스탬프 추가
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    stem = dest_path.stem
                    suffix = dest_path.suffix
                    dest_path = bids_dir / f"{stem}_{timestamp}{suffix}"
                
                shutil.copy2(file_path, dest_path)
                print(f"  ✓ {file_path.name} → bids/")
                moved_count += 1
        
        print(f"\n  총 {moved_count}개 파일 이동 완료")
    
    # 4. 기존 announcements 폴더도 확인
    announcements_dir = base_dir / "announcements"
    if announcements_dir.exists():
        print(f"\n[4단계] announcements 폴더 확인...")
        files = list(announcements_dir.glob("*"))
        file_count = sum(1 for f in files if f.is_file() and f.name != "README.md")
        if file_count > 0:
            print(f"  발견: {file_count}개 파일 (bids/로 이동)")
            for file_path in announcements_dir.glob("*"):
                if file_path.is_file() and file_path.name != "README.md":
                    dest_path = bids_dir / file_path.name
                    if not dest_path.exists():
                        shutil.copy2(file_path, dest_path)
                        print(f"  ✓ {file_path.name} → bids/")
    
    # 5. indexed/reports를 bids/로 이동 (선택사항)
    reports_dir = base_dir / "indexed" / "reports"
    if reports_dir.exists():
        print(f"\n[5단계] 리포트 파일 확인...")
        report_files = list(reports_dir.glob("*.json"))
        if report_files:
            print(f"  발견: {len(report_files)}개 리포트")
            print(f"  [참고] 리포트는 indexed/reports/에 유지됩니다")
    
    # 6. README 생성
    readme_content = """# 데이터 폴더 구조

## 📁 목적별 폴더 구조

```
backend/data/
├── companies/        # 기업 추천용 데이터
│   ├── 프리랜서_기업등록데이터.csv
│   ├── R&D_과제데이터.csv
│   └── ...
│
└── bids/             # 견적서 RAG용 데이터
    ├── UI-ADODAA-008R.입찰공고 내역.csv
    ├── UI-ADODAA-010R.통합 입찰공고 내역.csv
    ├── 공고문_정보통신시스템.hwpx
    ├── 과업지시서_정보통신시스템.hwpx
    ├── 제안요청서_정보통신시스템.hwpx
    └── 물품공급기술지원협약서.pdf
```

## 🎯 사용 방식

### 기업 추천 파이프라인
- **폴더**: `data/companies/`
- **용도**: 기업 역량 임베딩, 유사 기업 추천
- **파일 형식**: CSV, JSON 등

### RAG 견적서 파이프라인
- **폴더**: `data/bids/`
- **용도**: 공고문, 제안요청서 검색/질문응답
- **파일 형식**: PDF, HWP, HWPX, CSV 등

## 🚀 배치 처리

```bash
# 견적서 RAG 처리
cd backend
python scripts/batch_ingest.py data/bids

# 기업 추천 처리 (추후 구현)
python scripts/batch_ingest.py data/companies
```

## 📝 파일명 규칙

### 입찰 공고
- `공고문_프로젝트명.hwpx`
- `과업지시서_프로젝트명.hwpx`
- `제안요청서_프로젝트명.hwpx`

### CSV 데이터
- `UI-ADODAA-008R.입찰공고 내역.csv`
- `프리랜서_기업등록데이터.csv`

## 🔧 확장 옵션

파일이 많아질 경우 하위 폴더 추가:

```
backend/data/bids/
├── raw/          # 원본 파일
├── processed/    # 전처리 완료
└── ...
```
"""
    
    readme_path = base_dir / "README.md"
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(readme_content)
    print(f"\n[6단계] README.md 생성 완료")
    
    print("\n" + "=" * 60)
    print("마이그레이션 완료!")
    print(f"  ✓ companies/ 폴더 생성")
    print(f"  ✓ bids/ 폴더 생성 및 파일 이동")
    print("\n[다음 단계]")
    print(f"  1. python scripts/batch_ingest.py data/bids 실행")
    print(f"  2. 기존 raw/, processed/, indexed/ 폴더는 선택적으로 삭제 가능")
    print("=" * 60)


if __name__ == "__main__":
    migrate_to_simple_structure()

