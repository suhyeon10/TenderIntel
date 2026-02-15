"""
Generator v2 - 실전형
임베딩 생성 및 LLM 분석
"""

from typing import List, Dict, Any, Optional
import os
import json
import warnings
from config import settings

# langchain-community의 Ollama Deprecated 경고 무시
warnings.filterwarnings("ignore", category=DeprecationWarning, module="langchain")
warnings.filterwarnings("ignore", message=".*Ollama.*deprecated.*", category=DeprecationWarning)
warnings.filterwarnings("ignore", message=".*LangChainDeprecationWarning.*")

# 로컬 임베딩 모델 (선택사항)
_local_embedding_model = None
_ollama_llm = None

def _get_local_embedding_model():
    """
    로컬 임베딩 모델 지연 로드
    
    ⚠️ 중요: meta tensor 문제를 피하기 위해 .to(device) 절대 사용 금지
    SentenceTransformer를 처음부터 target device로 직접 로드해야 함
    """
    global _local_embedding_model
    if _local_embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            import torch
            
            print(f"[로딩] 로컬 임베딩 모델: {settings.local_embedding_model}")
            
            # Windows 경로 문제 해결: Hugging Face 캐시 경로를 짧은 경로로 설정
            import platform
            cache_dir = None
            if platform.system() == "Windows":
                # Windows에서 경로 길이 제한 문제 해결
                # 가능한 한 짧은 경로 사용 (C:\hf_cache)
                # 환경변수로 지정된 경로가 있으면 우선 사용
                cache_dir = os.getenv("HF_HOME") or os.getenv("TRANSFORMERS_CACHE")
                
                if not cache_dir:
                    # 짧은 경로 우선 시도: C:\hf_cache
                    short_cache = r"C:\hf_cache"
                    try:
                        os.makedirs(short_cache, exist_ok=True)
                        # 경로 접근 가능한지 테스트
                        test_file = os.path.join(short_cache, ".test")
                        with open(test_file, 'w') as f:
                            f.write("test")
                        os.remove(test_file)
                        cache_dir = short_cache
                        print(f"[Windows] 짧은 캐시 경로 사용: {cache_dir}")
                    except (OSError, PermissionError) as e:
                        # C:\hf_cache 접근 불가 시 사용자 홈 디렉토리 사용
                        cache_dir = os.path.join(os.path.expanduser("~"), ".cache", "hf")
                        print(f"[Windows] C:\\hf_cache 접근 불가, 대체 경로 사용: {cache_dir}")
                        print(f"[Windows] 경고: {str(e)}")
                
                # 환경변수 설정
                os.makedirs(cache_dir, exist_ok=True)
                os.environ["HF_HOME"] = cache_dir
                os.environ["TRANSFORMERS_CACHE"] = cache_dir
                os.environ["HF_DATASETS_CACHE"] = cache_dir
                print(f"[Windows] Hugging Face 캐시 경로 설정: {cache_dir}")
            
            # meta tensor 문제 해결: CPU로 직접 로드 (GPU 이동 시도 안 함)
            # bge-m3 모델은 meta tensor 상태로 초기화되므로 .to() 호출 시 에러 발생
            # 따라서 처음부터 CPU로 로드하고 GPU 이동은 하지 않음
            # config.py의 embedding_device 또는 환경변수 EMBEDDING_DEVICE 사용, 없으면 "cpu" 기본값
            device = settings.embedding_device or os.getenv("EMBEDDING_DEVICE", "cpu")
            if device != "cpu":
                print(f"[경고] meta tensor 문제 방지를 위해 device를 cpu로 강제 변경: {device} -> cpu")
                device = "cpu"
            
            if torch.cuda.is_available():
                device_name = torch.cuda.get_device_name(0)
                print(f"[GPU] CUDA 사용 가능하지만 meta tensor 문제 방지를 위해 CPU 사용: {device_name}")
            else:
                print(f"[CPU] CUDA 사용 불가, CPU 사용")
            
            try:
                # 첫 번째 시도: CPU로 직접 로드 (trust_remote_code=True로 안전하게)
                print(f"[로딩] CPU로 모델 직접 로드 중 (trust_remote_code=True)...")
                
                # 모델 로드 파라미터 준비
                model_kwargs = {
                    "device": device,  # 처음부터 CPU로 로드
                    "trust_remote_code": True  # bge-m3 모델에 필요할 수 있음
                }
                
                # Windows에서 캐시 경로 명시적으로 지정
                if platform.system() == "Windows" and cache_dir:
                    model_kwargs["cache_folder"] = cache_dir
                    print(f"[Windows] 모델 캐시 폴더 지정: {cache_dir}")
                
                _local_embedding_model = SentenceTransformer(
                    settings.local_embedding_model,
                    **model_kwargs
                )
                print(f"[완료] 로컬 임베딩 모델 로드 완료 (device: {device})")
                # ⚠️ 주의: .to(device) 호출 절대 금지 - meta tensor 에러 발생
                    
            except Exception as e:
                error_msg = str(e)
                error_type = type(e).__name__
                print(f"[에러] 모델 로딩 실패: {error_type}: {error_msg}")
                
                # Windows 경로 오류인 경우 특별 처리
                if platform.system() == "Windows" and ("Invalid argument" in error_msg or "Errno 22" in error_msg):
                    print(f"[Windows 경로 오류] 재시도 중...")
                    try:
                        # 캐시 폴더를 명시적으로 지정하여 재시도
                        retry_kwargs = {
                            "device": "cpu",
                            "trust_remote_code": True
                        }
                        if cache_dir:
                            retry_kwargs["cache_folder"] = cache_dir
                        
                        print(f"[재시도] CPU로 모델 재로드 중 (cache_folder 지정)...")
                        _local_embedding_model = SentenceTransformer(
                            settings.local_embedding_model,
                            **retry_kwargs
                        )
                        print(f"[완료] 로컬 임베딩 모델 재로드 완료 (device: cpu)")
                        # ⚠️ 주의: .to(device) 호출 절대 금지
                    except Exception as retry_e:
                        # 최종 시도: 캐시 없이 로드 시도
                        print(f"[최종 시도] 캐시 없이 로드 시도 중...: {str(retry_e)}")
                        try:
                            _local_embedding_model = SentenceTransformer(
                                settings.local_embedding_model,
                                device="cpu",
                                trust_remote_code=True,
                                cache_folder=None  # 캐시 사용 안 함
                            )
                            print(f"[완료] 로컬 임베딩 모델 최종 로드 완료 (캐시 없음)")
                        except Exception as final_e:
                            # 모든 시도 실패
                            raise Exception(
                                f"모델 로딩 실패 (모든 시도 실패):\n"
                                f"원본 오류: {error_msg}\n"
                                f"재시도 오류: {str(retry_e)}\n"
                                f"최종 오류: {str(final_e)}\n\n"
                                f"[해결 방법]\n"
                                f"1. Hugging Face 캐시 삭제: rmdir /s /q \"%USERPROFILE%\\.cache\\huggingface\"\n"
                                f"2. 짧은 캐시 경로 사용: set HF_HOME=C:\\hf_cache\n"
                                f"3. 서버 재시작 후 재시도"
                            )
                # 에러 발생 시 재시도 (meta tensor 오류)
                elif "meta tensor" in error_msg.lower() or "to_empty" in error_msg.lower():
                    print(f"[경고] 모델 로딩 에러 발생 (meta tensor), 재시도 중...: {str(e)}")
                    try:
                        # trust_remote_code와 함께 CPU로 재로드 시도
                        print(f"[재시도] CPU로 모델 재로드 중 (trust_remote_code=True)...")
                        _local_embedding_model = SentenceTransformer(
                            settings.local_embedding_model,
                            device="cpu",
                            trust_remote_code=True
                        )
                        print(f"[완료] 로컬 임베딩 모델 재로드 완료 (device: cpu)")
                        # ⚠️ 주의: .to(device) 호출 절대 금지
                            
                    except Exception as retry_e:
                        # 최종 시도: CPU로만 로드 (안전 모드)
                        print(f"[최종 시도] CPU로만 로드 중...: {str(retry_e)}")
                        _local_embedding_model = SentenceTransformer(
                            settings.local_embedding_model,
                            trust_remote_code=True,
                            device="cpu"
                        )
                        print(f"[완료] 로컬 임베딩 모델 최종 로드 완료 (device: cpu)")
                        # ⚠️ 주의: .to(device) 호출 절대 금지
                else:
                    raise
        except ImportError:
            raise ImportError("sentence-transformers가 설치되지 않았습니다. pip install sentence-transformers")
    return _local_embedding_model

