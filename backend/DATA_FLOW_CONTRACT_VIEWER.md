# 계약서 뷰어 데이터 흐름 분석

계약서 상세 페이지(`/legal/contract/[docId]`)의 왼쪽 부분(계약서 텍스트)이 어디서 데이터를 받아오는지 정리한 문서입니다.

## 📊 데이터 흐름도

```
[사용자] 
  ↓
[프론트엔드] /legal/contract/[docId]
  ↓
[데이터 소스 우선순위]
  1. v2 API: GET /api/v2/legal/contracts/{docId}
     ↓
     [백엔드] routes_legal_v2.py::get_contract_analysis()
     ↓
     [DB 조회] contract_storage.py::get_contract_analysis()
     ↓
     [Supabase] contract_analyses 테이블
     ↓
     contract_text 컬럼에서 가져옴
     
  2. 로컬 스토리지 (Fallback)
     ↓
     localStorage.getItem(`contract_analysis_${docId}`)
     ↓
     JSON.parse() → contractText 필드
```

## 🔍 상세 분석

### 1. 프론트엔드 데이터 로드 (`page.tsx`)

**위치**: `src/app/legal/contract/[docId]/page.tsx`

**데이터 소스 우선순위**:

```typescript
// 1순위: v2 API 호출
const { getContractAnalysisV2 } = await import('@/apis/legal.service')
v2Data = await getContractAnalysisV2(docId)
// → v2Data.contractText 사용

// 2순위: 로컬 스토리지 (Fallback)
storedData = localStorage.getItem(`contract_analysis_${docId}`)
localData = JSON.parse(storedData)
// → localData.contractText 또는 localData.contract_text 사용
```

**데이터 정규화**:

```typescript
const normalizedData = v2Data ? {
  contractText: v2Data.contractText || '',
  // ...
} : {
  contractText: localData?.contractText || localData?.contract_text || '',
  // ...
}
```

### 2. 백엔드 API 엔드포인트

**위치**: `backend/api/routes_legal_v2.py`

**엔드포인트**: `GET /api/v2/legal/contracts/{doc_id}`

**조회 순서**:

1. **임시 ID인 경우**: 메모리(`_contract_analyses`)에서 조회
2. **DB 조회**: `contract_storage.get_contract_analysis()` 호출
3. **Fallback**: 메모리에서 조회

### 3. DB 저장소 (`contract_storage.py`)

**위치**: `backend/core/contract_storage.py`

**메서드**: `get_contract_analysis()`

**DB 쿼리**:

```python
# contract_analyses 테이블에서 조회
query = self.sb.table("contract_analyses").select("*").eq("doc_id", doc_id)
result = query.execute()

# contract_text 컬럼에서 가져옴
contractText = analysis.get("contract_text", "")
```

**응답 형식 변환**:

```python
return {
    "docId": doc_id_value,
    "title": analysis.get("title", ""),
    "contractText": analysis.get("contract_text", ""),  # ← 여기서 가져옴
    # ...
}
```

### 4. DB 테이블 구조

**테이블**: `contract_analyses`

**컬럼**: `contract_text` (TEXT, NULL 허용)

**저장 시점**: 계약서 분석 완료 시 (`save_contract_analysis()` 메서드)

## 📝 데이터 저장 흐름

### 계약서 업로드 시

```
[사용자] 파일 업로드
  ↓
[프론트엔드] POST /api/v2/legal/analyze-contract
  ↓
[백엔드] routes_legal_v2.py::analyze_contract()
  ↓
[텍스트 추출] document_processor_v2.py
  ↓
[분석] legal_rag_service.py
  ↓
[DB 저장] contract_storage.py::save_contract_analysis()
  ↓
[Supabase] contract_analyses.contract_text 컬럼에 저장
```

## 🔧 문제 해결

### 계약서 텍스트가 표시되지 않는 경우

1. **DB에 데이터가 있는지 확인**:
   ```sql
   SELECT doc_id, title, LENGTH(contract_text) as text_length
   FROM contract_analyses
   WHERE doc_id = '01dde315-e83c-4126-ae96-5551018cbd73';
   ```

2. **API 응답 확인**:
   - 브라우저 개발자 도구 → Network 탭
   - `/api/v2/legal/contracts/{docId}` 요청 확인
   - 응답 본문에서 `contractText` 필드 확인

3. **로컬 스토리지 확인**:
   ```javascript
   // 브라우저 콘솔에서
   const data = localStorage.getItem('contract_analysis_01dde315-e83c-4126-ae96-5551018cbd73');
   console.log(JSON.parse(data));
   ```

4. **프론트엔드 로그 확인**:
   - 콘솔에서 `[Frontend] 계약서 텍스트 확인:` 로그 확인
   - `contractTextLength` 값 확인

## 📋 체크리스트

계약서 텍스트가 표시되지 않을 때 확인할 사항:

- [ ] DB에 `contract_text` 컬럼에 데이터가 있는가?
- [ ] API 응답에 `contractText` 필드가 있는가?
- [ ] 로컬 스토리지에 데이터가 있는가?
- [ ] 프론트엔드 콘솔에 에러가 있는가?
- [ ] `analysisResult.contractText`가 비어있지 않은가?

## 💡 참고

- **계약서 텍스트 저장**: `contract_analyses.contract_text` 컬럼
- **계약서 텍스트 전달**: API 응답의 `contractText` 필드
- **프론트엔드 표시**: `ContractViewer` 컴포넌트의 `contractText` prop

