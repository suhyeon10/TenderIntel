#!/bin/bash
# Meta tensor 문제 해결을 위한 패키지 버전 수정 스크립트
# Bash 스크립트 (Linux/Mac)

echo "=== Meta Tensor 문제 해결: 패키지 버전 수정 ==="

# venv 활성화 확인
if [ -z "$VIRTUAL_ENV" ]; then
    echo "[경고] venv가 활성화되지 않았습니다. venv를 먼저 활성화하세요."
    echo "예: source venv/bin/activate"
    exit 1
fi

echo "[1/4] 기존 패키지 제거 중..."
pip uninstall -y torch torchvision torchaudio transformers sentence-transformers accelerate

echo "[2/4] CPU 전용 PyTorch 설치 중..."
pip install "torch==2.2.1" --index-url https://download.pytorch.org/whl/cpu

echo "[3/4] transformers / sentence-transformers / accelerate 설치 중..."
pip install "transformers==4.40.2" "sentence-transformers==3.0.1" "accelerate==0.28.0"

echo "[4/4] 설치된 버전 확인 중..."
python -c "import torch; import transformers; import sentence_transformers; import accelerate; print(f'torch: {torch.__version__}'); print(f'transformers: {transformers.__version__}'); print(f'sentence-transformers: {sentence_transformers.__version__}'); print(f'accelerate: {accelerate.__version__}')"

echo ""
echo "=== 완료! ==="
echo "이제 .env 파일에 EMBEDDING_DEVICE=cpu 설정을 확인하세요."

