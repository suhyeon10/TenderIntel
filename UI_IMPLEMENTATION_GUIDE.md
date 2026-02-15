# UI 구현 가이드 - 새 기능 반영

## 📋 개요

백엔드에 추가된 4가지 기능을 프론트엔드 UI에 반영하는 가이드입니다.

## 🎯 구현할 기능

1. ✅ 조항 자동 분류(Labeling) - 조항 목록 표시
2. ✅ 위험 조항 자동 하이라이트 - 문서 전문에 색상 표시
3. ✅ 계약서 버전 비교 - 비교 화면 추가
4. ✅ AI 기반 조항 리라이트 - 수정 제안 UI

---

## 1️⃣ 타입 정의 업데이트

### `src/apis/legal.service.ts` 수정

```typescript
// 기존 ContractIssueV2에 필드 추가
export interface ContractIssueV2 {
  id: string
  category: string
  severity: 'low' | 'medium' | 'high'
  summary: string
  originalText: string
  legalBasis: string[]
  explanation: string
  suggestedRevision: string
  clauseId?: string  // ✨ 추가
  startIndex?: number  // ✨ 추가
  endIndex?: number  // ✨ 추가
}

// ✨ 새 타입 추가
export interface ClauseV2 {
  id: string
  title: string  // "제1조 (목적)"
  content: string
  articleNumber?: number
  startIndex: number
  endIndex: number
  category?: string
}

export interface HighlightedTextV2 {
  text: string
  startIndex: number
  endIndex: number
  severity: 'low' | 'medium' | 'high'
  issueId: string
}

// ContractAnalysisResponseV2에 필드 추가
export interface ContractAnalysisResponseV2 {
  docId: string
  title: string
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high'
  sections: {
    working_hours?: number
    wage?: number
    probation_termination?: number
    stock_option_ip?: number
  }
  issues: ContractIssueV2[]
  summary: string
  retrievedContexts: Array<{
    sourceType: string
    title: string
    snippet: string
  }>
  contractText?: string
  clauses?: ClauseV2[]  // ✨ 추가
  highlightedTexts?: HighlightedTextV2[]  // ✨ 추가
  createdAt: string
}

// ✨ 비교 API 타입
export interface ContractComparisonRequestV2 {
  oldContractId: string
  newContractId: string
}

export interface ContractComparisonResponseV2 {
  oldContract: ContractAnalysisResponseV2
  newContract: ContractAnalysisResponseV2
  changedClauses: Array<{
    type: 'added' | 'removed' | 'modified'
    clauseId: string
    title: string
    content?: string
    oldContent?: string
    newContent?: string
  }>
  riskChange: {
    oldRiskScore: number
    newRiskScore: number
    oldRiskLevel: string
    newRiskLevel: string
    riskScoreDelta: number
  }
  summary: string
}

// ✨ 리라이트 API 타입
export interface ClauseRewriteRequestV2 {
  clauseId: string
  originalText: string
  issueId?: string
}

export interface ClauseRewriteResponseV2 {
  originalText: string
  rewrittenText: string
  explanation: string
  legalBasis: string[]
}
```

### API 함수 추가 (`src/apis/legal.service.ts`)

```typescript
/**
 * 계약서 비교 (v2)
 */
export const compareContractsV2 = async (
  oldContractId: string,
  newContractId: string
): Promise<ContractComparisonResponseV2> => {
  const url = `${LEGAL_API_BASE_V2}/compare-contracts`
  const authHeaders = await getAuthHeaders()
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      oldContractId,
      newContractId,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`계약서 비교 실패: ${response.status}`)
  }
  
  return await response.json()
}

/**
 * 조항 리라이트 (v2)
 */
export const rewriteClauseV2 = async (
  clauseId: string,
  originalText: string,
  issueId?: string
): Promise<ClauseRewriteResponseV2> => {
  const url = `${LEGAL_API_BASE_V2}/rewrite-clause`
  const authHeaders = await getAuthHeaders()
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      clauseId,
      originalText,
      issueId,
    }),
  })
  
  if (!response.ok) {
    throw new Error(`조항 리라이트 실패: ${response.status}`)
  }
  
  return await response.json()
}
```

---

## 2️⃣ ContractViewer 개선 - 하이라이트 기능

### `src/components/contract/ContractViewer.tsx` 수정

