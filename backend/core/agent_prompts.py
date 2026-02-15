"""
Agent 기반 통합 챗 API 전용 프롬프트
- Plain 모드: RAG 기반 일반 법률 상담 (마크다운 형식)
- Contract 모드: 계약서 분석 결과 기반 챗
- Situation 모드: 상황 분석 결과 기반 챗
"""

import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

# ============================================================================
# Plain 모드 프롬프트 (RAG 기반 일반 법률 상담)
# ============================================================================

AGENT_PLAIN_SYSTEM_PROMPT = """법률 정보 안내 AI입니다. 노동법·민법·근로계약 실무에 특화되어 있습니다.

[규칙]
- RAG로 제공된 법령·가이드라인을 최우선 참고. 자료 부족 시 "제공된 자료가 제한적"임을 밝히고 일반 원칙 수준에서만 안내.
- 확인되지 않은 부분은 추측하지 말고 "통상적으로 ~인 경우가 많습니다" 같은 완화된 표현 사용.
- 답변은 한국어, 마크다운 형식(제목/목록/강조만). **3-5문장으로 매우 간결하게** 답변하세요.
- 핵심 결론 → 법적 근거 → 실무 조언 순으로 구성. 주의사항은 필요시만 짧게 추가.
"""


def build_agent_plain_prompt(
    query: str,
    legal_chunks: List[Any] = None,
    history_messages: List[Dict[str, Any]] = None,
) -> str:
    """
    Agent Plain 모드용 프롬프트 구성 (RAG 기반 일반 법률 상담)
    
    Args:
        query: 사용자 질문
        legal_chunks: RAG 검색 결과 (법령/가이드라인 청크)
        history_messages: 대화 히스토리 (최근 N개)
    
    Returns:
        완성된 프롬프트 문자열
    """
    # RAG 검색 결과 구성 (극한 최적화: 3개, 100자)
    rag_context = "## 참고 법령/가이드라인\n\n"
    if legal_chunks:
        for idx, chunk in enumerate(legal_chunks[:3], 1):  # 극한 최적화: 상위 3개
            source_type = getattr(chunk, "source_type", "law")
            title = getattr(chunk, "title", "제목 없음")
            snippet = getattr(chunk, "snippet", "")[:100]  # 극한 최적화: 100자로 제한

            # source_type 한글 변환
            source_type_kr = {
                "law": "법령",
                "manual": "가이드라인",
                "standard_contract": "표준계약서",
                "case": "사례",
            }.get(source_type, source_type)

            rag_context += f"{idx}. {title} ({source_type_kr})\n"
            if snippet:
                rag_context += f"   {snippet}\n\n"
            else:
                rag_context += "   (내용 없음)\n\n"
    else:
        rag_context += "검색된 법령/가이드라인이 없습니다.\n\n"

    # 대화 히스토리 구성 (극한 최적화: 2개, 60자)
    history_context = ""
    if history_messages and len(history_messages) > 0:
        recent_messages = history_messages[-2:]  # 극한 최적화: 최근 2개
        if recent_messages:
            history_context = "## 대화 히스토리\n\n"
            for msg in recent_messages:
                role = msg.get("sender_type", "user")
                content = msg.get("message", "")[:60]  # 극한 최적화: 60자로 제한
                role_kr = "사용자" if role == "user" else "어시스턴트"
                history_context += f"- {role_kr}: {content}\n"
            history_context += "\n"
    
    # 최종 프롬프트 (극한 최적화: 최소한의 구조만 유지)
    prompt = f"""{AGENT_PLAIN_SYSTEM_PROMPT}

## 질문
{query}

{history_context}{rag_context}"""
    
    return prompt


# ============================================================================
# Contract 모드 프롬프트 (계약서 분석 결과 기반 챗)
# ============================================================================

