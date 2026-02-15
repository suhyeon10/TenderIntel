# 표준계약서 인덱싱 스크립트

`backend/data/legal/standard_contracts/` 폴더의 표준계약서들을 조항 단위로 청킹하여 `contract_chunks` 테이블에 저장하는 스크립트입니다.

## 📋 사전 준비

### 1. contract_chunks 테이블 생성

Supabase SQL Editor에서 다음 스크립트를 실행하세요:

```sql
-- backend/scripts/create_contract_chunks_table.sql 실행
```

### 2. 환경 변수 확인

`.env` 파일에 다음이 설정되어 있는지 확인:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
LOCAL_EMBEDDING_MODEL=BAAI/bge-m3
USE_LOCAL_EMBEDDING=true
```

## 🚀 실행 방법

### 방법 1: Python 직접 실행

```bash
cd backend
python scripts/index_contracts_from_data.py
```

### 방법 2: 가상환경에서 실행

```bash
cd backend
# 가상환경 활성화
venv\Scripts\activate  # Windows
# 또는
source venv/bin/activate  # Linux/Mac

# 스크립트 실행
python scripts/index_contracts_from_data.py
```

## 📊 처리 과정

1. **파일 수집**: `data/legal/standard_contracts/` 폴더의 PDF, HWP, HWPX 파일 수집
2. **텍스트 추출**: 각 파일에서 텍스트 추출
3. **조항 단위 청킹**: `제n조` 패턴으로 조항 분할
4. **임베딩 생성**: BAAI/bge-m3 모델로 임베딩 생성
5. **DB 저장**: `contract_chunks` 테이블에 저장

## 📁 처리 대상 파일

- `data/legal/standard_contracts/*.pdf`
- `data/legal/standard_contracts/*.hwp`
- `data/legal/standard_contracts/*.hwpx`

## 📝 결과 리포트

처리 완료 후 리포트가 자동으로 저장됩니다:

```
backend/data/indexed/reports/contract_indexing_YYYYMMDD_HHMMSS.json
```

**리포트 형식:**
```json
{
  "total": 10,
  "success": 8,
  "failed": 2,
  "total_chunks": 150,
  "results": [
    {
      "file": "표준근로계약서.pdf",
      "status": "success",
      "contract_id": "uuid",
      "chunks_count": 25,
      "error": null
    },
    ...
  ],
  "processed_at": "2025-11-18T21:00:00"
}
```

## ⚠️ 주의사항

1. **기존 데이터**: 같은 `contract_id`로 다시 실행하면 기존 청크가 삭제되고 새로 저장됩니다.
2. **임베딩 모델**: BAAI/bge-m3 모델이 로드되는데 시간이 걸릴 수 있습니다 (처음 실행 시).
3. **파일 경로**: 파일 경로에 한글이나 특수문자가 있으면 문제가 될 수 있습니다.

## 🔍 문제 해결

### 텍스트 추출 실패
- PDF 파일이 스캔본인 경우 OCR이 필요할 수 있습니다.
- HWP 파일은 HWPX로 변환하는 것을 권장합니다.

### 청크 생성 실패
- 계약서에 `제n조` 패턴이 없으면 청크가 생성되지 않을 수 있습니다.
- 일반 텍스트로 처리되거나 빈 청크가 반환될 수 있습니다.

### DB 저장 실패
- `contract_chunks` 테이블이 생성되어 있는지 확인하세요.
- Supabase 연결 정보가 올바른지 확인하세요.

## 📚 관련 문서

- [계약서 청킹 전략](./BACKEND_LOGIC_EXPLANATION.md#1-계약서-텍스트-처리-및-조항-단위-청킹)
- [contract_chunks 테이블 스키마](./create_contract_chunks_table.sql)

