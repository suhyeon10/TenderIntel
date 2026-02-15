"""
GPU 사용 가능 여부 확인 스크립트
"""

import sys
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

def check_gpu():
    """GPU 상태 확인"""
    print("=" * 60)
    print("  GPU 사용 가능 여부 확인")
    print("=" * 60)
    
    try:
        import torch
        print(f"\n[OK] PyTorch 설치됨 (버전: {torch.__version__})")
        
        # CUDA 사용 가능 여부
        cuda_available = torch.cuda.is_available()
        print(f"\n{'='*60}")
        if cuda_available:
            print("[OK] CUDA 사용 가능!")
            print(f"   GPU 개수: {torch.cuda.device_count()}")
            for i in range(torch.cuda.device_count()):
                print(f"   GPU {i}: {torch.cuda.get_device_name(i)}")
                print(f"      메모리: {torch.cuda.get_device_properties(i).total_memory / 1024**3:.2f} GB")
        else:
            print("[X] CUDA 사용 불가")
            print("   CPU 모드로 실행됩니다.")
        print(f"{'='*60}")
        
        # 현재 device 확인
        if cuda_available:
            current_device = torch.cuda.current_device()
            print(f"\n현재 사용 중인 GPU: {current_device} ({torch.cuda.get_device_name(current_device)})")
        else:
            print("\n현재 사용 중인 device: CPU")
        
        # sentence-transformers에서 GPU 사용 가능 여부
        print(f"\n{'='*60}")
        print("sentence-transformers GPU 사용 테스트")
        print(f"{'='*60}")
        try:
            from sentence_transformers import SentenceTransformer
            print("[OK] sentence-transformers 설치됨")
            
            # 간단한 모델 로드 테스트
            print("\n테스트 모델 로드 중...")
            test_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2", device="cpu")
            print("[OK] CPU 모드 테스트 성공")
            
            if cuda_available:
                try:
                    test_model_gpu = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2", device="cuda")
                    print("[OK] GPU 모드 테스트 성공")
                    del test_model_gpu
                    torch.cuda.empty_cache()
                except Exception as e:
                    print(f"[WARNING] GPU 모드 테스트 실패: {str(e)}")
                    print("   CPU 모드로 폴백됩니다.")
            
            del test_model
        except ImportError:
            print("[X] sentence-transformers가 설치되지 않았습니다.")
            print("   pip install sentence-transformers")
        except Exception as e:
            print(f"[WARNING] 테스트 중 오류: {str(e)}")
        
        print(f"\n{'='*60}")
        print("권장 사항")
        print(f"{'='*60}")
        if cuda_available:
            print("[OK] GPU가 감지되었습니다!")
            print("   - 임베딩 생성 속도가 크게 향상됩니다.")
            print("   - 배치 처리 시 특히 효과적입니다.")
        else:
            print("[TIP] GPU를 사용하려면:")
            print("   1. NVIDIA GPU가 설치되어 있는지 확인")
            print("   2. CUDA 드라이버 설치 확인")
            print("   3. PyTorch CUDA 버전 설치:")
            print("      pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118")
        
    except ImportError:
        print("[X] PyTorch가 설치되지 않았습니다.")
        print("   pip install torch")
    except Exception as e:
        print(f"[X] 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    check_gpu()

