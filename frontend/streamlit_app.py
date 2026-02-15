"""
Streamlit 프론트엔드 (해커톤용)
간단한 Q&A 인터페이스
"""

import streamlit as st
import requests
import os
from pathlib import Path

# API 엔드포인트
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

st.set_page_config(
    page_title="RAG Q&A 시스템",
    page_icon="🤖",
    layout="wide"
)

st.title("🤖 RAG Q&A 시스템")
st.markdown("해커톤용 완전 무료 RAG 시스템 (Ollama + bge-m3 + Supabase/ChromaDB)")

# 사이드바
with st.sidebar:
    st.header("⚙️ 설정")
    
    # API 엔드포인트 설정
    api_url = st.text_input(
        "API URL",
        value=API_BASE_URL,
        help="백엔드 API 서버 주소"
    )
    
    st.markdown("---")
    st.markdown("### 📊 시스템 정보")
    st.markdown("""
    - **임베딩**: sentence-transformers (bge-m3)
    - **LLM**: Ollama (llama3)
    - **벡터 DB**: Supabase pgvector / ChromaDB
    """)

# 메인 영역
tab1, tab2, tab3 = st.tabs(["💬 Q&A", "📄 문서 업로드", "📊 상태 확인"])

# Q&A 탭
with tab1:
    st.header("질문하기")
    
    # 질문 예시
    st.markdown("### 💡 질문 예시")
    col1, col2, col3 = st.columns(3)
    
    example_questions = {
        "문서 분석": [
            "이 문서의 핵심 내용은?",
            "이 공고의 주요 목적은 무엇인가요?",
            "프로젝트 요약을 해주세요"
        ],
        "예산 및 기간": [
            "예산 범위는 얼마인가요?",
            "프로젝트 수행 기간은 얼마나 되나요?",
            "입찰 마감일은 언제인가요?"
        ],
        "기술 및 요구사항": [
            "필수 기술 스택은 무엇인가요?",
            "필요한 자격 요건은?",
            "제출해야 할 서류는 무엇인가요?"
        ],
        "견적서 생성": [
            "이 프로젝트에 대한 견적서를 작성해주세요",
            "예상 비용과 인력 구성은?",
            "견적서 초안을 만들어주세요"
        ],
        "팀 매칭": [
            "이 프로젝트에 적합한 팀은?",
            "필요한 기술을 가진 팀을 추천해주세요",
            "팀 매칭 점수는 어떻게 되나요?"
        ]
    }
    
    # 세션 상태 초기화
    if "pending_question" not in st.session_state:
        st.session_state.pending_question = None
    
    # 대기 중인 질문이 있으면 적용 (위젯 생성 전에 처리)
    if st.session_state.pending_question is not None:
        st.session_state.question_input = st.session_state.pending_question
        st.session_state.pending_question = None
    
    with col1:
        if st.button("📄 문서 분석", use_container_width=True, key="btn_doc"):
            st.session_state.pending_question = example_questions["문서 분석"][0]
            st.rerun()
        if st.button("💰 예산/기간", use_container_width=True, key="btn_budget"):
            st.session_state.pending_question = example_questions["예산 및 기간"][0]
            st.rerun()
    
    with col2:
        if st.button("🔧 기술 요구사항", use_container_width=True, key="btn_tech"):
            st.session_state.pending_question = example_questions["기술 및 요구사항"][0]
            st.rerun()
        if st.button("📝 견적서 생성", use_container_width=True, key="btn_estimate"):
            st.session_state.pending_question = example_questions["견적서 생성"][0]
            st.rerun()
    
    with col3:
        if st.button("👥 팀 매칭", use_container_width=True, key="btn_team"):
            st.session_state.pending_question = example_questions["팀 매칭"][0]
            st.rerun()
    
    st.markdown("---")
    
    # 질문 입력
    question = st.text_input(
        "질문을 입력하세요",
        placeholder="예: 이 문서의 핵심 내용은?",
        key="question_input"
    )
    
    # 추가 질문 예시 (접기/펼치기)
    with st.expander("📋 더 많은 질문 예시 보기"):
        for category, questions in example_questions.items():
            st.markdown(f"**{category}**")
            for idx, q in enumerate(questions):
                if st.button(f"💬 {q}", key=f"example_{category}_{idx}", use_container_width=True):
                    st.session_state.pending_question = q
                    st.rerun()
            st.markdown("")
    
    if st.button("질문하기", type="primary"):
        if not question:
            st.warning("질문을 입력해주세요.")
        else:
            with st.spinner("답변 생성 중..."):
                try:
                    # API 호출
                    response = requests.get(
                        f"{api_url}/api/v2/announcements/search",
                        params={"query": question, "limit": 5},
                        timeout=60
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        
                        st.success("답변 생성 완료!")
                        
                        # 답변 표시
                        if "answer" in data:
                            st.markdown("### 💡 답변")
                            st.markdown(data["answer"])
                        
                        # 관련 문서 표시
                        if "results" in data and data["results"]:
                            st.markdown("### 📚 관련 문서")
                            for i, result in enumerate(data["results"][:3], 1):
                                with st.expander(f"문서 {i}: {result.get('title', '제목 없음')}"):
                                    st.markdown(f"**내용**: {result.get('content', '')[:500]}...")
                                    st.markdown(f"**유사도**: {result.get('score', 0):.3f}")
                    else:
                        st.error(f"오류 발생: {response.status_code}")
                        st.json(response.json())
                        
                except requests.exceptions.RequestException as e:
                    st.error(f"API 연결 실패: {str(e)}")
                    st.info("백엔드 서버가 실행 중인지 확인하세요: `python -m uvicorn main:app --reload`")

# 문서 업로드 탭
with tab2:
    st.header("문서 업로드")
    
    uploaded_file = st.file_uploader(
        "PDF 파일을 업로드하세요",
        type=["pdf"],
        help="PDF 파일을 업로드하면 자동으로 인덱싱됩니다."
    )
    
    if uploaded_file is not None:
        st.info(f"파일: {uploaded_file.name} ({uploaded_file.size} bytes)")
        
        # 파일명에서 제목 추출 (확장자 제거)
        file_title = uploaded_file.name
        if file_title.endswith(".pdf"):
            file_title = file_title[:-4]
        elif file_title.endswith(".txt"):
            file_title = file_title[:-4]
        
        # 제목 표시
        title_input = st.text_input(
            "제목 (선택사항, 기본값: 파일명)",
            value=file_title,
            key="upload_title"
        )
        
        if st.button("업로드 및 인덱싱", type="primary"):
            with st.spinner("업로드 및 인덱싱 중..."):
                try:
                    # 파일을 BytesIO로 변환
                    from io import BytesIO
                    file_bytes = BytesIO(uploaded_file.getvalue())
                    
                    files = {"file": (uploaded_file.name, file_bytes, "application/pdf")}
                    data = {
                        "source": "streamlit_upload",
                        "external_id": uploaded_file.name,
                        "title": title_input or file_title
                    }
                    
                    response = requests.post(
                        f"{api_url}/api/v2/announcements/upload",
                        files=files,
                        data=data,
                        timeout=120
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        st.success("✅ 업로드 및 인덱싱 완료!")
                        st.json(result)
                    else:
                        st.error(f"오류 발생: {response.status_code}")
                        st.json(response.json())
                        
                except requests.exceptions.RequestException as e:
                    st.error(f"업로드 실패: {str(e)}")

# 상태 확인 탭
with tab3:
    st.header("시스템 상태")
    
    if st.button("상태 확인", type="primary"):
        try:
            # 헬스 체크
            response = requests.get(f"{api_url}/api/health", timeout=5)
            
            if response.status_code == 200:
                st.success("✅ 백엔드 서버 정상 작동 중")
                data = response.json()
                st.json(data)
            else:
                st.warning(f"⚠️ 서버 응답: {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            st.error(f"❌ 서버 연결 실패: {str(e)}")
            st.info("백엔드 서버를 실행하세요: `python -m uvicorn main:app --reload`")
    
    st.markdown("---")
    st.markdown("### 📝 사용 방법")
    st.markdown("""
    1. **문서 인덱싱**: `python backend/scripts/simple_ingest.py`
    2. **백엔드 실행**: `python -m uvicorn main:app --reload`
    3. **프론트엔드 실행**: `streamlit run frontend/streamlit_app.py`
    4. **질문하기**: Q&A 탭에서 질문 입력
    """)

