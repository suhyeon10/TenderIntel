# HWPX 파일 처리 상세

## 📋 HWPX 형식

HWPX는 한글과컴퓨터의 XML 기반 문서 형식입니다.

### 구조
- **ZIP 압축 파일**: 여러 XML 파일을 압축
- **Contents/section0.xml, section1.xml, ...**: 본문 섹션
- **XML 네임스페이스**: `http://www.hancom.co.kr/hwpml/2011/section`

## 🔧 처리 방식

### 1. ZIP 압축 해제
```python
import zipfile
with zipfile.ZipFile('file.hwpx', 'r') as zip_ref:
    # 파일 목록 확인
    files = zip_ref.namelist()
```

### 2. 섹션 파일 찾기
```
Contents/section0.xml
Contents/section1.xml
Contents/section2.xml
...
```

### 3. XML 파싱 및 텍스트 추출
```xml
<hp:paragraph>
  <hp:run>
    <hp:t>텍스트 내용</hp:t>
  </hp:run>
</hp:paragraph>
```

**텍스트는 `<hp:t>` 태그에 저장됩니다.**

## ✅ 구현된 기능

### 자동 섹션 감지
- 섹션 파일 자동 찾기
- 섹션 번호로 정렬 (순서 보장)

### 텍스트 추출
1. **표준 방법**: `<hp:t>` 태그에서 추출
2. **네임스페이스 처리**: HWPX XML 네임스페이스 지원
3. **폴백**: 모든 텍스트 노드에서 추출

### 에러 처리
- 섹션 처리 실패해도 계속 진행
- XML 파싱 오류 무시

## 🚀 사용 예시

### 배치 처리
```bash
python scripts/batch_ingest.py data/announcements --extensions .hwpx
```

### API 업로드
```bash
curl -X POST http://localhost:8000/api/announcements/upload \
  -F "file=@announcement.hwpx" \
  -F "source=나라장터" \
  -F "title=샘플 공고"
```

## 📊 처리 흐름

```
HWPX 파일
  ↓
ZIP 압축 해제
  ↓
섹션 파일 찾기 (Contents/section*.xml)
  ↓
각 섹션 XML 파싱
  ↓
<hp:t> 태그에서 텍스트 추출
  ↓
텍스트 결합 및 정제
  ↓
청킹 및 임베딩
```

## ⚠️ 주의사항

### 네임스페이스
- HWPX는 XML 네임스페이스를 사용합니다
- 구현에서 네임스페이스 처리 포함

### 텍스트 품질
- HWPX는 구조화된 형식이므로 텍스트 추출 품질이 좋습니다
- PDF보다 더 정확한 텍스트 추출 가능

### 성능
- ZIP 압축 해제 필요
- XML 파싱 오버헤드 있음
- 하지만 일반적으로 빠름

## 🔍 문제 해결

### "HWPX 처리 실패" 오류
1. 파일이 올바른 HWPX 형식인지 확인
2. ZIP 파일로 열 수 있는지 확인
3. `Contents/` 폴더가 있는지 확인

### 텍스트가 추출되지 않음
- HWPX 파일이 비어있을 수 있음
- XML 구조가 표준과 다를 수 있음
- 폴백 방법으로 모든 텍스트 노드에서 추출 시도

## 📝 참고

- HWPX는 HWP의 XML 버전
- 더 구조화되어 있어 파싱이 쉬움
- HWP보다 HWPX 사용 권장

