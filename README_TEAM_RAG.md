# 팀 RAG 데이터 수집 가이드

## 📋 개요

팀 RAG 시스템은 팀 프로필 정보를 벡터 임베딩으로 변환하여 공고와의 매칭을 수행합니다.

## 🔄 자동 수집 (이벤트 기반)

### 1. 팀 생성 시 자동 임베딩 생성
- `createDefaultTeam()` 함수에서 팀 생성 후 자동으로 임베딩 생성
- 팀 정보가 비어있어도 기본 임베딩 생성

### 2. 팀 업데이트 시 자동 임베딩 업데이트
- `updateTeam()` 함수에서 팀 정보 업데이트 후 자동으로 임베딩 업데이트
- 실패해도 팀 업데이트는 성공 (비동기 처리)

## 📝 팀 Summary 생성

팀 프로필에서 다음 정보를 조합하여 summary 생성:

```typescript
- 팀명
- 팀 소개 (bio)
- 전문 분야 (specialty)
- 세부 전문 분야 (sub_specialty)
- 선호 기술 (prefered)
- 팀 멤버 정보 (team_members)
- 멤버 기술 스택
- 매니저 정보
```

**사용 예시:**
```typescript
import { generateTeamSummary, generateTeamSummarySimple } from '@/lib/rag/team-summary'

// 전체 팀 프로필이 있을 때
const summaryData = generateTeamSummary(teamProfile)

// 간단한 팀 정보만 있을 때
const summaryData = generateTeamSummarySimple({
  name: '웹 개발 팀',
  bio: 'React, Node.js 전문',
  specialty: ['웹개발'],
  sub_specialty: ['프론트엔드', '백엔드'],
  prefered: ['React', 'Node.js']
})
```

## 🔧 배치 수집 (기존 팀 처리)

기존 팀들의 임베딩을 일괄 생성하려면 배치 스크립트를 실행하세요:

```bash
cd backend
python scripts/sync_team_embeddings.py
```

**환경 변수 필요:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 📊 API 엔드포인트

### 팀 임베딩 저장/업데이트
```bash
POST /api/v2/teams/embedding
Content-Type: application/x-www-form-urlencoded

team_id=1
summary=팀명: 웹 개발 팀\n소개: React, Node.js 전문...
meta={"specialty": ["웹개발"], "prefered": ["React", "Node.js"]}
```

### 팀 검색
```bash
GET /api/v2/teams/search?query=웹개발 React&top_k=5
```

### 공고에 맞는 팀 매칭
```bash
GET /api/v2/announcements/{announcement_id}/match-teams?top_k=5
```

## 🎯 사용 시나리오

### 시나리오 1: 팀 생성
1. 사용자가 팀을 생성 (`createDefaultTeam()`)
2. 자동으로 팀 임베딩 생성
3. `team_embeddings` 테이블에 저장

### 시나리오 2: 팀 정보 업데이트
1. 매니저가 팀 정보 수정 (`updateTeam()`)
2. 자동으로 팀 임베딩 업데이트
3. 기존 임베딩 덮어쓰기

### 시나리오 3: 공고에 맞는 팀 찾기
1. 공고 분석 결과 조회
2. 요구사항 추출 (기술 스택, 프로젝트 유형 등)
3. 유사 팀 검색 (`match_teams_for_announcement()`)
4. 유사도 순으로 팀 반환

## 🔍 데이터 구조

### team_embeddings 테이블
```sql
- team_id: int (PK)
- summary: text (팀 요약 텍스트)
- meta: jsonb (메타데이터)
- embedding: vector (임베딩 벡터)
- updated_at: timestamp
```

### Meta 구조
```json
{
  "specialty": ["웹개발", "모바일"],
  "sub_specialty": ["프론트엔드", "백엔드"],
  "prefered": ["React", "Node.js", "TypeScript"],
  "member_count": 3,
  "member_skills": ["React", "Node.js", "Python"]
}
```

## ⚠️ 주의사항

1. **비동기 처리**: 팀 생성/업데이트 시 임베딩 생성이 실패해도 팀 작업은 성공합니다.
2. **Summary 최소 길이**: 팀 정보가 비어있으면 임베딩을 생성하지 않습니다.
3. **임베딩 모델**: 공고와 동일한 임베딩 모델을 사용하여 일관성을 유지합니다.

## 🚀 다음 단계

1. 팀 프로젝트 이력 추가 (과거 프로젝트 정보를 summary에 포함)
2. 팀 평점/리뷰 정보 추가
3. 팀 지역 정보 추가 (지역 기반 필터링)
4. 팀 성공률 통계 추가