def _get_ollama_llm():
    """Ollama LLM 지연 로드"""
    global _ollama_llm
    if _ollama_llm is None:
        # langchain-community를 우선 사용 (think 파라미터 에러 방지)
        # Deprecation 경고는 이미 필터링됨
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", category=DeprecationWarning)
            warnings.filterwarnings("ignore", message=".*Ollama.*deprecated.*")
            try:
                from langchain_community.llms import Ollama
                print(f"[연결] Ollama LLM: {settings.ollama_base_url} (모델: {settings.ollama_model})")
                _ollama_llm = Ollama(
                    base_url=settings.ollama_base_url,
                    model=settings.ollama_model,
                    temperature=settings.llm_temperature
                    # model_kwargs는 langchain-community의 Ollama에서 지원하지 않음
                )
                print("[완료] Ollama LLM 연결 완료 (langchain-community)")
            except ImportError:
                try:
                    # 대안: langchain-ollama 사용 (think 파라미터 에러 가능)
                    from langchain_ollama import OllamaLLM
                    print(f"[연결] Ollama LLM: {settings.ollama_base_url} (모델: {settings.ollama_model})")
                    print("[경고] langchain-ollama 사용 중 - think 파라미터 에러가 발생할 수 있습니다.")
                    _ollama_llm = OllamaLLM(
                        base_url=settings.ollama_base_url,
                        model=settings.ollama_model,
                        temperature=settings.llm_temperature
                    )
                    print("[완료] Ollama LLM 연결 완료 (langchain-ollama)")
                except ImportError:
                    raise ImportError("Ollama 지원이 설치되지 않았습니다. pip install langchain-community 또는 pip install langchain-ollama")
                except Exception as e:
                    if "think" in str(e).lower():
                        print("[경고] langchain-ollama에서 think 파라미터 에러 발생. langchain-community로 재시도...")
                        with warnings.catch_warnings():
                            warnings.filterwarnings("ignore", category=DeprecationWarning)
                            warnings.filterwarnings("ignore", message=".*Ollama.*deprecated.*")
                            from langchain_community.llms import Ollama
                            _ollama_llm = Ollama(
                                base_url=settings.ollama_base_url,
                                model=settings.ollama_model,
                                temperature=settings.llm_temperature
                            )
                        print("[완료] Ollama LLM 연결 완료 (langchain-community, fallback)")
                    else:
                        raise Exception(f"Ollama 연결 실패: {str(e)}\n[팁] Ollama가 실행 중인지 확인하세요: ollama serve")
            except Exception as e:
                raise Exception(f"Ollama 연결 실패: {str(e)}\n[팁] Ollama가 실행 중인지 확인하세요: ollama serve")
    return _ollama_llm


