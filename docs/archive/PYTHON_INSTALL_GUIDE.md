# Python 설치 가이드 (Windows)

## 🐍 Python 설치 방법

### 방법 1: Microsoft Store (가장 쉬움) ⭐ 권장

1. **Microsoft Store 열기**
   - Windows 키 누르기
   - "Microsoft Store" 검색 후 실행

2. **Python 검색 및 설치**
   - Store에서 "Python 3.12" 또는 "Python 3.11" 검색
   - "Python 3.12" 선택
   - "다운로드" 또는 "설치" 클릭

3. **설치 확인**
   ```bash
   python --version
   # Python 3.12.x 출력되면 성공
   ```

**장점**: 자동으로 PATH에 추가됨, 업데이트 관리 쉬움

---

### 방법 2: python.org에서 직접 다운로드

1. **다운로드**
   - https://www.python.org/downloads/ 접속
   - "Download Python 3.12.x" 버튼 클릭 (최신 버전)

2. **설치**
   - 다운로드한 `.exe` 파일 실행
   - ⚠️ **중요**: "Add Python to PATH" 체크박스 반드시 선택!
   - "Install Now" 클릭

3. **설치 확인**
   ```bash
   python --version
   ```

**주의**: PATH 추가를 깜빡하면 수동으로 추가해야 함

---

### 방법 3: winget 사용 (명령줄)

```bash
# Python 3.12 설치
winget install Python.Python.3.12

# 또는 Python 3.11
winget install Python.Python.3.11
```

**설치 확인**
```bash
python --version
```

---

## ✅ 설치 확인

터미널(또는 PowerShell)에서 다음 명령어 실행:

```bash
python --version
```

**예상 출력**:
```
Python 3.12.0
```

또는

```bash
python3 --version
```

---

## 🔧 PATH 문제 해결

만약 `python` 명령어가 인식되지 않으면:

### 1. Python 설치 경로 확인
일반적으로:
- `C:\Users\사용자명\AppData\Local\Programs\Python\Python312\`
- 또는 `C:\Python312\`

### 2. PATH 수동 추가

1. **시스템 환경 변수 설정**
   - Windows 키 + R
   - `sysdm.cpl` 입력 후 Enter
   - "고급" 탭 → "환경 변수" 클릭

2. **PATH 편집**
   - "시스템 변수"에서 `Path` 선택
   - "편집" 클릭
   - "새로 만들기" 클릭
   - Python 설치 경로 추가:
     ```
     C:\Users\사용자명\AppData\Local\Programs\Python\Python312
     C:\Users\사용자명\AppData\Local\Programs\Python\Python312\Scripts
     ```

3. **터미널 재시작**
   - 모든 터미널 창 닫기
   - 새 터미널 열기
   - `python --version` 다시 시도

---

## 📦 설치 후 다음 단계

Python 설치가 완료되면:

### 1. pip 업그레이드
```bash
python -m pip install --upgrade pip
```

### 2. Backend 가상환경 생성
```bash
cd backend
python -m venv venv
```

### 3. 가상환경 활성화
```bash
# Windows PowerShell
venv\Scripts\Activate.ps1

# Windows CMD
venv\Scripts\activate.bat
```

### 4. 의존성 설치
```bash
pip install -r requirements.txt
```

---

## 🚨 자주 발생하는 문제

### 문제 1: "python이 내부 또는 외부 명령으로 인식되지 않습니다"
**해결**: PATH에 Python이 추가되지 않음
- Microsoft Store 버전 재설치 또는
- python.org 버전 설치 시 "Add Python to PATH" 체크

### 문제 2: PowerShell 실행 정책 오류
```bash
venv\Scripts\Activate.ps1을 로드할 수 없습니다.
```
**해결**:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 문제 3: 여러 Python 버전 설치됨
**해결**: `py` 런처 사용
```bash
py --version  # 설치된 모든 버전 확인
py -3.12 --version  # 특정 버전 사용
```

---

## 💡 추천 설치 방법

**Microsoft Store 방법을 추천합니다:**
- ✅ 자동 PATH 설정
- ✅ 업데이트 관리 쉬움
- ✅ 관리자 권한 불필요
- ✅ 가장 간단함

---

## 📝 설치 완료 체크리스트

- [ ] Python 설치 완료
- [ ] `python --version` 명령어 작동 확인
- [ ] `pip --version` 명령어 작동 확인
- [ ] Backend 가상환경 생성 가능
- [ ] 의존성 설치 가능

설치가 완료되면 `backend/README.md`의 "빠른 시작" 섹션을 따라 진행하세요!
