import type { ContractRiskResult } from "@/types/contract"
import { ContractRiskBubble } from "./ContractRiskBubble"
import { MarkdownRenderer } from "@/components/rag/MarkdownRenderer"

interface ChatAiMessageProps {
  content: string  // LLM이 준 raw string
}

export function ChatAiMessage({ content }: ChatAiMessageProps) {
  let parsed: ContractRiskResult | null = null
  let disclaimer: string | null = null

  try {
    let jsonPart = content
    
    // --- 구분선 찾기 (JSON과 안내 문구 사이)
    const separatorIndex = jsonPart.indexOf('---')
    if (separatorIndex !== -1) {
      jsonPart = jsonPart.substring(0, separatorIndex).trim()
      disclaimer = content.substring(separatorIndex).trim()
    } else {
      // ⚠️ 뒤에 붙는 안내 문구 분리 (구분선이 없는 경우)
      const warningIndex = content.indexOf("⚠️")
      if (warningIndex !== -1) {
        jsonPart = content.substring(0, warningIndex).trim()
        disclaimer = content.substring(warningIndex).trim()
      }
    }
    
    // ```json 코드 블록 제거
    jsonPart = jsonPart.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    
    // JSON 객체 시작/끝 찾기 (중괄호로 감싸진 부분만 추출)
    const firstBrace = jsonPart.indexOf('{')
    const lastBrace = jsonPart.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonPart = jsonPart.substring(firstBrace, lastBrace + 1)
    }
    
    // JSON 파싱 시도
    parsed = JSON.parse(jsonPart)
    
    // ContractRiskResult 타입 검증 (최소한의 필수 필드 확인)
    if (!parsed || typeof parsed !== 'object' || !parsed.summary) {
      parsed = null
    }
  } catch (e) {
    parsed = null
  }

  return (
    <div>
      {parsed ? (
        <ContractRiskBubble result={parsed} />
      ) : (
        <div className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-code:text-blue-600 prose-pre:bg-slate-50 prose-pre:border prose-pre:border-slate-200 text-sm leading-relaxed">
          <MarkdownRenderer content={content} />
        </div>
      )}

      {disclaimer && (
        <p className="mt-3 text-[11px] text-slate-500 whitespace-pre-wrap border-t border-slate-200 pt-2">
          {disclaimer}
        </p>
      )}
    </div>
  )
}

