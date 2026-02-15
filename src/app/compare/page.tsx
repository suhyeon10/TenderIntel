'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { Button } from '@/components/ui/button'
// import { getAnnouncements, getAnnouncement } from '@/apis/public-announcement.service'
import { Loader2, CheckCircle2, X, BarChart3, Calendar, DollarSign, FileText } from 'lucide-react'
import { Money } from '@/components/common/Money'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export default function ComparePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const announcementIds = searchParams.get('ids')?.split(',').map((id) => {
    const trimmed = id.trim()
    // UUID 형식인지 확인
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
      return trimmed
    }
    // 숫자인 경우
    const num = Number(trimmed)
    return isNaN(num) ? null : num
  }).filter((id): id is number | string => id !== null) || []

  const [announcements, setAnnouncements] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<(number | string)[]>(announcementIds)
  const [loading, setLoading] = useState(true)
  const [comparing, setComparing] = useState(false)
  const [compareData, setCompareData] = useState<any[]>([])

  useEffect(() => {
    loadAnnouncements()
  }, [])

  useEffect(() => {
    if (announcementIds.length > 0) {
      loadCompareData()
    }
  }, [announcementIds])

  const loadAnnouncements = async () => {
    try {
      setLoading(true)
      // 인증 없이 접근 가능한 API 사용
      const response = await fetch('/api/rag/docs?limit=100')
      if (response.ok) {
        const data = await response.json()
        // announcements 형식으로 변환
        setAnnouncements(data || [])
      } else {
        throw new Error('공고 목록을 불러오는데 실패했습니다')
      }
    } catch (error) {
      console.error('공고 목록 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCompareData = async () => {
    if (announcementIds.length === 0) return

    try {
      setComparing(true)
      // 각 공고 ID에 대해 API 호출
      const data = await Promise.all(
        announcementIds.map(async (id) => {
          try {
            // UUID인지 숫자인지 확인
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id))
            
            if (isUUID) {
              // UUID인 경우 /api/rag/docs/[docId] 사용
              const response = await fetch(`/api/rag/docs/${id}`)
              if (response.ok) {
                return await response.json()
              }
            } else {
              // 숫자 ID인 경우 public_announcements API 시도 (인증 필요할 수 있음)
              try {
                const response = await fetch(`/api/public-announcement/${id}`)
                if (response.ok) {
                  return await response.json()
                }
              } catch (e) {
                // 인증 오류 시 무시하고 다음 시도
              }
            }
            return null
          } catch (error) {
            console.error(`공고 ${id} 로드 실패:`, error)
            return null
          }
        })
      )
      setCompareData(data.filter(Boolean))
    } catch (error) {
      console.error('비교 데이터 로드 실패:', error)
    } finally {
      setComparing(false)
    }
  }

  const toggleSelection = (id: number | string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleCompare = () => {
    if (selectedIds.length >= 2) {
      router.push(`/compare?ids=${selectedIds.map(id => String(id)).join(',')}`)
    }
  }

  const handleClear = () => {
    setSelectedIds([])
    setCompareData([])
    router.push('/compare')
  }

  // 비교 모드인지 확인
  const isCompareMode = announcementIds.length > 0 && compareData.length > 0

  // 비교 차트 데이터
  const chartData = compareData.map((ann) => ({
    name: ann.title?.substring(0, 20) || `공고 ${ann.id}`,
    예산: ann.budget_min ? ann.budget_min / 1000000 : 0, // 만원 단위
    기간: ann.duration_months || 0,
  }))

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-6 py-8 max-w-7xl">
        {!isCompareMode ? (
          // 공고 선택 모드
          <>
            <div className="mb-6">
              <h1 className="text-3xl font-semibold mb-2">공고 비교</h1>
              <p className="text-slate-600">
                비교할 공고를 선택하세요. (최소 2개 이상)
              </p>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : announcements.length === 0 ? (
              <div className="text-center py-20 border rounded-lg">
                <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 mb-4">등록된 공고가 없습니다.</p>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    {selectedIds.length}개 선택됨
                  </div>
                  <div className="flex gap-2">
                    {selectedIds.length > 0 && (
                      <Button variant="outline" onClick={() => setSelectedIds([])}>
                        선택 해제
                      </Button>
                    )}
                    <Button
                      onClick={handleCompare}
                      disabled={selectedIds.length < 2}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      비교하기 ({selectedIds.length})
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {announcements.map((announcement) => {
                    const isSelected = selectedIds.includes(announcement.id)
                    return (
                      <div
                        key={announcement.id}
                        onClick={() => toggleSelection(announcement.id)}
                        className={`p-6 border-2 rounded-lg cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold line-clamp-2 mb-2">
                              {announcement.title}
                            </h3>
                            {(announcement.organization_name || announcement.agency) && (
                              <p className="text-sm text-slate-600">
                                {announcement.organization_name || announcement.agency}
                              </p>
                            )}
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-6 h-6 text-blue-600 flex-shrink-0 ml-2" />
                          )}
                        </div>

                        <div className="space-y-2 mb-4">
                          {announcement.budget_min && (
                            <div className="flex items-center gap-2 text-sm">
                              <DollarSign className="w-4 h-4 text-green-600" />
                              <span>
                                {announcement.budget_min.toLocaleString()}원
                                {announcement.budget_max &&
                                  ` ~ ${announcement.budget_max.toLocaleString()}원`}
                              </span>
                            </div>
                          )}
                          {announcement.duration_months && (
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-4 h-4 text-purple-600" />
                              <span>{announcement.duration_months}개월</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              announcement.status === 'analyzed'
                                ? 'bg-green-100 text-green-700'
                                : announcement.status === 'matched'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {announcement.status === 'analyzed'
                              ? '분석 완료'
                              : announcement.status === 'matched'
                              ? '매칭 완료'
                              : '대기 중'}
                          </span>
                          <span className="text-xs text-slate-500">
                            {new Date(announcement.created_at).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </>
        ) : (
          // 비교 결과 모드
          <>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-semibold mb-2">공고 비교 결과</h1>
                <p className="text-slate-600">
                  {compareData.length}개의 공고를 비교합니다.
                </p>
              </div>
              <Button variant="outline" onClick={handleClear}>
                <X className="w-4 h-4 mr-2" />
                새로 비교
              </Button>
            </div>

            {comparing ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* 비교 그래프 */}
                <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
                  <h3 className="text-lg font-semibold mb-4">예산 및 기간 비교</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="예산" fill="#3B82F6" name="예산 (만원)" />
                      <Bar yAxisId="right" dataKey="기간" fill="#10B981" name="기간 (개월)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 상세 비교 테이블 */}
                <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
                  <h3 className="text-lg font-semibold mb-4">상세 비교</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left p-3 font-semibold">항목</th>
                          {compareData.map((ann) => (
                            <th key={ann.id} className="text-left p-3 font-semibold">
                              {ann.title?.substring(0, 30) || `공고 ${ann.id}`}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-slate-100">
                          <td className="p-3 font-medium">기관명</td>
                          {compareData.map((ann) => (
                            <td key={ann.id} className="p-3">
                              {ann.organization_name || ann.agency || '-'}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="p-3 font-medium">예산</td>
                          {compareData.map((ann) => (
                            <td key={ann.id} className="p-3">
                              {ann.budget_min ? (
                                <>
                                  <Money amount={ann.budget_min} />
                                  {ann.budget_max && (
                                    <> ~ <Money amount={ann.budget_max} /></>
                                  )}
                                </>
                              ) : (
                                '-'
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="p-3 font-medium">기간</td>
                          {compareData.map((ann) => (
                            <td key={ann.id} className="p-3">
                              {ann.duration_months ? `${ann.duration_months}개월` : '-'}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="p-3 font-medium">필요 기술</td>
                          {compareData.map((ann) => (
                            <td key={ann.id} className="p-3">
                              {ann.required_skills && ann.required_skills.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {ann.required_skills.slice(0, 5).map((skill: string, idx: number) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                                    >
                                      {skill}
                                    </span>
                                  ))}
                                  {ann.required_skills.length > 5 && (
                                    <span className="text-xs text-slate-500">
                                      +{ann.required_skills.length - 5}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                '-'
                              )}
                            </td>
                          ))}
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td className="p-3 font-medium">상태</td>
                          {compareData.map((ann) => (
                            <td key={ann.id} className="p-3">
                              <span
                                className={`px-2 py-1 rounded text-xs ${
                                  ann.status === 'analyzed'
                                    ? 'bg-green-100 text-green-700'
                                    : ann.status === 'matched'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {ann.status === 'analyzed'
                                  ? '분석 완료'
                                  : ann.status === 'matched'
                                  ? '매칭 완료'
                                  : '대기 중'}
                              </span>
                            </td>
                          ))}
                        </tr>
                        {compareData.some((ann) => ann.ai_analysis?.summary) && (
                          <tr className="border-b border-slate-100">
                            <td className="p-3 font-medium">AI 요약</td>
                            {compareData.map((ann) => (
                              <td key={ann.id} className="p-3">
                                {ann.ai_analysis?.summary ? (
                                  <p className="text-sm text-slate-700 line-clamp-3">
                                    {ann.ai_analysis.summary}
                                  </p>
                                ) : (
                                  '-'
                                )}
                              </td>
                            ))}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 개별 공고 상세 보기 링크 */}
                <div className="flex gap-4 justify-end">
                  {compareData.map((ann) => (
                    <Button
                      key={ann.id}
                      variant="outline"
                      onClick={() => router.push(`/public-announcements/${ann.id}`)}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      {ann.title?.substring(0, 20) || `공고 ${ann.id}`} 상세보기
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}

