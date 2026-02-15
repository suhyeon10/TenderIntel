'use client'

import { Button } from '@/components/ui/button'
import { Upload, CheckCircle2, XCircle, AlertCircle, FileText, Play, Eye } from 'lucide-react'
import type { EvidenceItem } from '@/types/legal'
import { cn } from '@/lib/utils'

interface EvidenceCardProps {
  evidence: EvidenceItem
  onUpload?: (evidence: EvidenceItem) => void
  onView?: (evidence: EvidenceItem) => void
}

/**
 * 증거 파일 아카이빙 카드 컴포넌트
 * 실제 파일 업로드 UI처럼 보이게 구현 (Mocking)
 */
export function EvidenceCard({ evidence, onUpload, onView }: EvidenceCardProps) {
  const isSecured = evidence.status === 'secured'
  const isMissing = evidence.status === 'missing'
  const isPending = evidence.status === 'pending'

  return (
    <div
      className={cn(
        'p-5 rounded-xl border-2 transition-all',
        isSecured
          ? 'bg-green-50/80 border-green-300 shadow-sm'
          : isPending
          ? 'bg-yellow-50/80 border-yellow-300 shadow-sm'
          : 'bg-red-50/80 border-red-300 shadow-sm hover:shadow-md'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* 좌측: 파일 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            {/* 상태 아이콘 */}
            {isSecured ? (
              <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
            ) : isPending ? (
              <AlertCircle className="h-6 w-6 text-yellow-600 flex-shrink-0" />
            ) : (
              <XCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
            )}
            
            {/* 파일명/라벨 */}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-slate-800 truncate">
                {evidence.label}
              </h4>
              {evidence.file_name && (
                <p className="text-xs text-slate-500 mt-1 truncate">
                  {evidence.file_name}
                </p>
              )}
            </div>
            
            {/* 필수 배지 */}
            {evidence.required && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded font-semibold flex-shrink-0">
                필수
              </span>
            )}
          </div>
          
          {/* 상태 텍스트 */}
          <div className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                'font-medium',
                isSecured
                  ? 'text-green-700'
                  : isPending
                  ? 'text-yellow-700'
                  : 'text-red-700'
              )}
            >
              {isSecured ? '✅ 확보됨' : isPending ? '⏳ 대기 중' : '❌ 미확보'}
            </span>
            {evidence.uploaded_at && (
              <span className="text-xs text-slate-500">
                ({new Date(evidence.uploaded_at).toLocaleDateString('ko-KR')})
              </span>
            )}
          </div>
        </div>

        {/* 우측: 액션 버튼 */}
        <div className="flex-shrink-0">
          {isSecured ? (
            <div className="flex gap-2">
              {evidence.file_url && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onView?.(evidence)}
                    className="border-green-300 text-green-700 hover:bg-green-100"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    보기
                  </Button>
                  {evidence.label.includes('녹취') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onView?.(evidence)}
                      className="border-green-300 text-green-700 hover:bg-green-100"
                    >
                      <Play className="h-4 w-4 mr-1" />
                      재생
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpload?.(evidence)}
              className={cn(
                'border-2',
                isMissing
                  ? 'border-red-300 text-red-700 hover:bg-red-50'
                  : 'border-yellow-300 text-yellow-700 hover:bg-yellow-50'
              )}
            >
              <Upload className="h-4 w-4 mr-2" />
              {isMissing ? '파일 업로드' : '재업로드'}
            </Button>
          )}
        </div>
      </div>

      {/* 파일 아이콘 (시각적 효과) */}
      <div className="mt-3 pt-3 border-t border-slate-200/50">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <FileText className="h-4 w-4" />
          <span>
            {isSecured
              ? '파일이 업로드되어 있습니다.'
              : '파일을 업로드해주세요.'}
          </span>
        </div>
      </div>
    </div>
  )
}

