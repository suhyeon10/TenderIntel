# RAG 빠른 시작 가이드

## 🚀 5분 안에 RAG 시작하기

### 1단계: 샘플 PDF 준비 (1분)

공고 PDF 파일을 준비하세요. 없으면:
- 온라인에서 공공기관 입찰 공고 PDF 다운로드
- 또는 테스트용 텍스트 PDF 생성

### 2단계: 서버 실행 (1분)

```bash
# Frontend 서버
npm run dev

# Backend 서버 (별도 터미널)
cd backend
python main.py
```

### 3단계: 문서 업로드 (2분)

1. 브라우저에서 `http://localhost:3000/upload` 접속
2. PDF 파일 선택
3. 업로드 버튼 클릭
4. 완료 메시지 확인 (docId 표시)

### 4단계: 검색 테스트 (1분)

1. `http://localhost:3000/analysis/{docId}` 접속
2. 자동으로 분석 시작
3. 결과 확인

## ✅ 완료 확인

```sql
-- Supabase SQL Editor에서
SELECT COUNT(*) FROM docs;        -- 1 이상이어야 함
SELECT COUNT(*) FROM doc_chunks;  -- 1 이상이어야 함
```

## 🎯 이제 할 수 있는 것

- ✅ 문서 검색
- ✅ 요약 생성
- ✅ 유사 문서 찾기
- ✅ 팀 매칭 (팀 프로필 필요)
- ✅ 견적서 생성

