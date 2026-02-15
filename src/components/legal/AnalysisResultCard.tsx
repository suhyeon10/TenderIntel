'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, FileText, Lightbulb } from 'lucide-react'

interface RiskItem {
  title: string
  description: string
  legalBasis?: string
  recommendation?: string
}

interface AnalysisResultCardProps {
  risks: RiskItem[]
  scenarios?: string[]
}

export function AnalysisResultCard({ risks, scenarios }: AnalysisResultCardProps) {
  return (
    <div className="space-y-6">
      {/* 법적 리스크 설명 */}
      <div>
        <h3 className="text-xl font-semibold mb-4 text-slate-900 flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
          법적 리스크 설명
        </h3>
        <div className="space-y-4">
          {risks.map((risk, index) => (
            <Card key={index} className="border-amber-200">
              <CardHeader>
                <CardTitle className="text-lg">{risk.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-slate-700">{risk.description}</p>
                {risk.legalBasis && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-start gap-2">
                      <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-blue-900 mb-1">법적 근거</p>
                        <p className="text-sm text-blue-800">{risk.legalBasis}</p>
                      </div>
                    </div>
                  </div>
                )}
                {risk.recommendation && (
                  <div className="bg-emerald-50 p-3 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-emerald-900 mb-1">추천 대응 방법</p>
                        <p className="text-sm text-emerald-800">{risk.recommendation}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 법적 시나리오 */}
      {scenarios && scenarios.length > 0 && (
        <div>
          <h3 className="text-xl font-semibold mb-4 text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-purple-600" />
            관련 법적 시나리오
          </h3>
          <div className="space-y-3">
            {scenarios.map((scenario, index) => (
              <Card key={index} className="border-purple-200">
                <CardContent className="p-4">
                  <p className="text-slate-700">{scenario}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

