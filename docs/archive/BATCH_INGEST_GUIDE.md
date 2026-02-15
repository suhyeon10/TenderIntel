# 배치 인입 가이드

## 🎯 목표

폴더에 파일들을 넣어두고, 실행하면 자동으로 RAG에 반영되도록!

## 🚀 빠른 시작

### 방법 1: 배치 처리 (일괄 인입)

```bash
# 1. 공고 PDF들을 폴더에 모음
mkdir -p backend/data/announcements
# PDF 파일들을 복사

# 2. 배치 처리 실행
cd backend
python scripts/batch_ingest.py data/announcements
```

### 방법 2: 폴더 감시 (자동 인입)

```bash
# 1. 감시 폴더 설정
cd backend
python scripts/watch_folder.py data/announcements

# 2. 새 파일을 폴더에 드롭
# 자동으로 처리됨!

# 3. 종료: Ctrl+C
```

## 📁 폴더 구조 예시

```
backend/data/
└── announcements/
    ├── 나라장터_2024-001_웹사이트구축.pdf
    ├── 조달청_2024-002_모바일앱개발.hwpx
    ├── 수기_샘플공고.hwp
    ├── 기타공고.txt
    └── ...
```

**지원 형식**: PDF, TXT, HWP, HWPX

## 🔧 사용 방법

### 배치 처리

```bash
# 기본 (모든 PDF/TXT 처리)
python scripts/batch_ingest.py ./data/announcements

# PDF만 처리
python scripts/batch_ingest.py ./data/announcements --extensions .pdf

# 병렬 처리 (빠름)
python scripts/batch_ingest.py ./data/announcements --parallel --max-workers 5

# 리포트 저장
python scripts/batch_ingest.py ./data/announcements --report ./reports/batch.json
```

### 폴더 감시

```bash
# 기본 (PDF/TXT 감시)
python scripts/watch_folder.py ./data/announcements

# PDF만 감시
python scripts/watch_folder.py ./data/announcements --extensions .pdf
```

## 📊 처리 결과

### 콘솔 출력

```
📁 발견된 파일: 10개
🚀 처리 시작...

[1/10] 📄 처리 중: 공고1.pdf
✅ 완료: 공고1.pdf → uuid-1234
[2/10] 📄 처리 중: 공고2.pdf
✅ 완료: 공고2.pdf → uuid-5678
...

==================================================
📊 배치 처리 완료
   전체: 10개
   성공: 8개
   실패: 2개
==================================================
```

### 리포트 파일 (JSON)

```json
{
  "total": 10,
  "success": 8,
  "failed": 2,
  "results": [
    {
      "file": "./data/announcements/공고1.pdf",
      "status": "success",
      "announcement_id": "uuid-here",
      "started_at": "2024-01-01T10:00:00",
      "completed_at": "2024-01-01T10:00:30"
    }
  ]
}
```

## 🎯 파일명 규칙

파일명에서 메타데이터를 자동 추출:

**형식**: `{source}_{external_id}_{title}.pdf`

**예시**:
- `나라장터_2024-001_웹사이트구축.pdf`
  - source: 나라장터
  - external_id: 2024-001
  - title: 웹사이트구축

**기본값** (규칙을 따르지 않으면):
- source: batch_upload
- external_id: 파일명
- title: 파일명

## ⚙️ 설정

### 환경 변수

`backend/.env`:
```env
OPENAI_API_KEY=sk-xxxxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxx
```

### 의존성

```bash
# 폴더 감시 사용 시
pip install watchdog
```

## 📝 사용 시나리오

### 시나리오 1: 초기 대량 인입

```bash
# 1. 공고 PDF들을 폴더에 모음
# 2. 배치 처리 실행
python scripts/batch_ingest.py data/announcements --parallel

# 3. 결과 확인
# - 콘솔 출력 확인
# - 리포트 파일 확인
# - Supabase에서 확인
```

### 시나리오 2: 지속적 자동 인입

```bash
# 1. 감시 시작
python scripts/watch_folder.py data/announcements

# 2. 새 파일을 폴더에 드롭
# 자동으로 처리됨!

# 3. 종료: Ctrl+C
```

### 시나리오 3: 주기적 배치

```bash
# cron 또는 작업 스케줄러로 설정
# 매일 새벽 2시 실행
0 2 * * * cd /path/to/backend && python scripts/batch_ingest.py /path/to/announcements
```

## 🔍 확인 방법

### 데이터베이스 확인

```sql
-- Supabase SQL Editor에서
SELECT COUNT(*) FROM announcements;
SELECT COUNT(*) FROM announcement_chunks;

-- 최근 처리된 공고
SELECT id, title, source, created_at 
FROM announcements 
ORDER BY created_at DESC 
LIMIT 10;
```

### API 확인

```bash
# 분석 결과 조회
curl http://localhost:8000/api/announcements/{announcement_id}/analysis
```

## ⚠️ 주의사항

1. **파일 크기**: 큰 PDF는 처리 시간이 오래 걸림
2. **API 비용**: 임베딩 생성 시 OpenAI API 사용료 발생
3. **중복 방지**: 동일 파일을 여러 번 처리해도 중복 저장 안 됨
4. **에러 처리**: 실패한 파일은 리포트에 기록됨

## 🚨 문제 해결

### 파일이 처리되지 않음
- 파일 확장자 확인 (`.pdf`, `.txt`만 지원)
- 환경 변수 설정 확인
- 파일이 완전히 복사되었는지 확인

### 처리 속도가 느림
- `--parallel` 옵션 사용
- `--max-workers` 값 증가 (API 제한 고려)

### 중복 저장됨
- content_hash 기반 중복 방지 확인
- external_id가 고유한지 확인

