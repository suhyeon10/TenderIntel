# RAG API 사용 가이드

## 🎯 현재 상황

✅ **Backend RAG API 실행 중**: `http://localhost:8000`
✅ **Frontend RAG 구현 완료**: Supabase pgvector 사용
⚠️ **Frontend ↔ Backend 연동 필요**: 아직 완전히 연결되지 않음

## 📋 해야 할 작업

### 1. Frontend에서 Backend RAG API 호출 구현

현재 Frontend는 자체 RAG만 사용하고 있습니다. Backend RAG와 연동해야 합니다.

#### 작업 1-1: Backend API 클라이언트 생성

`src/lib/api/backend-rag.ts` 파일 생성:

```typescript
const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000'

export class BackendRAGClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = BACKEND_API_URL
  }

  /**
   * 공고 분석 작업 시작
   */
  async startAnalysis(docId: string): Promise<{ job_id: string }> {
    const response = await fetch(`${this.baseUrl}/api/analysis/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doc_id: docId }),
    })

    if (!response.ok) {
      throw new Error('분석 작업 시작 실패')
    }

    const result = await response.json()
    return result.data
  }

  /**
   * 분석 진행 상황 스트리밍 (Server-Sent Events)
   */
  streamAnalysisProgress(
    jobId: string,
    onProgress: (data: any) => void,
    onComplete: (result: any) => void,
    onError: (error: Error) => void
  ) {
    const eventSource = new EventSource(
      `${this.baseUrl}/api/analysis/stream/${jobId}`
    )

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.status === 'completed') {
        eventSource.close()
        onComplete(data.result)
      } else if (data.status === 'failed') {
        eventSource.close()
        onError(new Error(data.error))
      } else {
        onProgress(data)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
      onError(new Error('분석 중 오류가 발생했습니다.'))
    }

    return () => eventSource.close()
  }

  /**
   * 팀 매칭
   */
  async matchTeams(
    announcementId: string,
    options?: { top_k?: number; min_score?: number }
  ) {
    const params = new URLSearchParams()
    if (options?.top_k) params.append('top_k', options.top_k.toString())
    if (options?.min_score) params.append('min_score', options.min_score.toString())

    const response = await fetch(
      `${this.baseUrl}/api/announcements/${announcementId}/match?${params}`
    )

    if (!response.ok) {
      throw new Error('팀 매칭 실패')
    }

    const result = await response.json()
    return result.data?.matched_teams || []
  }

  /**
   * 견적서 생성
   */
  async generateEstimate(announcementId: string, teamId: string) {
    const response = await fetch(`${this.baseUrl}/api/estimates/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        announcement_id: announcementId,
        team_id: teamId,
      }),
    })

    if (!response.ok) {
      throw new Error('견적서 생성 실패')
    }

    const result = await response.json()
    return result.data?.estimate || ''
  }
}
```

### 2. 업로드 페이지에 Backend 분석 통합

`src/app/upload/page.tsx` 수정:

```typescript
import { BiddingWorkflow } from '@/lib/workflows/bidding-workflow'
import { AnalysisProgress } from '@/components/rag/AnalysisProgress'

export default function UploadPage() {
  const [workflow, setWorkflow] = useState<BiddingWorkflow | null>(null)
  const [progress, setProgress] = useState<any>(null)

  const handleFileUpload = async (file: File) => {
    const workflow = new BiddingWorkflow()
    
    try {
      const result = await workflow.processAnnouncement(
        file,
        (progress) => {
          setProgress(progress)
          console.log(`진행률: ${progress.progress}% - ${progress.message}`)
        }
      )

      // 결과 처리
      router.push(`/analysis/${result.docId}`)
    } catch (error) {
      console.error('워크플로우 오류:', error)
    }
  }

  return (
    <div>
      {/* 업로드 UI */}
      {progress && (
        <AnalysisProgress
          docId={progress.data?.docId}
          onComplete={(result) => {
            // 분석 완료 처리
          }}
        />
      )}
    </div>
  )
}
```

### 3. 분석 페이지에 Backend 분석 결과 표시

`src/app/analysis/[docId]/page.tsx` 수정:

```typescript
import { BackendRAGClient } from '@/lib/api/backend-rag'

export default function AnalysisPage() {
  const [backendAnalysis, setBackendAnalysis] = useState<any>(null)
  const [loadingBackend, setLoadingBackend] = useState(false)

  useEffect(() => {
    // Backend 심층 분석 시작
    startBackendAnalysis()
  }, [docId])

  const startBackendAnalysis = async () => {
    try {
      setLoadingBackend(true)
      const client = new BackendRAGClient()
      
      const { job_id } = await client.startAnalysis(docId)
      
      // 진행 상황 스트리밍
      client.streamAnalysisProgress(
        job_id,
        (progress) => {
          console.log('분석 진행:', progress)
        },
        (result) => {
          setBackendAnalysis(result)
          setLoadingBackend(false)
        },
        (error) => {
          console.error('분석 오류:', error)
          setLoadingBackend(false)
        }
      )
    } catch (error) {
      console.error('분석 시작 실패:', error)
      setLoadingBackend(false)
    }
  }

  return (
    <div>
      {/* Frontend RAG 결과 (빠른 응답) */}
      {analysis && <AnalysisSummaryCard data={analysis} />}
      
      {/* Backend RAG 결과 (심층 분석) */}
      {loadingBackend && <div>심층 분석 중...</div>}
      {backendAnalysis && <BackendAnalysisCard data={backendAnalysis} />}
    </div>
  )
}
```

### 4. 팀 매칭 페이지에 Backend 매칭 통합

`src/app/match/[docId]/page.tsx` 수정:

```typescript
import { BackendRAGClient } from '@/lib/api/backend-rag'

export default function MatchPage() {
  const [matchedTeams, setMatchedTeams] = useState([])

  useEffect(() => {
    loadMatchedTeams()
  }, [docId])

  const loadMatchedTeams = async () => {
    try {
      const client = new BackendRAGClient()
      const teams = await client.matchTeams(docId, {
        top_k: 10,
        min_score: 0.7,
      })
      setMatchedTeams(teams)
    } catch (error) {
      console.error('팀 매칭 실패:', error)
    }
  }

  return (
    <div>
      {matchedTeams.map(team => (
        <TeamCard key={team.team_id} team={team} />
      ))}
    </div>
  )
}
```

## 🧪 테스트 방법

### 1. API 직접 테스트

```bash
# 1. 헬스 체크
curl http://localhost:8000/api/health

# 2. 분석 작업 시작
curl -X POST http://localhost:8000/api/analysis/start \
  -H "Content-Type: application/json" \
  -d '{"doc_id": "1"}'

# 3. 팀 매칭
curl http://localhost:8000/api/announcements/1/match?top_k=5

# 4. 견적서 생성
curl -X POST http://localhost:8000/api/estimates/generate \
  -H "Content-Type: application/json" \
  -d '{"announcement_id": "1", "team_id": "1"}'
```

### 2. Swagger UI에서 테스트

1. 브라우저에서 `http://localhost:8000/docs` 접속
2. 각 API 엔드포인트 클릭
3. "Try it out" 버튼 클릭
4. 파라미터 입력 후 "Execute" 클릭

### 3. Frontend에서 통합 테스트

1. `npm run dev` 실행
2. `/upload` 페이지에서 PDF 업로드
3. 진행 상황 확인
4. 분석 결과 확인

## 📊 전체 워크플로우

```
1. 사용자가 PDF 업로드
   ↓
2. Frontend RAG: 빠른 메타데이터 추출 (5초)
   ↓
3. Backend RAG: 심층 분석 시작 (비동기)
   ↓
4. Backend RAG: 팀 매칭 (10-30초)
   ↓
5. Backend RAG: 견적서 생성 (선택)
   ↓
6. 결과 표시
```

## 🚀 우선순위

### 높음 (즉시 구현)
1. ✅ Backend API 클라이언트 생성
2. ✅ 업로드 페이지에 워크플로우 통합
3. ✅ 분석 페이지에 Backend 결과 표시

### 중간 (다음 단계)
4. 팀 매칭 페이지 연동
5. 견적서 생성 기능 통합
6. 에러 처리 강화

### 낮음 (향후 개선)
7. 실시간 진행 상황 UI 개선
8. 결과 캐싱
9. 재시도 로직

## 📝 참고

- Backend API 문서: `http://localhost:8000/docs`
- Frontend RAG: `src/lib/rag/frontend-rag.ts`
- Backend RAG: `backend/core/orchestrator.py`
- 워크플로우: `src/lib/workflows/bidding-workflow.ts`

