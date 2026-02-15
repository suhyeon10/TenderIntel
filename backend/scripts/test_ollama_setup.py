"""
Ollama 설정 확인 스크립트
친구 PC에서 Ollama가 제대로 설정되었는지 확인하는 용도
"""

import sys
import warnings
from pathlib import Path

# langchain-community의 Ollama Deprecated 경고 무시
warnings.filterwarnings("ignore", category=DeprecationWarning, module="langchain")

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

def test_ollama_setup():
    """Ollama 설정 확인"""
    print("=" * 60)
    print("Ollama 설정 확인")
    print("=" * 60)
    
    # 1. langchain-ollama 패키지 확인
    print("\n1. langchain-ollama 패키지 확인...")
    try:
        import langchain_ollama
        print("   ✅ langchain-ollama 설치됨")
    except ImportError:
        print("   ❌ langchain-ollama 설치 안 됨")
        print("   해결: pip install langchain-ollama")
        return False
    
    # 2. config 설정 확인
    print("\n2. 설정 확인...")
    try:
        from config import settings
        print(f"   LLM Provider: {settings.llm_provider}")
        print(f"   Ollama URL: {settings.ollama_base_url}")
        print(f"   Ollama Model: {settings.ollama_model}")
        print(f"   use_ollama: {settings.use_ollama}")
        
        if not settings.use_ollama:
            print("   ⚠️ use_ollama가 False입니다.")
            print("   해결: .env 파일에 LLM_PROVIDER=ollama 설정")
    except Exception as e:
        print(f"   ❌ 설정 로드 실패: {str(e)}")
        return False
    
    # 3. Ollama 서버 연결 확인
    print("\n3. Ollama 서버 연결 확인...")
    try:
        import httpx
        import asyncio
        
        async def check_ollama_server():
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(f"{settings.ollama_base_url}/api/tags")
                    if response.status_code == 200:
                        models_data = response.json()
                        available_models = [model.get("name", "") for model in models_data.get("models", [])]
                        print(f"   ✅ Ollama 서버 연결 성공")
                        print(f"   설치된 모델: {', '.join(available_models) if available_models else '(없음)'}")
                        
                        # 설정된 모델이 있는지 확인
                        model_name = settings.ollama_model.split(":")[0] if ":" in settings.ollama_model else settings.ollama_model
                        available_model_names = [name.split(":")[0] for name in available_models]
                        
                        if model_name in available_model_names:
                            print(f"   ✅ 설정된 모델 '{settings.ollama_model}' 설치됨")
                            return True
                        else:
                            print(f"   ❌ 설정된 모델 '{settings.ollama_model}' 없음")
                            print(f"   해결: ollama pull {settings.ollama_model}")
                            return False
                    else:
                        print(f"   ❌ Ollama 서버 응답 실패 (HTTP {response.status_code})")
                        return False
            except Exception as e:
                print(f"   ❌ Ollama 서버 연결 실패: {str(e)}")
                print(f"   해결: ollama serve 실행 확인")
                return False
        
        result = asyncio.run(check_ollama_server())
        if not result:
            return False
    except ImportError:
        print("   ⚠️ httpx가 없어서 서버 확인을 건너뜁니다.")
        print("   해결: pip install httpx")
    except Exception as e:
        print(f"   ❌ 서버 확인 중 오류: {str(e)}")
        return False
    
    # 4. 실제 LLM 호출 테스트
    print("\n4. LLM 호출 테스트...")
    # langchain-community 우선 사용 (think 파라미터 에러 방지)
    try:
        from langchain_community.llms import Ollama
        llm = Ollama(
            base_url=settings.ollama_base_url,
            model=settings.ollama_model
        )
        print("   langchain-community.llms.Ollama 사용")
    except ImportError:
        print("   ⚠️ langchain-community를 사용할 수 없습니다.")
        print("   langchain-ollama로 시도...")
        try:
            from langchain_ollama import OllamaLLM
            llm = OllamaLLM(
                base_url=settings.ollama_base_url,
                model=settings.ollama_model
            )
            print("   langchain-ollama.OllamaLLM 사용")
        except ImportError:
            print("   ❌ Ollama 지원 패키지가 설치되지 않았습니다.")
            return False
        except Exception as e:
            if "think" in str(e).lower():
                print("   ⚠️ langchain-ollama에서 think 파라미터 에러 발생.")
                print("   langchain-community로 재시도...")
                try:
                    from langchain_community.llms import Ollama
                    llm = Ollama(
                        base_url=settings.ollama_base_url,
                        model=settings.ollama_model
                    )
                    print("   langchain-community.llms.Ollama 사용 (fallback)")
                except Exception as e2:
                    print(f"   ❌ LLM 초기화 실패: {str(e2)}")
                    return False
            else:
                print(f"   ❌ LLM 초기화 실패: {str(e)}")
                return False
    
    try:
        # 간단한 테스트 프롬프트
        test_prompt = "한 줄로 답변: 안녕하세요"
        print(f"   테스트 프롬프트: '{test_prompt}'")
        print("   LLM 응답 대기 중...")
        
        response = llm.invoke(test_prompt)
        if response and len(response) > 0:
            print(f"   ✅ LLM 호출 성공!")
            print(f"   응답: {response[:100]}...")
            return True
        else:
            print("   ❌ LLM 응답이 비어있습니다")
            return False
    except Exception as e:
        print(f"   ❌ LLM 호출 실패: {str(e)}")
        print(f"   에러 타입: {type(e).__name__}")
        return False
    
    return True


if __name__ == "__main__":
    print("\n🚀 Ollama 설정 확인 시작\n")
    
    try:
        success = test_ollama_setup()
        
        print("\n" + "=" * 60)
        if success:
            print("✅ 모든 확인 완료! Ollama가 정상적으로 설정되었습니다.")
            print("\n이제 성능 테스트를 실행할 수 있습니다:")
            print("  python scripts/performance_test.py")
        else:
            print("❌ 일부 확인 실패. 위의 해결 방법을 참고하세요.")
        print("=" * 60)
    except KeyboardInterrupt:
        print("\n\n⚠️ 확인이 중단되었습니다.")
    except Exception as e:
        print(f"\n\n❌ 확인 중 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()

