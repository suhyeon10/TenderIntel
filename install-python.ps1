# Python 설치 스크립트 (Windows)

Write-Host "Python 설치 가이드" -ForegroundColor Green
Write-Host "===================" -ForegroundColor Green
Write-Host ""

# Python 설치 확인
Write-Host "1. Python 설치 확인 중..." -ForegroundColor Yellow
$pythonVersion = python --version 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Python이 이미 설치되어 있습니다: $pythonVersion" -ForegroundColor Green
    exit 0
}

Write-Host "❌ Python이 설치되어 있지 않습니다." -ForegroundColor Red
Write-Host ""

# winget 확인
Write-Host "2. winget 확인 중..." -ForegroundColor Yellow
$wingetVersion = winget --version 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ winget이 사용 가능합니다." -ForegroundColor Green
    Write-Host ""
    Write-Host "winget으로 Python을 설치하시겠습니까? (Y/N)" -ForegroundColor Cyan
    $response = Read-Host
    
    if ($response -eq "Y" -or $response -eq "y") {
        Write-Host "Python 3.12 설치 중..." -ForegroundColor Yellow
        winget install Python.Python.3.12
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Python 설치 완료!" -ForegroundColor Green
            Write-Host ""
            Write-Host "⚠️  새 터미널을 열고 다음 명령어로 확인하세요:" -ForegroundColor Yellow
            Write-Host "   python --version" -ForegroundColor Cyan
        } else {
            Write-Host "❌ 설치 실패. 수동 설치를 진행하세요." -ForegroundColor Red
        }
    }
} else {
    Write-Host "❌ winget이 사용 불가능합니다." -ForegroundColor Red
    Write-Host ""
    Write-Host "다음 방법 중 하나를 선택하세요:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "방법 1: Microsoft Store" -ForegroundColor Cyan
    Write-Host "  1. Microsoft Store 열기" -ForegroundColor White
    Write-Host "  2. 'Python 3.12' 검색" -ForegroundColor White
    Write-Host "  3. 설치 버튼 클릭" -ForegroundColor White
    Write-Host ""
    Write-Host "방법 2: 공식 웹사이트" -ForegroundColor Cyan
    Write-Host "  1. https://www.python.org/downloads/ 접속" -ForegroundColor White
    Write-Host "  2. 최신 버전 다운로드" -ForegroundColor White
    Write-Host "  3. 설치 시 'Add Python to PATH' 체크!" -ForegroundColor Yellow
    Write-Host ""
    
    # 브라우저로 Python 다운로드 페이지 열기
    Write-Host "Python 다운로드 페이지를 열까요? (Y/N)" -ForegroundColor Cyan
    $openBrowser = Read-Host
    
    if ($openBrowser -eq "Y" -or $openBrowser -eq "y") {
        Start-Process "https://www.python.org/downloads/"
    }
}

Write-Host ""
Write-Host "설치 완료 후 새 터미널을 열고 'python --version'으로 확인하세요." -ForegroundColor Yellow

