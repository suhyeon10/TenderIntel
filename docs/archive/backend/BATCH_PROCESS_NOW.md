# 📦 공고 파일 배치 처리 가이드

`backend/backend/data/announcements/` 폴더에 있는 공고 파일들을 일괄 처리하는 방법입니다.

## 🚀 빠른 실행

### 방법 1: 기본 실행 (순차 처리)

```bash
cd backend
python scripts/batch_ingest.py backend/data/announcements
```

### 방법 2: 모든 파일 형식 포함 (PDF, HWP, HWPX)

```bash
cd backend
python scripts/batch_ingest.py backend/data/announcements --extensions .pdf .hwp .hwpx .txt
```

### 방법 3: 병렬 처리 (빠름)

```bash
cd backend
python scripts/batch_ingest.py backend/data/announcements --extensions .pdf .hwp .hwpx --parallel --max-workers 3
```

## 📁 현재 파일 목록

다음 파일들이 처리됩니다:

**PDF 파일:**
- `#물품공급 및 기술지원협약서_정보통신시스템 통합유지관리.pdf`
- `0. 위치도 및 사진대지(장등천) ★.pdf`

**HWP 파일:**
- `장등천 재해복구 실시설계용역 수의견적 제출 안내 공고문.hwp`
- `0. 과업지시서(장등천 재해복구 실시설계용역) ★.hwp`

**HWPX 파일:**
- `#공고문_정보통신시스템 통합유지관리.hwpx`
- `#과업지시서_정보통신시스템 통합유지관리.hwpx`
- `#제안요청서_정보통신시스템 통합유지관리.hwpx`

**총 7개 파일**

## ⚙️ 처리 과정

각 파일이 다음 과정을 거칩니다:

1. **파일 읽기** → PDF/HWP에서 텍스트 추출
2. **청킹** → 1000자 단위로 분할
3. **임베딩 생성** → 벡터 변환
4. **Supabase 저장** → announcements, chunks 테이블에 저장
5. **LLM 분석** → 구조화된 정보 추출
6. **분석 결과 저장** → announcement_analysis 테이블에 저장

## 📊 예상 출력

```
📁 발견된 파일: 7개
🚀 처리 시작...

[1/7] 📄 처리 중: #물품공급 및 기술지원협약서_정보통신시스템 통합유지관리.pdf
✅ 완료: #물품공급 및 기술지원협약서_정보통신시스템 통합유지관리.pdf → uuid-1234
[2/7] 📄 처리 중: 0. 위치도 및 사진대지(장등천) ★.pdf
✅ 완료: 0. 위치도 및 사진대지(장등천) ★.pdf → uuid-5678
...

==================================================
📊 배치 처리 완료
   전체: 7개
   성공: 7개
   실패: 0개
==================================================
```

## 💡 팁

### 해커톤 모드 사용 시

`.env`에 설정:
```env
USE_HACKATHON_MODE=true
```

이렇게 하면:
- ✅ 로컬 임베딩 사용 (무료)
- ✅ Ollama LLM 사용 (무료)
- ✅ Supabase 벡터 저장 (무료 티어)

### 처리 시간

- PDF 1개: 약 30초~1분 (임베딩 + LLM 분석 포함)
- HWP 1개: 약 20초~30초
- 병렬 처리 시: 전체 시간 단축

### 중복 방지

동일한 파일을 여러 번 실행해도:
- ✅ content_hash로 중복 감지
- ✅ 기존 ID 반환 (새로 저장 안 함)

## 🔍 결과 확인

### Supabase에서 확인

```sql
-- 처리된 공고 수
SELECT COUNT(*) FROM announcements;

-- 최근 처리된 공고
SELECT id, title, source, created_at 
FROM announcements 
ORDER BY created_at DESC 
LIMIT 10;

-- 청크 수
SELECT COUNT(*) FROM announcement_chunks;
```

### API로 확인

```bash
# 분석 결과 조회
curl http://localhost:8000/api/announcements/{announcement_id}/analysis
```

## 🚨 문제 해결

### HWP 파일 처리 실패
- HWP 파일 처리는 추가 라이브러리가 필요할 수 있습니다
- PDF로 변환 후 처리하는 것을 권장합니다

### 처리 속도가 느림
- `--parallel` 옵션 사용
- 해커톤 모드 사용 (로컬 임베딩이 더 빠를 수 있음)

### 메모리 부족
- `--max-workers` 값을 줄이기 (기본: 3)
- 순차 처리 사용 (--parallel 제거)

