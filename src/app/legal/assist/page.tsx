'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { 
  Zap, 
  FileText, 
  BookOpen,
  ArrowRight,
  MessageSquare,
  Sparkles,
  Scale
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function LegalAssistHubPage() {
  const router = useRouter()

  const assistOptions = [
    {
      id: 'quick',
      title: '즉시 상담',
      subtitle: 'Quick Ask',
      description: '자연어 질문만으로 법적 위험도·조항·상황 유형을 자동 분류하고, 위반 가능성과 핵심 권리, 조문 근거를 즉시 요약해드립니다.',
      icon: Zap,
      color: 'from-blue-500 to-indigo-600',
      hoverColor: 'hover:from-blue-600 hover:to-indigo-700',
      borderColor: 'border-blue-200',
      bgColor: 'from-blue-50/50 to-indigo-50/50',
      features: [
        'ChatGPT 스타일 큰 입력창',
        '대표 질문 버튼 제공',
        '상황 자동 태깅 (Burden Type, 위험도)',
        '즉시 위험도 라벨 표기',
      ],
      href: '/legal/assist/quick',
    },
    {
      id: 'contract',
      title: '문서 기반 상담',
      subtitle: 'Contract-Aware Talk',
      description: '계약서에서 추출된 위험 조항을 자동 연동하여 문제 조항 선택 → 근거 기반 상담 → 수정문구 제안 순으로 안내합니다.',
      icon: FileText,
      color: 'from-emerald-500 to-green-600',
      hoverColor: 'hover:from-emerald-600 hover:to-green-700',
      borderColor: 'border-emerald-200',
      bgColor: 'from-emerald-50/50 to-green-50/50',
      features: [
        '좌측: 문제 조항 리스트',
        '우측: 상담 챗봇',
        '위험 조항별 맞춤 협상 멘트',
        '대안 문구 자동 추천',
      ],
      href: '/legal/contract',
      note: '계약서를 먼저 업로드해주세요',
    },
    {
      id: 'cases',
      title: '사례 기반 상담',
      subtitle: 'Case-based Assist',
      description: '입력된 상황과 유사한 판례·상담 사례를 RAG 기반으로 추천하고, 내 상황과의 차이 비교 분석 및 단계별 행동 가이드를 제공합니다.',
      icon: BookOpen,
      color: 'from-purple-500 to-indigo-600',
      hoverColor: 'hover:from-purple-600 hover:to-indigo-700',
      borderColor: 'border-purple-200',
      bgColor: 'from-purple-50/50 to-indigo-50/50',
      features: [
        '유사 판례/사례 추천',
        '조치 체크리스트 제공',
        '근거 조문 링크 제공',
        '상황 차이점 비교 분석',
      ],
      href: '/legal/cases/assist',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-16 max-w-6xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full mb-6 shadow-lg">
            <Sparkles className="w-5 h-5" />
            <span className="font-semibold">AI 법률 상담 허브</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            어떤 방식으로 상담받고 싶으신가요?
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            즉시 상담, 문서 기반 상담, 사례 기반 상담 중에서 선택하실 수 있습니다.
            <br />
            각 방식은 서로 다른 장점을 가지고 있어요.
          </p>
        </div>

        {/* 3가지 상담 옵션 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {assistOptions.map((option) => {
            const Icon = option.icon
            return (
              <Card
                key={option.id}
                className={cn(
                  "border-2 shadow-lg hover:shadow-xl transition-all cursor-pointer group",
                  option.borderColor,
                  `bg-gradient-to-br ${option.bgColor}`
                )}
                onClick={() => {
                  if (option.id === 'contract') {
                    // 계약서 페이지로 이동 (사용자가 먼저 계약서를 업로드해야 함)
                    router.push('/legal/contract')
                  } else {
                    router.push(option.href)
                  }
                }}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-4 mb-4">
                    <div className={cn(
                      "p-3 rounded-xl shadow-md group-hover:scale-110 transition-transform",
                      `bg-gradient-to-br ${option.color}`
                    )}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-xl font-bold text-slate-900 mb-1">
                        {option.title}
                      </CardTitle>
                      <CardDescription className="text-xs font-semibold text-slate-500">
                        {option.subtitle}
                      </CardDescription>
                    </div>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {option.description}
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-6">
                    {option.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-xs text-slate-600">
                        <span className={cn(
                          "mt-1.5",
                          option.id === 'quick' && "text-blue-600",
                          option.id === 'contract' && "text-emerald-600",
                          option.id === 'cases' && "text-purple-600"
                        )}>✓</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  {option.note && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-800 font-medium">
                        💡 {option.note}
                      </p>
                    </div>
                  )}
                  <Button
                    className={cn(
                      "w-full",
                      `bg-gradient-to-r ${option.color} ${option.hoverColor} text-white shadow-md hover:shadow-lg`
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (option.id === 'contract') {
                        router.push('/legal/contract')
                      } else {
                        router.push(option.href)
                      }
                    }}
                  >
                    시작하기
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* 비교 테이블 */}
        <Card className="border-2 border-slate-200 shadow-lg bg-white/80 backdrop-blur-sm mb-12">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Scale className="w-5 h-5 text-blue-600" />
              각 상담 방식 비교
            </CardTitle>
            <CardDescription>
              상황에 맞는 상담 방식을 선택하세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-900">특징</th>
                    <th className="text-center py-3 px-4 font-semibold text-blue-700">즉시 상담</th>
                    <th className="text-center py-3 px-4 font-semibold text-emerald-700">문서 기반</th>
                    <th className="text-center py-3 px-4 font-semibold text-purple-700">사례 기반</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: '계약서 필요 여부', quick: '❌', contract: '✅', cases: '❌' },
                    { feature: '즉시 답변 가능', quick: '✅', contract: '✅', cases: '✅' },
                    { feature: '위험 조항 자동 탐지', quick: '⚠️', contract: '✅', cases: '⚠️' },
                    { feature: '협상 멘트 제공', quick: '⚠️', contract: '✅', cases: '⚠️' },
                    { feature: '유사 사례 비교', quick: '⚠️', contract: '⚠️', cases: '✅' },
                    { feature: '수정 문구 제안', quick: '❌', contract: '✅', cases: '❌' },
                  ].map((row, index) => (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-700">{row.feature}</td>
                      <td className="py-3 px-4 text-center">{row.quick}</td>
                      <td className="py-3 px-4 text-center">{row.contract}</td>
                      <td className="py-3 px-4 text-center">{row.cases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 하단 안내 */}
        <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/50 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
                <MessageSquare className="w-5 h-5 text-amber-700" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-amber-900 mb-2">
                  💡 상담 방식 선택 가이드
                </h3>
                <ul className="space-y-2 text-sm text-amber-800">
                  <li className="flex items-start gap-2">
                    <span className="mt-1">•</span>
                    <span><strong>즉시 상담:</strong> 빠르게 궁금한 점을 물어보고 싶을 때</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">•</span>
                    <span><strong>문서 기반 상담:</strong> 계약서를 업로드했고, 특정 조항에 대해 자세히 알고 싶을 때</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1">•</span>
                    <span><strong>사례 기반 상담:</strong> 비슷한 상황의 판례나 사례를 보고 싶을 때</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

