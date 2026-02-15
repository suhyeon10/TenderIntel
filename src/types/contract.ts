export type ContractRiskResult = {
  summary: string
  riskLevel: string
  riskLevelDescription: string
  riskContent: ({ 내용: string; 설명: string } | string)[]  // 객체 배열 또는 문자열 배열 지원
  checklist: ({ 항목: string; 결론: string } | string)[]  // 객체 배열 또는 문자열 배열 지원
  negotiationPoints: Record<string, string>
  legalReferences: { name: string; description: string }[]
}

