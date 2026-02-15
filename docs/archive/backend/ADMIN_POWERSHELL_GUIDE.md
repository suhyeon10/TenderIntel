# 🔐 관리자 PowerShell 실행 가이드

Windows Long Path 활성화를 위해 관리자 권한이 필요합니다.

## 🚀 빠른 방법

### Windows 11
1. `Win + X` 키 누르기
2. **"Windows PowerShell (관리자)"** 또는 **"터미널 (관리자)"** 선택
3. UAC 프롬프트에서 **"예"** 클릭

### Windows 10
1. 시작 메뉴에서 **"PowerShell"** 검색
2. **"Windows PowerShell"** 우클릭
3. **"관리자 권한으로 실행"** 선택
4. UAC 프롬프트에서 **"예"** 클릭

## ✅ 관리자 권한 확인

PowerShell 창 제목에 **"관리자"** 또는 **"Administrator"**가 표시되어야 합니다.

또는 다음 명령으로 확인:
```powershell
([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
```

`True`가 나오면 관리자 권한입니다.

## 📝 Long Path 활성화 명령

관리자 PowerShell에서:
```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

## 🔄 재시작

명령 실행 후 **반드시 컴퓨터를 재시작**하세요.

## ✅ 재시작 후 확인

```powershell
Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled"
```

`LongPathsEnabled : 1`이 나오면 성공!

## 🚀 다음 단계

재시작 후:
```bash
pip install sentence-transformers
```

