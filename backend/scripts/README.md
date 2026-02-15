# 배치 인입 스크립트

## 📁 폴더 구조

```
backend/scripts/
├── batch_ingest.py    # 배치 처리 (일괄 인입)
├── watch_folder.py    # 폴더 감시 (자동 인입)
└── README.md          # 이 문서
```

## 🚀 사용 방법

### 1. 배치 처리 (일괄 인입)

폴더의 모든 파일을 한 번에 처리:

```bash
cd backend
python scripts/batch_ingest.py ./data/announcements
```

**옵션**:
- `--extensions .pdf .txt` - 처리할 파일 확장자
- `--parallel` - 병렬 처리 활성화
- `--max-workers 3` - 병렬 처리 워커 수
- `--report report.json` - 리포트 저장 경로
- `--quiet` - 진행 상황 출력 안 함

**예시**:
```bash
# PDF만 처리
python scripts/batch_ingest.py ./data/announcements --extensions .pdf

# 병렬 처리 (빠름)
python scripts/batch_ingest.py ./data/announcements --parallel --max-workers 5

# 리포트 저장
python scripts/batch_ingest.py ./data/announcements --report ./reports/batch_2024.json
```

### 2. 폴더 감시 (자동 인입)

새 파일이 추가되면 자동으로 처리:

```bash
python scripts/watch_folder.py ./data/announcements
```

**옵션**:
- `--extensions .pdf .txt` - 감시할 파일 확장자

**예시**:
```bash
# PDF만 감시
python scripts/watch_folder.py ./data/announcements --extensions .pdf
```

## 📊 처리 결과

### 배치 처리 리포트

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
    },
    ...
  ],
  "processed_at": "2024-01-01T10:05:00"
}
```

## 🔧 파일명 규칙

파일명에서 메타데이터를 자동 추출합니다:

**형식**: `{source}_{external_id}_{title}.pdf`

**예시**:
- `나라장터_2024-001_웹사이트구축.pdf`
  - source: 나라장터
  - external_id: 2024-001
  - title: 웹사이트구축

**기본값** (파일명이 규칙을 따르지 않으면):
- source: batch_upload (배치) 또는 watch_folder (감시)
- external_id: 파일명 (확장자 제외)
- title: 파일명 (확장자 제외)

## ⚙️ 설정

### 환경 변수

`backend/.env` 파일에 다음이 설정되어 있어야 합니다:

```env
OPENAI_API_KEY=sk-xxxxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxxx
```

### 의존성

폴더 감시를 사용하려면:

```bash
pip install watchdog
```

## 📝 사용 시나리오

### 시나리오 1: 초기 대량 인입

```bash
# 1. 공고 PDF들을 폴더에 모음
mkdir -p data/announcements
# PDF 파일들을 복사

# 2. 배치 처리 실행
python scripts/batch_ingest.py data/announcements --parallel

# 3. 결과 확인
# 리포트 파일 확인 또는 Supabase에서 확인
```

### 시나리오 2: 지속적 자동 인입

```bash
# 1. 감시 폴더 설정
python scripts/watch_folder.py data/announcements

# 2. 새 파일을 폴더에 드롭
# 자동으로 처리됨!

# 3. 종료: Ctrl+C
```

### 시나리오 3: 주기적 배치 처리

```bash
# cron 또는 스케줄러로 주기적 실행
# 매일 새벽 2시 실행 예시
0 2 * * * cd /path/to/backend && python scripts/batch_ingest.py /path/to/announcements
```

## 🎯 처리 프로세스

각 파일마다:

1. 파일명에서 메타데이터 추출
2. 중복 확인 (content_hash)
3. 텍스트 추출 (PDF → Text)
4. 청킹 (1000자, 200자 오버랩)
5. 임베딩 생성 (OpenAI)
6. Supabase 저장
7. LLM 분석
8. 분석 결과 저장

## ⚠️ 주의사항

1. **파일 크기**: 큰 PDF는 처리 시간이 오래 걸릴 수 있음
2. **API 비용**: 임베딩 생성 시 OpenAI API 사용료 발생
3. **중복 방지**: 동일 파일을 여러 번 처리해도 중복 저장 안 됨
4. **에러 처리**: 실패한 파일은 리포트에 기록됨

## 🔍 문제 해결

### 파일이 처리되지 않음
- 파일 확장자 확인 (`.pdf`, `.txt`만 지원)
- 파일이 완전히 복사되었는지 확인
- 환경 변수 설정 확인

### 처리 속도가 느림
- `--parallel` 옵션 사용
- `--max-workers` 값 증가 (주의: API 제한 고려)

### 중복 저장됨
- content_hash 기반 중복 방지 작동 확인
- external_id가 고유한지 확인

