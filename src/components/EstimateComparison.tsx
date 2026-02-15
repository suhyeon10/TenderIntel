'use client'

import { useState } from 'react'
import { TrendingUp, Calendar, DollarSign, CheckCircle, XCircle, BarChart3 } from 'lucide-react'

interface Estimate {
  id: number
  teamName: string
  totalAmount: number
  startDate: string
  endDate: string
  matchScore: number
  milestones: Array<{
    title: string
    paymentAmount: number
    startDate: string
    endDate: string
  }>
  detail: string
}

interface EstimateComparisonProps {
  estimates: Estimate[]
  onSelect?: (estimateId: number) => void
}

export default function EstimateComparison({
  estimates,
  onSelect,
}: EstimateComparisonProps) {
  const [selectedEstimate, setSelectedEstimate] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<'amount' | 'score' | 'duration'>('score')

  const sortedEstimates = [...estimates].sort((a, b) => {
    switch (sortBy) {
      case 'amount':
        return a.totalAmount - b.totalAmount
      case 'duration':
        const aDuration = new Date(a.endDate).getTime() - new Date(a.startDate).getTime()
        const bDuration = new Date(b.endDate).getTime() - new Date(b.startDate).getTime()
        return aDuration - bDuration
      case 'score':
      default:
        return b.matchScore - a.matchScore
    }
  })

  const maxAmount = Math.max(...estimates.map(e => e.totalAmount))
  const maxScore = Math.max(...estimates.map(e => e.matchScore))

  const handleSelect = (estimateId: number) => {
    setSelectedEstimate(estimateId)
    onSelect?.(estimateId)
  }

  const formatAmount = (amount: number) => {
    return `${amount.toLocaleString()}원`
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ko-KR')
  }

  const calculateDuration = (start: string, end: string) => {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  return (
    <div className="space-y-6">
      {/* 정렬 옵션 */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">정렬:</span>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('score')}
            className={`px-3 py-1 rounded text-sm ${
              sortBy === 'score'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            적합도순
          </button>
          <button
            onClick={() => setSortBy('amount')}
            className={`px-3 py-1 rounded text-sm ${
              sortBy === 'amount'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            금액순
          </button>
          <button
            onClick={() => setSortBy('duration')}
            className={`px-3 py-1 rounded text-sm ${
              sortBy === 'duration'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            기간순
          </button>
        </div>
      </div>

      {/* 견적서 비교 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedEstimates.map((estimate) => (
          <div
            key={estimate.id}
            onClick={() => handleSelect(estimate.id)}
            className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
              selectedEstimate === estimate.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            {/* 팀명 & 적합도 */}
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-bold text-lg">{estimate.teamName}</h3>
              <div className="flex items-center gap-1">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-blue-600">
                  {(estimate.matchScore * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* 적합도 바 */}
            <div className="mb-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${(estimate.matchScore / maxScore) * 100}%` }}
                />
              </div>
            </div>

            {/* 금액 */}
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="font-semibold">{formatAmount(estimate.totalAmount)}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-2 ml-2">
                <div
                  className="bg-green-500 h-2 rounded-full"
                  style={{ width: `${(estimate.totalAmount / maxAmount) * 100}%` }}
                />
              </div>
            </div>

            {/* 기간 */}
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span className="text-sm">
                {formatDate(estimate.startDate)} ~ {formatDate(estimate.endDate)}
              </span>
              <span className="text-xs text-gray-500 ml-auto">
                ({calculateDuration(estimate.startDate, estimate.endDate)}일)
              </span>
            </div>

            {/* 마일스톤 개수 */}
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-orange-600" />
              <span className="text-sm">마일스톤 {estimate.milestones.length}개</span>
            </div>

            {/* 상세 내용 미리보기 */}
            <div className="mt-4 p-3 bg-gray-50 rounded text-sm text-gray-700 line-clamp-3">
              {estimate.detail.substring(0, 150)}
              {estimate.detail.length > 150 && '...'}
            </div>

            {/* 선택 표시 */}
            {selectedEstimate === estimate.id && (
              <div className="mt-4 flex items-center justify-center gap-2 text-blue-600">
                <CheckCircle className="w-5 h-5" />
                <span className="font-semibold">선택됨</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 비교 그래프 (선택사항) */}
      {estimates.length > 1 && (
        <div className="mt-8 p-6 border rounded-lg">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            비교 그래프
          </h3>
          <div className="space-y-4">
            {/* 금액 비교 */}
            <div>
              <h4 className="text-sm font-medium mb-2">금액 비교</h4>
              <div className="space-y-2">
                {sortedEstimates.map((estimate) => (
                  <div key={estimate.id} className="flex items-center gap-3">
                    <span className="text-sm w-24 truncate">{estimate.teamName}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-green-500 h-4 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${(estimate.totalAmount / maxAmount) * 100}%` }}
                      >
                        <span className="text-xs text-white font-semibold">
                          {formatAmount(estimate.totalAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 적합도 비교 */}
            <div>
              <h4 className="text-sm font-medium mb-2">적합도 비교</h4>
              <div className="space-y-2">
                {sortedEstimates.map((estimate) => (
                  <div key={estimate.id} className="flex items-center gap-3">
                    <span className="text-sm w-24 truncate">{estimate.teamName}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-blue-500 h-4 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${(estimate.matchScore / maxScore) * 100}%` }}
                      >
                        <span className="text-xs text-white font-semibold">
                          {(estimate.matchScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

