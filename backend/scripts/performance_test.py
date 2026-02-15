"""
성능 테스트 스크립트
RAG 시스템의 각 컴포넌트별 성능 측정
"""

import asyncio
import time
import statistics
import json
from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path
import sys
import warnings

# langchain-community의 Ollama Deprecated 경고 무시
warnings.filterwarnings("ignore", category=DeprecationWarning, module="langchain")

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.generator_v2 import LLMGenerator
from core.legal_rag_service import LegalRAGService
from core.supabase_vector_store import SupabaseVectorStore
from core.document_processor_v2 import DocumentProcessor
from config import settings

# 상황분석 워크플로우 (선택적)
try:
    from core.situation_workflow import SituationWorkflow
    SITUATION_WORKFLOW_AVAILABLE = True
except ImportError:
    SITUATION_WORKFLOW_AVAILABLE = False


class PerformanceTester:
    """성능 테스트 클래스"""
    
    def __init__(self, save_results: bool = True, save_dir: str = None):
        self.generator = LLMGenerator()
        self.legal_service = LegalRAGService(embedding_cache_size=100)
        self.vector_store = SupabaseVectorStore()
        self.processor = DocumentProcessor()
        self.results: Dict[str, List[float]] = {}
        self.save_results = save_results
        
        # 저장 디렉토리 설정
        if save_dir is None:
            save_dir = Path(__file__).parent.parent / "data" / "indexed" / "reports" / "performance"
        else:
            save_dir = Path(save_dir)
        
        self.save_dir = save_dir
        self.save_dir.mkdir(parents=True, exist_ok=True)
        
        # 타임스탬프 생성
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.result_file = self.save_dir / f"performance_test_{self.timestamp}.json"
        
        # 전체 결과 데이터
        self.all_results = {
            "timestamp": self.timestamp,
            "datetime": datetime.now().isoformat(),
            "config": {
                "embedding_model": settings.local_embedding_model,
                "llm_model": settings.ollama_model,
                "vector_db": "Supabase" if settings.supabase_url else "ChromaDB",
            },
            "results": {}
        }
    
    def print_header(self, title: str):
        """헤더 출력"""
        print("\n" + "=" * 60)
        print(f"  {title}")
        print("=" * 60)
    
    def print_result(self, test_name: str, times: List[float], unit: str = "초"):
        """결과 출력"""
        if not times:
            print(f"❌ {test_name}: 측정 실패")
            return
        
        avg = statistics.mean(times)
        median = statistics.median(times)
        min_time = min(times)
        max_time = max(times)
        std_dev = statistics.stdev(times) if len(times) > 1 else 0
        
        print(f"\n📊 {test_name}")
        print(f"   평균: {avg:.3f} {unit}")
        print(f"   중앙값: {median:.3f} {unit}")
        print(f"   최소: {min_time:.3f} {unit}")
        print(f"   최대: {max_time:.3f} {unit}")
        print(f"   표준편차: {std_dev:.3f} {unit}")
        print(f"   측정 횟수: {len(times)}회")
        
        self.results[test_name] = times
        
        # 결과를 파일에 저장
        if self.save_results:
            self._save_result(test_name, times)
    
    async def test_embedding_single(self, iterations: int = 10) -> List[float]:
        """단일 임베딩 생성 성능 테스트"""
        self.print_header("1. 단일 임베딩 생성 성능")
        
        test_texts = [
            "근로계약서의 수습 기간은 최대 3개월을 초과할 수 없다.",
            "임금은 매월 말일에 지급하며, 지급일이 휴일인 경우 그 전일로 지급한다.",
            "근로자는 정당한 사유 없이 근로를 제공하지 않을 수 없다.",
            "사용자는 근로자의 안전과 건강을 보호할 의무가 있다.",
            "근로시간은 1주 40시간을 초과할 수 없다.",
        ]
        
        times = []
        for i in range(iterations):
            text = test_texts[i % len(test_texts)]
            start = time.time()
            try:
                embedding = await asyncio.to_thread(self.generator.embed_one, text)
                elapsed = time.time() - start
                times.append(elapsed)
                print(f"   [{i+1}/{iterations}] {elapsed:.3f}초 - '{text[:30]}...'")
            except Exception as e:
                print(f"   ❌ [{i+1}/{iterations}] 실패: {str(e)}")
        
        return times
    
    async def test_embedding_batch(self, batch_sizes: List[int] = [1, 5, 10, 20]) -> Dict[int, List[float]]:
        """배치 임베딩 생성 성능 테스트"""
        self.print_header("2. 배치 임베딩 생성 성능")
        
        test_texts = [
            f"근로계약서 조항 {i}: 근로자는 정당한 사유 없이 근로를 제공하지 않을 수 없다."
            for i in range(50)
        ]
        
        results = {}
        for batch_size in batch_sizes:
            print(f"\n   배치 크기: {batch_size}")
            times = []
            for i in range(3):  # 각 배치 크기당 3회 측정
                batch = test_texts[:batch_size]
                start = time.time()
                try:
                    embeddings = await asyncio.to_thread(self.generator.embed, batch)
                    elapsed = time.time() - start
                    times.append(elapsed)
                    avg_per_item = elapsed / batch_size
                    print(f"      [{i+1}/3] {elapsed:.3f}초 (항목당 {avg_per_item:.3f}초)")
                except Exception as e:
                    print(f"      ❌ [{i+1}/3] 실패: {str(e)}")
            
            if times:
                avg = statistics.mean(times)
                avg_per_item = avg / batch_size
                print(f"      평균: {avg:.3f}초 (항목당 {avg_per_item:.3f}초)")
                results[batch_size] = times
        
        return results
    
    async def test_embedding_cache(self, iterations: int = 20) -> Dict[str, List[float]]:
        """임베딩 캐시 효과 테스트"""
        self.print_header("3. 임베딩 캐시 효과")
        
        test_text = "근로계약서의 수습 기간은 최대 3개월을 초과할 수 없다."
        
        # 캐시 없이 (첫 실행)
        print("\n   캐시 없이 (첫 실행):")
        first_times = []
        for i in range(5):
            start = time.time()
            try:
                embedding = await asyncio.to_thread(self.generator.embed_one, test_text)
                elapsed = time.time() - start
                first_times.append(elapsed)
                print(f"      [{i+1}/5] {elapsed:.3f}초")
            except Exception as e:
                print(f"      ❌ [{i+1}/5] 실패: {str(e)}")
        
        # 캐시 있음 (재사용)
        print("\n   캐시 있음 (재사용):")
        cached_times = []
        for i in range(iterations):
            start = time.time()
            try:
                # LegalRAGService의 캐시를 사용
                embedding = await self.legal_service._get_embedding(test_text)
                elapsed = time.time() - start
                cached_times.append(elapsed)
                if i < 5:
                    print(f"      [{i+1}/{iterations}] {elapsed:.3f}초")
            except Exception as e:
                print(f"      ❌ [{i+1}/{iterations}] 실패: {str(e)}")
        
        return {
            "캐시 없음": first_times,
            "캐시 있음": cached_times
        }
    
    async def test_vector_search(self, iterations: int = 10) -> List[float]:
        """벡터 검색 성능 테스트"""
        self.print_header("4. 벡터 검색 성능")
        
        queries = [
            "수습 기간 해고 조건",
            "임금 지급 시기",
            "근로시간 제한",
            "휴가 및 휴직",
            "해고 사유 및 절차",
        ]
        
        times = []
        for i in range(iterations):
            query = queries[i % len(queries)]
            start = time.time()
            try:
                chunks = await self.legal_service._search_legal_chunks(query=query, top_k=10)
                elapsed = time.time() - start
                times.append(elapsed)
                print(f"   [{i+1}/{iterations}] {elapsed:.3f}초 - '{query}' (결과: {len(chunks)}개)")
            except Exception as e:
                print(f"   ❌ [{i+1}/{iterations}] 실패: {str(e)}")
        
        return times
    
    async def test_llm_response(self, iterations: int = 5) -> List[float]:
        """LLM 응답 생성 성능 테스트"""
        self.print_header("5. LLM 응답 생성 성능")
        
        queries = [
            "수습 기간 해고 조건은 어떻게 되나요?",
            "임금 지급 시기는 언제인가요?",
            "근로시간 제한은 어떻게 되나요?",
        ]
        
        # LLM 초기화
        from config import settings
        times = []
        
        for i in range(iterations):
            query = queries[i % len(queries)]
            start = time.time()
            try:
                if settings.use_groq:
                    # Groq 사용
                    from llm_api import ask_groq_with_messages
                    messages = [
                        {"role": "system", "content": "너는 유능한 법률 AI야. 한국어로만 답변해주세요."},
                        {"role": "user", "content": f"다음 질문에 간단히 답변하세요: {query}"}
                    ]
                    response_text = await asyncio.to_thread(
                        ask_groq_with_messages,
                        messages=messages,
                        temperature=settings.llm_temperature,
                        model=settings.groq_model
                    )
                elif settings.use_ollama:
                    # Ollama 사용 - langchain-community 우선 사용 (think 파라미터 에러 방지)
                    try:
                        from langchain_community.llms import Ollama
                        llm = Ollama(
                            base_url=settings.ollama_base_url,
                            model=settings.ollama_model
                        )
                    except ImportError:
                        # 대안: langchain-ollama 사용 (think 파라미터 에러 가능)
                        try:
                            from langchain_ollama import OllamaLLM
                            llm = OllamaLLM(
                                base_url=settings.ollama_base_url,
                                model=settings.ollama_model
                            )
                        except Exception as e:
                            if "think" in str(e).lower():
                                print("   [경고] langchain-ollama에서 think 파라미터 에러 발생. langchain-community로 재시도...")
                                from langchain_community.llms import Ollama
                                llm = Ollama(
                                    base_url=settings.ollama_base_url,
                                    model=settings.ollama_model
                                )
                            else:
                                raise
                    
                    prompt = f"다음 질문에 간단히 답변하세요: {query}"
                    response_text = await asyncio.to_thread(llm.invoke, prompt)
                else:
                    print(f"   ❌ [{i+1}/{iterations}] LLM이 설정되지 않았습니다.")
                    continue
                
                elapsed = time.time() - start
                times.append(elapsed)
                response_preview = response_text[:50] if isinstance(response_text, str) else str(response_text)[:50]
                print(f"   [{i+1}/{iterations}] {elapsed:.3f}초 - '{query}'")
                print(f"      응답: {response_preview}...")
            except Exception as e:
                print(f"   ❌ [{i+1}/{iterations}] 실패: {str(e)}")
        
        return times
    
    async def test_dual_rag_search(self, iterations: int = 5) -> List[float]:
        """Dual RAG 검색 성능 테스트"""
        self.print_header("6. Dual RAG 검색 성능")
        
        query = "수습 기간 해고 조건"
        doc_id = None  # 테스트용 doc_id (실제로는 존재하는 doc_id 사용)
        
        times = []
        for i in range(iterations):
            start = time.time()
            try:
                # 계약서 청크 검색과 법령 청크 검색을 병렬로 실행
                query_embedding = await self.legal_service._get_embedding(query)
                
                # 병렬 검색
                if doc_id:
                    contract_task = self.legal_service._search_contract_chunks(
                        doc_id=doc_id,
                        query=query,
                        top_k=5
                    )
                else:
                    # doc_id가 없으면 빈 리스트를 반환하는 코루틴
                    async def empty_contract_chunks():
                        return []
                    contract_task = empty_contract_chunks()
                
                legal_task = self.legal_service._search_legal_chunks(query=query, top_k=8)
                
                contract_chunks, legal_chunks = await asyncio.gather(
                    contract_task,
                    legal_task,
                    return_exceptions=True
                )
                
                elapsed = time.time() - start
                times.append(elapsed)
                
                # None 체크 추가
                if isinstance(contract_chunks, Exception):
                    contract_count = 0
                elif contract_chunks is None:
                    contract_count = 0
                else:
                    contract_count = len(contract_chunks)
                
                if isinstance(legal_chunks, Exception):
                    legal_count = 0
                elif legal_chunks is None:
                    legal_count = 0
                else:
                    legal_count = len(legal_chunks)
                
                print(f"   [{i+1}/{iterations}] {elapsed:.3f}초 - 계약서: {contract_count}개, 법령: {legal_count}개")
            except Exception as e:
                print(f"   ❌ [{i+1}/{iterations}] 실패: {str(e)}")
        
        return times
    
    async def test_contract_analysis_pipeline(self, test_text: str = None) -> Dict[str, float]:
        """전체 계약서 분석 파이프라인 성능 테스트"""
        self.print_header("7. 전체 계약서 분석 파이프라인")
        
        if not test_text:
            test_text = """
            제1조 (근로기간)
            본 계약의 근로기간은 2024년 1월 1일부터 2024년 12월 31일까지로 한다.
            
            제2조 (수습기간)
            근로자는 수습기간 6개월을 거쳐야 하며, 수습기간 중에는 정당한 사유 없이 해고할 수 있다.
            
            제3조 (근로시간)
            근로시간은 1주 50시간을 초과할 수 없으며, 휴게시간은 포함하지 않는다.
            
            제4조 (임금)
            임금은 매월 말일에 지급하며, 지급일이 휴일인 경우 그 전일로 지급한다.
            """
        
        pipeline_times = {}
        
        # 1. 텍스트 추출 (이미 추출된 텍스트 사용)
        print("\n   1단계: 텍스트 추출 (스킵 - 이미 추출됨)")
        
        # 2. 청킹
        print("   2단계: 청킹")
        start = time.time()
        try:
            chunks = self.processor.to_contract_chunks(test_text)
            elapsed = time.time() - start
            pipeline_times["청킹"] = elapsed
            print(f"      완료: {elapsed:.3f}초 ({len(chunks)}개 청크)")
        except Exception as e:
            print(f"      ❌ 실패: {str(e)}")
            pipeline_times["청킹"] = 0
        
        # 3. 임베딩 생성
        print("   3단계: 임베딩 생성")
        start = time.time()
        try:
            chunk_texts = [chunk.content for chunk in chunks]
            embeddings = await asyncio.to_thread(self.generator.embed, chunk_texts)
            elapsed = time.time() - start
            pipeline_times["임베딩 생성"] = elapsed
            print(f"      완료: {elapsed:.3f}초 ({len(embeddings)}개 임베딩)")
        except Exception as e:
            print(f"      ❌ 실패: {str(e)}")
            pipeline_times["임베딩 생성"] = 0
        
        # 4. Dual RAG 검색
        print("   4단계: Dual RAG 검색")
        start = time.time()
        try:
            query = self.legal_service._build_query_from_contract(test_text, None)
            query_embedding = await self.legal_service._get_embedding(query)
            
            legal_chunks = await self.legal_service._search_legal_chunks(query=query, top_k=8)
            elapsed = time.time() - start
            pipeline_times["RAG 검색"] = elapsed
            print(f"      완료: {elapsed:.3f}초 (법령 청크: {len(legal_chunks)}개)")
        except Exception as e:
            print(f"      ❌ 실패: {str(e)}")
            pipeline_times["RAG 검색"] = 0
        
        # 5. LLM 분석
        print("   5단계: LLM 분석")
        start = time.time()
        try:
            # 청크에서 간단한 clauses 생성 (성능 테스트용)
            clauses = []
            for idx, chunk in enumerate(chunks[:4], 1):  # 최대 4개만
                clauses.append({
                    "id": f"clause-{idx}",
                    "title": f"제{idx}조",
                    "content": chunk.content[:300]  # 처음 300자만
                })
            
            result = await self.legal_service._llm_summarize_risk(
                query=query,
                contract_text=test_text,
                contract_chunks=[],
                grounding_chunks=legal_chunks[:5],  # 상위 5개만 사용
                clauses=clauses  # clauses 추가
            )
            elapsed = time.time() - start
            pipeline_times["LLM 분석"] = elapsed
            print(f"      완료: {elapsed:.3f}초 (이슈: {len(result.issues)}개)")
        except Exception as e:
            print(f"      ❌ 실패: {str(e)}")
            pipeline_times["LLM 분석"] = 0
        
        # 전체 시간
        total_time = sum(pipeline_times.values())
        pipeline_times["전체"] = total_time
        print(f"\n   총 소요 시간: {total_time:.3f}초")
        
        return pipeline_times
    
    async def test_situation_analysis_pipeline(self, iterations: int = 3) -> Dict[str, Any]:
        """상황분석 파이프라인 전체 테스트"""
        self.print_header("8. 상황분석 파이프라인 성능")
        
        if not SITUATION_WORKFLOW_AVAILABLE:
            print("   ⚠️ LangGraph가 설치되지 않아 상황분석 워크플로우를 테스트할 수 없습니다.")
            print("   해결: pip install langgraph")
            return {}
        
        # 테스트 케이스
        test_cases = [
            {
                "situation_text": "3개월째 월급이 늦게 들어와요. 매번 다음 달 중순에 들어오는데, 이번 달은 아직도 안 들어왔어요.",
                "category_hint": "unpaid_wage",
                "employment_type": "regular",
                "work_period": "1_3_years",
                "weekly_hours": 40,
                "is_probation": False,
                "social_insurance": "all",
            },
            {
                "situation_text": "수습 기간 중인데 갑자기 해고 통보를 받았어요. 이유를 물어봐도 명확한 답변을 주지 않아요.",
                "category_hint": "unfair_dismissal",
                "employment_type": "regular",
                "work_period": "under_1_month",
                "weekly_hours": 40,
                "is_probation": True,
                "social_insurance": "all",
            },
            {
                "situation_text": "주 60시간씩 일하는데 연장수당을 제대로 받지 못하고 있어요.",
                "category_hint": "overtime",
                "employment_type": "regular",
                "work_period": "1_3_years",
                "weekly_hours": 60,
                "is_probation": False,
                "social_insurance": "all",
            },
        ]
        
        all_pipeline_times = []
        
        for i in range(min(iterations, len(test_cases))):
            test_case = test_cases[i]
            print(f"\n   테스트 케이스 {i+1}/{iterations}: {test_case['category_hint']}")
            print(f"   상황: {test_case['situation_text'][:50]}...")
            
            pipeline_times = {}
            
            try:
                workflow = SituationWorkflow()
                
                # 전체 파이프라인 시간 측정
                start = time.time()
                result = await workflow.run(test_case)
                total_time = time.time() - start
                pipeline_times["전체 파이프라인"] = total_time
                
                # 결과 확인
                if result:
                    print(f"      ✅ 완료: {total_time:.3f}초")
                    if "final_output" in result:
                        final = result["final_output"]
                        print(f"         - 위험도: {final.get('risk_score', 'N/A')}")
                        print(f"         - 판단 기준: {len(final.get('criteria', []))}개")
                        print(f"         - 행동 계획: {len(final.get('action_plan', {}).get('steps', []))}단계")
                    else:
                        print(f"         - 분류: {result.get('classification', {}).get('classified_type', 'N/A')}")
                        print(f"         - 위험도: {result.get('classification', {}).get('risk_score', 'N/A')}")
                else:
                    print(f"      ⚠️ 결과 없음: {total_time:.3f}초")
                
                all_pipeline_times.append(pipeline_times)
                
            except Exception as e:
                print(f"      ❌ 실패: {str(e)}")
                import traceback
                traceback.print_exc()
        
        # 통계 계산
        if all_pipeline_times:
            total_times = [pt["전체 파이프라인"] for pt in all_pipeline_times if "전체 파이프라인" in pt]
            if total_times:
                avg_time = statistics.mean(total_times)
                min_time = min(total_times)
                max_time = max(total_times)
                print(f"\n   통계:")
                print(f"      평균: {avg_time:.3f}초")
                print(f"      최소: {min_time:.3f}초")
                print(f"      최대: {max_time:.3f}초")
                
                return {
                    "평균 시간": avg_time,
                    "최소 시간": min_time,
                    "최대 시간": max_time,
                    "테스트 횟수": len(total_times),
                }
        
        return {}
    
    async def test_async_parallelism(self) -> Dict[str, float]:
        """비동기 병렬 처리 효과 테스트"""
        self.print_header("9. 비동기 병렬 처리 효과")
        
        queries = [
            "수습 기간 해고 조건",
            "임금 지급 시기",
            "근로시간 제한",
        ]
        
        # 순차 실행
        print("\n   순차 실행:")
        start = time.time()
        for query in queries:
            try:
                await self.legal_service._search_legal_chunks(query=query, top_k=5)
            except Exception as e:
                print(f"      ❌ 실패: {str(e)}")
        sequential_time = time.time() - start
        print(f"      완료: {sequential_time:.3f}초")
        
        # 병렬 실행
        print("\n   병렬 실행:")
        start = time.time()
        try:
            tasks = [
                self.legal_service._search_legal_chunks(query=query, top_k=5)
                for query in queries
            ]
            await asyncio.gather(*tasks)
        except Exception as e:
            print(f"      ❌ 실패: {str(e)}")
        parallel_time = time.time() - start
        print(f"      완료: {parallel_time:.3f}초")
        
        speedup = sequential_time / parallel_time if parallel_time > 0 else 0
        print(f"\n   속도 향상: {speedup:.2f}배")
        
        return {
            "순차 실행": sequential_time,
            "병렬 실행": parallel_time,
            "속도 향상": speedup
        }
    
    def _save_result(self, test_name: str, times: List[float]):
        """개별 테스트 결과를 파일에 저장"""
        if not times:
            return
        
        avg = statistics.mean(times)
        median = statistics.median(times)
        min_time = min(times)
        max_time = max(times)
        std_dev = statistics.stdev(times) if len(times) > 1 else 0
        
        result_data = {
            "test_name": test_name,
            "statistics": {
                "mean": round(avg, 3),
                "median": round(median, 3),
                "min": round(min_time, 3),
                "max": round(max_time, 3),
                "std_dev": round(std_dev, 3),
                "count": len(times)
            },
            "raw_times": [round(t, 3) for t in times]
        }
        
        # 전체 결과에 추가
        self.all_results["results"][test_name] = result_data
        
        # 즉시 파일에 저장 (주기적 저장)
        try:
            with open(self.result_file, 'w', encoding='utf-8') as f:
                json.dump(self.all_results, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"   [경고] 결과 저장 실패: {str(e)}")
    
    def _save_final_results(self):
        """최종 결과를 파일에 저장"""
        try:
            # 전체 결과 요약 추가
            summary = {}
            for test_name, times in self.results.items():
                if times:
                    summary[test_name] = {
                        "mean": round(statistics.mean(times), 3),
                        "count": len(times)
                    }
            
            self.all_results["summary"] = summary
            self.all_results["total_tests"] = len(self.results)
            
            # 최종 저장
            with open(self.result_file, 'w', encoding='utf-8') as f:
                json.dump(self.all_results, f, ensure_ascii=False, indent=2)
            
            print(f"\n💾 결과 저장 완료: {self.result_file}")
        except Exception as e:
            print(f"\n❌ 최종 결과 저장 실패: {str(e)}")
    
    def print_summary(self):
        """전체 결과 요약"""
        self.print_header("성능 테스트 결과 요약")
        
        print("\n📈 주요 지표:")
        for test_name, times in self.results.items():
            if times:
                avg = statistics.mean(times)
                print(f"   {test_name}: 평균 {avg:.3f}초")
        
        print("\n💡 최적화 권장사항:")
        if "단일 임베딩" in self.results and "배치 임베딩" in self.results:
            single_avg = statistics.mean(self.results.get("단일 임베딩", [0]))
            print(f"   - 배치 임베딩 사용 시 속도 향상 가능")
        
        if "캐시 없음" in self.results and "캐시 있음" in self.results:
            no_cache = statistics.mean(self.results.get("캐시 없음", [0]))
            with_cache = statistics.mean(self.results.get("캐시 있음", [0]))
            if no_cache > 0:
                cache_speedup = no_cache / with_cache if with_cache > 0 else 0
                print(f"   - 캐시 사용 시 {cache_speedup:.2f}배 속도 향상")
        
        print("\n✅ 테스트 완료!")
        
        # 최종 결과 저장
        if self.save_results:
            self._save_final_results()


