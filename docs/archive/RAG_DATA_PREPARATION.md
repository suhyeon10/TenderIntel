# RAG 데이터 준비 가이드

## 🎯 현재 상황

- ✅ **인덱싱 API 구현 완료**: `/api/rag/ingest`
- ✅ **청킹 로직 구현 완료**: `src/lib/rag/chunker.ts`
- ✅ **임베딩 로직 구현 완료**: `src/lib/rag/embedder.ts`
- ❌ **저장된 문서**: 0개
- ❌ **저장된 청크**: 0개

**→ 공고 문서를 먼저 업로드해야 RAG가 작동합니다!**

## 📋 해야 할 작업

### 1단계: 샘플 공고 PDF 준비

공고 PDF 파일을 준비하세요. 예:
- 공공기관 입찰 공고
- IT 프로젝트 공고
- 웹사이트 개발 공고
- 모바일 앱 개발 공고

**권장**: 최소 3-5개의 다양한 공고 문서

### 2단계: 문서 업로드

#### 방법 A: UI를 통한 업로드 (권장)

1. **Frontend 서버 실행**
   ```bash
   npm run dev
   ```

2. **업로드 페이지 접속**
   ```
   http://localhost:3000/upload
   ```

3. **PDF 파일 업로드**
   - 파일 선택
   - 업로드 버튼 클릭
   - 자동으로 처리됨:
     - 텍스트 추출
     - 청킹 (500자 단위, 100자 오버랩)
     - 임베딩 생성 (OpenAI)
     - Supabase에 저장

#### 방법 B: API 직접 호출

```bash
curl -X POST http://localhost:3000/api/rag/ingest \
  -F "file=@sample_announcement.pdf" \
  -F "source=pdf" \
  -F "title=샘플 공고" \
  -F "organization=한국공공기관"
```

### 3단계: 업로드 확인

#### 데이터베이스 확인

```sql
-- Supabase SQL Editor에서 실행

-- 문서 개수 확인
SELECT COUNT(*) as doc_count FROM docs;

-- 청크 개수 확인
SELECT COUNT(*) as chunk_count FROM doc_chunks;

-- 문서 목록 확인
SELECT id, title, source, created_at FROM docs ORDER BY created_at DESC;

-- 특정 문서의 청크 확인
SELECT 
  chunk_index, 
  LEFT(text, 100) as text_preview,
  array_length(embedding, 1) as embedding_dim
FROM doc_chunks 
WHERE doc_id = 1
ORDER BY chunk_index;
```

#### Frontend에서 확인

```typescript
// 브라우저 콘솔에서
const response = await fetch('/api/rag/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'summary',
    query: '이 공고의 핵심 요구사항을 요약해주세요',
    topK: 5,
    docIds: [1] // 업로드한 문서 ID
  })
})

const result = await response.json()
console.log(result)
```

## 🔄 전체 프로세스

```
1. PDF 파일 업로드
   ↓
2. 텍스트 추출 (PDF → 텍스트)
   ↓
3. 청킹 (텍스트 → 작은 청크들)
   - 청크 크기: 500자
   - 오버랩: 100자
   ↓
4. 임베딩 생성 (청크 → 벡터)
   - 모델: text-embedding-3-small
   - 차원: 1536
   ↓
5. Supabase에 저장
   - docs 테이블: 문서 메타데이터
   - doc_chunks 테이블: 청크 + 임베딩
   ↓
6. RAG 검색 가능!
```

## 📊 청킹 설정

현재 설정 (`src/lib/rag/chunker.ts`):
- **청크 크기**: 500자
- **오버랩**: 100자
- **보존**: 숫자, 테이블 구조

**변경하려면**:
```typescript
// src/lib/rag/chunker.ts
const chunks = chunkText(text, {
  chunkSize: 1000,  // 더 큰 청크
  chunkOverlap: 200,
  preserveNumbers: true,
  preserveTables: true,
})
```

## 🧪 테스트 시나리오

### 시나리오 1: 첫 문서 업로드

1. 샘플 PDF 업로드
2. 업로드 완료 확인 (docId 반환)
3. 분석 페이지에서 검색 테스트
4. 결과 확인

### 시나리오 2: 여러 문서 업로드

1. 3-5개 공고 PDF 업로드
2. 각 문서의 청크 수 확인
3. 전체 문서에 대한 검색 테스트
4. 유사 문서 검색 테스트

### 시나리오 3: 팀 매칭 테스트

1. 공고 문서 업로드 완료
2. 팀 프로필도 임베딩 필요 (별도 작업)
3. 팀 매칭 API 호출
4. 매칭 결과 확인

## ⚠️ 주의사항

### 1. OpenAI API 키 필요
- `.env.local`에 `OPENAI_API_KEY` 설정 필수
- 임베딩 생성에 사용됨

### 2. Supabase 설정 필요
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 또는 `SUPABASE_SERVICE_ROLE_KEY`

### 3. 비용 고려
- 임베딩 생성: OpenAI API 사용료 발생
- 청크당 약 $0.00002 (text-embedding-3-small 기준)
- 100개 청크 ≈ $0.002

### 4. 처리 시간
- 작은 PDF (10페이지): 약 10-30초
- 큰 PDF (100페이지): 약 1-3분
- 임베딩 생성이 가장 오래 걸림

## 🚀 빠른 시작

### 1. 샘플 PDF 준비
```
backend/data/sample_data/
  ├── announcement_1.pdf
  ├── announcement_2.pdf
  └── announcement_3.pdf
```

### 2. 업로드 스크립트 (선택사항)

```typescript
// scripts/upload-samples.ts
import fs from 'fs'
import path from 'path'

async function uploadSamples() {
  const sampleDir = path.join(process.cwd(), 'backend/data/sample_data')
  const files = fs.readdirSync(sampleDir).filter(f => f.endsWith('.pdf'))

  for (const file of files) {
    const filePath = path.join(sampleDir, file)
    const formData = new FormData()
    formData.append('file', new Blob([fs.readFileSync(filePath)]), file)
    formData.append('source', 'pdf')
    formData.append('title', file.replace('.pdf', ''))

    const response = await fetch('http://localhost:3000/api/rag/ingest', {
      method: 'POST',
      body: formData,
    })

    const result = await response.json()
    console.log(`✅ ${file}: docId=${result.docId}, chunks=${result.chunks}`)
  }
}

uploadSamples()
```

## 📝 체크리스트

- [ ] 샘플 공고 PDF 준비 (최소 3개)
- [ ] Frontend 서버 실행 (`npm run dev`)
- [ ] `/upload` 페이지 접속
- [ ] PDF 파일 업로드
- [ ] 업로드 완료 확인 (docId 반환)
- [ ] 데이터베이스에서 문서 확인
- [ ] 청크 개수 확인
- [ ] RAG 검색 테스트
- [ ] 분석 결과 확인

## 🎯 다음 단계

문서 업로드가 완료되면:
1. ✅ RAG 검색 가능
2. ✅ 문서 요약 가능
3. ✅ 유사 문서 검색 가능
4. ⏳ 팀 매칭 (팀 프로필도 임베딩 필요)
5. ⏳ 견적서 생성

