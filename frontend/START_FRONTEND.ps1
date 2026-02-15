# RAG 프론트엔드 실행 스크립트
Write-Host "[시작] RAG 프론트엔드 실행 중..." -ForegroundColor Green
Set-Location $PSScriptRoot
python -m streamlit run streamlit_app.py