async def main():
    """메인 함수"""
    print("🚀 RAG 시스템 성능 테스트 시작")
    print(f"   임베딩 모델: {settings.local_embedding_model}")
    print(f"   LLM 모델: {settings.ollama_model}")
    print(f"   벡터 DB: {'Supabase' if settings.supabase_url else 'ChromaDB'}")
    
    tester = PerformanceTester()
    
    try:
        # 1. 단일 임베딩 생성
        single_times = await tester.test_embedding_single(iterations=10)
        tester.print_result("단일 임베딩 생성", single_times)
        
        # 2. 배치 임베딩 생성
        batch_results = await tester.test_embedding_batch(batch_sizes=[1, 5, 10, 20])
        for batch_size, times in batch_results.items():
            tester.print_result(f"배치 임베딩 ({batch_size}개)", times)
        
        # 3. 캐시 효과
        cache_results = await tester.test_embedding_cache(iterations=20)
        for cache_type, times in cache_results.items():
            tester.print_result(f"임베딩 생성 ({cache_type})", times)
        
        # 4. 벡터 검색
        search_times = await tester.test_vector_search(iterations=10)
        tester.print_result("벡터 검색", search_times)
        
        # 5. LLM 응답 생성
        llm_times = await tester.test_llm_response(iterations=5)
        tester.print_result("LLM 응답 생성", llm_times)
        
        # 6. Dual RAG 검색
        dual_rag_times = await tester.test_dual_rag_search(iterations=5)
        tester.print_result("Dual RAG 검색", dual_rag_times)
        
        # 7. 전체 계약서 분석 파이프라인
        pipeline_results = await tester.test_contract_analysis_pipeline()
        for stage, time_taken in pipeline_results.items():
            print(f"\n   {stage}: {time_taken:.3f}초")
        
        # 파이프라인 결과도 저장
        if pipeline_results:
            tester.all_results["pipeline_results"] = {
                stage: round(time_taken, 3) 
                for stage, time_taken in pipeline_results.items()
            }
            tester._save_final_results()
        
        # 8. 상황분석 파이프라인
        situation_results = await tester.test_situation_analysis_pipeline(iterations=3)
        if situation_results:
            print(f"\n   상황분석 파이프라인 결과:")
            for key, value in situation_results.items():
                if isinstance(value, float):
                    print(f"      {key}: {value:.3f}초")
                else:
                    print(f"      {key}: {value}")
            
            # 상황분석 결과도 저장
            tester.all_results["situation_pipeline_results"] = {
                key: round(value, 3) if isinstance(value, float) else value
                for key, value in situation_results.items()
            }
            tester._save_final_results()
        
        # 9. 비동기 병렬 처리
        async_results = await tester.test_async_parallelism()
        for test_type, time_taken in async_results.items():
            if isinstance(time_taken, float):
                print(f"\n   {test_type}: {time_taken:.3f}초")
            else:
                print(f"\n   {test_type}: {time_taken:.2f}배")
        
        # 비동기 결과도 저장
        if async_results:
            tester.all_results["async_results"] = {
                test_type: round(time_taken, 3) if isinstance(time_taken, float) else round(time_taken, 2)
                for test_type, time_taken in async_results.items()
            }
            tester._save_final_results()
        
        # 요약
        tester.print_summary()
        
    except KeyboardInterrupt:
        print("\n\n⚠️ 테스트가 중단되었습니다.")
    except Exception as e:
        print(f"\n\n❌ 테스트 중 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())

