"""
Groq LLM API 도구함
Groq 관련 코드를 한 곳에 모아두는 모듈
"""

import os
import logging
from groq import Groq
from config import settings

logger = logging.getLogger(__name__)

# 1. 클라이언트 설정 (여기서만 딱 한 번 설정)
# config.py의 groq_api_key는 환경변수 GROQ_API_KEY에서 자동으로 읽힘
# pydantic_settings가 자동으로 환경변수를 필드에 매핑함
GROQ_API_KEY = settings.groq_api_key or os.getenv("GROQ_API_KEY")

# 디버깅: 어떤 키가 사용되는지 확인 (logger만 사용 - multiprocessing spawn 호환성)
# Windows에서 uvicorn reload 시 multiprocessing spawn 과정에서 모듈 레벨 print가 문제를 일으킬 수 있음
try:
    if GROQ_API_KEY and GROQ_API_KEY != "not_set":
        masked_key = GROQ_API_KEY[:8] + "..." + GROQ_API_KEY[-8:] if len(GROQ_API_KEY) > 16 else "***"
        logger.info(f"[llm_api] GROQ_API_KEY 로드됨: {masked_key} (길이: {len(GROQ_API_KEY)})")
        logger.info(f"[llm_api] settings.groq_api_key: {settings.groq_api_key[:8] + '...' if settings.groq_api_key and len(settings.groq_api_key) > 8 else 'None'}")
        logger.info(f"[llm_api] os.getenv('GROQ_API_KEY'): {os.getenv('GROQ_API_KEY')[:8] + '...' if os.getenv('GROQ_API_KEY') and len(os.getenv('GROQ_API_KEY')) > 8 else 'None'}")
    else:
        logger.warning("[llm_api] GROQ_API_KEY가 설정되지 않았습니다!")
except (KeyboardInterrupt, SystemExit):
    # multiprocessing spawn 과정에서 발생할 수 있는 인터럽트 무시
    pass
except Exception as e:
    # 기타 예외는 로깅만 하고 계속 진행
    logger.warning(f"[llm_api] 설정 로드 중 예외 발생 (무시됨): {e}")

if not GROQ_API_KEY:
    import warnings
    warnings.warn(
        "⚠️ Groq API 키가 설정되지 않았습니다. "
        "환경변수 GROQ_API_KEY를 설정하거나 .env 파일에 GROQ_API_KEY=your_key를 추가하세요. "
        "Groq를 사용하지 않으려면 config.py에서 use_groq=False로 설정하세요.",
        UserWarning
    )
    # API 키가 없어도 클라이언트는 생성하되, 실제 호출 시 에러 발생
    GROQ_API_KEY = "not_set"

CLIENT = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY != "not_set" else None
if CLIENT:
    logger.info("[llm_api] Groq CLIENT 초기화 완료")
else:
    logger.warning("[llm_api] Groq CLIENT 초기화 실패 (API 키 없음)")


def ask_groq(user_input: str, system_role: str = "너는 유능한 법률 AI야.") -> str:
    """
    이 함수는 질문(user_input)을 받으면 Groq에게 물어보고 답을 리턴합니다.
    
    Args:
        user_input: 사용자 질문/입력 텍스트
        system_role: 시스템 역할 설정 (기본값: "너는 유능한 법률 AI야.")
    
    Returns:
        LLM 응답 텍스트
    """
    if not CLIENT:
        raise ValueError("Groq API 키가 설정되지 않았습니다. 환경변수 GROQ_API_KEY를 설정하세요.")
    
    try:
        completion = CLIENT.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_role},
                {"role": "user", "content": user_input}
            ],
            temperature=0.5,
        )
        # 결과 텍스트만 깔끔하게 뽑아서 돌려줌
        return completion.choices[0].message.content
        
    except Exception as e:
        return f"에러가 발생했습니다: {str(e)}"


def ask_groq_with_messages(messages: list, temperature: float = 0.5, model: str = "llama-3.3-70b-versatile", max_tokens: int = 4096) -> str:
    """
    메시지 리스트를 받아서 Groq에게 물어보고 답을 리턴합니다.
    
    Args:
        messages: 메시지 리스트 (예: [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}])
        temperature: 온도 설정 (기본값: 0.5)
        model: 사용할 모델 (기본값: "llama-3.3-70b-versatile")
        max_tokens: 최대 토큰 수 (기본값: 4096, 응답 시간 단축을 위해 제한)
    
    Returns:
        LLM 응답 텍스트
    
    Raises:
        Exception: Groq API 호출 실패 시 예외를 그대로 전파
    """
    if not CLIENT:
        raise ValueError("Groq API 키가 설정되지 않았습니다. 환경변수 GROQ_API_KEY를 설정하세요.")
    
    # 디버깅: 실제 사용 중인 키 확인 (첫 호출 시에만)
    if not hasattr(ask_groq_with_messages, '_key_logged'):
        masked_key = GROQ_API_KEY[:8] + "..." + GROQ_API_KEY[-8:] if GROQ_API_KEY != "not_set" and len(GROQ_API_KEY) > 16 else "***"
        logger.info(f"[llm_api] 실제 사용 중인 GROQ_API_KEY: {masked_key} (길이: {len(GROQ_API_KEY) if GROQ_API_KEY != 'not_set' else 0})")
        ask_groq_with_messages._key_logged = True
    
    try:
        completion = CLIENT.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,  # 응답 길이 제한으로 생성 시간 단축
        )
        # 결과 텍스트만 깔끔하게 뽑아서 돌려줌
        response_content = completion.choices[0].message.content
        if not response_content:
            raise ValueError("Groq API가 빈 응답을 반환했습니다.")
        
        # 토큰 사용량 로깅
        if hasattr(completion, 'usage') and completion.usage:
            usage = completion.usage
            prompt_tokens = getattr(usage, 'prompt_tokens', 0)
            completion_tokens = getattr(usage, 'completion_tokens', 0)
            total_tokens = getattr(usage, 'total_tokens', 0)
            logger.info(f"[토큰 사용량] 입력: {prompt_tokens}토큰, 출력: {completion_tokens}토큰, 총: {total_tokens}토큰 (모델: {model})")
        else:
            logger.warning("[토큰 사용량] Groq API 응답에 토큰 사용량 정보가 없습니다.")
        
        return response_content
        
    except Exception as e:
        # 예외를 그대로 전파하여 상위에서 처리할 수 있도록 함
        logger.error(f"Groq API 호출 실패: {str(e)}", exc_info=True)
        raise

