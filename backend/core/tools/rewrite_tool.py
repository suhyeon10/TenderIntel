"""
RewriteTool - AI 기반 조항 자동 리라이트 도구
위험 조항을 법적으로 안전한 문구로 자동 수정
"""

from typing import List, Dict, Any, Optional
import logging

from .base_tool import BaseTool
from ..generator_v2 import LLMGenerator

logger = logging.getLogger(__name__)


class RewriteTool(BaseTool):
    """AI 기반 조항 자동 리라이트 도구"""
    
    def __init__(self):
        """도구 초기화"""
        self.generator = LLMGenerator()
    
    @property
    def name(self) -> str:
        return "RewriteTool"
    
    @property
    def description(self) -> str:
        return "위험 조항을 법적으로 안전한 문구로 자동 수정"
    
    async def execute(
        self,
        original_text: str,
        issue_id: Optional[str] = None,
        legal_basis: List[str] = None,
        contract_type: str = "employment",
        **kwargs
    ) -> Dict[str, Any]:
        """
        조항 리라이트 실행
        
        Args:
            original_text: 원본 조항 텍스트
            issue_id: 관련 issue ID (선택)
            legal_basis: 법적 근거 리스트
            contract_type: 계약서 타입
            **kwargs: 추가 옵션
        
        Returns:
            {
                "originalText": str,
                "rewrittenText": str,
                "explanation": str,
                "legalBasis": List[str]
            }
        """
        self.log_execution(original_text_length=len(original_text), issue_id=issue_id)
        
        # 입력 검증
        self.validate_input(["original_text"], original_text=original_text)
        
        if not original_text or not original_text.strip():
            return {
                "originalText": original_text,
                "rewrittenText": original_text,
                "explanation": "수정할 내용이 없습니다.",
                "legalBasis": []
            }
        
        try:
            # LLM 비활성화 시 기본 응답
            if self.generator.disable_llm:
                return self._generate_default_rewrite(original_text, legal_basis or [])
            
            # LLM 기반 리라이트 생성
            rewrite_result = await self._generate_llm_rewrite(
                original_text=original_text,
                legal_basis=legal_basis or [],
                contract_type=contract_type
            )
            
            result = {
                "originalText": original_text,
                "rewrittenText": rewrite_result.get("rewritten_text", original_text),
                "explanation": rewrite_result.get("explanation", ""),
                "legalBasis": rewrite_result.get("legal_basis", legal_basis or [])
            }
            
            self.log_result(result)
            return result
            
        except Exception as e:
            logger.error(f"[{self.name}] 실행 실패: {str(e)}", exc_info=True)
            # 실패 시 원본 반환
            return {
                "originalText": original_text,
                "rewrittenText": original_text,
                "explanation": f"리라이트 생성 중 오류가 발생했습니다: {str(e)}",
                "legalBasis": legal_basis or []
            }
    
    async def _generate_llm_rewrite(
        self,
        original_text: str,
        legal_basis: List[str],
        contract_type: str
    ) -> Dict[str, Any]:
        """LLM 기반 리라이트 생성"""
        
        # 원문에서 조항 제목 제거 (있는 경우)
        import re
        # "제N조" 또는 "N. 제목" 형식 제거
        cleaned_text = original_text
        # 조항 제목 패턴 제거 (예: "7. 연차유급휴가" 또는 "제7조 연차유급휴가")
        cleaned_text = re.sub(r'^\d+\.\s*[^\n]+\n', '', cleaned_text, flags=re.MULTILINE)
        cleaned_text = re.sub(r'^제\s*\d+\s*조[^\n]*\n', '', cleaned_text, flags=re.MULTILINE)
        cleaned_text = cleaned_text.strip()
        
        # 조항 제목 추출 (있는 경우)
        title_match = re.search(r'(\d+\.\s*[^\n]+|제\s*\d+\s*조[^\n]*)', original_text)
        clause_title = title_match.group(0).strip() if title_match else None
        
        # 프롬프트 구성
        legal_basis_text = "\n".join([f"- {basis}" for basis in legal_basis]) if legal_basis else "없음"
        
        # 원문에서 조항 제목 제거 (있는 경우)
        import re
        # "제N조" 또는 "N. 제목" 형식 제거
        cleaned_text = original_text
        # 조항 제목 패턴 제거 (예: "7. 연차유급휴가" 또는 "제7조 연차유급휴가")
        cleaned_text = re.sub(r'^\d+\.\s*[^\n]+\n', '', cleaned_text, flags=re.MULTILINE)
        cleaned_text = re.sub(r'^제\s*\d+\s*조[^\n]*\n', '', cleaned_text, flags=re.MULTILINE)
        cleaned_text = cleaned_text.strip()
        
        # 조항 제목 추출 (있는 경우)
        title_match = re.search(r'(\d+\.\s*[^\n]+|제\s*\d+\s*조[^\n]*)', original_text)
        clause_title = title_match.group(0).strip() if title_match else None
        
        prompt = f"""다음 계약서 조항을 법적으로 안전하고 명확한 문구로 수정해주세요.

**원본 조항 본문:**
{cleaned_text}

**관련 법적 근거:**
{legal_basis_text}

**계약서 타입:** {contract_type}

**요구사항:**
1. 조항 제목은 그대로 유지하고, 본문만 법적으로 문제가 없는 명확한 문구로 수정
2. 근로기준법, 노동법 등 관련 법령을 준수
3. 근로자에게 불리한 조항은 공정한 조항으로 변경
4. 모호한 표현은 구체적으로 명시
5. 수정 이유를 2-3문장으로 간단히 설명 (법적 근거 포함)
6. 관련 법령 조문을 명시

**⚠️ 중요한 출력 형식 규칙:**
- 반드시 유효한 JSON 형식으로만 응답하세요.
- JSON 외에 다른 설명, 마크다운 헤더, 자연어는 절대 포함하지 마세요.
- 모든 문자열은 반드시 한국어로 작성하세요.
- rewritten_text에는 조항 제목을 포함하지 말고 본문만 수정된 내용을 반환하세요.

**응답 형식 (JSON만 반환):**
{{
    "rewritten_text": "수정된 조항 본문만 (조항 제목 제외, 원본과 다른 부분을 명확히 표시)",
    "explanation": "수정 이유 설명 (2-3문장, 법적 근거 포함, 구체적으로 작성)",
    "legal_basis": ["관련 법령 조문", "예: 근로기준법 제60조"]
}}

**예시:**
- 원본: "연차유급휴가는 회사 사정에 따라 부여하지 않을 수 있음"
- rewritten_text: "연차유급휴가는 근로기준법 제60조에 따라 부여하며, 업무상 중대한 지장이 있는 경우에는 근로자와 협의하여 사용 시기를 변경할 수 있음"
- explanation: "근로기준법 제60조는 연차유급휴가 부여를 사용자의 의무로 규정하고 있습니다. '회사 사정에 따라 부여하지 않을 수 있다'는 표현은 이 의무를 위반하는 것으로, 무효일 수 있습니다. 따라서 부여 자체는 의무이되, 시기 변경은 협의를 통해 가능하다는 내용으로 수정했습니다."

**JSON 형식만 반환하세요. JSON 앞뒤에 설명을 추가하지 마세요.**
"""
        
        try:
            response = await self.generator.generate(prompt)
            
            # JSON 파싱 시도
            import json
            import re
            try:
                # JSON 코드 블록 제거
                response_clean = response.strip()
                
                # ```json ... ``` 형식 제거
                json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response_clean)
                if json_match:
                    response_clean = json_match.group(1).strip()
                else:
                    # 직접 JSON 추출 시도
                    json_match = re.search(r'\{[\s\S]*\}', response_clean, re.DOTALL)
                    if json_match:
                        response_clean = json_match.group(0)
                
                # 불완전한 JSON 처리 (마지막 중괄호까지 찾기)
                brace_count = 0
                last_valid_pos = -1
                for i, char in enumerate(response_clean):
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            last_valid_pos = i + 1
                            break
                
                if last_valid_pos > 0:
                    response_clean = response_clean[:last_valid_pos]
                
                response_clean = response_clean.strip()
                
                result = json.loads(response_clean)
                
                # 필수 필드 검증
                if not result.get("rewritten_text") and not result.get("rewrittenText"):
                    logger.warning("JSON 파싱 성공했으나 rewritten_text 필드가 없음")
                    return self._parse_text_response(response, original_text, legal_basis)
                
                # 필드명 정규화 및 explanation 검증
                explanation = result.get("explanation", "")
                # explanation이 배열이거나 잘못된 형식인 경우 처리
                if isinstance(explanation, list):
                    explanation = " ".join([str(item) for item in explanation])
                elif not isinstance(explanation, str):
                    explanation = str(explanation) if explanation else "조항이 법적으로 안전한 문구로 수정되었습니다."
                
                # explanation이 비어있거나 legal_basis만 있는 경우 기본 메시지
                if not explanation or explanation.strip() == "":
                    explanation = "조항이 법적으로 안전한 문구로 수정되었습니다."
                
                rewritten_text = result.get("rewritten_text") or result.get("rewrittenText", cleaned_text)
                # 조항 제목이 포함되어 있으면 제거
                if rewritten_text and clause_title:
                    rewritten_text = re.sub(rf'^{re.escape(clause_title)}\s*\n?', '', rewritten_text, flags=re.MULTILINE).strip()
                
                return {
                    "rewritten_text": rewritten_text,
                    "explanation": explanation,
                    "legal_basis": result.get("legal_basis") or result.get("legalBasis", legal_basis)
                }
            except (json.JSONDecodeError, KeyError, ValueError) as e:
                logger.warning(f"JSON 파싱 실패: {str(e)}, 텍스트 파싱으로 전환")
                logger.debug(f"응답 원문 (처음 500자): {response[:500]}")
                # JSON 파싱 실패 시 텍스트에서 추출
                return self._parse_text_response(response, original_text, legal_basis)
                
        except Exception as e:
            logger.error(f"LLM 리라이트 생성 실패: {str(e)}")
            return self._generate_default_rewrite(original_text, legal_basis)
    
    def _parse_text_response(
        self,
        response: str,
        original_text: str,
        legal_basis: List[str]
    ) -> Dict[str, Any]:
        """텍스트 응답 파싱 (JSON 파싱 실패 시 대체 로직)"""
        import re
        
        rewritten_text = original_text  # 기본값
        explanation = ""
        
        # 1. JSON 형식 다시 시도 (더 유연한 파싱)
        try:
            # 중괄호로 감싸진 부분 찾기
            json_match = re.search(r'\{[\s\S]*\}', response, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                # 마지막 중괄호까지 찾기 (불완전한 JSON 처리)
                brace_count = 0
                last_valid_pos = -1
                for i, char in enumerate(json_str):
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            last_valid_pos = i + 1
                            break
                
                if last_valid_pos > 0:
                    json_str = json_str[:last_valid_pos]
                    try:
                        import json
                        parsed = json.loads(json_str)
                        rewritten_text = parsed.get("rewritten_text", parsed.get("rewrittenText", original_text))
                        explanation = parsed.get("explanation", parsed.get("explanation", ""))
                        if not explanation:
                            explanation = "조항이 법적으로 안전한 문구로 수정되었습니다."
                        return {
                            "rewritten_text": rewritten_text,
                            "explanation": explanation,
                            "legal_basis": parsed.get("legal_basis", parsed.get("legalBasis", legal_basis))
                        }
                    except:
                        pass
        except:
            pass
        
        # 2. 텍스트에서 직접 추출 시도
        lines = response.split('\n')
        in_rewritten_section = False
        rewritten_lines = []
        explanation_lines = []
        
        for i, line in enumerate(lines):
            line_lower = line.lower().strip()
            
            # 수정된 조항 섹션 찾기
            if any(keyword in line_lower for keyword in ["수정된", "rewritten", "수정안", "개선된", "revised"]):
                in_rewritten_section = True
                # 다음 줄부터 수정된 텍스트일 가능성
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    if next_line and not next_line.startswith(("**", "#", "-", "1.", "2.")):
                        rewritten_lines.append(next_line)
                continue
            
            # 설명 섹션 찾기
            if any(keyword in line_lower for keyword in ["설명", "explanation", "이유", "reason", "rationale"]):
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    if next_line:
                        explanation_lines.append(next_line)
                continue
            
            # 수정된 조항 섹션 내에서 텍스트 수집
            if in_rewritten_section:
                stripped = line.strip()
                if stripped and not stripped.startswith(("**", "#", "-", "1.", "2.", "{", "}", "```")):
                    rewritten_lines.append(stripped)
                elif stripped.startswith(("**", "#", "-")):
                    # 섹션 종료로 판단
                    in_rewritten_section = False
        
        # 수정된 텍스트 추출
        if rewritten_lines:
            rewritten_text = "\n".join(rewritten_lines).strip()
            # 따옴표 제거
            rewritten_text = re.sub(r'^["\']|["\']$', '', rewritten_text)
        
        # 설명 추출
        if explanation_lines:
            explanation = "\n".join(explanation_lines).strip()
        elif not explanation:
            # 기본 설명 생성
            if rewritten_text != original_text:
                explanation = "조항이 법적으로 안전하고 명확한 문구로 수정되었습니다. 관련 법령을 준수하며 근로자에게 불리한 표현을 개선했습니다."
            else:
                explanation = "LLM 응답에서 수정된 조항을 추출하지 못했습니다. 원본 조항을 그대로 반환합니다."
        
        logger.warning(f"JSON 파싱 실패, 텍스트 파싱 결과: rewritten_text 길이={len(rewritten_text)}, explanation 길이={len(explanation)}")
        
        return {
            "rewritten_text": rewritten_text if rewritten_text else original_text,
            "explanation": explanation,
            "legal_basis": legal_basis
        }
    
    def _generate_default_rewrite(
        self,
        original_text: str,
        legal_basis: List[str]
    ) -> Dict[str, Any]:
        """기본 리라이트 생성 (LLM 비활성화 시)"""
        # 간단한 규칙 기반 수정
        rewritten_text = original_text
        
        # 위험 키워드 치환
        replacements = {
            "사전 통보 없이": "최소 30일 전 서면 통보 후",
            "임의로": "법적 절차에 따라",
            "즉시": "법적 통지 기간을 준수하여",
            "무조건": "법적 요건을 충족하는 경우에 한하여"
        }
        
        for old, new in replacements.items():
            if old in rewritten_text:
                rewritten_text = rewritten_text.replace(old, new)
        
        explanation = "기본 규칙 기반 수정이 적용되었습니다. 더 정확한 수정을 위해서는 LLM을 활성화해주세요."
        
        return {
            "rewritten_text": rewritten_text,
            "explanation": explanation,
            "legal_basis": legal_basis
        }