def build_agent_contract_prompt(
    query: str,
    contract_analysis: Dict[str, Any],
    legal_chunks: List[Any] = None,
    history_messages: List[Dict[str, Any]] = None,
) -> str:
    """
    Agent Contract 모드용 프롬프트 구성 (계약서 분석 결과 기반)
    
    Args:
        query: 사용자 질문
        contract_analysis: 계약서 분석 결과
        legal_chunks: RAG 검색 결과
        history_messages: 대화 히스토리
    
    Returns:
        완성된 프롬프트 문자열
    """
    # 첫 요청인지 확인 (히스토리가 없거나 첫 메시지인 경우)
    is_first_request = not history_messages or len(history_messages) == 0
    
    # 계약서 분석 결과 요약
    analysis_summary = f"""
## 계약서 분석 결과

**위험도**: {contract_analysis.get('risk_score', 0)}점 ({contract_analysis.get('risk_level', 'unknown')})

**요약**: {contract_analysis.get('summary', '')[:500]}

**발견된 위험 조항**: {len(contract_analysis.get('issues', []))}개
"""
    
    # 주요 이슈 상세 정보 (JSON 생성에 필요)
    issues_detail = ""
    issues = contract_analysis.get('issues', [])
    if issues:
        issues_detail = "\n### 발견된 위험 조항 상세\n\n"
        for idx, issue in enumerate(issues[:10], 1):  # 최대 10개
            issue_name = issue.get('name', '알 수 없음')
            issue_severity = issue.get('severity', 'medium')
            issue_summary = issue.get('summary', '') or issue.get('description', '')
            issue_category = issue.get('category', 'unknown')
            issue_explanation = issue.get('explanation', '')
            issue_original_text = issue.get('originalText', '')
            
            issues_detail += f"{idx}. **{issue_name}**\n"
            issues_detail += f"   - 카테고리: {issue_category}\n"
            issues_detail += f"   - 위험도: {issue_severity}\n"
            issues_detail += f"   - 요약: {issue_summary[:300]}\n"
            if issue_explanation:
                issues_detail += f"   - 설명: {issue_explanation[:300]}\n"
            if issue_original_text:
                issues_detail += f"   - 원문: {issue_original_text[:200]}\n"
            issues_detail += "\n"
    
    # RAG 검색 결과 (법적 근거)
    rag_context = ""
    legal_refs = []
    if legal_chunks:
        rag_context = "\n## 참고 법령/가이드라인\n\n"
        for idx, chunk in enumerate(legal_chunks[:5], 1):
            title = getattr(chunk, 'title', '제목 없음')
            snippet = getattr(chunk, 'snippet', '')[:200]
            rag_context += f"{idx}. **{title}**\n   {snippet}...\n\n"
            # 법적 근거로 사용
            legal_refs.append({
                "name": title,
                "description": snippet[:300] if snippet else ""
            })
    
    # 첫 요청일 때: JSON 형식으로 계약서 분석 리포트 생성
    if is_first_request:
        # 위험도 레벨 한글 변환
        risk_level_kr = {
            'high': '고',
            'medium': '중',
            'low': '저',
        }.get(contract_analysis.get('risk_level', 'medium'), '중')
        
        # riskContent 생성 (주요 위험 조항들)
        risk_content = []
        for issue in issues[:5]:  # 상위 5개
            issue_summary = issue.get('summary', '') or issue.get('description', '')
            issue_explanation = issue.get('explanation', '')
            if issue_summary:
                risk_content.append({
                    "내용": issue_summary[:200],
                    "설명": issue_explanation[:300] if issue_explanation else "계약서 분석 결과에서 발견된 위험 조항입니다."
                })
        
        # checklist 생성
        checklist = []
        for issue in issues[:5]:  # 상위 5개
            issue_name = issue.get('name', '알 수 없음')
            issue_summary = issue.get('summary', '') or issue.get('description', '')
            if issue_name and issue_summary:
                checklist.append({
                    "항목": issue_name,
                    "결론": issue_summary[:200]
                })
        
        # negotiationPoints 생성 (수정안 제안)
        negotiation_points = {}
        for idx, issue in enumerate(issues[:3], 1):  # 상위 3개
            issue_suggested = issue.get('suggestedRevision', '')
            if issue_suggested:
                negotiation_points[f"수정안{idx}"] = issue_suggested[:300]
            else:
                issue_name = issue.get('name', '알 수 없음')
                negotiation_points[f"수정안{idx}"] = f"계약서를 수정하여 {issue_name} 관련 조항을 개선합니다."
        
        prompt = f"""당신은 계약서 분석 결과를 바탕으로 사용자에게 계약서 분석 리포트를 제공하는 법률 상담 AI입니다.

{analysis_summary}
{issues_detail}
{rag_context}

## 사용자 질문
{query}

위의 계약서 분석 결과를 바탕으로 **JSON 형식**으로 계약서 분석 리포트를 생성하세요.

**반드시 다음 JSON 구조를 정확히 따르세요:**

**중요**: riskLevel은 반드시 "고", "중", "저" 중 하나만 사용하세요. 숫자나 다른 형식은 사용하지 마세요.

```json
{{
  "summary": "계약서 전체 요약 (2-3문장으로 핵심 위험 요소 요약)",
  "riskLevel": "{risk_level_kr}",
  "riskLevelDescription": "위험 수준에 대한 상세 설명 (왜 이 위험도인지 설명)",
  "riskContent": [
    {{
      "내용": "위험 요소 내용 (간단히)",
      "설명": "위험 요소에 대한 상세 설명"
    }}
  ],
  "checklist": [
    {{
      "항목": "체크리스트 항목",
      "결론": "해당 항목에 대한 결론"
    }}
  ],
  "negotiationPoints": {{
    "수정안1": "첫 번째 수정 제안",
    "수정안2": "두 번째 수정 제안"
  }},
  "legalReferences": [
    {{
      "name": "법적 근거 이름 (예: 근로기준법 제15조)",
      "description": "법적 근거 설명"
    }}
  ]
}}
```

**답변 작성 지침:**
1. **summary**: 계약서의 핵심 위험 요소를 2-3문장으로 요약하세요. 위에서 제공된 계약서 분석 결과의 요약을 참고하되, 더 구체적으로 작성하세요.
2. **riskLevel**: 반드시 "고", "중", "저" 중 하나만 사용하세요. 숫자나 다른 형식("0점", "high", "medium" 등)은 절대 사용하지 마세요. 현재 위험도 점수: {contract_analysis.get('risk_score', 0)}점, 등급: {contract_analysis.get('risk_level', 'unknown')}를 참고하여 적절한 한글 위험도를 선택하세요.
   - 70점 이상 또는 "high" → "고"
   - 40-69점 또는 "medium" → "중"
   - 39점 이하 또는 "low" → "저"
3. **riskLevelDescription**: 왜 이 위험도인지, 어떤 법적 분쟁 위험이 있는지 상세히 설명하세요.
4. **riskContent**: 발견된 위험 조항 중 가장 중요한 3-5개를 선택하여 배열로 작성하세요. 각 항목은 "내용"과 "설명"을 포함해야 합니다.
5. **checklist**: 사용자가 확인해야 할 주요 항목들을 배열로 작성하세요. 각 항목은 "항목"과 "결론"을 포함해야 합니다.
6. **negotiationPoints**: 계약서 수정을 위한 구체적인 제안을 2-3개 작성하세요. 키는 "수정안1", "수정안2" 형식으로 하세요.
7. **legalReferences**: 위에서 제공된 참고 법령/가이드라인을 참고하여 법적 근거를 배열로 작성하세요. 각 항목은 "name"과 "description"을 포함해야 합니다.
8. **모든 필드는 반드시 포함**해야 하며, 빈 배열이나 빈 객체가 되지 않도록 하세요.
9. **한국어로만 작성**하세요.
10. **반환 형식**: 다음 형식으로 반환하세요:
    - 먼저 ```json 코드 블록으로 JSON을 감싸세요
    - JSON 다음에 빈 줄 하나
    - 그 다음 "---" 구분선
    - 그 다음 빈 줄 하나
    - 마지막으로 "**⚠️ 참고:** 이 답변은 정보 안내를 위한 것이며 법률 자문이 아닙니다. 중요한 사안은 전문 변호사나 노동위원회 등 전문 기관에 상담하시기 바랍니다." 안내 문구 추가

**반환 형식 예시:**
```json
{{
  "summary": "...",
  "riskLevel": "...",
  ...
}}
```

---

**⚠️ 참고:** 이 답변은 정보 안내를 위한 것이며 법률 자문이 아닙니다. 중요한 사안은 전문 변호사나 노동위원회 등 전문 기관에 상담하시기 바랍니다.

**중요**: 반드시 위의 JSON 구조를 정확히 따르고, 모든 필드를 채워서 반환하세요.
"""
    else:
        # 후속 요청일 때: 마크다운 형식으로 답변
        prompt = f"""당신은 계약서 분석 결과를 바탕으로 사용자의 질문에 답변하는 법률 상담 AI입니다.

{analysis_summary}
{issues_detail}
{rag_context}

## 사용자 질문
{query}

위의 계약서 분석 결과와 참고 법령을 바탕으로 사용자 질문에 대해 **마크다운 형식**으로 답변하세요.

**답변 작성 지침:**
- 계약서 분석 결과에서 언급된 내용과 일관성 있게 답변하세요.
- 특정 조항에 대한 질문이면, 해당 조항의 위험도와 개선안을 포함하세요.
- 모든 답변은 한국어로만 작성하세요.
- 마크다운 형식(제목, 목록, 강조 등)을 활용하세요.
"""
    
    return prompt


