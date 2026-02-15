# 해커톤 모드 임시 해결책

Windows Long Path 문제로 `sentence-transformers` 설치가 실패했습니다.

## 옵션 1: Long Path 활성화 (권장)

관리자 권한으로 PowerShell 실행 후:
```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

**재시작 후** 다시 설치:
```bash
pip install sentence-transformers
```

## 옵션 2: 임시로 OpenAI 임베딩 사용 (해커톤 모드 유지)

`.env` 파일에 추가:
```env
USE_HACKATHON_MODE=true
USE_LOCAL_EMBEDDING=false  # 임시로 OpenAI 임베딩 사용
USE_OPENAI=true
OPENAI_API_KEY=your-key-here
```

이렇게 하면:
- ✅ Ollama LLM 사용 (무료)
- ✅ Supabase 벡터 저장 (무료)
- ⚠️ OpenAI 임베딩 사용 (유료, 하지만 매우 저렴)

## 옵션 3: 더 가벼운 임베딩 모델 시도

Long Path 활성화 후 더 작은 모델 사용:
```python
# config.py에서
local_embedding_model = "sentence-transformers/all-MiniLM-L6-v2"  # 더 작은 모델
```

## 현재 상태

- ✅ RLS 정책 수정 완료
- ✅ Supabase 클라이언트 정상 작동
- ⚠️ sentence-transformers 설치 실패 (Long Path 문제)

## 다음 단계

1. Long Path 활성화 → 재시작 → sentence-transformers 설치
2. 또는 옵션 2로 임시 진행

