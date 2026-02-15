# Supabase 프로젝트 정보

## 🔗 프로젝트 연결 정보

### 프로젝트 기본 정보
- **프로젝트 ID**: `zmxxbdrfwhavwxizdfyz`
- **프로젝트 URL**: `https://zmxxbdrfwhavwxizdfyz.supabase.co`
- **프로젝트 이름**: linkers-public

### API 키
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpteHhiZHJmd2hhdnd4aXpkZnl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2ODQxMzcsImV4cCI6MjA3NDI2MDEzN30.lmIGh9Ysak38gGxvw2ZFbCluiVDMY_OSNQmZJOiZ1KY`

### MCP 연결
- **MCP 서버**: `supabase-sessac`
- **MCP URL**: `https://mcp.supabase.com/mcp?project_ref=zmxxbdrfwhavwxizdfyz`
- **연결 상태**: ✅ 정상 연결됨

## 📊 데이터베이스 현황

### 테이블 개수
총 **35개 이상**의 테이블이 존재합니다.

### 주요 테이블 목록

#### 1. 프로필 관련 테이블
- `accounts` (11개 행) - 사용자 프로필 (프리랜서/기업)
- `account_educations` (6개 행) - 학력 정보
- `account_work_experiences` (7개 행) - 경력 정보
- `account_license` (8개 행) - 자격증 정보
- `account_portfolios` (2개 행) - 포트폴리오

#### 2. 프로젝트 상담 관련 테이블
- `counsel` (12개 행) - 프로젝트 상담 요청
- `counsel_status_events` - 상담 상태 이벤트 로그
- `estimate` - 견적서
- `estimate_version` - 견적서 버전
- `estimate_views` (1개 행) - 견적서 열람 기록
- `estimate_access` (1개 행) - 견적서 접근 권한

#### 3. 팀 관련 테이블
- `teams` (3개 행) - 팀 정보
- `team_members` (3개 행) - 팀 멤버
- `team_proposals` - 팀 제안
- `team_counsel` - 팀별 상담 연결
- `team_project` - 팀 프로젝트

#### 4. 프로젝트 멤버 관련 테이블
- `project_members` (7개 행) - 프로젝트 멤버
- `career_verification_requests` (4개 행) - 경력 인증 요청

#### 5. 결제 관련 테이블
- `subscriptions` (1개 행) - 구독 정보
- `payments` - 결제 내역
- `pricing` (2개 행) - 가격표
- `free_quota` (3개 행) - 무료 열람 할당량
- `payment_retry_queue` - 결제 재시도 큐

#### 6. 채팅 관련 테이블
- `chat` - 채팅방
- `chat_message` - 채팅 메시지

#### 7. 기업 관련 테이블
- `client` (1개 행) - 기업 클라이언트 정보
- `company_bookmarks` - 기업 북마크
- `company_team_members` (1개 행) - 기업 팀 멤버

#### 8. 마일스톤 및 지급 테이블
- `milestone` - 마일스톤
- `payment` - 지급 내역

#### 9. 알림 및 기타 테이블
- `notifications` - 알림
- `manager_bookmarks` (2개 행) - 매니저 북마크
- `project_bookmarks` (3개 행) - 프로젝트 북마크
- `user_settings` (2개 행) - 사용자 설정
- `magazine` - 잡지
- `maker_estimates` - 메이커 견적

## 🔄 마이그레이션 현황

### 총 마이그레이션 수
**45개의 마이그레이션**이 적용되어 있습니다.

### 최근 마이그레이션 (일부)
1. `enable_multiple_profiles_per_user` - 다중 프로필 지원
2. `change_primary_key_to_profile_id` - 기본 키 변경
3. `create_subscriptions_and_payments_tables` - 구독/결제 테이블 생성
4. `payment_model_v2_schema_fixed` - 결제 모델 V2 스키마
5. `payment_retry_queue` - 결제 재시도 큐
6. `improve_dual_profiles_design` - 이중 프로필 설계 개선

## 📝 생성된 스키마 파일

### 초기 스키마 파일
- **파일명**: `database_initial_schema.sql`
- **위치**: 프로젝트 루트 디렉토리
- **내용**: 모든 기본 테이블 생성 SQL

### 주요 포함 내용
1. ENUM 타입 정의 (profile_type, user_role, counsel_status 등)
2. 프로필 관련 테이블 (accounts, client, account_educations 등)
3. 프로젝트 상담 테이블 (counsel, estimate 등)
4. 팀 관련 테이블 (teams, team_members 등)
5. 결제 관련 테이블 (subscriptions, payments 등)
6. 채팅 테이블 (chat, chat_message)
7. 트리거 함수 및 인덱스

## ⚠️ 보안 상태

### RLS (Row Level Security) 상태
- ✅ RLS 활성화된 테이블: `accounts`, `subscriptions`, `payments`, `team_proposals` 등
- ❌ RLS 비활성화된 테이블: `counsel`, `teams`, `client`, `estimate`, `chat` 등

### 보안 권고사항
1. **RLS 활성화 필요**: 주요 테이블에 RLS를 활성화해야 합니다
2. **RLS 정책 추가**: 각 테이블에 적절한 RLS 정책이 필요합니다
3. **SECURITY DEFINER 뷰 검토**: `team_with_members`, `maker_estimates_with_details` 뷰 검토 필요

## 🔧 환경 변수 설정

### 필수 환경 변수
```env
NEXT_PUBLIC_SUPABASE_URL=https://zmxxbdrfwhavwxizdfyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpteHhiZHJmd2hhdnd4aXpkZnl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2ODQxMzcsImV4cCI6MjA3NDI2MDEzN30.lmIGh9Ysak38gGxvw2ZFbCluiVDMY_OSNQmZJOiZ1KY
NEXT_PUBLIC_STORAGE_BUCKET=attach_file
```

## 📚 관련 문서

- `database_initial_schema.sql` - 초기 스키마 생성 파일
- `MCP_CONNECTION_CHECK.md` - MCP 연결 확인 가이드
- `DB_VERIFICATION.md` - 데이터베이스 확인 결과

## 🔗 유용한 링크

- [Supabase 대시보드](https://app.supabase.com/project/zmxxbdrfwhavwxizdfyz)
- [SQL Editor](https://app.supabase.com/project/zmxxbdrfwhavwxizdfyz/sql)
- [Table Editor](https://app.supabase.com/project/zmxxbdrfwhavwxizdfyz/editor)

