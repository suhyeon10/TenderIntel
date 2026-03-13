# 법률 RAG 재구축 절차 (새 DB에서 RAG 올리기)

이 문서만 보고 새 DB에서 법률 RAG를 처음부터 재구축할 수 있도록 순서를 정리했습니다.

## 전제 조건

- Supabase 프로젝트 (또는 PostgreSQL + pgvector)
- Python 3.10+, backend 의존성 설치 완료 (`pip install -r requirements.txt` 등)
- 법률 원본 파일: `backend/data/legal/` 하위에 `laws/`, `manuals/`, `cases/`, `standard_contracts/` 폴더 및 파일

## 1. DB 스키마 생성

Supabase SQL Editor에서 아래 스크립트를 **순서대로** 실행합니다.

1. **법률/계약 테이블**  
   - `linkus_legal_legal_chunks` 테이블이 있어야 합니다.  
   - 프로젝트에 있는 `create_legal_tables.sql` 또는 `linkus_legal` 스키마용 DDL을 실행해 주세요.

2. **legal_chunks upsert용 유니크 제약**  
   - `backend/scripts/add_legal_chunks_upsert_unique.sql`  
   - `(external_id, chunk_index)` 유니크 제약이 있어야 `bulk_upsert_legal_chunks`가 동작합니다.

3. **법률 청크 벡터 검색 RPC**  
   - `backend/scripts/create_match_legal_chunks_rpc.sql`  
   - `linkus_legal_match_legal_chunks` 함수 생성 (1024차원 벡터 검색).

4. **계약서 청크 테이블 및 RPC**  
   - `backend/scripts/create_contract_chunks_table.sql`  
   - `linkus_legal_contract_chunks` 테이블 및 `linkus_legal_match_contract_chunks` RPC.

5. **(선택) 인덱싱 audit 테이블**  
   - `backend/scripts/create_legal_ingestion_manifest_table.sql`  
   - 인덱싱 이력을 DB에 남길 때만 사용.

## 2. 법률 코퍼스 인덱싱 (단일 진입점)

**인덱싱 명령은 다음 하나만 사용합니다.**

```bash
cd backend
python -m scripts.index_contracts_from_data
```

옵션 예:

- `--upload-to-storage`: Supabase Storage에 파일 업로드 후 인덱싱
- `--folder laws`: `data/legal/laws/` 만 처리
- `--files "파일명.pdf"`: 특정 파일만 처리
- `--pattern "*표준*.pdf"`: 패턴에 맞는 파일만 처리

환경 변수:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (또는 `config.settings`) 필수.

인덱싱 결과는 다음에 기록됩니다.

- **DB**: `linkus_legal_legal_chunks` 테이블 (upsert 기준: `external_id` + `chunk_index`)
- **파일 manifest**: `backend/data/indexed/manifest/legal_ingestion_YYYYMMDD.jsonl` (JSONL, 문서별 1줄)

## 3. 검증 쿼리

인덱싱 직후 아래로 데이터 존재 여부를 확인합니다.

```sql
-- 청크 수 확인
SELECT source_type, COUNT(*) AS cnt
FROM linkus_legal_legal_chunks
GROUP BY source_type;

-- 최근 인덱싱 문서 샘플
SELECT external_id, source_type, title, chunk_index
FROM linkus_legal_legal_chunks
ORDER BY external_id, chunk_index
LIMIT 20;
```

## 4. 샘플 검색 테스트 (Smoke Test)

1. **법령 검색**  
   - API 또는 앱에서 “근로계약 해지 사유” 등 질의로 법령 RAG 응답이 오는지 확인.

2. **계약서 내부 검색**  
   - 계약서(doc_id)가 `linkus_legal_contract_chunks`에 있는 경우, 해당 계약서에 대한 계약서 내부 검색이 동작하는지 확인.

3. **Rerank 동작**  
   - `LegalRAGService._search_legal_chunks` → `rerank_legal_chunks` 경로로 diversity·threshold가 적용되는지 로그/결과로 확인.

## Smoke Test 체크리스트 (3종)

| # | 항목 | 확인 방법 |
|---|------|-----------|
| 1 | legal_chunks 벡터 검색 | 위 검증 쿼리로 행 존재 확인 후, 앱/API에서 법령 검색 1회 성공 |
| 2 | contract_chunks RPC 검색 | 계약서 1건 업로드·분석 후, 해당 doc_id로 계약서 내부 검색 1회 성공 |
| 3 | 인덱싱 manifest | `data/indexed/manifest/legal_ingestion_*.jsonl`에 당일 실행분 1줄 이상 존재 |

## 트러블슈팅

- **upsert 실패 (unique constraint)**  
  - `add_legal_chunks_upsert_unique.sql` 미실행 가능성.  
  - 해당 스크립트 실행 후 재인덱싱.

- **RPC not found (match_legal_chunks / match_contract_chunks)**  
  - `create_match_legal_chunks_rpc.sql`, `create_contract_chunks_table.sql` 순서대로 실행 여부 확인.  
  - 스키마 이름(예: `linkus_legal`)이 코드의 `table(...)`/RPC 호출과 일치하는지 확인.

- **임베딩 차원 불일치**  
  - `linkus_legal_legal_chunks.embedding`은 1024차원(bge-m3) 가정.  
  - 다른 차원 사용 시 RPC 및 인덱싱 스크립트의 모델/차원을 맞출 것.
