@echo off
echo [시작] Streamlit 프론트엔드 실행 중...
echo [정보] 브라우저가 자동으로 열립니다.
echo [정보] 종료하려면 Ctrl+C를 누르세요.
echo.
cd /d %~dp0
python -m streamlit run streamlit_app.py --server.port 8501
pause

