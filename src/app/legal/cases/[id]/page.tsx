'use client'

import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, BookOpen, FileText, CheckCircle2, ExternalLink, AlertTriangle } from 'lucide-react'

interface CaseDetail {
  id: string
  title: string
  description: string
  legalBasis: string
  recommendations: string[]
  evidenceGuide: string[]
  consultationLinks: Array<{ name: string; url: string }>
}

export default function CaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const caseId = params.id as string

  // 임시 데이터 (실제로는 API에서 가져와야 함)
  const caseData: CaseDetail = {
    id: caseId,
    title: '수습 인턴, 평가 없이 계약 종료 통보',
    description: `수습기간 중 성과 평가 없이 일방적으로 계약 종료를 통보받은 사례입니다.

회사는 수습기간을 6개월로 정하고, 수습기간 중에는 언제든지 해고할 수 있다고 계약서에 명시했습니다. 
그러나 실제로는 성과 평가나 피드백 없이 갑작스럽게 계약 종료를 통보받았습니다.

이 경우 근로기준법 제27조(해고의 제한)에 따라 정당한 사유 없이 해고할 수 없으며, 
수습기간이라 하더라도 부당해고에 해당할 수 있습니다.`,
    legalBasis: `근로기준법 제27조(해고의 제한)
- 사용자는 근로자에게 정당한 사유 없이 해고를 하지 못한다.

근로기준법 제23조(해고예고)
- 사용자는 근로자를 해고하는 경우에는 30일 전에 예고를 하여야 하며, 
  30일 전에 예고를 하지 아니한 때에는 30일분 이상의 통상임금을 지급하여야 한다.

관련 판례: 대법원 2010. 6. 24. 선고 2009다101123 판결
- 수습기간 중이라 하더라도 정당한 사유 없이 해고하는 것은 부당해고에 해당한다.`,
    recommendations: [
      '해고 통보서를 반드시 받아 보관하세요.',
      '회사와의 대화 내용을 녹음하거나 기록으로 남기세요.',
      '근로계약서와 급여 명세서를 모두 보관하세요.',
      '노동위원회에 부당해고 구제 신청을 검토하세요.',
      '근로감독관에게 신고할 수 있습니다.',
    ],
    evidenceGuide: [
      '근로계약서 사본',
      '해고 통보서 (또는 이메일/문자 메시지)',
      '급여 명세서',
      '출퇴근 기록 (근태 기록)',
      '회사와의 대화 녹음 파일 (있는 경우)',
      '평가서 또는 피드백 문서',
      '회사와의 이메일/메신저 대화 기록',
    ],
    consultationLinks: [
      { name: '고용노동부 노동상담센터', url: 'https://www.moel.go.kr' },
      { name: '대한변호사협회 법률상담', url: 'https://www.koreanbar.or.kr' },
      { name: '법률구조공단', url: 'https://www.klaf.or.kr' },
    ],
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push('/legal/cases')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            목록으로 돌아가기
          </Button>
          <h1 className="text-4xl md:text-5xl font-bold mb-3 text-slate-900">
            {caseData.title}
          </h1>
        </div>

        {/* Case Description */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              상세 상황 설명
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
              {caseData.description}
            </p>
          </CardContent>
        </Card>

        {/* Legal Basis */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              법적 근거
            </CardTitle>
            <CardDescription>관련 법령 및 판례 요약</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                {caseData.legalBasis}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              추천 대응 방법
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {caseData.recommendations.map((rec, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                  <div className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold">
                    {index + 1}
                  </div>
                  <p className="text-slate-700 flex-1">{rec}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Evidence Guide */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              증거 수집 가이드
            </CardTitle>
            <CardDescription>단계별로 수집해야 할 증거 자료</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {caseData.evidenceGuide.map((item, index) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <span className="text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Consultation Links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-blue-600" />
              법률 상담 링크
            </CardTitle>
            <CardDescription>상담을 위한 추천 기관</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {caseData.consultationLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <span className="font-medium text-blue-900">{link.name}</span>
                  <ExternalLink className="w-4 h-4 text-blue-600" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Back Button */}
        <div className="mt-8">
          <Button
            onClick={() => router.push('/legal/cases')}
            variant="outline"
            className="w-full"
            size="lg"
          >
            목록으로 돌아가기
          </Button>
        </div>
      </div>
    </div>
  )
}

