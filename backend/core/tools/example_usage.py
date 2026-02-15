"""
도구 사용 예시 (Phase 1 & Phase 2)
"""

import asyncio
from document_parser_tool import DocumentParserTool
from vector_search_tool import VectorSearchTool
from provision_matching_tool import ProvisionMatchingTool
from risk_scoring_tool import RiskScoringTool
from llm_explanation_tool import LLMExplanationTool


async def example_document_parser():
    """DocumentParserTool 사용 예시"""
    print("=== DocumentParserTool 예시 ===\n")
    
    tool = DocumentParserTool()
    
    # PDF 파일 파싱
    result = await tool.parse(
        file_path="data/legal/standard_contracts/개정 표준근로계약서(2025년, 배포).hwp",
        file_type="hwp",
        extract_provisions=True
    )
    
    print(f"추출된 텍스트 길이: {len(result['extracted_text'])}자")
    print(f"청크 개수: {len(result['chunks'])}개")
    print(f"조항 개수: {len(result['provisions'])}개")
    print(f"\n조항 목록:")
    for prov in result['provisions'][:5]:  # 처음 5개만
        print(f"  - {prov['title']} (조 번호: {prov.get('article_number', 'N/A')})")
    
    return result


async def example_vector_search():
    """VectorSearchTool 사용 예시"""
    print("\n=== VectorSearchTool 예시 ===\n")
    
    tool = VectorSearchTool()
    
    # Hybrid Search + MMR
    result = await tool.search(
        query="수습 기간 해고 조건",
        doc_types=["law", "manual"],
        top_k=5,
        use_hybrid=True,
        use_mmr=True
    )
    
    print(f"검색 결과: {result['count']}개")
    print(f"검색 타입: {result['search_type']}")
    print(f"\n검색 결과:")
    for r in result['results'][:3]:  # 처음 3개만
        print(f"  - [{r['source_type']}] {r['title']}")
        print(f"    점수: {r['score']:.3f}")
        print(f"    내용: {r['content'][:100]}...")
    
    return result


async def example_provision_matching():
    """ProvisionMatchingTool 사용 예시"""
    print("\n=== ProvisionMatchingTool 예시 ===\n")
    
    # 먼저 문서 파싱
    parser = DocumentParserTool()
    parse_result = await parser.parse(
        file_path="data/legal/standard_contracts/개정 표준근로계약서(2025년, 배포).hwp",
        extract_provisions=True
    )
    
    # 조항 매칭
    matcher = ProvisionMatchingTool()
    match_result = await matcher.match(
        contract_text=parse_result["extracted_text"],
        contract_provisions=parse_result["provisions"],
        standard_contract_type="employment"
    )
    
    print(f"매칭된 조항: {len(match_result['matched_provisions'])}개")
    print(f"누락된 조항: {len(match_result['missing_provisions'])}개")
    print(f"과도한 조항: {len(match_result['excessive_provisions'])}개")
    print(f"\n매칭 요약: {match_result['summary']}")
    
    return match_result


async def example_risk_scoring():
    """RiskScoringTool 사용 예시"""
    print("\n=== RiskScoringTool 예시 ===\n")
    
    # 1. 문서 파싱
    parser = DocumentParserTool()
    parse_result = await parser.parse(
        file_path="data/legal/standard_contracts/개정 표준근로계약서(2025년, 배포).hwp",
        extract_provisions=True
    )
    
    # 2. 조항 매칭
    matcher = ProvisionMatchingTool()
    match_result = await matcher.match(
        contract_text=parse_result["extracted_text"],
        contract_provisions=parse_result["provisions"],
        standard_contract_type="employment"
    )
    
    # 3. 법령 검색
    searcher = VectorSearchTool()
    search_result = await searcher.search(
        query=parse_result["extracted_text"][:2000],
        doc_types=["law", "manual"],
        top_k=5
    )
    
    # 4. 위험도 산정
    scorer = RiskScoringTool()
    risk_result = await scorer.score(
        provisions=parse_result["provisions"],
        matched_provisions=match_result["matched_provisions"],
        legal_contexts=search_result["results"],
        contract_type="employment"
    )
    
    print(f"전체 위험도: {risk_result['overall_risk_score']:.1f}점")
    print(f"위험 레벨: {risk_result['risk_level']}")
    print(f"\n영역별 위험도:")
    for category, score in risk_result['risk_breakdown'].items():
        print(f"  - {category}: {score:.1f}점")
    print(f"\n심각한 이슈: {len(risk_result['critical_issues'])}개")
    for issue in risk_result['critical_issues'][:3]:
        print(f"  - {issue}")
    
    return risk_result


