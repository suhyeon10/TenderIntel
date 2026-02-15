# Meta tensor 문제 해결을 위한 패키지 버전 수정 스크립트
# PowerShell 스크립트

Write-Host "=== Meta Tensor 문제 해결: 패키지 버전 수정 ===" -ForegroundColor Cyan

# venv 활성화 확인
if (-not $env:VIRTUAL_ENV) {
    Write-Host "[경고] venv가 활성화되지 않았습니다. venv를 먼저 활성화하세요." -ForegroundColor Yellow
    Write-Host "예: .\venv\Scripts\Activate.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "[1/4] 기존 패키지 제거 중..." -ForegroundColor Yellow
pip uninstall -y torch torchvision torchaudio transformers sentence-transformers accelerate

Write-Host "[2/4] CPU 전용 PyTorch 설치 중..." -ForegroundColor Yellow
pip install "torch==2.2.1" --index-url https://download.pytorch.org/whl/cpu

Write-Host "[3/4] transformers / sentence-transformers / accelerate 설치 중..." -ForegroundColor Yellow
pip install "transformers==4.40.2" "sentence-transformers==3.0.1" "accelerate==0.28.0"

Write-Host "[4/4] 설치된 버전 확인 중..." -ForegroundColor Yellow
python -c "import torch; import transformers; import sentence_transformers; import accelerate; print(f'torch: {torch.__version__}'); print(f'transformers: {transformers.__version__}'); print(f'sentence-transformers: {sentence_transformers.__version__}'); print(f'accelerate: {accelerate.__version__}')"

Write-Host "`n=== 완료! ===" -ForegroundColor Green
Write-Host "이제 .env 파일에 EMBEDDING_DEVICE=cpu 설정을 확인하세요." -ForegroundColor Cyan

