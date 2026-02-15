import type { ContractRiskResult } from "@/types/contract"

const badgeColor: Record<string, string> = {
  "고": "bg-red-100 text-red-700 border-red-300",
  "중": "bg-amber-100 text-amber-700 border-amber-300",
  "저": "bg-emerald-100 text-emerald-700 border-emerald-300",
}

interface Props {
  result: ContractRiskResult
}

export function ContractRiskBubble({ result }: Props) {
  const riskClass = badgeColor[result.riskLevel] ?? "bg-slate-100 text-slate-700 border-slate-300"

  return (
    <div className="space-y-3">
      {/* 상단 요약 및 위험도 */}
      <div className="space-y-2">
        {/* 위험도 배지 */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">
            위험도
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold border ${riskClass}`}
          >
            {result.riskLevel}
          </span>
        </div>
        
        {/* 요약 (summary) */}
        {result.summary && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
            <p className="text-sm text-slate-900 leading-relaxed font-medium">
              {result.summary}
            </p>
          </div>
        )}
        
        {/* 위험도 설명 (riskLevelDescription) */}
        {result.riskLevelDescription && result.riskLevelDescription !== result.summary && (
          <p className="text-xs text-slate-700 leading-relaxed">
            {result.riskLevelDescription}
          </p>
        )}
      </div>

      {/* 핵심 위험 포인트 */}
      {Array.isArray(result.riskContent) && result.riskContent.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <span className="text-base">🔍</span>
            핵심 위험 포인트
          </p>
          <ul className="space-y-2">
            {result.riskContent.map((item, i) => {
              // 객체 형식: { 내용: string, 설명: string }
              if (typeof item === 'object' && item !== null && '내용' in item) {
                return (
                  <li
                    key={i}
                    className="rounded-lg bg-red-50/50 border border-red-200 px-3 py-2.5"
                  >
                    <p className="font-semibold text-xs text-red-900 mb-1">{item.내용}</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{item.설명}</p>
                  </li>
                )
              }
              // 문자열 형식: string (fallback)
              return (
                <li
                  key={i}
                  className="rounded-lg bg-red-50/50 border border-red-200 px-3 py-2.5"
                >
                  <p className="text-xs text-slate-700 leading-relaxed">{String(item)}</p>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 체크리스트 */}
      {Array.isArray(result.checklist) && result.checklist.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <span className="text-base">✅</span>
            꼭 확인해 볼 것
          </p>
          <ul className="space-y-2">
            {result.checklist.map((item, i) => {
              // 객체 형식: { 항목: string, 결론: string }
              if (typeof item === 'object' && item !== null && '항목' in item) {
                return (
                  <li key={i} className="rounded-lg bg-amber-50/50 border border-amber-200 px-3 py-2.5">
                    <p className="font-semibold text-xs text-slate-900 mb-1">• {item.항목}</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{item.결론}</p>
                  </li>
                )
              }
              // 문자열 형식: string (fallback)
              return (
                <li key={i} className="rounded-lg bg-amber-50/50 border border-amber-200 px-3 py-2.5">
                  <p className="text-xs text-slate-700 leading-relaxed">• {String(item)}</p>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 수정 포인트 (있으면) */}
      {result.negotiationPoints &&
        Object.keys(result.negotiationPoints).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <span className="text-base">📝</span>
              수정·협상 포인트
            </p>
            <ul className="space-y-2">
              {Object.entries(result.negotiationPoints).map(([k, v]) => (
                <li key={k} className="rounded-lg bg-indigo-50/50 border border-indigo-200 px-3 py-2.5">
                  <span className="font-semibold text-indigo-700 text-xs mr-2">
                    {k}:
                  </span>
                  <span className="text-xs text-slate-700 leading-relaxed">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

      {/* 법적 근거 */}
      {Array.isArray(result.legalReferences) && result.legalReferences.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
            <span className="text-base">⚖️</span>
            참고 법령
          </p>
          <ul className="space-y-1.5">
            {result.legalReferences.map((ref, i) => (
              <li key={i} className="rounded-lg bg-blue-50/50 border border-blue-200 px-3 py-2 text-xs leading-relaxed">
                <span className="font-semibold text-blue-900">{ref.name}</span>
                <span className="text-slate-600 mx-1.5">–</span>
                <span className="text-slate-700">{ref.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

