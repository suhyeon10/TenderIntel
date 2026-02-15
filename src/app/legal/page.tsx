'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Upload, 
  MessageSquare, 
  AlertTriangle, 
  Info, 
  FileText, 
  Scale, 
  BookOpen, 
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Search,
  FileCheck,
  TrendingUp
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function LegalLandingPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
      <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-20 max-w-7xl">
        {/* Hero Section */}
        <div className="mb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* 좌: 텍스트 */}
            <div>
              {/* 상단 라벨 */}
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-[11px] font-semibold mb-6 border border-blue-200">
                <Scale className="w-3 h-3" />
                청년·프리랜서 법률 환경 네비게이터
              </div>

              {/* 메인 헤드라인 */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-5 text-slate-900 leading-tight">
                첫 입사, 첫 계약, 변호사는 못 써도
                <br />
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  "이 계약, 그냥 서명해도 되나요?"
                </span>
                <br />
                를 대신 물어봐 줍니다.
              </h1>

              {/* 서브 카피 */}
              <p className="text-sm sm:text-base text-slate-600 mb-6 leading-relaxed">
                근로계약서 · 프리랜서 계약 · 스톡옵션 · 직장 내 괴롭힘까지
                <br />
                법령·표준계약·공공 가이드를 기반으로 위험 신호와 대응 방법을 정리해 드립니다.
              </p>

              {/* 메인 CTA 영역 */}
              <div className="space-y-4">
                {/* Primary CTA */}
                <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 shadow-lg hover:shadow-xl transition-all cursor-pointer group"
                  onClick={() => router.push('/legal/contract')}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-md group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2">📄 계약서 올려서 위험도 분석 받기</h3>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                          근로·용역·프리랜서 계약서를 업로드하면, 위험 조항과 수정이 필요한 부분을 찾아드립니다.
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>

                {/* Secondary CTA */}
                <Card className="border-2 border-slate-300 bg-white shadow-md hover:shadow-lg transition-all cursor-pointer group"
                  onClick={() => router.push('/legal/situation')}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-gradient-to-br from-slate-600 to-slate-700 rounded-xl shadow-md group-hover:scale-110 transition-transform">
                        <MessageSquare className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-2">💬 지금 겪는 상황부터 상담받기</h3>
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                          해고 통보, 무급 야근, 괴롭힘 등 현재 상황을 한 줄로 적으면, 법적 쟁점과 행동 가이드를 정리해 드립니다.
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-slate-600 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* 우: 간단한 일러스트/아이콘 블록 */}
            <div className="hidden lg:block">
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-lg">
                  <CardContent className="p-6 text-center">
                    <div className="p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl w-16 h-16 mx-auto mb-4 shadow-md">
                      <FileText className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900">계약서 분석</p>
                    <p className="text-xs text-slate-600 mt-1">위험 조항 탐지</p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 shadow-lg">
                  <CardContent className="p-6 text-center">
                    <div className="p-4 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl w-16 h-16 mx-auto mb-4 shadow-md">
                      <MessageSquare className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900">상황 진단</p>
                    <p className="text-xs text-slate-600 mt-1">법적 쟁점 파악</p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-lg">
                  <CardContent className="p-6 text-center">
                    <div className="p-4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl w-16 h-16 mx-auto mb-4 shadow-md">
                      <BookOpen className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900">케이스 학습</p>
                    <p className="text-xs text-slate-600 mt-1">유사 사례 비교</p>
                  </CardContent>
                </Card>
                <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 shadow-lg">
                  <CardContent className="p-6 text-center">
                    <div className="p-4 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl w-16 h-16 mx-auto mb-4 shadow-md">
                      <Scale className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900">법적 근거</p>
                    <p className="text-xs text-slate-600 mt-1">RAG 기반 분석</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* 이 서비스로 할 수 있는 것 3박스 섹션 */}
        <div className="mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-center mb-10 text-slate-900">
            이 서비스로 할 수 있는 것
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 카드 1 - 계약서 분석 */}
            <Card className="border-2 border-blue-200 shadow-lg bg-white hover:shadow-xl transition-all">
              <CardHeader>
                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl w-14 h-14 mb-4 shadow-md">
                  <FileCheck className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-lg sm:text-xl font-bold">계약서 위험 신호 찾기</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-blue-600 mt-1">·</span>
                    <span>근로시간 · 수습 · 해지 조항 위험도 분석</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-blue-600 mt-1">·</span>
                    <span>표준근로계약서와의 차이 비교</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-blue-600 mt-1">·</span>
                    <span>붉은색으로 표시된 "레드 플래그" 확인</span>
                  </li>
                </ul>
                <Button
                  variant="outline"
                  onClick={() => router.push('/legal/contract')}
                  className="w-full border-blue-300 hover:bg-blue-50 hover:border-blue-400"
                >
                  계약서 분석하러 가기
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* 카드 2 - 상황 기반 상담 */}
            <Card className="border-2 border-emerald-200 shadow-lg bg-white hover:shadow-xl transition-all">
              <CardHeader>
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl w-14 h-14 mb-4 shadow-md">
                  <MessageSquare className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-lg sm:text-xl font-bold">지금 겪는 상황 진단</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-emerald-600 mt-1">·</span>
                    <span>"수습 해고 통보를 받았어요" 같은 서술 입력</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-emerald-600 mt-1">·</span>
                    <span>법적 쟁점과 필요한 증거, 행동 순서 안내</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-emerald-600 mt-1">·</span>
                    <span>상담 기관/노무 관련 가이드 제시</span>
                  </li>
                </ul>
                <Button
                  variant="outline"
                  onClick={() => router.push('/legal/situation')}
                  className="w-full border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400"
                >
                  상황 진단으로 이동
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>

            {/* 카드 3 - 케이스로 미리 공부 */}
            <Card className="border-2 border-purple-200 shadow-lg bg-white hover:shadow-xl transition-all">
              <CardHeader>
                <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl w-14 h-14 mb-4 shadow-md">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <CardTitle className="text-lg sm:text-xl font-bold">비슷한 사례로 미리 공부</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-purple-600 mt-1">·</span>
                    <span>인턴 해고, 무급 야근, 괴롭힘 등 케이스 정리</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-purple-600 mt-1">·</span>
                    <span>법적 쟁점과 배울 점 요약</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="text-purple-600 mt-1">·</span>
                    <span>내 상황과 비교해서 리스크 감 잡기</span>
                  </li>
                </ul>
                <Button
                  variant="outline"
                  onClick={() => router.push('/legal/cases')}
                  className="w-full border-purple-300 hover:bg-purple-50 hover:border-purple-400"
                >
                  케이스 갤러리 보기
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 이런 분에게 추천 섹션 */}
        <div className="mb-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-center mb-6 text-slate-900">
            이런 상황이라면, 먼저 Linkus Legal을 써보세요
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              '첫 스타트업 입사를 앞두고, 근로계약서가 부담스러운 취준생',
              '수습 인턴인데, 갑자기 "그만 나와도 될 것 같다"는 말을 들은 사람',
              '프리랜서인데, "원래 야근 수당은 따로 안 줘요"라는 말이 익숙해진 사람',
              '스톡옵션 계약서를 받았지만, 뭐가 좋은 조건인지 모르겠는 사람',
              '직장 내 괴롭힘인지 애매해서 아무에게도 말 못 하고 있는 사람',
            ].map((text, index) => (
              <Card
                key={index}
                className="rounded-2xl bg-slate-50 px-4 py-3 border-2 border-slate-200 hover:border-blue-300 hover:shadow-md transition-all"
              >
                <CardContent className="p-0">
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 서비스 흐름 Step 섹션 */}
        <div className="mb-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-3 text-slate-900">사용 흐름</h2>
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
              3단계만 거치면, 내 계약/상황의 위험 신호를 파악할 수 있습니다.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: 1,
                title: '입력하기',
                items: [
                  '계약서를 업로드하거나',
                  '지금 겪는 상황을 한 줄로 적어주세요.',
                ],
                color: 'blue',
              },
              {
                step: 2,
                title: 'AI 분석 보기',
                items: [
                  '법령·표준계약·가이드 문서를 검색하고',
                  '위험도/쟁점을 카드 형태로 정리합니다.',
                ],
                color: 'emerald',
              },
              {
                step: 3,
                title: '대응 방향 잡기',
                items: [
                  '조항 수정 제안/협상 포인트를 참고하고',
                  '필요하다면 실제 상담 기관에 연결해 보세요.',
                ],
                color: 'purple',
              },
            ].map((stepData) => (
              <Card
                key={stepData.step}
                className={cn(
                  "border-2 shadow-lg hover:shadow-xl transition-all relative",
                  stepData.color === 'blue' && "border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/50",
                  stepData.color === 'emerald' && "border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-green-50/50",
                  stepData.color === 'purple' && "border-purple-200 bg-gradient-to-br from-purple-50/50 to-indigo-50/50"
                )}
              >
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center text-white font-extrabold text-xl shadow-md",
                      stepData.color === 'blue' && "bg-gradient-to-br from-blue-500 to-indigo-600",
                      stepData.color === 'emerald' && "bg-gradient-to-br from-emerald-500 to-green-600",
                      stepData.color === 'purple' && "bg-gradient-to-br from-purple-500 to-indigo-600"
                    )}>
                      {stepData.step}
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900">{stepData.step}. {stepData.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {stepData.items.map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className={cn(
                          "mt-1",
                          stepData.color === 'blue' && "text-blue-600",
                          stepData.color === 'emerald' && "text-emerald-600",
                          stepData.color === 'purple' && "text-purple-600"
                        )}>·</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* AI가 어떻게 판단하는지 신뢰 섹션 */}
        <div className="mb-16">
          <Card className="border-2 border-slate-200 shadow-lg bg-gradient-to-br from-white to-slate-50/50">
            <CardContent className="p-6 sm:p-8 md:p-10">
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full mb-3 shadow-lg text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span className="font-semibold">RAG 기반 분석</span>
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-3 text-slate-900">
                  AI가 아무 말이나 하는 게 아니라,<br />
                  근거를 보고 말하도록 설계했습니다.
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {[
                  {
                    icon: Search,
                    title: '법령·가이드 검색',
                    text: '근로기준법, 표준근로계약서, 공공 가이드 문서를 RAG로 검색합니다.',
                  },
                  {
                    icon: FileText,
                    title: '근거 제시',
                    text: 'AI의 답변에는 항상 "어떤 기준/조항을 참고했는지" 근거 텍스트가 함께 나옵니다.',
                  },
                  {
                    icon: Info,
                    title: '정보 정리 도구',
                    text: '이 서비스는 법률 자문이 아닌, 정보를 이해하기 쉽게 정리해 주는 도구입니다.',
                  },
                ].map((item, index) => {
                  const Icon = item.icon
                  return (
                    <div key={index} className="text-center">
                      <div className="p-4 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl w-16 h-16 mx-auto mb-4 shadow-md">
                        <Icon className="w-8 h-8 text-blue-600" />
                      </div>
                      <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{item.text}</p>
                    </div>
                  )
                })}
              </div>
              {/* 미니 프롬프트 예시 박스 */}
              <Card className="bg-slate-900 text-slate-100 border-2 border-slate-700">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-800 rounded-lg">
                      <FileText className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">예시 프롬프트</p>
                      <p className="text-sm leading-relaxed font-mono">
                        "다음 계약서에서 근로시간·임금·해지 조항을 중심으로, 근로기준법과 표준근로계약서를 참고해 위험 요소와 그 이유를 정리해줘."
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </div>

        {/* 법률 자문 아님 / 디스클레이머 영역 */}
        <div className="mb-16">
          <Card className="bg-amber-50 border-2 border-amber-200 shadow-lg">
            <CardContent className="p-6 sm:p-8">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2.5 bg-amber-100 rounded-xl flex-shrink-0">
                  <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6 text-amber-700" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-amber-900 mb-2 sm:mb-3">
                    이 서비스는 변호사·노무사 등 전문 법률 자문을 대체하지 않습니다.
                  </h3>
                  <p className="text-sm text-amber-800 leading-relaxed mb-2">
                    공개된 법령·가이드·사례를 바탕으로, 사용자가 스스로 상황을 이해하고 준비할 수 있도록 돕는 정보 제공 서비스입니다.
                  </p>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    구체적인 사건 처리, 소송, 합의 등은 반드시 전문가 상담을 통해 진행해야 합니다.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 하단 CTA 정리 */}
        <div className="mb-12">
          <Card className="border-2 border-slate-200 shadow-xl bg-gradient-to-br from-white to-blue-50/30">
            <CardContent className="p-6 sm:p-8 md:p-10">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6 sm:gap-8">
                <div className="flex-1 text-center lg:text-left">
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 sm:mb-3">
                    어디서부터 시작해야 할지 헷갈린다면,
                  </h3>
                  <p className="text-base sm:text-lg text-slate-600">
                    지금 가지고 있는 계약서 또는 고민되는 상황부터 한번 같이 살펴볼까요?
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    onClick={() => router.push('/legal/contract')}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg h-14 px-8 text-base font-semibold"
                    size="lg"
                  >
                    <Upload className="w-5 h-5 mr-2" />
                    계약서 올려서 분석받기
                  </Button>
                  <Button
                    onClick={() => router.push('/legal/situation')}
                    variant="outline"
                    className="border-2 border-slate-300 hover:bg-slate-50 hover:border-slate-400 h-14 px-8 text-base font-semibold"
                    size="lg"
                  >
                    <MessageSquare className="w-5 h-5 mr-2" />
                    상황 먼저 설명해보기
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

