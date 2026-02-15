# 상황분석 워크플로우 안전성 체크리스트

## ✅ 완료된 안전성 개선

### 1. JSON 파싱 안전성 ✅

**구현된 기능:**
- ✅ 마크다운 코드 블록 제거 (` ```json `, ` ``` `)
- ✅ 중괄호 매칭으로 유효한 JSON 추출
- ✅ summary 필드 내부 마크다운 코드 블록 제거
- ✅ JSON 파싱 실패 시 기본값 반환 (4개 섹션 구조 유지)

**추가 개선:**
- ✅ `_reformat_action_result()` 함수 추가
  - action_plan.items 배열 검증
  - 마크다운 조각 제거 ("- ", "* " 제거)
  - items가 문자열/객체일 때 배열로 변환

**처리되는 케이스:**
- LLM이 "```json" 없이 JSON만 반환 → ✅ 파싱됨
- summary 내부 따옴표 → ✅ JSON escape 처리됨
- action_plan.items에 마크다운 조각 섞임 → ✅ 제거됨

### 2. retrieve → generate_action_guide 간 데이터 전달 ✅

**구현된 기능:**
- ✅ `retrieve_guides_node`에서 `legal_basis` 추출
- ✅ `generate_action_guide_node`에서 legal_basis 빈 배열 체크
- ✅ 빈 배열일 때 fallback criteria 생성

**Fallback 로직:**
```python
if not legal_basis:
    legal_basis = [{
        "title": "법적 근거 확인 필요",
        "snippet": "관련 법령 정보를 확인하는 중입니다.",
        "source_type": "unknown",
    }]
```

**결과:**
- legal_basis가 비어있어도 빈 criteria가 아닌 기본 criteria 생성
- UX 저하 방지

### 3. actionPlan 구조 강제화 ✅

**구현된 기능:**
- ✅ `_reformat_action_result()`에서 action_plan 검증
- ✅ steps 배열 구조 강제
- ✅ 각 step의 items 배열 검증
- ✅ items가 문자열/객체일 때 배열로 변환
- ✅ 마크다운 조각 제거 ("- ", "* " 제거)
- ✅ title 없는 step 처리 (기본값 "기타")
- ✅ steps가 비어있으면 기본값 생성

**처리되는 케이스:**
- items를 object로 변환 → ✅ 배열로 변환
- items를 하나의 문자열로 합침 → ✅ 줄바꿈 기준으로 분리
- title 없는 step → ✅ "기타"로 설정

**프롬프트 명시:**
- JSON 스키마에 steps 구조 명시
- items는 문자열 배열로 명시

### 4. merge_output 충돌 확인 ✅

**확인 사항:**

#### ✅ summary 중복 결합 없음
- `generate_summary_node` 제거됨
- `generate_action_guide_node`에서만 `summary_report` 생성
- `merge_output_node`에서 `summary_report`를 그대로 사용
- 중복 결합 코드 없음

#### ✅ 이전 summary 필드 merge 코드 없음
- `generate_summary_node` 완전 제거
- `_llm_generate_summary()` 함수 제거
- merge_output에서 summary_report만 사용

#### ✅ relatedCases 이중 제한 안전
- `retrieve_guides_node`: `related_cases[:3]`
- `merge_output_node`: `related_cases[:3]` (이중 안전장치)
- 두 번 걸려도 문제 없음 (최대 3개 보장)

## 검증 함수: _reformat_action_result()

### 기능
1. **criteria 검증**
   - 빈 배열 체크 → fallback criteria 생성
   - 구조 검증 (name, status, reason)

2. **action_plan 검증**
   - steps 배열 강제
   - 각 step의 items 배열 검증
   - items 타입 변환 (문자열/객체 → 배열)
   - 마크다운 조각 제거

3. **scripts 검증**
   - to_company, to_advisor 문자열 검증

4. **summary 검증**
   - 4개 섹션 필수 포함 확인
   - 누락된 섹션 자동 추가

## 에러 처리 흐름

```
LLM 응답
  ↓
코드 블록 제거
  ↓
JSON 파싱 시도
  ↓ (실패 시)
기본값 반환 (4개 섹션 구조 유지)
  ↓
_reformat_action_result() 검증
  ↓
최종 결과 반환
```

## 테스트 시나리오

### 시나리오 1: 정상 응답
- ✅ JSON 파싱 성공
- ✅ 모든 필드 정상 생성
- ✅ UI 정상 표시

### 시나리오 2: JSON 파싱 실패
- ✅ 기본값 반환 (4개 섹션 구조)
- ✅ UI에 오류 메시지 표시

### 시나리오 3: legal_basis 빈 배열
- ✅ fallback criteria 생성
- ✅ 빈 criteria 방지

### 시나리오 4: action_plan.items 잘못된 형식
- ✅ 배열로 변환
- ✅ 마크다운 조각 제거
- ✅ 정상 체크리스트 표시

### 시나리오 5: summary 섹션 누락
- ✅ 누락된 섹션 자동 추가
- ✅ 4개 섹션 모두 표시

## 결론

✅ **모든 안전성 체크리스트 완료**

1. ✅ JSON 파싱 안전성 (코드 블록, 따옴표, 마크다운 조각 처리)
2. ✅ legal_basis 빈 배열 fallback
3. ✅ actionPlan 구조 강제화 (steps/items 배열)
4. ✅ merge_output 충돌 없음 (summary 중복 없음, relatedCases 이중 제한 안전)

**추가된 함수:**
- `_reformat_action_result()`: 결과 정규화 및 검증
- `_extract_legal_basis()`: legal_basis 추출

**제거된 함수:**
- `_llm_generate_summary()`: generate_action_guide에 통합

