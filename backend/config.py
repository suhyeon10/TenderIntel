# backend/config.py

import os
import logging
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

logger = logging.getLogger(__name__)

# backend 디렉토리 경로 찾기 (이 파일이 backend/config.py에 있으므로)
BACKEND_DIR = Path(__file__).resolve().parent
ENV_FILE_PATH = BACKEND_DIR / ".env"


class Settings(BaseSettings):
    # API Keys (해커톤 모드에서는 사용 안 함)
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None  # Groq API 키 (환경변수 GROQ_API_KEY에서 자동으로 가져옴)
    
    # Supabase
    supabase_url: Optional[str] = None
    supabase_service_role_key: Optional[str] = None
    database_url: Optional[str] = None
    
    # Vector DB (레거시 - ChromaDB)
    chroma_persist_dir: str = "./data/chroma_db"
    
    # Embedding Model (로컬 임베딩 사용)
    use_local_embedding: bool = True  # sentence-transformers 사용 (무료)
    local_embedding_model: str = "BAAI/bge-m3"  # 로컬 임베딩 모델: bge-m3 (1024차원, 다국어 지원, 법률/계약서에 적합)
    embedding_device: Optional[str] = "cpu"  # 임베딩 디바이스: "cpu" (meta tensor 문제 방지), "cuda"(GPU 강제), None/"auto"(자동 감지)
    
    # 문서/기업 임베딩 모델 구분 (선택사항)
    doc_embed_model: str = "BAAI/bge-m3"  # 문서 임베딩: 법률/계약서/공고문 (1024차원, 다국어)
    company_embed_model: str = "BAAI/bge-small-en-v1.5"  # 기업 임베딩: 기업/팀 기술스택 및 수행이력 (384차원, 빠름, 레거시)
    
    # LLM Model Provider 선택 (환경변수 LLM_PROVIDER로 설정: "groq" 또는 "ollama")
    llm_provider: str = "groq"  # "groq" 또는 "ollama" (환경변수 LLM_PROVIDER로 오버라이드 가능)
    llm_temperature: float = 0.5
    disable_llm: bool = False  # True면 LLM 분석 비활성화 (개발/테스트용)
    
    # Groq 설정 (Groq LLM 사용)
    groq_model: str = "llama-3.3-70b-versatile"  # Groq 모델명 (기본값, 환경변수 GROQ_MODEL로 오버라이드 가능)
    use_groq: bool = True  # Groq 사용 여부 (llm_provider에 따라 자동 설정됨)
    
    # Ollama 설정 (로컬 LLM 사용 - 레거시, Groq 사용 시 비활성화)
    ollama_base_url: str = "http://localhost:11434"  # Ollama 서버 주소
    ollama_model: str = "mistral"  # mistral (한국어 성능 우수), llama3, phi3 등
    ollama_timeout: float = 600.0  # Ollama 호출 타임아웃 (초, 기본값: 10분)
    use_ollama: bool = False  # Ollama 사용 여부 (llm_provider에 따라 자동 설정됨)
    
    # 벡터 DB 선택
    use_chromadb: bool = False  # True면 ChromaDB 사용 (로컬), False면 Supabase
    
    # Chunk Settings
    chunk_size: int = 1000
    chunk_overlap: int = 200
    
    # Embedding Cache Settings
    embedding_cache_size: int = 100  # LRU 캐시 최대 크기 (기본값: 100)
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    model_config = SettingsConfigDict(
        env_file=str(ENV_FILE_PATH),  # 절대 경로 사용
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"  # 정의되지 않은 필드 무시
        # pydantic_settings는 필드명을 대문자로 변환하여 환경변수에서 자동으로 읽음
        # groq_api_key → GROQ_API_KEY 환경변수에서 자동으로 읽힘
    )


settings = Settings()

# LLM_PROVIDER 환경변수에 따라 use_groq와 use_ollama 자동 설정
# 환경변수에서 직접 읽기 (pydantic_settings가 처리하기 전에)
import os
llm_provider_env = os.getenv("LLM_PROVIDER", "").lower().strip()
if llm_provider_env:
    settings.llm_provider = llm_provider_env

# llm_provider에 따라 use_groq와 use_ollama 자동 설정
# Windows에서 uvicorn reload 시 multiprocessing spawn 과정에서 모듈 레벨 print가 문제를 일으킬 수 있음
try:
    if settings.llm_provider.lower() == "ollama":
        settings.use_groq = False
        settings.use_ollama = True
        logger.info(f"[설정] LLM Provider: Ollama (모델: {settings.ollama_model})")
    elif settings.llm_provider.lower() == "groq":
        settings.use_groq = True
        settings.use_ollama = False
        logger.info(f"[설정] LLM Provider: Groq (모델: {settings.groq_model})")
    else:
        # 기본값: Groq 사용
        settings.use_groq = True
        settings.use_ollama = False
        logger.info(f"[설정] LLM Provider: Groq (기본값, 모델: {settings.groq_model})")
except (KeyboardInterrupt, SystemExit):
    # multiprocessing spawn 과정에서 발생할 수 있는 인터럽트 무시
    pass
except Exception as e:
    # 기타 예외는 로깅만 하고 계속 진행
    logger.warning(f"[설정] LLM Provider 설정 중 예외 발생 (무시됨): {e}")

# 디버깅: .env 파일 로드 확인 (logger만 사용 - multiprocessing spawn 호환성)
# Windows에서 uvicorn reload 시 multiprocessing spawn 과정에서 모듈 레벨 print가 문제를 일으킬 수 있음
try:
    if settings.groq_api_key:
        masked_key = settings.groq_api_key[:8] + "..." + settings.groq_api_key[-8:] if len(settings.groq_api_key) > 16 else "***"
        logger.info(f"[config] GROQ_API_KEY 로드됨: {masked_key} (길이: {len(settings.groq_api_key)})")
        logger.info(f"[config] .env 파일 경로: {ENV_FILE_PATH}")
        logger.info(f"[config] .env 파일 존재 여부: {ENV_FILE_PATH.exists()}")
    else:
        logger.warning("[config] GROQ_API_KEY가 설정되지 않았습니다!")
        logger.info(f"[config] .env 파일 경로: {ENV_FILE_PATH}")
        logger.info(f"[config] .env 파일 존재 여부: {ENV_FILE_PATH.exists()}")
        if ENV_FILE_PATH.exists():
            logger.info(f"[config] .env 파일 내용 (GROQ 관련):")
            try:
                with open(ENV_FILE_PATH, 'r', encoding='utf-8') as f:
                    for line in f:
                        if 'GROQ' in line.upper():
                            # 키 값은 마스킹
                            if '=' in line:
                                key, value = line.split('=', 1)
                                masked_value = value.strip()[:8] + "..." + value.strip()[-8:] if len(value.strip()) > 16 else "***"
                                logger.info(f"[config]   {key}={masked_value}")
                            else:
                                logger.info(f"[config]   {line.strip()}")
            except Exception as e:
                logger.error(f"[config] .env 파일 읽기 실패: {e}")
except (KeyboardInterrupt, SystemExit):
    # multiprocessing spawn 과정에서 발생할 수 있는 인터럽트 무시
    pass
except Exception as e:
    # 기타 예외는 로깅만 하고 계속 진행
    logger.warning(f"[config] 설정 로드 중 예외 발생 (무시됨): {e}")