```typescript
interface ContractViewerProps {
  contractText: string
  issues: LegalIssue[]
  selectedIssueId?: string
  onIssueClick?: (issueId: string) => void
  highlightedTexts?: Array<{  // ✨ 추가
    text: string
    startIndex: number
    endIndex: number
    severity: 'low' | 'medium' | 'high'
    issueId: string
  }>
}

export function ContractViewer({
  contractText,
  issues,
  selectedIssueId,
  onIssueClick,
  highlightedTexts = [],  // ✨ 추가
}: ContractViewerProps) {
  // highlightedTexts를 사용하여 하이라이트 적용
  // 기존 issues 기반 하이라이트와 병합
  
  const renderTextWithHighlights = (text: string, paragraphIndex: number) => {
    // ... 기존 코드 ...
    
    // highlightedTexts와 issues를 병합하여 하이라이트 적용
    const allHighlights = [
      ...highlightedTexts.map(ht => ({
        startIndex: ht.startIndex,
        endIndex: ht.endIndex,
        severity: ht.severity,
        issueId: ht.issueId,
        text: ht.text,
      })),
      ...sortedIssues.map(issue => ({
        startIndex: issue.location.startIndex ?? 0,
        endIndex: issue.location.endIndex ?? issue.location.startIndex ?? 0 + (issue.originalText?.length ?? 0),
        severity: issue.severity,
        issueId: issue.id,
        text: issue.originalText || '',
      })),
    ].sort((a, b) => a.startIndex - b.startIndex)
    
    // 중복 제거 및 병합
    // ... 하이라이트 렌더링 로직 ...
  }
}
```

---

## 3️⃣ 조항 목록 컴포넌트 추가

### `src/components/contract/ClauseList.tsx` 생성

```typescript
'use client'

import React from 'react'
import { FileText, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Clause {
  id: string
  title: string
  content: string
  articleNumber?: number
  category?: string
}

interface ClauseListProps {
  clauses: Clause[]
  selectedClauseId?: string
  onClauseClick?: (clauseId: string) => void
}

export function ClauseList({ clauses, selectedClauseId, onClauseClick }: ClauseListProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold">조항 목록</h3>
        <span className="text-sm text-slate-500">({clauses.length}개)</span>
      </div>
      
      <div className="space-y-1">
        {clauses.map((clause) => (
          <button
            key={clause.id}
            onClick={() => onClauseClick?.(clause.id)}
            className={cn(
              "w-full text-left p-3 rounded-lg border transition-all",
              "hover:bg-slate-50 hover:border-blue-300",
              selectedClauseId === clause.id
                ? "bg-blue-50 border-blue-400 shadow-sm"
                : "bg-white border-slate-200"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {clause.articleNumber && (
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-600 text-white text-sm font-bold rounded">
                      {clause.articleNumber}
                    </span>
                  )}
                  <span className="font-medium text-slate-900 truncate">
                    {clause.title}
                  </span>
                </div>
                {clause.category && (
                  <span className="text-xs text-slate-500">
                    {getCategoryLabel(clause.category)}
                  </span>
                )}
                <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                  {clause.content.substring(0, 100)}...
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 flex-shrink-0" />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    working_hours: '근로시간',
    wage: '임금',
    probation_termination: '수습/해지',
    stock_option_ip: '스톡옵션/IP',
    vacation: '휴가',
    overtime: '연장근로',
    benefits: '복리후생',
  }
  return labels[category] || category
}
```

---

## 4️⃣ 계약서 상세 페이지 업데이트

### `src/app/legal/contract/[docId]/page.tsx` 수정

```typescript
// clauses와 highlightedTexts 추가
const [selectedClauseId, setSelectedClauseId] = useState<string | undefined>()

// 분석 결과 로드 시 clauses, highlightedTexts 포함
const normalizedData = {
  // ... 기존 코드 ...
  clauses: v2Data?.clauses || [],
  highlightedTexts: v2Data?.highlightedTexts || [],
}

// ContractViewer에 props 전달
<ContractViewer
  contractText={analysisResult.contractText}
  issues={analysisResult.issues}
  selectedIssueId={selectedIssueId}
  onIssueClick={setSelectedIssueId}
  highlightedTexts={analysisResult.highlightedTexts}  // ✨ 추가
/>

// 조항 목록 추가 (사이드바 또는 별도 패널)
<ClauseList
  clauses={analysisResult.clauses}
  selectedClauseId={selectedClauseId}
  onClauseClick={(clauseId) => {
    setSelectedClauseId(clauseId)
    // 해당 조항으로 스크롤
  }}
/>
```

---

## 5️⃣ 비교 기능 UI 추가

### `src/app/legal/contract/compare/page.tsx` 생성

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { compareContractsV2 } from '@/apis/legal.service'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Loader2, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'

