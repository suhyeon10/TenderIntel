# sentence-transformers 설치 가이드 (해커톤 모드)

해커톤 모드를 완전 무료로 사용하려면 `sentence-transformers`가 필요합니다.

## 문제

Windows Long Path 지원이 비활성화되어 있어 설치가 실패합니다.

## 해결 방법

### 1단계: Windows Long Path 활성화

**관리자 권한으로 PowerShell 실행** 후:

```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

### 2단계: 컴퓨터 재시작

변경사항을 적용하려면 **반드시 재시작**해야 합니다.

### 3단계: sentence-transformers 설치

재시작 후:

```bash
cd backend
pip install sentence-transformers
```

## 확인

설치 확인:
```bash
python -c "from sentence_transformers import SentenceTransformer; print('설치 완료!')"
```

## 대안: 더 가벼운 모델 사용

Long Path 활성화가 어려운 경우, 더 작은 모델을 시도할 수 있습니다:

```bash
# Long Path 활성화 후
pip install sentence-transformers --no-cache-dir
```

그리고 `.env`에서:
```env
LOCAL_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

## 현재 상태

- ✅ RLS 정책 수정 완료
- ✅ Supabase 클라이언트 정상 작동
- ⚠️ sentence-transformers 설치 필요 (Long Path 활성화 후)

