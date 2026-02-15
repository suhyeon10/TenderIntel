'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import SubHeader from '@/components/layout/SubHeader'
import { Button } from '@/components/ui/button'
import { Money } from '@/components/common/Money'
import { ScoreBadge } from '@/components/common/ScoreBadge'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts'
import { FileCheck, ArrowRight } from 'lucide-react'

export default function ComparePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const docId = params.docId as string
  const teamIds = searchParams.get('teams')?.split(',').map(Number) || []

  const [activeTab, setActiveTab] = useState<'summary' | 'items' | 'timeline' | 'evidence'>('summary')
  const [teams, setTeams] = useState<any[]>([])

  useEffect(() => {
    loadTeamData()
  }, [teamIds])

  const loadTeamData = async () => {
    // TODO: 실제 팀 데이터 로드
    const mockTeams = teamIds.map((id) => ({
      id,
      name: `팀 ${id}`,
      price: Math.floor(Math.random() * 50000000) + 10000000,
      duration: `${Math.floor(Math.random() * 6) + 3}개월`,
      score: Math.random() * 0.3 + 0.7,
      items: {
        planning: { price: 2000000, manMonths: 1 },
        design: { price: 3000000, manMonths: 1.5 },
        frontend: { price: 8000000, manMonths: 3 },
        backend: { price: 10000000, manMonths: 4 },
        infra: { price: 5000000, manMonths: 2 },
        qa: { price: 2000000, manMonths: 1 },
        pm: { price: 3000000, manMonths: 2 },
      },
      capabilities: {
        domain: Math.random() * 20 + 80,
        frontend: Math.random() * 20 + 80,
        backend: Math.random() * 20 + 80,
        cloud: Math.random() * 20 + 80,
        security: Math.random() * 20 + 80,
      },
    }))
    setTeams(mockTeams)
  }

  const chartData = teams.map((team) => ({
    name: team.name,
    금액: team.price / 1000000, // 만원 단위로 변환
    기간: parseInt(team.duration.replace('개월', '')) || 0,
    적합도: Math.round(team.score * 100),
  }))

  const radarData = [
    {
      subject: '도메인',
      ...teams.reduce((acc, team) => {
        acc[team.name] = team.capabilities.domain
        return acc
      }, {} as Record<string, number>),
    },
    {
      subject: '프론트엔드',
      ...teams.reduce((acc, team) => {
        acc[team.name] = team.capabilities.frontend
        return acc
      }, {} as Record<string, number>),
    },
    {
      subject: '백엔드',
      ...teams.reduce((acc, team) => {
        acc[team.name] = team.capabilities.backend
        return acc
      }, {} as Record<string, number>),
    },
    {
      subject: '클라우드',
      ...teams.reduce((acc, team) => {
        acc[team.name] = team.capabilities.cloud
        return acc
      }, {} as Record<string, number>),
    },
    {
      subject: '보안',
      ...teams.reduce((acc, team) => {
        acc[team.name] = team.capabilities.security
        return acc
      }, {} as Record<string, number>),
    },
  ]

  const handleContract = (teamId: number) => {
    router.push(`/contract/${docId}?teamId=${teamId}`)
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <SubHeader currentStep={4} totalSteps={5} />
      <main className="flex-1 container mx-auto px-6 py-8 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold mb-2">견적 비교 대시보드</h1>
          <p className="text-slate-600">
            선택한 팀들의 견적을 비교합니다.
          </p>
        </div>

        {/* 탭 */}
        <div className="flex gap-2 mb-6 border-b border-slate-200">
          {[
            { id: 'summary', label: '개요' },
            { id: 'items', label: '항목별' },
            { id: 'timeline', label: '타임라인' },
            { id: 'evidence', label: '근거' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 탭 컨텐츠 */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            {/* 막대 그래프 */}
            <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
              <h3 className="text-lg font-semibold mb-4">비교 그래프</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="금액" fill="#3B82F6" name="금액 (만원)" />
                  <Bar yAxisId="right" dataKey="적합도" fill="#10B981" name="적합도 (%)" />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 레이더 차트 */}
            <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
              <h3 className="text-lg font-semibold mb-4">역량 비교</h3>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  {teams.map((team, i) => {
                    const colors = ['#3B82F6', '#10B981', '#F59E0B']
                    return (
                      <Radar
                        key={team.id}
                        name={team.name}
                        dataKey={team.name}
                        stroke={colors[i % colors.length]}
                        fill={colors[i % colors.length]}
                        fillOpacity={0.3}
                      />
                    )
                  })}
                  <Tooltip />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'items' && (
          <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
            <h3 className="text-lg font-semibold mb-4">항목별 비교</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left p-3 font-semibold">항목</th>
                    {teams.map((team) => (
                      <th key={team.id} className="text-right p-3 font-semibold">
                        {team.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { key: 'planning', label: '기획' },
                    { key: 'design', label: '디자인' },
                    { key: 'frontend', label: '프론트엔드' },
                    { key: 'backend', label: '백엔드' },
                    { key: 'infra', label: '인프라' },
                    { key: 'qa', label: 'QA' },
                    { key: 'pm', label: 'PM' },
                  ].map((item) => (
                    <tr key={item.key} className="border-b border-slate-100">
                      <td className="p-3 font-medium">{item.label}</td>
                      {teams.map((team) => (
                        <td key={team.id} className="text-right p-3">
                          <div>
                            <Money amount={team.items[item.key].price} />
                          </div>
                          <div className="text-xs text-slate-500">
                            {team.items[item.key].manMonths}MM
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
            <h3 className="text-lg font-semibold mb-4">타임라인</h3>
            <div className="space-y-4">
              {teams.map((team) => (
                <div key={team.id}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{team.name}</span>
                    <span className="text-sm text-slate-600">{team.duration}</span>
                  </div>
                  <div className="h-8 bg-slate-100 rounded-lg relative overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-lg"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'evidence' && (
          <div className="rounded-2xl border border-slate-200 p-5 bg-white shadow-sm">
            <h3 className="text-lg font-semibold mb-4">근거</h3>
            <p className="text-sm text-slate-600 mb-4">
              모든 추천 및 견적 문장 옆에 [id:###] 표시가 있습니다. 클릭하면 원문을 확인할 수 있습니다.
            </p>
            <div className="space-y-2">
              {teams.map((team) => (
                <div key={team.id} className="p-4 bg-slate-50 rounded-lg">
                  <div className="font-medium mb-2">{team.name}</div>
                  <div className="text-sm text-slate-700">
                    예상 견적: <Money amount={team.price} />{' '}
                    <span className="text-blue-600 cursor-pointer hover:underline">
                      [id:123]
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-8 flex justify-end gap-4">
          {teams.map((team) => (
            <Button
              key={team.id}
              onClick={() => handleContract(team.id)}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-2 font-medium shadow-sm"
            >
              <FileCheck className="w-4 h-4 mr-2" />
              {team.name}와 계약 요청
            </Button>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}

