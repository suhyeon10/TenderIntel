# Linkus Legal - AI-Powered Contract Risk Analysis for Young Workers

<p align="center">
  <img src="demo.gif" alt="Demo" width="600"/>
</p>

<p align="center">
  <strong>알바·인턴 계약서의 법적 위험을 AI가 자동 검출하는 청년 노동 안전망</strong>
</p>

## 🎯 Project Overview

**Problem:**
- 사회 초년생 90%가 계약서를 혼자 검토
- 변호사 상담 비용 부담 (평균 20만원/건)

**Solution:**
- RAG 기반 법률 리스크 자동 검출 시스템
- 관련 법령 조문 자동 매칭 및 근거 기반 리포트 생성

**Key Results:**
- ⚡ 계약서 분석 시간 90% 단축 (2시간 → 10분)
- 🎯 위험 조항 검출률 90% (18/20 테스트 케이스)
- 💰 API 비용 60% 절감 (캐싱 + Prompt 최적화)
- 📊 응답 속도 83% 개선 (2.3초 → 0.4초)

---

## 🏗️ Technical Architecture

### **System Design**
```
User Input (계약서/자연어)
    ↓
ReAct Agent (의도 분석)
    ↓
Tool Selection:
  ├─ DocumentParser (구조 분석)
  ├─ VectorSearch (법령 검색)
  └─ RiskScoring (위험도 산출)
    ↓
Response (조문 근거 + 수정 가이드)
```

### **RAG Pipeline (핵심 기술)**

**1. Hybrid Retrieval**
- Vector Search (BGE-M3) + Keyword Search (BM25)
- 조문 정확 매칭률 35% 향상

**2. Advanced Techniques**
- MMR (Maximal Marginal Relevance) - 검색 다양성 확보
- Reranking (Cohere API) - 상위 결과 정제
- Source-Grounded Generation - 비근거 답변 차단

**3. Optimization**
- Redis 캐싱 → 동일 질문 응답 0.3초
- Prompt Engineering → 토큰 90% 절감
- 동적 모델 선택 → 비용 45% 절감

---

## 📊 Evaluation Results

직접 라벨링한 테스트셋으로 정량 평가:

| Metric | Score |
|--------|-------|
| Recall (위험 조항 검출) | 90% (18/20) |
| Faithfulness (근거 충실도) | 0.87 |
| Answer Relevancy | 0.91 |
| False Positive | 15% (3/20) |

**놓친 케이스 분석 (투명성):**
- 은근슬쩍 들어간 경업금지 조항 1건
- 모호한 표현 ("인턴 전환 보장처럼 읽힘") 1건
→ 키워드 확장 및 모호성 탐지 로직 개선 중

---

## 🛠️ Tech Stack

**AI/ML**
- Framework: LangChain (ReAct Agent), LlamaIndex
- LLM: GPT-4, Claude (비교 평가)
- Embedding: BGE-M3
- Vector DB: Supabase pgvector
- Evaluation: RAGAS

**Backend**
- Python, FastAPI
- PostgreSQL, Redis

**Frontend**
- Next.js 14, TypeScript, Tailwind CSS

**Infrastructure**
- Docker, GitHub Actions
- Vercel (Frontend), Railway (Backend)

---

## 🎬 Demo

**Live Demo:** [https://linkus-legal.vercel.app](링크)

**주요 기능:**
1. 계약서 위험도 자동 분석 (Heatmap)
2. 조항별 법적 근거 표시
3. AI 기반 수정 제안
4. 상황별 맞춤 법률 상담

<details>
<summary>📸 스크린샷 보기</summary>

![계약서 분석](screenshots/analysis.png)
![위험도 히트맵](screenshots/heatmap.png)

</details>

---

## 💡 Key Technical Challenges

### Challenge 1: 법률 도메인 특화 Hybrid Retrieval
**문제:**
- Semantic 검색만으로는 "근로기준법 제26조" 같은 정확한 조문 탐색 어려움

**해결:**
- Dense (벡터) + Sparse (BM25) 앙상블
- MMR로 검색 다양성 확보

**성과:**
- 조문 정확 매칭률 35% 향상
- 환각(Hallucination) 빈도 대폭 감소

### Challenge 2: ReAct 기반 유연한 워크플로우
**문제:**
- 입력 유형(계약서/상담/사례)별 분기 로직 복잡

**해결:**
- ReAct 패턴 도입 (LLM이 도구 동적 선택)
- Modular Tooling (각 기능 독립 에이전트화)

**성과:**
- 신규 도구 추가 시 기존 코드 변경 최소화

### Challenge 3: Grounded Generation Guardrail
**문제:**
- AI가 검색 근거 없이 임의 생성하는 리스크

**해결:**
- Source-Grounded Answer Gating (근거 검증)
- System Prompt Guardrail (법적 고지 강제)

**성과:**
- 비근거 답변 생성 차단

---

## 🚀 Quick Start

<details>
<summary>로컬 실행 가이드</summary>
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py

# Frontend
npm install
npm run dev
```
</details>

---

## 📝 Blog Posts

- [RAG 파이프라인 설계부터 프로덕션까지 - Linkus Legal 개발기](블로그링크)
- [법률 AI의 환각(Hallucination) 줄이기 - Hybrid Retrieval과 Guardrail 구현](블로그링크)

---

## 📄 License

MIT License


<p align="center">
  <sub>Built with ❤️ to help young workers stay safe</sub>
</p>