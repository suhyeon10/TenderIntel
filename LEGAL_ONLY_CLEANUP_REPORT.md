# Legal 서비스 전용 테이블 정리 보고서

## 📋 작업 개요

Legal 서비스에 필요한 테이블만 유지하고, 나머지 모든 비-legal 테이블을 삭제했습니다.

## ✅ 유지된 테이블 (Legal 관련)

다음 5개의 테이블이 유지되었습니다:

1. **`legal_documents`** (0 rows)
   - 법률 문서 메타데이터
   - 컬럼: id, title, source, file_path, doc_type, content_hash, created_at

2. **`legal_document_bodies`** (0 rows)
   - 법률 문서 본문 저장
   - 컬럼: id, legal_document_id, text, mime, language, created_at
   - 외래키: legal_document_id → legal_documents.id

3. **`legal_chunks`** (373 rows)
   - 법률 문서 청크 및 임베딩 (RAG용)
   - 컬럼: id, external_id, source_type, title, content, chunk_index, file_path, metadata, embedding, created_at

4. **`contract_analyses`** (10 rows)
   - 계약서 분석 결과
   - 컬럼: id, user_id, file_name, file_url, file_size, file_type, risk_score, risk_level, summary, contract_text, analysis_result, created_at, updated_at, doc_id, title, original_filename, doc_type, sections, retrieved_contexts
   - 외래키: user_id → auth.users.id

5. **`user_profiles`** (0 rows) - **새로 생성됨**
   - Legal 서비스용 최소 사용자 프로필
   - 컬럼: id, user_id, username, email, created_at, updated_at
   - 외래키: user_id → auth.users.id (ON DELETE CASCADE)
   - RLS 활성화: 사용자는 자신의 프로필만 조회/수정 가능

## ❌ 삭제된 테이블 목록

### Accounts 관련 (6개)
- `accounts`
- `account_educations`
- `account_work_experiences`
- `account_license`
- `account_portfolios`
- `career_verification_requests`

### Teams 관련 (7개)
- `teams`
- `team_members`
- `team_proposals`
- `team_counsel`
- `team_project`
- `team_embeddings`
- `estimate_templates`

### Payment 관련 (3개)
- `payment` (마일스톤 지급)
- `payments` (구독 결제)
- `milestone`

### Estimate 관련 (3개)
- `estimate`
- `estimate_version`
- `estimate_embeddings`

### Counsel 관련 (3개)
- `counsel`
- `counsel_status_events`
- `project_members`

### Client 관련 (1개)
- `client`

### Announcements 관련 (8개)
- `announcements`
- `announcement_bodies`
- `announcement_chunks`
- `announcement_analysis`
- `public_announcements`
- `announcement_embeddings`
- `announcement_team_matches`
- `announcement_estimates`

### Chat 관련 (2개)
- `chat`
- `chat_message`

### Subscriptions 관련 (1개)
- `subscriptions`

### 기타 (3개)
- `notifications`
- `magazine`
- `manager_bookmarks`
- `rag_audit_logs`

**총 삭제된 테이블: 37개**

## 📝 마이그레이션 파일

1. **`supabase/migrations/remove_non_legal_tables.sql`**
   - 비-legal 테이블 삭제
   - 적용 상태: ✅ 성공적으로 적용됨

2. **`supabase/migrations/create_legal_user_profiles.sql`** (자동 생성됨)
   - Legal 서비스용 사용자 프로필 테이블 생성
   - 적용 상태: ✅ 성공적으로 적용됨
   - 기능:
     - 최소한의 사용자 정보 저장 (username, email)
     - RLS (Row Level Security) 정책 적용
     - updated_at 자동 업데이트 트리거

## 🔍 확인 사항

- ✅ Legal 관련 테이블만 남아있음
- ✅ 외래키 제약조건이 올바르게 처리됨 (CASCADE 사용)
- ✅ 기존 데이터 보존됨:
  - `legal_chunks`: 373 rows 유지
  - `contract_analyses`: 10 rows 유지

## ⚠️ 주의사항

1. **인증 관련**: `auth.users` 테이블은 Supabase 인증 시스템의 일부이므로 유지됩니다. `contract_analyses.user_id`가 이를 참조합니다.

2. **데이터 복구**: 삭제된 테이블의 데이터는 복구할 수 없습니다. 필요시 백업에서 복구해야 합니다.

3. **애플리케이션 코드**: 이제 Legal 서비스만 사용하므로, 삭제된 테이블을 참조하는 코드가 있다면 제거하거나 수정해야 합니다.

## 🔄 코드 수정 사항

### `src/app/auth/callback/route.ts`
- `accounts` 테이블 참조 제거
- `user_profiles` 테이블 사용으로 변경
- 복잡한 프로필 타입 로직 제거 (Legal 서비스 전용으로 단순화)
- OAuth 콜백 시 자동으로 `user_profiles`에 사용자 정보 저장

## 🎯 다음 단계

1. ✅ Legal 서비스용 사용자 프로필 테이블 생성 완료
2. ✅ 인증 콜백 로직 수정 완료
3. 애플리케이션 코드에서 삭제된 테이블 참조 제거 (필요시)
4. Legal 서비스 관련 기능만 유지
5. 필요시 `contract_issues` 및 `situation_analyses` 테이블 생성 고려

