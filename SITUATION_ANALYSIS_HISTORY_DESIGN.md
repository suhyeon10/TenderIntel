# Quick Assist 페이지에서 Situation Analysis 히스토리 확인 기능 설계

## 📋 목표
`/legal/assist/quick` 페이지에서 `/legal/situation`에서 저장한 분석 결과를 확인하고 활용할 수 있도록 구현

## 🏗️ 구현 방안

### 1. 백엔드 API 추가

#### 1.1 Storage Service에 메서드 추가
**파일**: `backend/core/contract_storage.py`

```python
async def get_user_situation_analyses(
    self,
    user_id: str,
    limit: int = 20,
    offset: int = 0,
) -> List[Dict[str, Any]]:
    """
    사용자별 상황 분석 히스토리 조회
    
    Args:
        user_id: 사용자 ID
        limit: 조회 개수
        offset: 오프셋
    
    Returns:
        상황 분석 결과 리스트
    """
    self._ensure_initialized()
    
    try:
        result = (
            self.sb.table("situation_analyses")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .offset(offset)
            .execute()
        )
        
        analyses = []
        if result.data:
            for analysis in result.data:
                analyses.append({
                    "id": analysis["id"],
                    "situation": analysis.get("situation", "")[:100],  # 미리보기용
                    "category": analysis.get("category", "unknown"),
                    "risk_score": analysis.get("risk_score", 0),
                    "risk_level": analysis.get("risk_level", "low"),
                    "summary": analysis.get("analysis", {}).get("summary", "")[:200],  # 미리보기용
                    "created_at": analysis.get("created_at"),
                })
        
        return analyses
    except Exception as e:
        logger.error(f"상황 분석 히스토리 조회 중 오류: {str(e)}", exc_info=True)
        raise
```

#### 1.2 API 엔드포인트 추가
**파일**: `backend/api/routes_legal_v2.py`

```python
@router.get("/situations/history", response_model=List[dict])
async def get_situation_history(
    x_user_id: str = Header(..., alias="X-User-Id", description="사용자 ID"),
    limit: int = Query(20, ge=1, le=100, description="조회 개수"),
    offset: int = Query(0, ge=0, description="오프셋"),
):
    """
    사용자별 상황 분석 히스토리 조회
    """
    try:
        storage_service = get_storage_service()
        history = await storage_service.get_user_situation_analyses(
            user_id=x_user_id,
            limit=limit,
            offset=offset,
        )
        return history
    except Exception as e:
        logger.error(f"상황 분석 히스토리 조회 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"히스토리 조회 중 오류가 발생했습니다: {str(e)}",
        )
```

#### 1.3 특정 분석 결과 조회 API
```python
@router.get("/situations/{situation_id}", response_model=dict)
async def get_situation_analysis(
    situation_id: str,
    x_user_id: Optional[str] = Header(None, alias="X-User-Id", description="사용자 ID"),
):
    """
    특정 상황 분석 결과 조회
    """
    try:
        storage_service = get_storage_service()
        analysis = await storage_service.get_situation_analysis(situation_id, x_user_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="분석 결과를 찾을 수 없습니다.")
        return analysis
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"상황 분석 조회 중 오류 발생: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"분석 결과 조회 중 오류가 발생했습니다: {str(e)}",
        )
```

### 2. 프론트엔드 API 함수 추가

**파일**: `src/apis/legal.service.ts`

```typescript
/**
 * 사용자별 상황 분석 히스토리 조회 (v2)
 */
export const getSituationHistoryV2 = async (
  limit: number = 20,
  offset: number = 0,
  userId?: string | null
): Promise<Array<{
  id: string;
  situation: string;
  category: string;
  risk_score: number;
  risk_level: string;
  summary: string;
  created_at: string;
}>> => {
  try {
    const url = `${LEGAL_API_BASE_V2}/situations/history`;
    
    const authHeaders = await getAuthHeaders();
    authHeaders['Content-Type'] = 'application/json';
    
    if (userId !== undefined) {
      authHeaders['X-User-Id'] = userId;
    }
    
    if (!authHeaders['X-User-Id']) {
      console.warn('사용자 ID가 없어 히스토리를 조회할 수 없습니다.');
      return [];
    }
    
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    });

    const response = await fetch(`${url}?${params}`, {
      method: 'GET',
      headers: authHeaders,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`히스토리 조회 실패: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('히스토리 조회 오류:', error);
    throw error;
  }
};

