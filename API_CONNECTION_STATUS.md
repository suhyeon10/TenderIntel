# API 연결 상태 확인 리포트

## 📋 현재 설정 상태

### 1. 프론트엔드 (src/apis/legal.service.ts)

```typescript
const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL || 'http://localhost:8000';
const LEGAL_API_BASE_V2 = `${BACKEND_API_URL}/api/v2/legal`;
```

**기본값**: `http://localhost:8000`
**환경 변수**: `NEXT_PUBLIC_BACKEND_API_URL` (선택적)

### 2. 백엔드 (backend/main.py)

**서버 설정**:
- Host: `0.0.0.0` (모든 인터페이스에서 접근 가능)
- Port: `8000`
- CORS: 모든 origin 허용 (`allow_origins=["*"]`)

**등록된 라우터**:
- ✅ `router_legal_v2` → `/api/v2/legal` prefix

### 3. API 엔드포인트 매핑

| 프론트엔드 호출 | 백엔드 엔드포인트 | 상태 |
|----------------|-----------------|------|
| `POST /api/v2/legal/analyze-contract` | `POST /api/v2/legal/analyze-contract` | ✅ 매핑됨 |
| `GET /api/v2/legal/contracts/{docId}` | `GET /api/v2/legal/contracts/{doc_id}` | ✅ 매핑됨 |
| `GET /api/v2/legal/contracts/history` | `GET /api/v2/legal/contracts/history` | ✅ 매핑됨 |
| `POST /api/v2/legal/analyze-situation` | `POST /api/v2/legal/analyze-situation` | ✅ 매핑됨 |
| `GET /api/v2/legal/search` | `GET /api/v2/legal/search` | ✅ 매핑됨 |
| `GET /api/v2/legal/health` | `GET /api/v2/legal/health` | ✅ 매핑됨 |

## 🔍 확인 사항

### 1. 백엔드 서버 실행 여부
```bash
# 백엔드 서버가 실행 중인지 확인
curl http://localhost:8000/api/v2/legal/health
```

**예상 응답**:
```json
{
  "status": "ok",
  "message": "Linkus Public RAG API is running"
}
```

### 2. 환경 변수 설정
프론트엔드에서 `NEXT_PUBLIC_BACKEND_API_URL`이 설정되어 있는지 확인:

**확인 방법**:
- `.env.local` 또는 `.env` 파일에 `NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000` 추가
- 또는 기본값(`http://localhost:8000`) 사용

### 3. CORS 설정
백엔드에서 CORS가 모든 origin을 허용하도록 설정되어 있음:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 origin 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 🐛 문제 해결 체크리스트

### 문제 1: `ERR_CONNECTION_REFUSED`
**원인**: 백엔드 서버가 실행되지 않음
**해결**:
```bash
cd backend
python main.py
```

### 문제 2: `404 Not Found`
**원인**: 엔드포인트 경로 불일치
**확인**: 백엔드 로그에서 실제 호출된 경로 확인

### 문제 3: `contractText`가 빈 문자열
**원인**: 
- 백엔드에서 `extracted_text`가 비어있음
- 백엔드가 v1 형식으로 응답
**확인**: 백엔드 로그에서 `[계약서 분석]` 로그 확인

### 문제 4: CORS 에러
**원인**: CORS 설정 문제 (하지만 현재 모든 origin 허용)
**해결**: 이미 설정되어 있음

## 📝 다음 단계

1. **백엔드 서버 실행 확인**
   ```bash
   cd backend
   python main.py
   ```

2. **헬스 체크 테스트**
   ```bash
   curl http://localhost:8000/api/v2/legal/health
   ```

3. **프론트엔드에서 API 호출 테스트**
   - 브라우저 콘솔에서 `[계약서 분석]` 로그 확인
   - Network 탭에서 실제 요청 URL 확인

4. **백엔드 로그 확인**
   - `backend/logs/server_YYYYMMDD.log` 파일 확인
   - `[계약서 분석]` 로그 검색

