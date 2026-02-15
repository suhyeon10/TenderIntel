'use client'

import { FileText, Calendar, Building2 } from 'lucide-react'

interface SubHeaderProps {
  docTitle?: string
  organization?: string
  publishedAt?: string
  currentStep?: number
  totalSteps?: number
}

export default function SubHeader({
  docTitle,
  organization,
  publishedAt,
  currentStep = 1,
  totalSteps = 5,
}: SubHeaderProps) {
  const steps = ['업로드', 'AI 분석', '팀 매칭', '견적 비교', '계약 진행']

  return (
    <div className="border-b border-slate-200 bg-slate-50">
      <div className="container mx-auto px-6 py-4">
        {/* 문서 정보 */}
        {(docTitle || organization || publishedAt) && (
          <div className="flex items-center gap-6 mb-4 text-sm text-slate-600">
            {docTitle && (
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span className="font-medium">{docTitle}</span>
              </div>
            )}
            {organization && (
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>{organization}</span>
              </div>
            )}
            {publishedAt && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{new Date(publishedAt).toLocaleDateString('ko-KR')}</span>
              </div>
            )}
          </div>
        )}

        {/* 진행 단계 */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-700">
            {currentStep}/{totalSteps}
          </span>
          <div className="flex-1 flex items-center gap-2">
            {steps.map((step, index) => {
              const stepNumber = index + 1
              const isActive = stepNumber === currentStep
              const isCompleted = stepNumber < currentStep

              return (
                <div key={step} className="flex items-center flex-1">
                  <div className="flex items-center gap-2 flex-1">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full font-medium text-sm ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : isCompleted
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isCompleted ? '✓' : stepNumber}
                    </div>
                    <span
                      className={`text-sm ${
                        isActive
                          ? 'font-semibold text-blue-600'
                          : isCompleted
                          ? 'text-emerald-600'
                          : 'text-slate-500'
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 ${
                        isCompleted ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

