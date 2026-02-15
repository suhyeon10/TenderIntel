"""
Agent 기반 통합 챗 서비스
- Plain 모드: RAG 기반 일반 법률 상담
- Contract 모드: 계약서 분석 결과 기반 챗
- Situation 모드: 상황 분석 결과 기반 챗
"""

import logging
import time
from typing import Optional, List, Dict, Any
from models.schemas import LegalGroundingChunk

logger = logging.getLogger(__name__)


class AgentChatService:
    """Agent 기반 통합 챗 서비스"""
    
    def __init__(self):
        from core.legal_rag_service import LegalRAGService
        from core.generator_v2 import LLMGenerator
        
        self.legal_service = LegalRAGService()
        self.generator = LLMGenerator()
    
    async def chat_plain(
        self,
        query: str,
        legal_chunks: Optional[List[LegalGroundingChunk]] = None,
        history_messages: Optional[List[Dict[str, Any]]] = None,
    ) -> tuple[str, List[LegalGroundingChunk]]:
        """
        Plain 모드: RAG 기반 일반 법률 상담 (마크다운 형식)
        
        Args:
            query: 사용자 질문
            legal_chunks: RAG 검색 결과 (없으면 자동 검색)
            history_messages: 대화 히스토리
        
        Returns:
            (마크다운 형식 답변, 사용된 legal_chunks 리스트)
        """
        # RAG 검색 (legal_chunks가 없으면 자동 검색)
        if not legal_chunks:
            legal_chunks = await self.legal_service._search_legal_chunks(
                query=query,
                top_k=3,  # 극한 최적화: 5 → 3으로 감소 (프롬프트 1000자 이내 목표)
                category=None,
                ensure_diversity=True,
            )
        
        # 프롬프트 구성
        from core.agent_prompts import build_agent_plain_prompt
        prompt = build_agent_plain_prompt(
            query=query,
            legal_chunks=legal_chunks,
            history_messages=history_messages or [],
        )
        
        # 프롬프트 길이 로깅 (성능 분석용)
        prompt_length = len(prompt)
        estimated_tokens = prompt_length // 2.5  # 한국어 기준: 1토큰 ≈ 2-3자
        total_history = len(history_messages or [])
        used_history = min(2, total_history)  # 실제 프롬프트에 포함된 히스토리 개수 (최근 2개)
        logger.info(
            f"[Agent Plain] 프롬프트 구성 완료: "
            f"길이={prompt_length}자, 추정 토큰={int(estimated_tokens)}토큰, "
            f"legal_chunks={len(legal_chunks)}, "
            f"history_messages={used_history}/{total_history} (프롬프트 포함/전체)"
        )
        
        # LLM 호출
        if self.generator.disable_llm:
            answer = f"LLM 분석이 비활성화되어 있습니다. RAG 검색 결과는 {len(legal_chunks)}개 발견되었습니다."
            return answer, legal_chunks
        
        try:
            from config import settings
            # LLM 호출 시간 측정 시작
            llm_start_time = time.time()
            
            # LLM Provider에 따라 분기 처리
            if settings.use_ollama:
                # Ollama 사용 (해커톤 최적화: 출력 토큰 제한으로 속도 향상)
                try:
                    # Plain 모드에서 출력 토큰 제한 (약 200토큰 = 500자)
                    response_text = await self.generator.generate(
                        prompt=prompt,
                        system_role="너는 유능한 법률 AI야. 한국어로만 답변해주세요.",
                        max_output_tokens=200  # 해커톤 최적화: 짧은 답변으로 속도 향상
                    )
                    llm_elapsed = time.time() - llm_start_time
                    logger.info(
                        f"[Agent Plain] 답변 생성 완료: "
                        f"길이={len(response_text)}자, LLM 호출 시간={llm_elapsed:.2f}초"
                    )
                    return response_text.strip(), legal_chunks
                except Exception as e:
                    llm_elapsed = time.time() - llm_start_time
                    logger.error(
                        f"[Agent Plain] Ollama 호출 실패 (소요 시간={llm_elapsed:.2f}초): {str(e)}",
                        exc_info=True
                    )
                    raise
            elif settings.use_groq:
                # Groq 사용 (해커톤 최적화: max_tokens=768로 제한하여 응답 속도 향상)
                from llm_api import ask_groq_with_messages
                
                messages = [
                    {"role": "system", "content": "너는 유능한 법률 AI야. 한국어로만 답변해주세요."},
                    {"role": "user", "content": prompt}
                ]
                
                try:
                    response_text = ask_groq_with_messages(
                        messages=messages,
                        temperature=settings.llm_temperature,
                        model=settings.groq_model,
                        max_tokens=768  # 해커톤 최적화: 짧은 답변 유도로 속도 향상
                    )
                    llm_elapsed = time.time() - llm_start_time
                    logger.info(
                        f"[Agent Plain] 답변 생성 완료: "
                        f"길이={len(response_text)}자, LLM 호출 시간={llm_elapsed:.2f}초"
                    )
                    return response_text.strip(), legal_chunks
                except Exception as e:
                    llm_elapsed = time.time() - llm_start_time
                    logger.error(
                        f"[Agent Plain] Groq 호출 실패 (소요 시간={llm_elapsed:.2f}초): {str(e)}",
                        exc_info=True
                    )
                    raise
            else:
                # 기본값: generator 사용 (Ollama로 fallback)
                try:
                    response_text = await self.generator.generate(
                        prompt=prompt,
                        system_role="너는 유능한 법률 AI야. 한국어로만 답변해주세요."
                    )
                    llm_elapsed = time.time() - llm_start_time
                    logger.info(
                        f"[Agent Plain] 답변 생성 완료: "
                        f"길이={len(response_text)}자, LLM 호출 시간={llm_elapsed:.2f}초"
                    )
                    return response_text.strip(), legal_chunks
                except Exception as e:
                    llm_elapsed = time.time() - llm_start_time
                    logger.error(
                        f"[Agent Plain] Generator 호출 실패 (소요 시간={llm_elapsed:.2f}초): {str(e)}",
                        exc_info=True
                    )
                    raise
        except Exception as e:
            # 예외 발생 시에도 시간 측정 로그 출력
            if 'llm_start_time' in locals():
                llm_elapsed = time.time() - llm_start_time
                logger.error(
                    f"[Agent Plain] 답변 생성 실패 (소요 시간={llm_elapsed:.2f}초): {str(e)}",
                    exc_info=True
                )
            else:
                logger.error(f"[Agent Plain] 답변 생성 실패: {str(e)}", exc_info=True)
            answer = f"답변 생성 중 오류가 발생했습니다: {str(e)}"
            return answer, legal_chunks
    
    async def chat_contract(
        self,
        query: str,
        contract_analysis: Dict[str, Any],
        legal_chunks: Optional[List[LegalGroundingChunk]] = None,
        history_messages: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """
        Contract 모드: 계약서 분석 결과 기반 챗 (마크다운 형식)
        
        Args:
            query: 사용자 질문
            contract_analysis: 계약서 분석 결과
            legal_chunks: RAG 검색 결과 (없으면 자동 검색)
            history_messages: 대화 히스토리
        
        Returns:
            마크다운 형식 답변
        """
        # RAG 검색 (legal_chunks가 없으면 자동 검색)
        if not legal_chunks:
            # 계약서 분석 요약을 기반으로 검색
            search_query = f"{query} {contract_analysis.get('summary', '')[:200]}"
            legal_chunks = await self.legal_service._search_legal_chunks(
                query=search_query,
                top_k=5,
                category=None,
                ensure_diversity=True,
            )
        
        # 프롬프트 구성
        from core.agent_prompts import build_agent_contract_prompt
        prompt = build_agent_contract_prompt(
            query=query,
            contract_analysis=contract_analysis,
            legal_chunks=legal_chunks,
            history_messages=history_messages or [],
        )
        
        # 프롬프트 길이 로깅 (성능 분석용)
        prompt_length = len(prompt)
        estimated_tokens = prompt_length // 2.5
        logger.info(
            f"[Agent Contract] 프롬프트 구성 완료: "
            f"길이={prompt_length}자, 추정 토큰={int(estimated_tokens)}토큰, "
            f"legal_chunks={len(legal_chunks)}"
        )
        
        # LLM 호출
        if self.generator.disable_llm:
            return f"LLM 분석이 비활성화되어 있습니다. RAG 검색 결과는 {len(legal_chunks)}개 발견되었습니다."
        
        try:
            from config import settings
            # LLM 호출 시간 측정 시작
            llm_start_time = time.time()
            
            # LLM Provider에 따라 분기 처리
            if settings.use_ollama:
                # Ollama 사용
                response_text = await self.generator.generate(
                    prompt=prompt,
                    system_role="너는 유능한 법률 AI야. 한국어로만 답변해주세요."
                )
                llm_elapsed = time.time() - llm_start_time
                logger.info(
                    f"[Agent Contract] 답변 생성 완료: "
                    f"길이={len(response_text)}자, LLM 호출 시간={llm_elapsed:.2f}초"
                )
                return response_text.strip()
            elif settings.use_groq:
                # Groq 사용
                from llm_api import ask_groq_with_messages
                
                messages = [
                    {"role": "system", "content": "너는 유능한 법률 AI야. 한국어로만 답변해주세요."},
                    {"role": "user", "content": prompt}
                ]
                
                response_text = ask_groq_with_messages(
                    messages=messages,
                    temperature=settings.llm_temperature,
                    model=settings.groq_model
                )
                llm_elapsed = time.time() - llm_start_time
                logger.info(
                    f"[Agent Contract] 답변 생성 완료: "
                    f"길이={len(response_text)}자, LLM 호출 시간={llm_elapsed:.2f}초"
                )
                return response_text.strip()
            else:
                # 기본값: generator 사용 (Ollama로 fallback)
                response_text = await self.generator.generate(
                    prompt=prompt,
                    system_role="너는 유능한 법률 AI야. 한국어로만 답변해주세요."
                )
                llm_elapsed = time.time() - llm_start_time
                logger.info(
                    f"[Agent Contract] 답변 생성 완료: "
                    f"길이={len(response_text)}자, LLM 호출 시간={llm_elapsed:.2f}초"
                )
                return response_text.strip()
        except Exception as e:
            logger.error(f"[Agent Contract] 답변 생성 실패: {str(e)}", exc_info=True)
            return f"답변 생성 중 오류가 발생했습니다: {str(e)}"
    
    async def chat_situation(
        self,
        query: str,
        situation_analysis: Dict[str, Any],
        legal_chunks: Optional[List[LegalGroundingChunk]] = None,
        history_messages: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """
        Situation 모드: 상황 분석 결과 기반 챗 (마크다운 형식)
        
        Args:
            query: 사용자 질문
            situation_analysis: 상황 분석 결과
            legal_chunks: RAG 검색 결과 (없으면 자동 검색)
            history_messages: 대화 히스토리
        
        Returns:
            마크다운 형식 답변
        """
        # RAG 검색 (legal_chunks가 없으면 자동 검색)
        if not legal_chunks:
            # 상황 분석 요약을 기반으로 검색
            search_query = f"{query} {situation_analysis.get('summary', '')[:200]}"
            legal_chunks = await self.legal_service._search_legal_chunks(
                query=search_query,
                top_k=5,
                category=None,
                ensure_diversity=True,
            )
        
        # 프롬프트 구성
        from core.agent_prompts import build_agent_situation_prompt
        prompt = build_agent_situation_prompt(
            query=query,
            situation_analysis=situation_analysis,
            legal_chunks=legal_chunks,
            history_messages=history_messages or [],
        )
        
        # 프롬프트 길이 로깅 (성능 분석용)
        prompt_length = len(prompt)
        estimated_tokens = prompt_length // 2.5
        logger.info(
            f"[Agent Situation] 프롬프트 구성 완료: "
            f"길이={prompt_length}자, 추정 토큰={int(estimated_tokens)}토큰, "
            f"legal_chunks={len(legal_chunks)}"
        )
        
        # LLM 호출
        if self.generator.disable_llm:
            return f"LLM 분석이 비활성화되어 있습니다. RAG 검색 결과는 {len(legal_chunks)}개 발견되었습니다."
        
        try:
            from config import settings
            # LLM 호출 시간 측정 시작
            llm_start_time = time.time()
            
            # LLM Provider에 따라 분기 처리
            if settings.use_ollama:
                # Ollama 사용
                response_text = await self.generator.generate(
                    prompt=prompt,
                    system_role="너는 유능한 법률 AI야. 한국어로만 답변해주세요."
                )
                llm_elapsed = time.time() - llm_start_time
                logger.info(
                    f"[Agent Situation] 답변 생성 완료: "
                    f"길이={len(response_text)}자, LLM 호출 시간={llm_elapsed:.2f}초"
                )
                return response_text.strip()
            elif settings.use_groq:
                # Groq 사용
                from llm_api import ask_groq_with_messages
                
                messages = [
                    {"role": "system", "content": "너는 유능한 법률 AI야. 한국어로만 답변해주세요."},
                    {"role": "user", "content": prompt}
                ]
                
                response_text = ask_groq_with_messages(
                    messages=messages,
                    temperature=settings.llm_temperature,
                    model=settings.groq_model
                )
                llm_elapsed = time.time() - llm_start_time
                logger.info(
                    f"[Agent Situation] 답변 생성 완료: "
                    f"길이={len(response_text)}자, LLM 호출 시간={llm_elapsed:.2f}초"
                )
                return response_text.strip()
            else:
                # 기본값: generator 사용 (Ollama로 fallback)
                response_text = await self.generator.generate(
                    prompt=prompt,
                    system_role="너는 유능한 법률 AI야. 한국어로만 답변해주세요."
                )
                llm_elapsed = time.time() - llm_start_time
                logger.info(
                    f"[Agent Situation] 답변 생성 완료: "
                    f"길이={len(response_text)}자, LLM 호출 시간={llm_elapsed:.2f}초"
                )
                return response_text.strip()
        except Exception as e:
            logger.error(f"[Agent Situation] 답변 생성 실패: {str(e)}", exc_info=True)
            return f"답변 생성 중 오류가 발생했습니다: {str(e)}"

