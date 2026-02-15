# 🔐 Windows Long Path 활성화 (관리자 권한 필요)

레지스트리 수정을 위해 **관리자 권한**이 필요합니다.

## 방법 1: 관리자 PowerShell 실행 (권장)

### Windows 11/10

1. **시작 메뉴**에서 "PowerShell" 검색
2. **Windows PowerShell** 우클릭
3. **"관리자 권한으로 실행"** 선택
4. 다음 명령 실행:

```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

### 확인

```powershell
Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled"
```

값이 `1`이면 성공!

## 방법 2: 레지스트리 편집기 사용

1. `Win + R` → `regedit` 입력
2. 다음 경로로 이동:
   ```
   HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\FileSystem
   ```
3. `LongPathsEnabled` 찾기 (없으면 생성)
4. 값 데이터를 `1`로 설정
5. **재시작 필수**

## 방법 3: Group Policy (Windows Pro 이상)

1. `Win + R` → `gpedit.msc` 실행
2. Computer Configuration → Administrative Templates → System → Filesystem
3. **"Enable Win32 long paths"** 더블 클릭
4. **"Enabled"** 선택
5. **재시작 필수**

## ⚠️ 중요

- **반드시 재시작**해야 변경사항이 적용됩니다
- 재시작 후 `sentence-transformers` 설치 가능

## 재시작 후 확인

```powershell
# 재시작 후
pip install sentence-transformers
```

## 대안: 임시 해결책

Long Path 활성화가 어려운 경우, 더 짧은 경로에 프로젝트를 이동하거나:

```bash
# 가상환경을 짧은 경로에 생성
python -m venv C:\venv\linkers
C:\venv\linkers\Scripts\activate
pip install sentence-transformers
```

하지만 **Long Path 활성화를 권장**합니다 (일반적인 해결책).

