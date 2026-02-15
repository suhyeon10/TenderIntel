# 🔧 Supabase 벡터 차원 수정 가이드

## 단계별 실행

### 1단계: Supabase SQL Editor 열기

1. Supabase Dashboard 접속
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭
4. **New query** 클릭

### 2단계: SQL 실행

`backend/SUPABASE_FIX_384.sql` 파일의 내용을 복사해서 SQL Editor에 붙여넣고 **Run** 버튼 클릭

또는 직접 실행:

```sql
-- 기존 데이터 삭제 (선택사항)
DELETE FROM announcement_chunks;
DELETE FROM announcements;

-- 벡터 컬럼 재생성 (384차원)
ALTER TABLE announcement_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE announcement_chunks ADD COLUMN embedding vector(384);
```

### 3단계: 확인

SQL 실행 후 성공 메시지가 표시되면 완료입니다.

### 4단계: 재인덱싱

터미널에서:

```bash
cd backend
python scripts/simple_ingest.py
```

## ⚠️ 주의사항

- 기존 데이터를 삭제하면 모든 인덱싱된 문서가 사라집니다
- 데이터를 유지하려면 `DELETE` 문을 주석 처리하세요
- 하지만 차원이 맞지 않으면 검색이 작동하지 않으므로, 처음부터 다시 인덱싱하는 것을 권장합니다

## ✅ 완료 후

재인덱싱이 완료되면 Streamlit에서 질문을 다시 시도해보세요!