# ============================================================================
# Situation 모드 프롬프트 (상황 분석 결과 기반 챗)
# ============================================================================

def build_agent_situation_prompt(
    query: str,
    situation_analysis: Dict[str, Any],
    legal_chunks: List[Any] = None,
    history_messages: List[Dict[str, Any]] = None,
) -> str:
    """
    Agent Situation 모드용 프롬프트 구성 (상황 분석 결과 기반)
    
    Args:
        query: 사용자 질문
        situation_analysis: 상황 분석 결과
        legal_chunks: RAG 검색 결과
        history_messages: 대화 히스토리
    
    Returns:
        완성된 프롬프트 문자열
    """
    # 상황 분석 결과 요약
    analysis_summary = f"""
## 상황 분석 결과

**위험도**: {situation_analysis.get('risk_score', 0)}점 ({situation_analysis.get('risk_level', 'unknown')})

**요약**: {situation_analysis.get('summary', '')[:500]}

**법적 판단 기준**: {len(situation_analysis.get('criteria', []))}개
**발견된 쟁점**: {len(situation_analysis.get('findings', []))}개
"""
    
    # 주요 findings 요약
    findings_summary = ""
    findings = situation_analysis.get('findings', [])[:5]  # 상위 5개만
    if findings:
        findings_summary = "\n### 주요 법적 쟁점\n\n"
        for idx, finding in enumerate(findings, 1):
            finding_title = finding.get('title', '알 수 없음')
            finding_status = finding.get('statusLabel', '')
            finding_basis = finding.get('basisText', '')[:200]
            findings_summary += f"{idx}. **{finding_title}** ({finding_status})\n"
            findings_summary += f"   {finding_basis}...\n\n"
    
    # RAG 검색 결과
    rag_context = ""
    legal_refs = []
    if legal_chunks:
        rag_context = "\n## 참고 법령/가이드라인\n\n"
        for idx, chunk in enumerate(legal_chunks[:5], 1):
            title = getattr(chunk, 'title', '제목 없음')
            snippet = getattr(chunk, 'snippet', '')[:200]
            rag_context += f"{idx}. **{title}**\n   {snippet}...\n\n"
            # 법적 근거로 사용
            legal_refs.append({
                "name": title,
                "description": snippet[:300] if snippet else ""
            })
    
    # 행동 항목 생성 (findings와 criteria 기반)
    actions_list = []
    criteria = situation_analysis.get('criteria', [])
    findings = situation_analysis.get('findings', [])
    
    # criteria에서 행동 항목 추출
    for idx, criterion in enumerate(criteria[:3], 1):
        criterion_name = criterion.get('name', '')
        if criterion_name:
            actions_list.append({
                "description": f"{criterion_name}에 대해 확인하세요",
                "key": str(idx)
            })
    
    # findings에서 추가 행동 항목 추출
    for idx, finding in enumerate(findings[:2], len(actions_list) + 1):
        finding_title = finding.get('title', '')
        if finding_title:
            actions_list.append({
                "description": f"{finding_title} 관련 조치를 취하세요",
                "key": str(idx)
            })
    
    # 기본 행동 항목이 없으면 기본값 추가
    if not actions_list:
        actions_list = [
            {"description": "현재 업체의 규정에 대해 파악하세요", "key": "1"},
            {"description": "관련 법령을 확인하세요", "key": "2"},
            {"description": "필요한 경우 전문가 상담을 받으세요", "key": "3"}
        ]
    
    prompt = f"""당신은 상황 분석 결과를 바탕으로 사용자의 질문에 답변하는 법률 상담 AI입니다.

{analysis_summary}
{findings_summary}
{rag_context}

## 사용자 질문
{query}

위의 상황 분석 결과와 참고 법령을 바탕으로 **JSON 형식**으로 상황 분석 리포트를 생성하세요.

**반드시 다음 JSON 구조를 정확히 따르세요:**


{{
  "reportTitle": "상황 분석의 결과",
  "legalPerspective": {{
    "description": "법적 관점에서 본 현재 상황 설명 (2-3문장으로 핵심 내용 요약)",
    "references": [
      {{
        "name": "법적 근거 이름 (예: 근로기준법 제26조)",
        "description": "법적 근거 설명"
      }}
    ]
  }},
  "actions": [
    {{
      "description": "행동 항목 설명",
      "key": "1"
    }}
  ],
  "cases": [
    {{
      "id": "케이스 ID",
      "title": "케이스 제목",
      "situation": "상황 설명",
      "main_issues": ["이슈1", "이슈2"],
      "category": "intern",
      "severity": "high",
      "keywords": ["#이슈1", "#이슈2"],
      "legalIssues": ["법적 쟁점1", "법적 쟁점2"],
      "learnings": ["배울 점1", "배울 점2"],
      "actions": ["행동 가이드1", "행동 가이드2"]
    }}
  ]
}}


**답변 작성 지침:**

1. **reportTitle**: 상황 분석 리포트의 제목 (예: "상황 분석의 결과")

2. **legalPerspective.description**: 
   - 현재 상황을 법적으로 평가한 내용을 2-3문장으로 작성하세요.
   - 위에서 제공된 상황 분석 결과의 요약과 법적 판단 기준을 참고하여 작성하세요.
   - 관련 법령을 명시적으로 언급하세요.

3. **legalPerspective.references**: 
   - 위의 "참고 법령/가이드라인" 섹션에서 제공된 법령을 참고하여 작성하세요.
   - 최소 1개 이상의 참고 문서를 포함하세요.
   - 각 항목은 "name"과 "description"을 포함해야 합니다.

4. **actions**: 
   - 사용자가 할 수 있는 구체적인 행동 항목을 배열로 작성하세요.
   - 상황 분석 결과의 criteria와 findings를 참고하여 작성하세요.
   - 최소 3개 이상의 행동 항목을 포함하세요.
   - 각 항목은 "description"과 "key" (예: "1", "2", "3")를 포함해야 합니다.

5. **cases**: 
   - 위의 "참고 법령/가이드라인" 섹션에서 source_type이 'case'인 항목들을 케이스 카드 형태로 변환하여 배열로 작성하세요.
   - 각 케이스는 id, title, situation, main_issues, category, severity, keywords, legalIssues, learnings, actions를 포함해야 합니다.
   - case 타입이 없으면 빈 배열 []을 반환하세요.

**⚠️ 매우 중요한 출력 형식 규칙:**
- **반드시 json 코드 블록 형식으로 응답하세요.**
- **JSON 코드 블록 안에 유효한 JSON 객체만 포함하세요.**
- **JSON 외에 다른 설명, 마크다운 헤더, 자연어, 번호 목록은 절대 포함하지 마세요.**
- **"1. SituationChatResponse:" 같은 텍스트를 앞에 붙이지 마세요.**
- **"2. 대화 예시:" 같은 추가 설명을 포함하지 마세요.**
- 모든 문자열은 반드시 한국어로 작성하세요.

**반환 형식 예시:**

{{
  "reportTitle": "상황 분석의 결과",
  "legalPerspective": {{
    "description": "당사는 법적으로 주말 근무에 대한 규정을 분석하였습니다. 현재, 우리 회사는 주말 근무를 원칙으로 제시하고 있지 않으며, 공공기관의 경우 법에 따라 주말 근무가 필요한 경우만 허용할 수 있습니다.",
    "references": [
      {{
        "name": "공공기업 근로조건에 관한 법률",
        "description": "이 법에 따르면, 공공기관은 주말 근무가 필요하고 있는 경우만 허용할 수 있습니다."
      }}
    ]
  }},
  "actions": [
    {{
      "description": "현재 업체의 규정에 대해 파악하세요",
      "key": "1"
    }}
  ],
  "cases": []
}}

"""
    
    return prompt

