# Backend v2 - 실전형 RAG 파이프라인

## 🎯 완성된 기능

**"공고 대량·지속 인입 → 정규화 → 임베딩/인덱싱 → 검색/매칭"** 전체 파이프라인이 구현되었습니다!

## ✅ 구현 완료

### 데이터베이스 (Supabase)
- ✅ `announcements` - 공고 메타데이터 (버전 관리, 중복 방지)
- ✅ `announcement_bodies` - 공고 본문
- ✅ `announcement_chunks` - 벡터 청크 (pgvector)
- ✅ `announcement_analysis` - 분석 결과
- ✅ 벡터 검색 RPC 함수

### 핵심 모듈
- ✅ `supabase_vector_store.py` - Supabase pgvector 어댑터
- ✅ `document_processor_v2.py` - PDF 처리 및 청킹
- ✅ `generator_v2.py` - 임베딩 및 LLM 생성
- ✅ `orchestrator_v2.py` - 전체 파이프라인
- ✅ `routes_v2.py` - REST API

## 🚀 빠른 시작

### 1. 의존성 설치
```bash
cd backend
.\venv\Scripts\Activate.ps1
pip install supabase==2.3.4
```

### 2. 환경 변수 설정
`backend/.env`:
```env
OPENAI_API_KEY=sk-xxxxx
SUPABASE_URL=https://zmxxbdrfwhavwxizdfyz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. 서버 실행
```bash
python main.py
```

### 4. 공고 업로드
```bash
curl -X POST http://localhost:8000/api/announcements/upload \
  -F "file=@announcement.pdf" \
  -F "source=나라장터" \
  -F "title=샘플 공고"
```

## 📊 파이프라인

```
공고 인입 → 중복 판별 → 텍스트 추출 → 청킹 → 임베딩 → 저장 → LLM 분석 → 완료
```

## 📚 문서

- `USAGE_V2.md` - 사용 가이드
- `backend/QUICK_START_V2.md` - 빠른 시작
- `backend/ENV_V2.md` - 환경 변수
- `IMPLEMENTATION_COMPLETE.md` - 구현 완료 요약

