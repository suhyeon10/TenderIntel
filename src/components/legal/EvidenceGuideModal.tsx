'use client'

import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileText, MessageSquare, Phone, Mail, CheckCircle2 } from 'lucide-react'

interface EvidenceGuideModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  situationType?: string
}

export function EvidenceGuideModal({ open, onOpenChange, situationType }: EvidenceGuideModalProps) {
  const evidenceTypes = [
    {
      type: '근무일지',
      description: '출퇴근 시간, 근무 내용을 기록한 문서',
      examples: ['출퇴근 기록', '근무 시간표', '야근 기록'],
      icon: FileText,
    },
    {
      type: '대화 기록',
      description: '카톡, 이메일, 메신저 대화 내용',
      examples: ['카카오톡 대화', '슬랙 메시지', '이메일'],
      icon: MessageSquare,
    },
    {
      type: '녹취/녹음',
      description: '대화 내용을 녹음한 파일',
      examples: ['녹음 파일', '녹취록'],
      icon: Phone,
    },
    {
      type: '계약서/문서',
      description: '계약서, 통보서, 공문 등',
      examples: ['근로계약서', '해고 통보서', '경고장'],
      icon: FileText,
    },
  ]

  const precautions = [
    '개인정보(실명, 회사명)는 가급적 제거하세요',
    '녹음은 상대방 동의 없이도 법적으로 인정될 수 있지만, 윤리적으로 주의하세요',
    '증거는 원본을 보관하고, 복사본을 사용하세요',
    '증거 수집 시 법적 문제가 될 수 있으니 주의하세요',
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            증거 수집 가이드
          </DialogTitle>
          <DialogDescription>
            현재 상황에서는 다음 자료가 필요할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* 증거 유형 */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-3">필요한 증거 유형</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {evidenceTypes.map((evidence, index) => {
                const Icon = evidence.icon
                return (
                  <div
                    key={index}
                    className="border-2 border-slate-200 rounded-xl p-4 bg-gradient-to-br from-slate-50 to-blue-50/30"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Icon className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-slate-900 mb-1">{evidence.type}</h4>
                        <p className="text-xs text-slate-600 mb-2">{evidence.description}</p>
                        <div className="flex flex-wrap gap-1">
                          {evidence.examples.map((example, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-700"
                            >
                              {example}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 주의사항 */}
          <div className="border-2 border-amber-200 rounded-xl p-4 bg-gradient-to-br from-amber-50 to-orange-50/30">
            <h3 className="text-sm font-bold text-amber-900 mb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              증거 수집 시 주의사항
            </h3>
            <ul className="space-y-2">
              {precautions.map((precaution, index) => (
                <li key={index} className="flex items-start gap-2 text-xs text-amber-800">
                  <span className="mt-1">•</span>
                  <span>{precaution}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 템플릿 다운로드 */}
          <div className="border-2 border-blue-200 rounded-xl p-4 bg-gradient-to-br from-blue-50 to-indigo-50/30">
            <h3 className="text-sm font-bold text-blue-900 mb-3">근무일지 작성 템플릿</h3>
            <div className="bg-white border border-blue-200 rounded-lg p-3 mb-3">
              <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                {`[날짜] 2024년 1월 15일
[출근 시간] 09:00
[퇴근 시간] 22:00
[근무 내용] 
- 오전: 프로젝트 회의 및 기획
- 오후: 개발 작업
- 저녁: 야근 (연장근로 4시간)

[특이사항]
- 연장근로 수당 미지급
- 휴게시간 미제공`}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const template = `[날짜] 
[출근 시간] 
[퇴근 시간] 
[근무 내용] 

[특이사항]`
                navigator.clipboard.writeText(template)
              }}
              className="w-full border-blue-300 hover:bg-blue-50"
            >
              템플릿 복사하기
            </Button>
          </div>

          {/* 공공기관 신고 시 필요한 자료 */}
          <div className="border-2 border-slate-200 rounded-xl p-4 bg-white">
            <h3 className="text-sm font-bold text-slate-900 mb-3">고용노동부 신고 시 필요한 자료</h3>
            <ul className="space-y-2">
              {[
                '근로계약서 사본',
                '급여명세서',
                '출퇴근 기록',
                '해고 통보서 (해고인 경우)',
                '증거 자료 (대화 기록, 녹음 등)',
              ].map((item, index) => (
                <li key={index} className="flex items-center gap-2 text-xs text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-300"
          >
            닫기
          </Button>
          <Button
            onClick={() => {
              window.open('https://1350.moel.go.kr/home/hp/main/hpmain.do', '_blank')
            }}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
          >
            고용노동부 고객상담센터
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