export default function CompareContractsPage() {
  const router = useRouter()
  const [oldContractId, setOldContractId] = useState('')
  const [newContractId, setNewContractId] = useState('')
  const [loading, setLoading] = useState(false)
  const [comparison, setComparison] = useState<any>(null)

  const handleCompare = async () => {
    if (!oldContractId || !newContractId) return
    
    setLoading(true)
    try {
      const result = await compareContractsV2(oldContractId, newContractId)
      setComparison(result)
    } catch (error) {
      console.error('비교 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">계약서 비교</h1>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <input
          type="text"
          placeholder="이전 계약서 ID"
          value={oldContractId}
          onChange={(e) => setOldContractId(e.target.value)}
          className="p-2 border rounded"
        />
        <input
          type="text"
          placeholder="새 계약서 ID"
          value={newContractId}
          onChange={(e) => setNewContractId(e.target.value)}
          className="p-2 border rounded"
        />
      </div>
      
      <Button onClick={handleCompare} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : '비교하기'}
      </Button>
      
      {comparison && (
        <div className="mt-6 space-y-4">
          {/* 위험도 변화 */}
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-slate-600">이전 위험도</p>
                <p className="text-2xl font-bold">{comparison.riskChange.oldRiskScore.toFixed(1)}</p>
              </div>
              <ArrowRight className="w-6 h-6" />
              <div>
                <p className="text-sm text-slate-600">새 위험도</p>
                <p className="text-2xl font-bold">{comparison.riskChange.newRiskScore.toFixed(1)}</p>
              </div>
              {comparison.riskChange.riskScoreDelta > 0 ? (
                <TrendingUp className="w-6 h-6 text-red-500" />
              ) : (
                <TrendingDown className="w-6 h-6 text-green-500" />
              )}
            </div>
          </Card>
          
          {/* 변경된 조항 */}
          <Card className="p-4">
            <h3 className="font-semibold mb-4">변경된 조항 ({comparison.changedClauses.length}개)</h3>
            <div className="space-y-2">
              {comparison.changedClauses.map((clause: any, idx: number) => (
                <div key={idx} className="p-3 border rounded">
                  <span className={`px-2 py-1 rounded text-xs ${
                    clause.type === 'added' ? 'bg-green-100 text-green-800' :
                    clause.type === 'removed' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {clause.type === 'added' ? '추가' : clause.type === 'removed' ? '삭제' : '수정'}
                  </span>
                  <p className="font-medium mt-2">{clause.title}</p>
                  {clause.type === 'modified' && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-red-600">- {clause.oldContent?.substring(0, 100)}</p>
                      <p className="text-sm text-green-600">+ {clause.newContent?.substring(0, 100)}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
```

---

## 6️⃣ 리라이트 기능 UI 추가

### `src/components/contract/RewriteModal.tsx` 생성

```typescript
'use client'

import { useState } from 'react'
import { rewriteClauseV2 } from '@/apis/legal.service'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles } from 'lucide-react'

interface RewriteModalProps {
  clauseId: string
  originalText: string
  issueId?: string
  onClose: () => void
}

export function RewriteModal({ clauseId, originalText, issueId, onClose }: RewriteModalProps) {
  const [loading, setLoading] = useState(false)
  const [rewritten, setRewritten] = useState<any>(null)

  const handleRewrite = async () => {
    setLoading(true)
    try {
      const result = await rewriteClauseV2(clauseId, originalText, issueId)
      setRewritten(result)
    } catch (error) {
      console.error('리라이트 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            조항 수정 제안
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2 text-red-600">원본 조항</h3>
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <p className="text-sm whitespace-pre-wrap">{originalText}</p>
            </div>
          </div>
          
          {!rewritten ? (
            <Button onClick={handleRewrite} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="animate-spin mr-2" />
                  수정 중...
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
                <h3 className="font-semibold mb-2 text-green-600">수정 제안</h3>
                <div className="p-3 bg-green-50 border border-green-200 rounded">
                  <p className="text-sm whitespace-pre-wrap">{rewritten.rewrittenText}</p>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">수정 이유</h3>
                <p className="text-sm text-slate-600">{rewritten.explanation}</p>
              </div>
              
              {rewritten.legalBasis.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">법적 근거</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {rewritten.legalBasis.map((basis: string, idx: number) => (
                      <li key={idx} className="text-sm text-slate-600">{basis}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

---

## 7️⃣ AnalysisPanel에 리라이트 버튼 추가

### `src/components/contract/AnalysisPanel.tsx` 수정

```typescript
import { RewriteModal } from './RewriteModal'

// 각 issue 카드에 리라이트 버튼 추가
<Button
  variant="outline"
  size="sm"
  onClick={() => setRewriteModal({ clauseId: issue.id, originalText: issue.originalText, issueId: issue.id })}
>
  <Sparkles className="w-4 h-4 mr-2" />
  수정 제안
</Button>
```

---

## 📝 요약

1. **타입 정의 업데이트**: `clauses`, `highlightedTexts` 필드 추가
2. **ContractViewer 개선**: `highlightedTexts` 기반 하이라이트 적용
3. **ClauseList 컴포넌트**: 조항 목록 표시
4. **비교 페이지**: 계약서 버전 비교 UI
5. **리라이트 모달**: AI 기반 조항 수정 제안 UI

이 가이드를 따라 단계별로 구현하면 모든 기능이 UI에 반영됩니다!

