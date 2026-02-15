# HWP 파일 지원

## ✅ 구현 완료

HWP 및 HWPX 파일 지원이 추가되었습니다!

## 📋 지원 형식

- ✅ **HWPX** (`.hwpx`) - XML 기반, ZIP 압축
- ✅ **HWP** (`.hwp`) - 바이너리 형식

## 🔧 설정 방법

### 방법 1: HWP 변환 서비스 사용 (권장)

외부 HWP 변환 서비스를 설정하면 더 정확한 텍스트 추출이 가능합니다.

**환경 변수 설정** (`backend/.env`):
```env
HWP_CONVERTER_URL=http://localhost:8001/convert
```

### 방법 2: olefile 라이브러리 사용

기본적인 HWP 파일 처리를 위해 `olefile` 라이브러리를 사용합니다.

**설치**:
```bash
cd backend
.\venv\Scripts\Activate.ps1
pip install olefile
```

## 🚀 사용 방법

### 배치 처리

```bash
# HWP 파일 포함하여 처리
python scripts/batch_ingest.py data/announcements --extensions .pdf .hwp .hwpx

# HWP만 처리
python scripts/batch_ingest.py data/announcements --extensions .hwp .hwpx
```

### 폴더 감시

```bash
# HWP 파일 자동 감시
python scripts/watch_folder.py data/announcements --extensions .pdf .hwp .hwpx
```

### API 업로드

```bash
curl -X POST http://localhost:8000/api/announcements/upload \
  -F "file=@announcement.hwp" \
  -F "source=나라장터" \
  -F "title=샘플 공고"
```

## 📊 처리 방식

### HWPX (`.hwpx`)
- ZIP 압축 해제
- `Contents/section0.xml`에서 텍스트 추출
- XML 파싱으로 구조화된 텍스트 추출

### HWP (`.hwp`)
1. **우선**: HWP 변환 서비스 호출 (설정된 경우)
2. **대체**: olefile로 기본 추출 시도

## ⚠️ 주의사항

### HWP 바이너리 형식의 한계
- HWP 바이너리 형식은 복잡하여 완벽한 추출이 어려울 수 있습니다
- **권장**: HWPX 형식 사용 또는 HWP 변환 서비스 설정

### HWP 변환 서비스
외부 서비스를 사용하면 더 정확한 텍스트 추출이 가능합니다:
- FastAPI 기반 HWP 변환 서비스
- Supabase Edge Function
- 클라우드 HWP 변환 API

## 🔍 문제 해결

### "HWP 처리 실패" 오류
1. `olefile` 라이브러리 설치 확인
2. HWP 변환 서비스 URL 확인 (설정된 경우)
3. HWPX 형식으로 변환 후 시도

### 텍스트 추출이 불완전함
- HWPX 형식 사용 권장
- HWP 변환 서비스 설정 권장
- 수동으로 텍스트 추출 후 `.txt` 파일로 저장

## 📝 예시

### 파일 구조
```
backend/data/announcements/
├── 공고1.pdf
├── 공고2.hwpx      ← HWPX 파일
├── 공고3.hwp       ← HWP 파일
└── 공고4.txt
```

### 배치 처리
```bash
cd backend
python scripts/batch_ingest.py data/announcements
# 모든 파일 (PDF, TXT, HWP, HWPX) 자동 처리
```

## 🎯 다음 단계

1. ✅ HWP/HWPX 기본 지원 완료
2. ⏳ HWP 변환 서비스 연동 (선택)
3. ⏳ 더 정확한 HWP 바이너리 파싱 (선택)

