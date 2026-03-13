@echo off
REM 백엔드 서버 실행 스크립트 (Windows)

echo 🚀 Linkus Public RAG Backend 서버 시작...

REM 가상환경 활성화 (있는 경우)
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
    echo ✅ 가상환경 활성화됨
)

REM .env 파일 확인
if not exist .env (
    echo ⚠️  .env 파일이 없습니다. .env.example을 참고하여 생성하세요.
    pause
    exit /b 1
)

REM 서버 실행 (PORT 환경변수나 .env에서 지정 가능)
if defined PORT (
    echo ⚙️  사용 중인 포트: %PORT%
) else (
    echo ⚙️  기본 포트 8000 사용
)
python main.py

pause

