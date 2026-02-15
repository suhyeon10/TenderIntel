'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { compareContractsV2 } from '@/apis/legal.service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, ArrowRight, TrendingUp, TrendingDown, FileText, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function CompareContractsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [oldContractId, setOldContractId] = useState('')
  const [newContractId, setNewContractId] = useState('')
  const [loading, setLoading] = useState(false)
  const [comparison, setComparison] = useState<any>(null)

  const handleCompare = async () => {
    if (!oldContractId || !newContractId) {
      toast({
        variant: 'destructive',
        title: '입력 필요',
        description: '두 계약서 ID를 모두 입력해주세요.',
      })
      return
    }
    
    if (oldContractId === newContractId) {
      toast({
        variant: 'destructive',
        title: '잘못된 입력',
        description: '서로 다른 계약서를 선택해주세요.',
      })
      return
    }
    
    setLoading(true)
    try {
      const result = await compareContractsV2(oldContractId, newContractId)
      setComparison(result)
      toast({
        title: '비교 완료',
        description: `${result.changedClauses.length}개 조항이 변경되었습니다.`,
      })
    } catch (error: any) {
      console.error('비교 실패:', error)
      toast({
        variant: 'destructive',
        title: '비교 실패',
        description: error.message || '계약서 비교 중 오류가 발생했습니다.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">계약서 비교</h1>
        <p className="text-slate-600">이전 계약서와 새 계약서를 비교하여 변경사항을 확인하세요.</p>
      </div>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>계약서 선택</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">이전 계약서 ID</label>
              <input
                type="text"
                placeholder="이전 계약서 docId 입력"
                value={oldContractId}
                onChange={(e) => setOldContractId(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">새 계약서 ID</label>
              <input
                type="text"
                placeholder="새 계약서 docId 입력"
                value={newContractId}
                onChange={(e) => setNewContractId(e.target.value)}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <Button 
            onClick={handleCompare} 
            disabled={loading || !oldContractId || !newContractId}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" />
                비교 중...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                비교하기
              </>
            )}
          </Button>
        </CardContent>
      </Card>
      
      {comparison && (
        <div className="space-y-6">
          {/* 위험도 변화 */}
          <Card>
            <CardHeader>
              <CardTitle>위험도 변화</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <p className="text-sm text-slate-600 mb-1">이전 위험도</p>
                  <p className="text-4xl font-bold text-slate-800">{comparison.riskChange.oldRiskScore.toFixed(1)}</p>
                  <p className="text-xs text-slate-500 mt-1">{comparison.riskChange.oldRiskLevel}</p>
                </div>
                <ArrowRight className="w-8 h-8 text-slate-400" />
                <div className="text-center">
                  <p className="text-sm text-slate-600 mb-1">새 위험도</p>
                  <p className="text-4xl font-bold text-slate-800">{comparison.riskChange.newRiskScore.toFixed(1)}</p>
                  <p className="text-xs text-slate-500 mt-1">{comparison.riskChange.newRiskLevel}</p>
                </div>
                <div className="flex flex-col items-center">
                  {comparison.riskChange.riskScoreDelta > 0 ? (
                    <>
                      <TrendingUp className="w-8 h-8 text-red-500" />
                      <p className="text-sm text-red-600 font-medium mt-1">
                        +{comparison.riskChange.riskScoreDelta.toFixed(1)}
                      </p>
                    </>
                  ) : comparison.riskChange.riskScoreDelta < 0 ? (
                    <>
                      <TrendingDown className="w-8 h-8 text-green-500" />
                      <p className="text-sm text-green-600 font-medium mt-1">
                        {comparison.riskChange.riskScoreDelta.toFixed(1)}
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 flex items-center justify-center text-slate-400">
                        <span className="text-2xl">—</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">변화 없음</p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* 변경된 조항 */}
          <Card>
            <CardHeader>
              <CardTitle>변경된 조항 ({comparison.changedClauses.length}개)</CardTitle>
            </CardHeader>
            <CardContent>
              {comparison.changedClauses.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>변경된 조항이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {comparison.changedClauses.map((clause: any, idx: number) => (
                    <div key={idx} className="p-4 border rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          clause.type === 'added' ? 'bg-green-100 text-green-800' :
                          clause.type === 'removed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {clause.type === 'added' ? '➕ 추가' : clause.type === 'removed' ? '➖ 삭제' : '✏️ 수정'}
                        </span>
                        <span className="font-medium text-slate-900">{clause.title}</span>
                      </div>
                      {clause.type === 'modified' && (
                        <div className="mt-3 space-y-2">
                          <div className="p-2 bg-red-50 border-l-4 border-red-400 rounded">
                            <p className="text-xs text-red-700 font-medium mb-1">이전 내용</p>
                            <p className="text-sm text-slate-800">{clause.oldContent?.substring(0, 200)}...</p>
                          </div>
                          <div className="p-2 bg-green-50 border-l-4 border-green-400 rounded">
                            <p className="text-xs text-green-700 font-medium mb-1">새 내용</p>
                            <p className="text-sm text-slate-800">{clause.newContent?.substring(0, 200)}...</p>
                          </div>
                        </div>
                      )}
                      {clause.type === 'added' && clause.content && (
                        <div className="mt-2 p-2 bg-green-50 border-l-4 border-green-400 rounded">
                          <p className="text-sm text-slate-800">{clause.content.substring(0, 200)}...</p>
                        </div>
                      )}
                      {clause.type === 'removed' && clause.content && (
                        <div className="mt-2 p-2 bg-red-50 border-l-4 border-red-400 rounded">
                          <p className="text-sm text-slate-800 line-through">{clause.content.substring(0, 200)}...</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* 비교 요약 */}
          <Card>
            <CardHeader>
              <CardTitle>비교 요약</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-700">{comparison.summary}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

