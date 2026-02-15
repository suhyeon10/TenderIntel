'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileUpload } from '@/components/legal/FileUpload'
import { RiskScore } from '@/components/legal/RiskScore'
import { AnalysisResultCard } from '@/components/legal/AnalysisResultCard'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { analyzeContractV2, analyzeSituationV2, type SituationRequestV2 } from '@/apis/legal.service'

export default function LegalAnalysisPage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [textInput, setTextInput] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<{
    riskScore: number
    risks: Array<{
      title: string
      description: string
      legalBasis?: string
      recommendation?: string
    }>
    scenarios?: string[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileSelect = (file: File) => {
    setUploadedFile(file)
    setAnalysisResult(null)
    setError(null)
  }

  const handleAnalyze = async () => {
    if (!uploadedFile && !textInput.trim()) {
      alert('파일을 업로드하거나 텍스트를 입력해주세요.')
      return
    }

    setIsAnalyzing(true)
    setAnalysisResult(null)
    setError(null)

    try {
      let result

      if (uploadedFile) {
        // 파일 업로드 시 계약서 분석 (v2)
        const v2Result = await analyzeContractV2(uploadedFile, uploadedFile.name, 'employment')
        
        // v2 응답을 v1 형식으로 변환
        result = {
          risk_score: v2Result.riskScore,
          risk_level: v2Result.riskLevel,
          summary: v2Result.summary,
          issues: v2Result.issues.map(issue => ({
            name: issue.summary,
            description: issue.explanation,
            severity: issue.severity,
            legal_basis: issue.legalBasis,
          })),
          recommendations: [],
          grounding: v2Result.retrievedContexts.map(ctx => ({
            source_id: '',
            source_type: ctx.sourceType as 'law' | 'manual' | 'case',
            title: ctx.title,
            snippet: ctx.snippet,
            score: 0,
          })),
          contract_text: '',
        }
      } else {
        // 텍스트 입력 시 상황 분석 (v2)
        const v2Request: SituationRequestV2 = {
          situation: textInput.trim(),
        }
        const v2Result = await analyzeSituationV2(v2Request)
        
        // v2 응답을 v1 형식으로 변환
        result = {
          risk_score: v2Result.riskScore,
          risk_level: v2Result.riskLevel,
          summary: v2Result.analysis.summary,
          issues: v2Result.analysis.legalBasis.map(basis => ({
            name: basis.title,
            description: basis.snippet,
            severity: 'medium' as const,
            legal_basis: [basis.title],
          })),
          recommendations: v2Result.analysis.recommendations.map(rec => ({
            title: '권고사항',
            description: rec,
            steps: [],
          })),
          grounding: v2Result.analysis.legalBasis.map(basis => ({
            source_id: '',
            source_type: basis.sourceType as 'law' | 'manual' | 'case',
            title: basis.title,
            snippet: basis.snippet,
            score: 0,
          })),
          contract_text: '',
        }
      }

      // API 응답을 컴포넌트 형식으로 변환
      const risks = result.issues.map((issue) => ({
        title: issue.name,
        description: issue.description,
        legalBasis: issue.legal_basis.join(', '),
        recommendation: result.recommendations
          .filter((rec) => rec.title.includes(issue.name) || issue.name.includes(rec.title))
          .map((rec) => rec.description)
          .join('\n') || undefined,
      }))

      const scenarios = result.grounding
        .slice(0, 3)
        .map((chunk) => `${chunk.source_type === 'case' ? '케이스' : '법령'}: ${chunk.title}`)

      setAnalysisResult({
        riskScore: result.risk_score,
        risks,
        scenarios,
      })
    } catch (err: any) {
      console.error('분석 오류:', err)
      setError(err.message || '분석 중 오류가 발생했습니다. 백엔드 서버가 실행 중인지 확인해주세요.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="container mx-auto px-6 py-12 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
          법률 문제 분석
        </h1>
        <p className="text-lg text-slate-600">
          계약서나 법률 문서를 업로드하거나 법적 상황을 텍스트로 입력하여 분석하세요.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* 업로드 섹션 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-6 h-6 text-blue-600" />
              문서 업로드
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FileUpload onFileSelect={handleFileSelect} />
          </CardContent>
        </Card>

        {/* 텍스트 입력 섹션 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              법적 상황 입력
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="법적 문제나 상황을 자세히 설명해주세요. 예: 근로계약서에 최저임금 이하의 급여가 명시되어 있습니다..."
              value={textInput}
              onChange={(e) => {
                setTextInput(e.target.value)
                setAnalysisResult(null)
              }}
              className="min-h-[200px] mb-4"
            />
            <p className="text-sm text-slate-500">
              파일 업로드와 텍스트 입력 중 하나를 선택하여 사용할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 분석 버튼 */}
      <div className="mb-8">
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing || (!uploadedFile && !textInput.trim())}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg font-semibold"
          size="lg"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              분석 중...
            </>
          ) : (
            <>
              <FileText className="w-5 h-5 mr-2" />
              분석 시작하기
            </>
          )}
        </Button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 분석 결과 */}
      {analysisResult && (
        <div className="space-y-6">
          {/* 위험도 점수 */}
          <RiskScore score={analysisResult.riskScore} />

          {/* 분석 결과 카드 */}
          <AnalysisResultCard
            risks={analysisResult.risks}
            scenarios={analysisResult.scenarios}
          />
        </div>
      )}
    </div>
  )
}

