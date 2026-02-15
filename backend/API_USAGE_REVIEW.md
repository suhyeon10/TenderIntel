# API 사용 검토 결과

## 📋 검토 개요

`legal/contract/[docId]` 페이지에서 변경된 백엔드 API 사용 여부를 검토했습니다.

## ✅ 올바르게 사용 중인 API

### 1. 계약서 분석 결과 조회
- **프론트엔드**: `getContractAnalysisV2(docId)` 
- **백엔드**: `GET /api/v2/legal/contracts/{doc_id}` ✅
- **위치**: `src/app/legal/contract/[docId]/page.tsx:77`
- **상태**: ✅ 정상

```typescript
// src/app/legal/contract/[docId]/page.tsx
const { getContractAnalysisV2 } = await import('@/apis/legal.service')
v2Data = await getContractAnalysisV2(docId)
```

```python
# backend/api/routes_legal_v2.py:546
@router.get("/contracts/{doc_id}", response_model=ContractAnalysisResponseV2)
async def get_contract_analysis(doc_id: str):
```

## ✅ 수정 완료된 API

### 1. 법률 상담 챗 API

**수정 전:**
- **프론트엔드**: `/api/rag/query` (Next.js API 라우트) → 백엔드 `/api/v1/legal/chat` 호출
- **백엔드**: `/api/v1/legal/chat` (v1, 레거시)

**수정 후:**
- **프론트엔드**: `chatWithContractV2()` → 백엔드 `/api/v2/legal/chat` 직접 호출 ✅
- **백엔드**: `/api/v2/legal/chat` (v2, Dual RAG 지원) ✅

**변경 사항:**
1. ✅ 백엔드에 `/api/v2/legal/chat` 엔드포인트 추가 (`backend/api/routes_legal_v2.py:683`)
2. ✅ v2 스키마 추가 (`LegalChatRequestV2`, `LegalChatResponseV2`, `UsedChunksV2`)
3. ✅ 프론트엔드에서 Next.js API 라우트 제거하고 백엔드 직접 호출로 변경
4. ✅ `chatWithContractV2()` 함수 추가 (`src/apis/legal.service.ts:791`)

**주요 개선점:**
- Dual RAG 지원 (계약서 청크 + 법령 청크)
- 이슈 기반 boosting
- 구조화된 프롬프트로 답변 생성
- Next.js API 라우트 제거로 성능 향상

## 📊 API 사용 현황 요약

| 기능 | 프론트엔드 | 백엔드 | 상태 |
|------|-----------|--------|------|
| 계약서 분석 결과 조회 | `getContractAnalysisV2()` | `GET /api/v2/legal/contracts/{doc_id}` | ✅ 정상 |
| 법률 상담 챗 | `chatWithContractV2()` | `POST /api/v2/legal/chat` | ✅ v2로 마이그레이션 완료 |
| 계약서 분석 | `analyzeContractV2()` | `POST /api/v2/legal/analyze-contract` | ✅ 정상 |
| 법률 검색 | `searchLegalV2()` | `GET /api/v2/legal/search` | ✅ 정상 |
| 상황 분석 | `analyzeSituationV2()` | `POST /api/v2/legal/analyze-situation` | ✅ 정상 |

## ✅ 수정 완료 사항

1. ✅ **백엔드**: `/api/v2/legal/chat` 엔드포인트 추가 완료
2. ✅ **프론트엔드**: Next.js API 라우트 제거하고 백엔드 직접 호출로 변경 완료
3. ✅ **스키마**: `LegalChatRequestV2`, `LegalChatResponseV2`, `UsedChunksV2` 스키마 정의 완료

## 📝 참고

- `/api/v1/legal/chat`는 레거시 API이며, 향후 제거될 수 있습니다.
- v2 API는 Dual RAG 기능을 지원하여 더 정확한 답변을 제공합니다.
- 프론트엔드에서 직접 백엔드 API를 호출하여 성능이 향상되었습니다.

