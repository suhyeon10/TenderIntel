'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface ContractAnalysis {
  id: string
  doc_id: string
  file_name: string
  doc_type: string | null
  risk_score: number | null
  risk_level: string | null
  created_at: string
}

interface ContractListClientProps {
  initialContracts: ContractAnalysis[]
  initialSearch: string
  initialLevel: string
  fileNames: string[]
}

export default function ContractListClient({ initialContracts, initialSearch, initialLevel, fileNames }: ContractListClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(initialSearch)
  const [riskLevel, setRiskLevel] = useState(initialLevel || 'all')
  const [contracts, setContracts] = useState(initialContracts)

  // searchParams가 변경되면 contracts 업데이트
  useEffect(() => {
    setContracts(initialContracts)
    setSearchQuery(initialSearch)
    setRiskLevel(initialLevel || 'all')
  }, [initialContracts, initialSearch, initialLevel])

  // 필터 적용 (파일명 변경 시 자동 적용)
  const handleFileNameChange = (fileName: string) => {
    setSearchQuery(fileName)
    const params = new URLSearchParams()
    if (fileName && fileName !== 'all') {
      params.set('q', fileName)
    }
    if (riskLevel && riskLevel !== 'all') {
      params.set('level', riskLevel)
    }
    router.push(`/admin/contracts?${params.toString()}`)
  }

  // 위험 레벨 변경 시 자동 적용
  const handleRiskLevelChange = (level: string) => {
    setRiskLevel(level)
    const params = new URLSearchParams()
    if (searchQuery && searchQuery !== 'all') {
      params.set('q', searchQuery)
    }
    if (level && level !== 'all') {
      params.set('level', level)
    }
    router.push(`/admin/contracts?${params.toString()}`)
  }

  // 위험 레벨 뱃지 스타일
  const getRiskLevelBadge = (level: string | null) => {
    if (!level) return <span className="text-gray-500">-</span>
    
    const styles = {
      high: 'border-red-500 text-red-600 bg-red-50',
      medium: 'border-orange-500 text-orange-600 bg-orange-50',
      low: 'border-green-500 text-green-600 bg-green-50',
    }
    
    const style = styles[level as keyof typeof styles] || 'border-gray-500 text-gray-600 bg-gray-50'
    
    return (
      <span className={`px-2 py-1 text-xs font-medium border rounded ${style}`}>
        {level.toUpperCase()}
      </span>
    )
  }

  // 날짜 포맷팅
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

  return (
    <div>
      {/* 필터 영역 */}
      <div className="mb-6 flex gap-4 items-end">
        <div className="flex-1">
          <label htmlFor="file-name" className="block text-sm font-medium text-gray-700 mb-1">
            파일명
          </label>
          <select
            id="file-name"
            value={searchQuery || 'all'}
            onChange={(e) => handleFileNameChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체</option>
            {fileNames.map((fileName) => (
              <option key={fileName} value={fileName}>
                {fileName}
              </option>
            ))}
          </select>
        </div>
        <div className="w-48">
          <label htmlFor="risk-level" className="block text-sm font-medium text-gray-700 mb-1">
            위험 레벨
          </label>
          <select
            id="risk-level"
            value={riskLevel}
            onChange={(e) => handleRiskLevelChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                파일명
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                문서 타입
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                위험 점수/레벨
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                생성일시
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                상세 보기
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {contracts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  조회된 계약서가 없습니다.
                </td>
              </tr>
            ) : (
              contracts.map((contract) => (
                <tr key={contract.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {contract.file_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {contract.doc_type || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      {contract.risk_score !== null && (
                        <span className="text-gray-700">{contract.risk_score}</span>
                      )}
                      {getRiskLevelBadge(contract.risk_level)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(contract.created_at)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <Link
                      href={`/admin/contracts/${contract.id}`}
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      상세 보기
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

