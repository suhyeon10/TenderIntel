# ⚠️ Windows Long Path 오류 해결

`sentence-transformers` 설치 시 Long Path 오류가 발생했습니다.

## 🔍 현재 상태 확인

```powershell
reg query "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled
```

- `0x0` 또는 값이 없음 = 비활성화됨
- `0x1` = 활성화됨 (하지만 재시작 필요할 수 있음)

## ✅ 해결 방법

### 방법 1: Long Path 활성화 + 재시작 (권장)

1. **관리자 PowerShell 실행**
   - `Win + X` → "Windows PowerShell (관리자)"

2. **Long Path 활성화**
   ```powershell
   New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
   ```

3. **확인**
   ```powershell
   Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled"
   ```
   값이 `1`이어야 합니다.

4. **⚠️ 컴퓨터 재시작 (필수!)**

5. **재시작 후 설치**
   ```bash
   pip install sentence-transformers
   ```

### 방법 2: 임시 해결책 (재시작 없이)

더 짧은 경로에 가상환경 생성:

```bash
# 짧은 경로에 가상환경 생성
python -m venv C:\venv\linkers
C:\venv\linkers\Scripts\activate
pip install sentence-transformers
```

### 방법 3: 더 작은 모델 사용 (시도)

```bash
# CPU 전용 버전 시도
pip install sentence-transformers --no-cache-dir
```

또는 더 작은 모델 사용:
```python
# config.py에서
LOCAL_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2  # 더 작은 모델
```

## 🎯 권장 순서

1. ✅ Long Path 활성화 (관리자 PowerShell)
2. ✅ **컴퓨터 재시작** (가장 중요!)
3. ✅ `pip install sentence-transformers` 재시도

## 💡 재시작이 필요한 이유

Windows는 시스템 레지스트리 변경사항을 재시작 후에만 적용합니다. Long Path 설정도 마찬가지입니다.

## 📝 체크리스트

- [ ] 관리자 PowerShell에서 Long Path 활성화 명령 실행
- [ ] `LongPathsEnabled` 값이 `1`인지 확인
- [ ] **컴퓨터 재시작**
- [ ] 재시작 후 `pip install sentence-transformers` 실행