class LLMGenerator:
    """LLM 생성기 - 임베딩 및 분석 (Groq 기반)"""
    
    def __init__(self, model: Optional[str] = None):
        # 로컬 임베딩 사용 가능 여부 확인
        try:
            from sentence_transformers import SentenceTransformer  # noqa: F401
            settings.use_local_embedding = True
            _local_embedding_available = True
        except ImportError:
            _local_embedding_available = False
            settings.use_local_embedding = False
            print("[경고] sentence-transformers가 설치되지 않았습니다.")
            print("[해결] Windows Long Path를 활성화한 후 재시작하세요:")
            print("   관리자 PowerShell: New-ItemProperty -Path \"HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem\" -Name \"LongPathsEnabled\" -Value 1 -PropertyType DWORD -Force")
            raise ImportError("sentence-transformers가 필요합니다. Windows Long Path를 활성화하고 재시작한 후 pip install sentence-transformers를 실행하세요.")
        
        # LLM Provider에 따라 클라이언트 초기화 (Ollama 또는 Groq)
        self.use_local_embedding = settings.use_local_embedding
        
        # settings에서 use_ollama와 use_groq 확인 (config.py에서 자동 설정됨)
        if settings.use_ollama:
            # Ollama 사용
            self.use_groq = False
            self.use_ollama = True
            self.client = None  # Ollama는 필요할 때 지연 로드
            self.model = model or settings.ollama_model or "mistral"
            self.llm_model = self.model
            print(f"[Ollama] LLM 설정 완료 (모델: {self.model})")
        elif settings.use_groq:
            # Groq 사용
            self.use_groq = True
            self.use_ollama = False
            api_key = os.environ.get("GROQ_API_KEY") or settings.groq_api_key
            
            # 디버깅: 어떤 키가 사용되는지 확인
            if api_key:
                masked_key = api_key[:8] + "..." + api_key[-8:] if len(api_key) > 16 else "***"
                print(f"[generator_v2] GROQ_API_KEY 로드됨: {masked_key} (길이: {len(api_key)})")
                print(f"[generator_v2] os.environ.get('GROQ_API_KEY'): {os.environ.get('GROQ_API_KEY')[:8] + '...' if os.environ.get('GROQ_API_KEY') and len(os.environ.get('GROQ_API_KEY')) > 8 else 'None'}")
                print(f"[generator_v2] settings.groq_api_key: {settings.groq_api_key[:8] + '...' if settings.groq_api_key and len(settings.groq_api_key) > 8 else 'None'}")
            else:
                print("[generator_v2] ⚠️ GROQ_API_KEY가 설정되지 않았습니다!")
            
            if not api_key:
                raise RuntimeError(
                    "GROQ_API_KEY가 환경변수에 설정되지 않았습니다. "
                    ".env 파일에 GROQ_API_KEY=your_key를 추가하거나 환경변수로 설정하세요."
                )
            
            try:
                from groq import Groq
                self.client = Groq(api_key=api_key)
                
                # 기본 모델: 환경변수 > settings > 하드코딩
                self.model = (
                    model
                    or os.environ.get("GROQ_MODEL")
                    or getattr(settings, "groq_model", None)
                    or "llama-3.3-70b-versatile"
                )
                # 혹시 남아있는 옛 코드 호환용
                self.llm_model = self.model
                
                print(f"[Groq] 클라이언트 초기화 완료 (모델: {self.model})")
            except ImportError:
                raise ImportError("groq 패키지가 설치되지 않았습니다. pip install groq 를 실행하세요.")
            except Exception as e:
                raise RuntimeError(f"Groq 클라이언트 초기화 실패: {str(e)}")
        else:
            # 기본값: Groq 사용 (하위 호환성)
            self.use_groq = True
            self.use_ollama = False
            api_key = os.environ.get("GROQ_API_KEY") or settings.groq_api_key
            if not api_key:
                raise RuntimeError(
                    "GROQ_API_KEY가 환경변수에 설정되지 않았습니다. "
                    ".env 파일에 GROQ_API_KEY=your_key를 추가하거나 환경변수로 설정하세요."
                )
            
            try:
                from groq import Groq
                self.client = Groq(api_key=api_key)
                self.model = model or settings.groq_model or "llama-3.3-70b-versatile"
                self.llm_model = self.model
                print(f"[Groq] 클라이언트 초기화 완료 (모델: {self.model})")
            except ImportError:
                raise ImportError("groq 패키지가 설치되지 않았습니다. pip install groq 를 실행하세요.")
            except Exception as e:
                raise RuntimeError(f"Groq 클라이언트 초기화 실패: {str(e)}")
        
        # 벡터 DB 선택: Supabase가 연결되어 있으면 우선 사용
        llm_name = "Ollama" if self.use_ollama else "Groq"
        if settings.supabase_url:
            settings.use_chromadb = False
            print(f"[시스템] {llm_name} LLM + 무료 스택 사용")
            print(f"   - LLM: {llm_name} ({self.model})")
            print(f"   - 벡터 DB: Supabase pgvector (연결됨)")
            print(f"   - 임베딩: 로컬 (sentence-transformers)")
        elif not settings.use_chromadb:
            # Supabase도 없고 ChromaDB도 명시 안 했으면 ChromaDB 기본 사용
            settings.use_chromadb = True
            print(f"[시스템] {llm_name} LLM + 무료 스택 사용")
            print(f"   - LLM: {llm_name} ({self.model})")
            print(f"   - 벡터 DB: ChromaDB (로컬)")
            print(f"   - 임베딩: 로컬 (sentence-transformers)")
        else:
            print(f"[시스템] {llm_name} LLM + 무료 스택 사용")
            print(f"   - LLM: {llm_name} ({self.model})")
            print(f"   - 벡터 DB: ChromaDB (로컬)")
            print(f"   - 임베딩: 로컬 (sentence-transformers)")
        self.disable_llm = settings.disable_llm
        self.use_openai = False       # OpenAI 사용 안 함
        self.embedding_model = settings.local_embedding_model  # 로컬 임베딩 모델명 (호환성)
        
        self.llm_temperature = settings.llm_temperature
    
    def embed(self, texts: List[str], model_type: str = "doc") -> List[List[float]]:
        """
        텍스트 리스트 → 임베딩 벡터 리스트
        
        Args:
            texts: 텍스트 리스트
            model_type: 모델 타입 ("doc" 또는 "company")
                - "doc": 문서 임베딩 (공고문용, BAAI/bge-m3 권장)
                - "company": 기업 임베딩 (팀/기업용, multilingual-e5-large 등)
        
        Returns:
            임베딩 벡터 리스트
        """
        if not texts:
            return []
        
        # 로컬 임베딩 모델 사용 (무료)
        if self.use_local_embedding:
            try:
                model = _get_local_embedding_model()
                batch_size = min(64, len(texts))  # 최대 64개씩 배치 처리
                # Windows에서 tqdm 진행 표시줄이 sys.stderr.flush() 오류를 발생시킬 수 있으므로 항상 비활성화
                # 진행 표시줄은 성능에 영향을 주지 않으므로 안정성을 위해 비활성화
                embeddings = model.encode(
                    texts,
                    convert_to_numpy=True,
                    show_progress_bar=False,  # Windows 오류 방지를 위해 항상 False
                    batch_size=batch_size,
                    normalize_embeddings=True,
                )
                return embeddings.tolist()
            except Exception as e:
                error_msg = str(e)
                error_type = type(e).__name__
                import platform
                
                # Windows 경로 오류인 경우 상세 정보 추가
                if platform.system() == "Windows" and ("Invalid argument" in error_msg or "Errno 22" in error_msg):
                    import traceback
                    full_traceback = traceback.format_exc()
                    
                    # 현재 캐시 경로 확인
                    current_cache = os.getenv("HF_HOME") or os.getenv("TRANSFORMERS_CACHE") or "기본값 사용 중"
                    
                    raise Exception(
                        f"로컬 임베딩 생성 실패 (Windows 경로 오류): {error_msg}\n"
                        f"오류 타입: {error_type}\n"
                        f"현재 캐시 경로: {current_cache}\n"
                        f"가능한 원인:\n"
                        f"  1. Hugging Face 캐시 경로가 너무 깁니다 (260자 제한)\n"
                        f"  2. 모델 파일 손상\n"
                        f"  3. 파일 시스템 권한 문제\n"
                        f"해결 방법:\n"
                        f"  1. Hugging Face 캐시 삭제:\n"
                        f"     rmdir /s /q \"%USERPROFILE%\\.cache\\huggingface\"\n"
                        f"     rmdir /s /q \"C:\\hf_cache\" (있는 경우)\n"
                        f"  2. 짧은 캐시 경로 설정 (환경변수):\n"
                        f"     set HF_HOME=C:\\hf_cache\n"
                        f"     set TRANSFORMERS_CACHE=C:\\hf_cache\n"
                        f"  3. 서버 재시작 후 재시도\n"
                        f"상세 오류:\n{full_traceback}"
                    )
                else:
                    raise Exception(f"로컬 임베딩 생성 실패: {error_msg} (타입: {error_type})")
        
        # 그 외(원격 임베딩)는 현재 지원하지 않음
        raise RuntimeError(
            "현재 설정에서는 로컬 임베딩만 지원합니다. "
            "settings.use_local_embedding=True 상태에서 sentence-transformers를 사용하세요."
        )
    
    def embed_one(self, text: str, model_type: str = "doc") -> List[float]:
        """단일 텍스트 임베딩"""
        return self.embed([text], model_type=model_type)[0]
    
    def generate_content(
        self,
        messages: List[Dict[str, Any]],
        tools: Optional[List[Dict[str, Any]]] = None,
        tool_choice: Optional[Any] = None,
        temperature: float = None,
        max_tokens: int = 2048,
    ):
        """
        OpenAI ChatCompletion과 거의 같은 느낌으로 래핑.
        
        Args:
            messages: [{"role": "system"/"user"/"assistant", "content": "..."}]
            tools: 도구 목록 (선택사항)
            tool_choice: 도구 선택 옵션 (선택사항)
            temperature: 온도 설정 (기본값: self.llm_temperature)
            max_tokens: 최대 토큰 수
        
        Returns:
            Groq ChatCompletion 응답 객체
        """
        if self.disable_llm:
            raise ValueError("LLM이 비활성화되어 있습니다.")
        
        if not self.client:
            raise ValueError("Groq 클라이언트가 초기화되지 않았습니다.")
        
        params: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature if temperature is not None else self.llm_temperature,
            "max_tokens": max_tokens,
        }
        
        # Groq는 tools/tool_choice를 지원할 수 있으므로 전달 (지원 여부는 Groq 문서 확인 필요)
        if tools is not None:
            params["tools"] = tools
        if tool_choice is not None:
            params["tool_choice"] = tool_choice
        
        response = self.client.chat.completions.create(**params)
        return response
    
    @staticmethod
    def get_text(response) -> str:
        """
        단순 텍스트 응답이 필요할 때 편하게 꺼내 쓰는 헬퍼
        
        Args:
            response: Groq ChatCompletion 응답 객체
        
        Returns:
            응답 텍스트
        """
        return response.choices[0].message.content
    
    async def generate(self, prompt: str, system_role: str = "너는 유능한 법률 AI야.", max_output_tokens: Optional[int] = None) -> str:
        """
        간단한 프롬프트 생성 (기존 코드 호환성)
        
        Args:
            prompt: 사용자 프롬프트
            system_role: 시스템 역할
            max_output_tokens: 최대 출력 토큰 수 (Plain 모드 최적화용, Ollama만 지원)
        
        Returns:
            생성된 텍스트
        """
        if self.disable_llm:
            return "LLM이 비활성화되어 있습니다."
        
        # Ollama 사용 시
        if self.use_ollama:
            import asyncio
            from config import settings
            
            # Ollama LLM 가져오기 (지연 로드)
            llm = _get_ollama_llm()
            
            # Plain 모드 최적화: 출력 토큰 제한을 프롬프트에 명시
            # (langchain-community의 Ollama는 model_kwargs를 지원하지 않으므로 프롬프트로 제한)
            output_limit_note = ""
            if max_output_tokens is not None:
                # 약 200토큰 = 500자 정도로 제한
                output_limit_note = f"\n\n⚠️ 중요: 답변은 반드시 {max_output_tokens}토큰 이내(약 {max_output_tokens * 2.5:.0f}자)로 매우 간결하게 작성하세요."
            
            # 시스템 프롬프트와 사용자 프롬프트 결합
            full_prompt = f"{system_role}{output_limit_note}\n\n{prompt}" if system_role else f"{prompt}{output_limit_note}"
            
            try:
                # Ollama 호출을 비동기로 처리
                response_text = await asyncio.wait_for(
                    asyncio.to_thread(llm.invoke, full_prompt),
                    timeout=settings.ollama_timeout
                )
                return response_text
            except asyncio.TimeoutError:
                raise TimeoutError(f"Ollama LLM 호출이 타임아웃되었습니다 ({settings.ollama_timeout}초 초과)")
            except Exception as e:
                raise RuntimeError(f"Ollama LLM 호출 실패: {str(e)}")
        
        # Groq 사용 시
        elif self.use_groq:
            messages = [
                {"role": "system", "content": system_role},
                {"role": "user", "content": prompt}
            ]
            
            response = self.generate_content(messages=messages)
            return self.get_text(response)
        
        # 기본값: Groq로 fallback (하위 호환성)
        else:
            messages = [
                {"role": "system", "content": system_role},
                {"role": "user", "content": prompt}
            ]
            
            response = self.generate_content(messages=messages)
            return self.get_text(response)
    
    def analyze_announcement(
        self,
        text: str,
        seed_meta: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        공고문 구조화 분석 (LLM, Groq 사용)
        
        Args:
            text: 공고 본문 텍스트
            seed_meta: 정규식으로 추출한 초기 메타데이터
        
        Returns:
            구조화된 분석 결과
        """
        if seed_meta is None:
            seed_meta = {}
        
        # 텍스트 길이 제한 (토큰 절약)
        text_preview = text[:8000] if len(text) > 8000 else text
        
        messages = [
            {
                "role": "system",
                "content": """당신은 공공입찰 공고 분석 전문가입니다.
주어진 공고문에서 핵심 정보를 정확하게 추출하여 JSON 형식으로 반환하세요.

필수 필드:
- project_name: 프로젝트명
- budget_min: 최소 예산 (숫자)
- budget_max: 최대 예산 (숫자)
- duration_months: 수행 기간 (개월, 숫자)
- essential_skills: 필수 기술 스택 (배열)
- preferred_skills: 우대 기술 스택 (배열)
- submission_docs: 제출 서류 목록 (배열)
- summary: 공고 요약 (200자 이내)
- deadline: 입찰 마감일 (YYYY-MM-DD 형식)

주의사항:
- 공고문에 명시된 내용만 추출
- 추측하지 말고, 정보가 없으면 null 또는 빈 배열
- 예산은 원 단위 숫자로 변환 (억→100000000, 만원→10000)
- JSON 형식만 반환 (설명 없이)"""
            },
            {
                "role": "user",
                "content": f"""초기 메타데이터 힌트:
{json.dumps(seed_meta, ensure_ascii=False)}

공고문:
{text_preview}

위 정보를 바탕으로 구조화된 분석 결과를 JSON으로 반환하세요."""
            }
        ]
        
        # LLM 비활성화 모드 (개발/테스트용 - 비용 절감)
        if self.disable_llm:
            print("[경고] LLM 분석이 비활성화되어 있습니다. 더미 데이터를 반환합니다.")
            return {
                "project_name": seed_meta.get("title", "분석 비활성화"),
                "budget_min": seed_meta.get("budget_min"),
                "budget_max": seed_meta.get("budget_max"),
                "duration_months": None,
                "essential_skills": [],
                "preferred_skills": [],
                "submission_docs": [],
                "summary": "LLM 분석이 비활성화되어 있습니다. 설정에서 DISABLE_LLM=false로 변경하세요.",
                "deadline": seed_meta.get("end_date")
            }
        
        # Groq 사용
        if not hasattr(self, "client") or self.client is None:
            raise ValueError("Groq LLM 클라이언트가 초기화되지 않았습니다.")
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=self.llm_temperature,
            )
            
            result_text = response.choices[0].message.content
            result = json.loads(result_text) if result_text else {}
            
            return result
        except json.JSONDecodeError as e:
            print(f"JSON 파싱 오류: {str(e)}")
            return {
                "project_name": "분석 실패",
                "summary": "LLM 분석 중 JSON 파싱 오류가 발생했습니다."
            }
        except Exception as e:
            print(f"LLM 분석 오류: {str(e)}")
            return {
                "project_name": "분석 실패",
                "summary": f"오류: {str(e)}"
            }
    
    def generate_matching_rationale(
        self,
        team_data: Dict[str, Any],
        requirements: Dict[str, Any]
    ) -> str:
        """
        팀 추천 사유 생성 (Groq 사용)
        """
        prompt = f"""다음 팀이 프로젝트에 적합한 이유를 3가지로 간결하게 요약하세요:

[프로젝트 요구사항]
- 필수 기술: {', '.join(requirements.get('essential_skills', []))}
- 우대 기술: {', '.join(requirements.get('preferred_skills', []))}
- 예산: {requirements.get('budget_range', '미정')}
- 기간: {requirements.get('duration', '미정')}

[팀 정보]
- 이름: {team_data.get('name', 'Unknown')}
- 기술: {', '.join(team_data.get('skills', []))}
- 경력: {team_data.get('experience_years', 0)}년
- 평점: {team_data.get('rating', 0)}/5.0

출력 형식 (번호 없이):
✓ [강점 1]
✓ [강점 2]
✓ [강점 3]
"""
        
        if self.disable_llm:
            return "LLM이 비활성화되어 있습니다. 설정에서 DISABLE_LLM=false로 변경하세요."
        
        if not hasattr(self, "client") or self.client is None:
            raise ValueError("Groq LLM 클라이언트가 초기화되지 않았습니다.")
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "당신은 프로젝트 매칭 전문가입니다."},
                    {"role": "user", "content": prompt}
                ],
                temperature=self.llm_temperature
            )
            
            return response.choices[0].message.content
        except Exception as e:
            return f"Groq 매칭 사유 생성 실패: {str(e)}"
    
    def generate_estimate_draft(
        self,
        project_info: Dict[str, Any],
        team_info: Dict[str, Any],
        past_estimates: List[str] = None
    ) -> str:
        """
        견적서 초안 생성 (Groq 사용)
        """
        if past_estimates is None:
            past_estimates = []
        
        prompt = f"""다음 정보를 바탕으로 공공사업 견적서 초안을 작성하세요:

[프로젝트 정보]
- 프로젝트명: {project_info.get('project_name', 'Unknown')}
- 예산 범위: {project_info.get('budget_range', '미정')}
- 수행 기간: {project_info.get('duration', '미정')}
- 필수 기술: {', '.join(project_info.get('essential_skills', []))}

[투입 인력]
- 팀명: {team_info.get('name', 'Unknown')}
- 보유 기술: {', '.join(team_info.get('skills', []))}
- 경력: {team_info.get('experience_years', 0)}년

[참고: 유사 프로젝트 견적]
{chr(10).join(past_estimates[:2]) if past_estimates else '참고 자료 없음'}

출력 형식:
## 1. 사업 개요
## 2. 투입 인력 및 비용
## 3. 세부 견적 내역
## 4. 총 예상 금액

각 항목을 간결하고 명확하게 작성하세요.
"""
        
        if self.disable_llm:
            return "LLM이 비활성화되어 있습니다. 설정에서 DISABLE_LLM=false로 변경하세요."
        
        if not hasattr(self, "client") or self.client is None:
            raise ValueError("Groq LLM 클라이언트가 초기화되지 않았습니다.")
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "당신은 견적서 작성 전문가입니다."},
                    {"role": "user", "content": prompt}
                ],
                temperature=self.llm_temperature
            )
            
            return response.choices[0].message.content
        except Exception as e:
            return f"Groq 견적서 생성 실패: {str(e)}"

