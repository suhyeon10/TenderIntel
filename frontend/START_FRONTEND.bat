@echo off
echo [시작] RAG 프론트엔드 실행 중...
cd /d %~dp0
python -m streamlit run streamlit_app.py
pause

