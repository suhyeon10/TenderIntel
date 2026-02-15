# Meta Tensor 문제 해결 가이드

## 문제 원인
- PyTorch / transformers / sentence-transformers 버전 호환성 문제
- 모델이 "meta tensor" 상태로만 남아 실제 weight를 메모리에 로드하지 못함
- `SentenceTransformer`가 내부적으로 `.to(device)` 호출 시 에러 발생

## 해결 방법

### 1. 패키지 버전 수정 (필수)

**Windows (PowerShell):**
```powershell
# venv 활성화
.\venv\Scripts\Activate.ps1

# 스크립트 실행
.\fix_embedding_versions.ps1
```

**Linux/Mac:**
```bash
# venv 활성화
source venv/bin/activate

# 스크립트 실행
chmod +x fix_embedding_versions.sh
./fix_embedding_versions.sh
```

**수동 설치:**
```bash
# venv 활성화 후
pip uninstall -y torch torchvision torchaudio transformers sentence-transformers accelerate
pip install "torch==2.2.1" --index-url https://download.pytorch.org/whl/cpu
pip install "transformers==4.40.2" "sentence-transformers==3.0.1" "accelerate==0.28.0"
```

### 2. .env 파일 설정

`backend/.env` 파일에 다음 설정 추가:

```env
# 임베딩 관련 (meta tensor 문제 방지)
USE_LOCAL_EMBEDDING=true
LOCAL_EMBEDDING_MODEL=BAAI/bge-m3
EMBEDDING_DEVICE=cpu    # 중요: 반드시 cpu로 설정
```

### 3. 코드 확인

`backend/config.py`에서 `embedding_device` 기본값이 `"cpu"`로 설정되어 있는지 확인:
```python
embedding_device: Optional[str] = "cpu"  # 기본값: cpu
```

`backend/core/generator_v2.py`에서 device가 강제로 "cpu"로 설정되는지 확인:
```python
device = settings.embedding_device or os.getenv("EMBEDDING_DEVICE", "cpu")
if device != "cpu":
    device = "cpu"  # 강제로 cpu 사용
```

## 설치된 버전 확인

```bash
python -c "import torch; import transformers; import sentence_transformers; import accelerate; print(f'torch: {torch.__version__}'); print(f'transformers: {transformers.__version__}'); print(f'sentence-transformers: {sentence_transformers.__version__}'); print(f'accelerate: {accelerate.__version__}')"
```

**예상 출력:**
```
torch: 2.2.1
transformers: 4.40.2
sentence-transformers: 3.0.1
accelerate: 0.28.0
```

## 주의사항

1. **venv 활성화 필수**: 패키지 설치 전에 반드시 venv를 활성화하세요
2. **CPU 강제 사용**: meta tensor 문제를 완전히 회피하기 위해 GPU 사용하지 않음
3. **서버 재시작**: 패키지 설치 후 서버를 재시작하세요

## 문제가 계속되면

1. venv 재생성:
   ```bash
   # 기존 venv 삭제
   rm -rf venv  # Linux/Mac
   rmdir /s venv  # Windows
   
   # 새 venv 생성
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   .\venv\Scripts\Activate.ps1  # Windows
   
   # requirements.txt 설치
   pip install -r requirements.txt
   
   # 임베딩 패키지 재설치
   ./fix_embedding_versions.ps1  # 또는 .sh
   ```

2. 캐시 삭제:
   ```bash
   # HuggingFace 캐시 삭제
   rm -rf ~/.cache/huggingface
   ```

