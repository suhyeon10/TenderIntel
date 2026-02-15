'use client'

import { useState } from 'react'
import { rewriteClauseV2 } from '@/apis/legal.service'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { LegalBasisItem } from '@/types/legal'

interface RewriteModalProps {
  clauseId: string
  originalText: string
  issueId?: string
  onClose: () => void
}

export function RewriteModal({ clauseId, originalText, issueId, onClose }: RewriteModalProps) {
  const [loading, setLoading] = useState(false)
  const [rewritten, setRewritten] = useState<any>(null)
  const { toast } = useToast()

  const handleRewrite = async () => {
    setLoading(true)
    try {
      const result = await rewriteClauseV2(clauseId, originalText, issueId)
      setRewritten(result)
      toast({
        title: '수정 제안 생성 완료',
        description: 'AI가 조항을 분석하여 안전한 문구로 수정했습니다.',
      })
    } catch (error: any) {
      console.error('리라이트 실패:', error)
      toast({
        variant: 'destructive',
        title: '수정 제안 생성 실패',
        description: error.message || '조항 수정 제안을 생성하는 중 오류가 발생했습니다.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            조항 수정 제안
          </h2>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2 text-red-600 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              원본 조항
            </h3>
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm whitespace-pre-wrap text-slate-800">{originalText}</p>
            </div>
          </div>
          
          {!rewritten ? (
            <Button 
              onClick={handleRewrite} 
              disabled={loading} 
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin mr-2" />
                  AI가 조항을 분석 중...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI 수정 제안 받기
                </>
              )}
            </Button>
          ) : (
            <>
              <div>
                <h3 className="font-semibold mb-2 text-green-600 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  수정 제안
                </h3>
                <div className="p-3 bg-green-50 border border-green-200 rounded">
                  <p className="text-sm whitespace-pre-wrap text-slate-800">{rewritten.rewrittenText}</p>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2 text-slate-700">수정 이유</h3>
                <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded">{rewritten.explanation}</p>
              </div>
              
              {rewritten.legalBasis && rewritten.legalBasis.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 text-slate-700">법적 근거</h3>
                  <ul className="list-disc list-inside space-y-1 bg-slate-50 p-3 rounded">
                    {rewritten.legalBasis.map((basis: any, idx: number) => {
                      // 구조화된 형식인지 확인
                      const isStructured = typeof basis === 'object' && basis !== null && 'title' in basis;
                      
                      if (isStructured) {
                        const basisItem = basis as LegalBasisItem;
                        return (
                          <li key={idx} className="text-sm text-slate-600">
                            <span className="font-semibold">{basisItem.title}</span>
                            {basisItem.snippet && <span>: {basisItem.snippet.substring(0, 100)}...</span>}
                            {basisItem.filePath && (
                              <a
                                href={`${process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000'}/api/v2/legal/file?path=${encodeURIComponent(basisItem.filePath)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-700 hover:text-blue-800 hover:underline ml-2"
                                title="파일 열기"
                              >
                                [열기]
                              </a>
                            )}
                          </li>
                        );
                      } else {
                        const basisText = typeof basis === 'string' ? basis : JSON.stringify(basis);
                        return (
                          <li key={idx} className="text-sm text-slate-600">{basisText}</li>
                        );
                      }
                    })}
                  </ul>
                </div>
              )}
              
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={onClose} 
                  variant="outline" 
                  className="flex-1"
                >
                  닫기
                </Button>
                <Button 
                  onClick={() => {
                    navigator.clipboard.writeText(rewritten.rewrittenText)
                    toast({
                      title: '복사 완료',
                      description: '수정된 조항이 클립보드에 복사되었습니다.',
                    })
                  }}
                  className="flex-1"
                >
                  수정안 복사
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

