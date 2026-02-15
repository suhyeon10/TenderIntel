@echo off
REM 배치 처리 실행 스크립트 (Windows)

set FOLDER=%~1
if "%FOLDER%"=="" set FOLDER=.\data\announcements

set EXTENSIONS=%~2
if "%EXTENSIONS%"=="" set EXTENSIONS=.pdf .txt

echo 🚀 배치 인입 시작
echo    폴더: %FOLDER%
echo    확장자: %EXTENSIONS%
echo.

cd /d "%~dp0\.."
python scripts\batch_ingest.py "%FOLDER%" --extensions %EXTENSIONS% --parallel

