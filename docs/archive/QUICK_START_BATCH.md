# 배치 인입 빠른 시작

## 🎯 목표

폴더에 파일들을 넣고 실행하면 자동으로 RAG에 반영!

## 🚀 3단계로 시작

### 1. 파일 준비

```bash
# 공고 PDF 파일들을 폴더에 복사
backend/data/announcements/
├── 공고1.pdf
├── 공고2.pdf
└── ...
```

### 2. 배치 처리 실행

```bash
cd backend
python scripts/batch_ingest.py data/announcements
```

### 3. 완료!

```
📁 발견된 파일: 3개
🚀 처리 시작...

[1/3] 📄 처리 중: 공고1.pdf
✅ 완료: 공고1.pdf → uuid-1234
[2/3] 📄 처리 중: 공고2.pdf
✅ 완료: 공고2.pdf → uuid-5678
[3/3] 📄 처리 중: 공고3.pdf
✅ 완료: 공고3.pdf → uuid-9012

==================================================
📊 배치 처리 완료
   전체: 3개
   성공: 3개
   실패: 0개
==================================================
```

## 📋 옵션

### 병렬 처리 (빠름)

```bash
python scripts/batch_ingest.py data/announcements --parallel
```

### PDF만 처리

```bash
python scripts/batch_ingest.py data/announcements --extensions .pdf
```

### 리포트 저장

```bash
python scripts/batch_ingest.py data/announcements --report report.json
```

## 🔄 자동 감시 모드

새 파일이 추가되면 자동으로 처리:

```bash
python scripts/watch_folder.py data/announcements
```

## 📝 파일명 규칙 (선택)

파일명에서 메타데이터 자동 추출:

**형식**: `{source}_{external_id}_{title}.{ext}`

**예시**:
- `나라장터_2024-001_웹사이트구축.pdf`
- `조달청_2024-002_모바일앱개발.hwpx`
- `수기_샘플공고.hwp`

**지원 형식**: PDF, TXT, HWP, HWPX

규칙을 따르지 않으면 기본값 사용.

## ✅ 확인

```sql
-- Supabase SQL Editor에서
SELECT COUNT(*) FROM announcements;
SELECT title, source, created_at FROM announcements ORDER BY created_at DESC LIMIT 5;
```

