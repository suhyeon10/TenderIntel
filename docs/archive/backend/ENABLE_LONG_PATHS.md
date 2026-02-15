# Windows Long Path 활성화 가이드

`sentence-transformers` 설치를 위해 Windows Long Path 지원이 필요합니다.

## 방법 1: PowerShell로 활성화 (관리자 권한 필요)

```powershell
# 관리자 권한으로 PowerShell 실행 후:
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

**주의**: 변경 후 컴퓨터를 재시작해야 합니다.

## 방법 2: 레지스트리 편집기로 수동 설정

1. `Win + R` → `regedit` 실행
2. 다음 경로로 이동:
   ```
   HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\FileSystem
   ```
3. `LongPathsEnabled` 값 찾기 (없으면 생성)
4. 값 데이터를 `1`로 설정
5. 컴퓨터 재시작

## 방법 3: Group Policy (Windows Pro 이상)

1. `Win + R` → `gpedit.msc` 실행
2. Computer Configuration → Administrative Templates → System → Filesystem
3. "Enable Win32 long paths" 활성화
4. 재시작

## 확인

재시작 후 다음 명령으로 확인:
```powershell
reg query "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled
```

값이 `0x1`이면 활성화됨.

## 재시작 후 설치

```bash
cd backend
pip install sentence-transformers
```

