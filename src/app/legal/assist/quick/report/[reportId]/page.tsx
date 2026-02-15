'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, FileText, Scroll, X, Copy } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { MarkdownRenderer } from '@/components/rag/MarkdownRenderer'
import { getSituationReport } from '@/apis/legal.service'

interface Report {
  id: string
  question: string
  answer: string
  legalBasis: string[]
  recommendations: string[]
  riskScore?: number
  tags?: string[]
  createdAt: Date
}

export default function ReportPage() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const reportId = params.reportId as string
  
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined' || !reportId) return

    const loadReport = async () => {
      try {
        // Supabase에서 리포트 로드
        const situationReport = await getSituationReport(reportId)
        
        if (!situationReport) {
          toast({
            title: '리포트를 찾을 수 없습니다',
            description: '요청하신 리포트를 찾을 수 없습니다.',
            variant: 'destructive',
          })
          router.push('/legal/assist/quick')
          return
        }

        // 리포트 형식 변환
        const report: Report = {
          id: situationReport.id,
          question: situationReport.question,
          answer: situationReport.answer,
          legalBasis: situationReport.legal_basis || [],
          recommendations: situationReport.recommendations || [],
          riskScore: situationReport.risk_score,
          tags: situationReport.tags || [],
          createdAt: new Date(situationReport.created_at),
        }

        setReport(report)
      } catch (error) {
        console.error('리포트 로드 실패:', error)
        toast({
          title: '오류 발생',
          description: '리포트를 불러오는 중 오류가 발생했습니다.',
          variant: 'destructive',
        })
        router.push('/legal/assist/quick')
      } finally {
        setLoading(false)
      }
    }

    loadReport()
  }, [reportId, router, toast])

  const handleCopy = (text: string, description: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: '복사 완료',
      description,
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">리포트를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (!report) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-4xl">
        {/* 헤더 */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/legal/assist/quick')}
            className="text-slate-600 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            즉시 상담으로 돌아가기
          </Button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md">
                <Scroll className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  법적 조언 리포트
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  생성일: {report.createdAt.toLocaleString('ko-KR')}
                </p>
              </div>
            </div>
            {report.riskScore !== undefined && (
              <div className={cn(
                "px-4 py-2 rounded-lg text-sm font-semibold",
                report.riskScore > 70 ? "bg-red-100 text-red-700" :
                report.riskScore > 40 ? "bg-amber-100 text-amber-700" :
                "bg-green-100 text-green-700"
              )}>
                위험도 {report.riskScore}%
              </div>
            )}
          </div>
        </div>

        {/* 리포트 내용 */}
        <div className="space-y-6">
          {/* 질문 */}
          <Card className="border-2 border-blue-200 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-600">
                <FileText className="w-5 h-5" />
                질문
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700 whitespace-pre-wrap">{report.question}</p>
            </CardContent>
          </Card>

          {/* 법적 조언 */}
          <Card className="border-2 border-indigo-200 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-600">
                <Scroll className="w-5 h-5" />
                법적 조언
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-code:text-blue-600 prose-pre:bg-slate-50">
                <MarkdownRenderer content={report.answer} />
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(report.answer, '법적 조언이 복사되었습니다')}
                  className="border-blue-300 hover:bg-blue-50"
                >
                  <Copy className="w-4 h-4 mr-1.5" />
                  복사하기
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 참조 법조문 */}
          {report.legalBasis.length > 0 && (
            <Card className="border-2 border-slate-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-slate-700">참조 법조문</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {report.legalBasis.map((basis, index) => (
                    <li key={index} className="text-sm text-slate-700 pl-4 border-l-2 border-slate-200">
                      {basis}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* 권장 실행 단계 */}
          {report.recommendations.length > 0 && (
            <Card className="border-2 border-emerald-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-emerald-700">권장 실행 단계</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-3">
                  {report.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm text-slate-700 pl-4">
                      <span className="font-semibold text-emerald-700">{index + 1}.</span> {rec}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* 태그 */}
          {report.tags && report.tags.length > 0 && (
            <Card className="border-2 border-slate-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-slate-700">분류</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {report.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700"
                    >
                      {tag === 'harassment' ? '직장 내 괴롭힘' :
                       tag === 'unpaid_wage' ? '임금체불' :
                       tag === 'unfair_dismissal' ? '부당해고' :
                       tag === 'overtime' ? '근로시간 문제' :
                       tag === 'probation' ? '수습·인턴' :
                       tag}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  )
}