async def example_llm_explanation():
    """LLMExplanationTool 사용 예시"""
    print("\n=== LLMExplanationTool 예시 ===\n")
    
    # 1. 문서 파싱
    parser = DocumentParserTool()
    parse_result = await parser.parse(
        file_path="data/legal/standard_contracts/개정 표준근로계약서(2025년, 배포).hwp",
        extract_provisions=True
    )
    
    # 2. 위험도 산정 (간단히)
    scorer = RiskScoringTool()
    risk_result = await scorer.score(
        provisions=parse_result["provisions"][:3],  # 처음 3개만
        contract_type="employment"
    )
    
    # 3. 법령 검색
    searcher = VectorSearchTool()
    search_result = await searcher.search(
        query="수습 기간 해고",
        doc_types=["law", "manual"],
        top_k=3
    )
    
    # 4. 위험도가 높은 조항에 대해 설명 생성
    explainer = LLMExplanationTool()
    
    for pr in risk_result["provision_risks"][:2]:  # 처음 2개만
        if pr["risk_score"] > 30:
            explanation = await explainer.explain(
                provision=pr["provision"],
                risk_score=pr["risk_score"],
                legal_contexts=search_result["results"],
                issue_type=pr["issue_type"]
            )
            
            print(f"\n[조항] {pr['provision']['title']}")
            print(f"위험도: {pr['risk_score']:.1f}점")
            print(f"\n설명:")
            print(f"  {explanation['explanation']}")
            print(f"\n관련 법령:")
            for basis in explanation['legal_basis'][:3]:
                print(f"  - {basis}")
            print(f"\n수정 제안:")
            print(f"  {explanation['suggested_revision']}")
            print(f"\n질문 스크립트:")
            for q in explanation['suggested_questions'][:2]:
                print(f"  - {q}")
    
    return explanation


async def example_full_pipeline():
    """전체 파이프라인 예시"""
    print("\n=== 전체 파이프라인 예시 ===\n")
    
    # 1. 문서 파싱
    parser = DocumentParserTool()
    parse_result = await parser.parse(
        file_path="data/legal/standard_contracts/개정 표준근로계약서(2025년, 배포).hwp",
        extract_provisions=True
    )
    
    # 2. 조항 매칭
    matcher = ProvisionMatchingTool()
    match_result = await matcher.match(
        contract_text=parse_result["extracted_text"],
        contract_provisions=parse_result["provisions"],
        standard_contract_type="employment"
    )
    
    # 3. 법령 검색
    searcher = VectorSearchTool()
    search_result = await searcher.search(
        query=parse_result["extracted_text"][:2000],
        doc_types=["law", "standard_contract", "manual"],
        top_k=10,
        use_hybrid=True,
        use_mmr=True
    )
    
    # 4. 위험도 산정
    scorer = RiskScoringTool()
    risk_result = await scorer.score(
        provisions=parse_result["provisions"],
        matched_provisions=match_result["matched_provisions"],
        legal_contexts=search_result["results"],
        contract_type="employment"
    )
    
    # 5. 위험도가 높은 조항에 대해 설명 생성
    explainer = LLMExplanationTool()
    explanations = []
    
    for pr in risk_result["provision_risks"]:
        if pr["risk_score"] >= 40:  # 위험도 40 이상만
            explanation = await explainer.explain(
                provision=pr["provision"],
                risk_score=pr["risk_score"],
                legal_contexts=search_result["results"],
                issue_type=pr["issue_type"]
            )
            explanations.append({
                "provision": pr["provision"],
                "risk_score": pr["risk_score"],
                "explanation": explanation
            })
    
    # 최종 결과 요약
    print("=== 분석 결과 요약 ===")
    print(f"문서 ID: {parse_result['metadata']['doc_id']}")
    print(f"조항 개수: {len(parse_result['provisions'])}개")
    print(f"매칭률: {match_result['matching_scores']['total_match_rate']*100:.1f}%")
    print(f"전체 위험도: {risk_result['overall_risk_score']:.1f}점 ({risk_result['risk_level']})")
    print(f"누락된 조항: {len(match_result['missing_provisions'])}개")
    print(f"과도한 조항: {len(match_result['excessive_provisions'])}개")
    print(f"심각한 이슈: {len(risk_result['critical_issues'])}개")
    print(f"상세 설명 생성: {len(explanations)}개")
    
    return {
        "parse_result": parse_result,
        "match_result": match_result,
        "search_result": search_result,
        "risk_result": risk_result,
        "explanations": explanations
    }


async def main():
    """메인 함수"""
    try:
        # 개별 도구 예시
        # await example_document_parser()
        # await example_vector_search()
        # await example_provision_matching()
        # await example_risk_scoring()
        # await example_llm_explanation()
        
        # 전체 파이프라인 예시
        await example_full_pipeline()
        
    except Exception as e:
        print(f"오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())