/**
 * 특정 상황 분석 결과 조회 (v2)
 */
export const getSituationAnalysisV2 = async (
  situationId: string,
  userId?: string | null
): Promise<SituationResponseV2> => {
  try {
    const url = `${LEGAL_API_BASE_V2}/situations/${situationId}`;
    
    const authHeaders = await getAuthHeaders();
    authHeaders['Content-Type'] = 'application/json';
    
    if (userId !== undefined) {
      authHeaders['X-User-Id'] = userId;
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: authHeaders,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`분석 결과 조회 실패: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('분석 결과 조회 오류:', error);
    throw error;
  }
};
```

### 3. Quick Assist 페이지 UI 개선

**파일**: `src/app/legal/assist/quick/page.tsx`

#### 3.1 상태 추가
```typescript
// 저장된 상황 분석 히스토리
const [situationHistory, setSituationHistory] = useState<Array<{
  id: string;
  situation: string;
  category: string;
  risk_score: number;
  risk_level: string;
  summary: string;
  created_at: string;
}>>([])
const [loadingHistory, setLoadingHistory] = useState(false)
const [showHistory, setShowHistory] = useState(false)
```

#### 3.2 히스토리 로드 함수
```typescript
// 저장된 상황 분석 히스토리 로드
const loadSituationHistory = async () => {
  try {
    setLoadingHistory(true)
    const userId = await checkSession() // 사용자 ID 가져오기
    if (userId) {
      const history = await getSituationHistoryV2(10, 0, userId)
      setSituationHistory(history)
    }
  } catch (error) {
    console.error('히스토리 로드 실패:', error)
  } finally {
    setLoadingHistory(false)
  }
}

// 컴포넌트 마운트 시 히스토리 로드
useEffect(() => {
  loadSituationHistory()
}, [])
```

#### 3.3 UI 추가 위치
**옵션 1: 사이드바에 탭 추가** (추천)
- 왼쪽 사이드바에 "대화 내역"과 "저장된 분석" 탭 추가
- "저장된 분석" 탭에서 최근 10개 분석 결과 표시

**옵션 2: 상단에 드롭다운 추가**
- 상단에 "저장된 분석 보기" 버튼 추가
- 클릭하면 모달로 목록 표시

**옵션 3: 사이드바 하단에 섹션 추가**
- 대화 내역 아래에 "저장된 분석" 섹션 추가
- 접을 수 있는 아코디언 형태

#### 3.4 UI 컴포넌트 예시 (옵션 1 기준)
```tsx
{/* 사이드바 */}
<div className="w-1/5 border-r border-slate-200 flex flex-col bg-gradient-to-br from-blue-600 to-indigo-600">
  {/* 탭 선택 */}
  <div className="flex border-b border-slate-300">
    <button
      onClick={() => setShowHistory(false)}
      className={cn(
        "flex-1 px-4 py-3 text-sm font-medium transition-colors",
        !showHistory 
          ? "bg-white/20 text-white border-b-2 border-white" 
          : "text-white/70 hover:text-white hover:bg-white/10"
      )}
    >
      대화 내역
    </button>
    <button
      onClick={() => {
        setShowHistory(true)
        loadSituationHistory()
      }}
      className={cn(
        "flex-1 px-4 py-3 text-sm font-medium transition-colors",
        showHistory 
          ? "bg-white/20 text-white border-b-2 border-white" 
          : "text-white/70 hover:text-white hover:bg-white/10"
      )}
    >
      저장된 분석
    </button>
  </div>

  {/* 컨텐츠 영역 */}
  <div className="flex-1 overflow-y-auto">
    {!showHistory ? (
      // 기존 대화 내역
      <div>...</div>
    ) : (
      // 저장된 분석 목록
      <div className="p-4 space-y-2">
        {loadingHistory ? (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-white/70 mx-auto" />
            <p className="text-sm text-white/70 mt-2">로딩 중...</p>
          </div>
        ) : situationHistory.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 text-white/50 mx-auto mb-2" />
            <p className="text-sm text-white/70">저장된 분석이 없습니다</p>
            <Button
              onClick={() => router.push('/legal/situation')}
              variant="outline"
              size="sm"
              className="mt-4 bg-white/10 hover:bg-white/20 text-white border-white/30"
            >
              분석 시작하기
            </Button>
          </div>
        ) : (
          situationHistory.map((analysis) => (
            <button
              key={analysis.id}
              onClick={() => handleLoadSituationAnalysis(analysis.id)}
              className={cn(
                "w-full text-left p-3 rounded-lg transition-all",
                "bg-white/10 hover:bg-white/20 border border-white/20",
                "text-white"
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-semibold text-white/90 line-clamp-1">
                  {getCategoryLabel(analysis.category)}
                </span>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full",
                  analysis.risk_level === 'high' && "bg-red-500/80 text-white",
                  analysis.risk_level === 'medium' && "bg-amber-500/80 text-white",
                  analysis.risk_level === 'low' && "bg-green-500/80 text-white",
                )}>
                  {analysis.risk_score}
                </span>
              </div>
              <p className="text-xs text-white/70 line-clamp-2 mb-2">
                {analysis.situation}
              </p>
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>{formatDate(new Date(analysis.created_at))}</span>
                <span>상세 보기 →</span>
              </div>
            </button>
          ))
        )}
      </div>
    )}
  </div>
</div>
```

#### 3.5 분석 결과 로드 및 활용 함수
```typescript
// 저장된 분석 결과를 대화에 로드
const handleLoadSituationAnalysis = async (situationId: string) => {
  try {
    const userId = await checkSession()
    const analysis = await getSituationAnalysisV2(situationId, userId)
    
    // 분석 결과를 대화 메시지로 추가
    const contextMessage: ChatMessage = {
      id: `context-${Date.now()}`,
      role: 'assistant',
      content: `이전에 분석한 상황을 불러왔습니다:\n\n${analysis.analysis.summary}\n\n이 상황에 대해 추가로 질문하시겠어요?`,
      timestamp: new Date(),
    }
    
    setMessages([contextMessage, ...messages])
    setShowHistory(false)
    
    toast({
      title: '분석 결과 불러오기 완료',
      description: '이전 분석 결과를 대화에 추가했습니다.',
    })
  } catch (error) {
    console.error('분석 결과 로드 실패:', error)
    toast({
      title: '불러오기 실패',
      description: '분석 결과를 불러오는 중 오류가 발생했습니다.',
      variant: 'destructive',
    })
  }
}

// 상세 페이지로 이동
const handleViewSituationDetail = (situationId: string) => {
  router.push(`/legal/situation/${situationId}`)
}
```

### 4. 추가 기능 제안

#### 4.1 검색 기능
- 카테고리별 필터링
- 위험도별 필터링
- 검색어로 상황 설명 검색

#### 4.2 정렬 기능
- 최신순 (기본)
- 위험도 높은 순
- 카테고리별 그룹화

#### 4.3 액션 기능
- 분석 결과를 대화 컨텍스트로 추가
- 상세 페이지로 이동
- 삭제 (선택적)

## 📊 데이터 흐름

```
사용자가 /legal/situation에서 분석
  ↓
DB에 저장 (situation_analyses 테이블)
  ↓
/legal/assist/quick 페이지 접속
  ↓
히스토리 API 호출 (GET /api/v2/legal/situations/history)
  ↓
사이드바에 목록 표시
  ↓
사용자가 분석 결과 클릭
  ↓
상세 조회 API 호출 (GET /api/v2/legal/situations/{id})
  ↓
대화에 컨텍스트로 추가 또는 상세 페이지로 이동
```

## 🎨 UI/UX 고려사항

1. **로딩 상태**: 히스토리 로드 중 스피너 표시
2. **빈 상태**: 저장된 분석이 없을 때 안내 메시지 및 "분석 시작하기" 버튼
3. **반응형**: 모바일에서는 모달로 표시
4. **접근성**: 키보드 네비게이션 지원
5. **성능**: 무한 스크롤 또는 페이지네이션

## 🔄 통합 시나리오

1. 사용자가 `/legal/situation`에서 상세 분석 수행
2. 분석 결과가 DB에 저장됨
3. `/legal/assist/quick`에서 "저장된 분석" 탭 클릭
4. 최근 분석 결과 목록 확인
5. 원하는 분석 결과 클릭
6. 대화에 컨텍스트로 추가되어 이어서 질문 가능

## 📝 구현 우선순위

1. **높음**: 백엔드 API 추가 (히스토리 조회, 상세 조회)
2. **높음**: 프론트엔드 API 함수 추가
3. **중간**: 사이드바에 탭 추가 및 UI 구현
4. **중간**: 분석 결과를 대화에 로드하는 기능
5. **낮음**: 검색/필터링 기능
6. **낮음**: 상세 페이지 라우팅 (`/legal/situation/{id}`)

