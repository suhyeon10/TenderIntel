# 🚀 Vercel 배포 가이드

Vercel에 Frontend를 배포하는 단계별 가이드입니다.

## 📋 배포 전 체크리스트

### 1. GitHub에 코드 푸시 확인
```bash
# 현재 상태 확인
git status

# 변경사항이 있다면 커밋
git add .
git commit -m "Vercel 배포 준비"

# GitHub에 푸시
git push origin main
```

### 2. 빌드 테스트 (로컬)
```bash
# 의존성 설치
npm install

# 빌드 테스트
npm run build

# 빌드 성공 확인
```

---

## 🎯 Vercel 배포 단계

### 1단계: Vercel 계정 생성

1. [https://vercel.com](https://vercel.com) 접속
2. **"Sign Up"** 클릭
3. **GitHub 계정으로 로그인** 선택
4. GitHub 권한 승인

### 2단계: 프로젝트 배포

1. Vercel 대시보드에서 **"Add New Project"** 클릭
2. **"Import Git Repository"** 선택
3. GitHub 저장소 선택 (`linkers-public`)
4. **"Import"** 클릭

### 3단계: 프로젝트 설정

#### Framework Settings
- **Framework Preset**: `Next.js` (자동 감지됨)
- **Root Directory**: `./` (기본값, 루트 그대로)
- **Build Command**: `npm run build` (자동)
- **Output Directory**: `.next` (자동)
- **Install Command**: `npm install` (자동)

#### Environment Variables
**⚠️ 중요**: 배포 전에 반드시 환경 변수를 설정해야 합니다!

**Settings → Environment Variables**에서 다음 변수들을 추가:

```env
# Supabase (필수)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Backend API URL (선택, 나중에 Backend 배포 후 업데이트)
NEXT_PUBLIC_BACKEND_API_URL=http://localhost:8000

# Site URL (OAuth 리다이렉트용, 배포 후 자동 업데이트)
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app

# OpenAI API Key (서버 사이드에서 사용, 선택)
OPENAI_API_KEY=your_openai_api_key
```

**환경 변수 추가 방법:**
1. **Settings** 탭 클릭
2. **Environment Variables** 섹션으로 스크롤
3. **"Add New"** 클릭
4. Key와 Value 입력
5. **Environment** 선택:
   - `Production` (프로덕션)
   - `Preview` (프리뷰, PR용)
   - `Development` (개발용)
6. **"Save"** 클릭

> 💡 **팁**: 모든 환경에 적용하려면 세 가지 모두 선택하세요.

### 4단계: 배포 실행

1. 모든 설정 완료 후 **"Deploy"** 버튼 클릭
2. 배포 진행 상황 확인 (약 2-3분 소요)
3. 배포 완료 후 **"Visit"** 버튼으로 사이트 확인

---

## ✅ 배포 확인

### 1. 배포 상태 확인
- ✅ **Ready**: 배포 성공
- ⚠️ **Error**: 오류 발생 (로그 확인 필요)
- 🔄 **Building**: 배포 중

### 2. 사이트 접속
배포 완료 후 제공되는 URL로 접속:
- 프로덕션: `https://your-app.vercel.app`
- 커스텀 도메인: 설정한 도메인

### 3. 기능 테스트
- [ ] 홈페이지 로드 확인
- [ ] Supabase 연결 확인
- [ ] 로그인/회원가입 테스트
- [ ] 주요 기능 동작 확인

---

## 🔧 환경 변수 상세 설명

### 필수 환경 변수

#### `NEXT_PUBLIC_SUPABASE_URL`
- **설명**: Supabase 프로젝트 URL
- **형식**: `https://xxxxx.supabase.co`
- **위치**: Supabase Dashboard → Settings → API → Project URL

#### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **설명**: Supabase 공개 키 (클라이언트에서 사용)
- **형식**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **위치**: Supabase Dashboard → Settings → API → Project API keys → anon public

### 선택적 환경 변수

#### `NEXT_PUBLIC_BACKEND_API_URL`
- **설명**: Backend API 서버 URL
- **로컬**: `http://localhost:8000`
- **배포 후**: `https://your-backend.railway.app` (Backend 배포 후 업데이트)

#### `NEXT_PUBLIC_SITE_URL`
- **설명**: 사이트 URL (OAuth 리다이렉트용)
- **자동 설정**: Vercel이 자동으로 설정하지만, 명시적으로 설정 가능
- **형식**: `https://your-app.vercel.app`

#### `OPENAI_API_KEY`
- **설명**: OpenAI API 키 (RAG 기능 사용 시 필요)
- **위치**: [OpenAI Platform](https://platform.openai.com/api-keys)
- **주의**: 서버 사이드에서만 사용되므로 `NEXT_PUBLIC_` 접두사 없음

---

## 🚨 문제 해결

### 빌드 실패

#### "Module not found"
```bash
# 로컬에서 빌드 테스트
npm run build

# 의존성 재설치
rm -rf node_modules package-lock.json
npm install
```

#### "Environment variable not found"
- Vercel 대시보드에서 환경 변수 확인
- 변수명이 정확한지 확인 (`NEXT_PUBLIC_` 접두사 확인)
- 환경 변수 추가 후 **재배포** 필요

### 런타임 오류

#### "Supabase connection failed"
- `NEXT_PUBLIC_SUPABASE_URL` 확인
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 확인
- Supabase 프로젝트가 활성화되어 있는지 확인

#### "Backend API connection failed"
- `NEXT_PUBLIC_BACKEND_API_URL` 확인
- Backend가 배포되어 있는지 확인
- CORS 설정 확인 (Backend에서)

### 배포 로그 확인
1. Vercel 대시보드 → **Deployments**
2. 배포 항목 클릭
3. **"Build Logs"** 또는 **"Function Logs"** 확인

---

## 🔄 자동 배포 설정

### GitHub 연동 (기본 활성화)
- ✅ `main` 브랜치에 push → 자동 배포
- ✅ Pull Request 생성 → 프리뷰 배포
- ✅ 배포 완료 후 알림 (선택)

### 커스텀 도메인 설정
1. **Settings → Domains**
2. 도메인 입력
3. DNS 설정 안내 따르기
4. SSL 인증서 자동 발급 (약 1분)

---

## 📊 배포 후 확인사항

### 1. 성능 확인
- Vercel Analytics 확인 (대시보드)
- Speed Insights 확인
- Core Web Vitals 점수

### 2. 환경 변수 확인
배포된 사이트에서 환경 변수가 제대로 로드되는지 확인:
```javascript
// 브라우저 콘솔에서 확인
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
```

### 3. 기능 테스트
- [ ] 인증 (로그인/회원가입)
- [ ] 데이터베이스 연결
- [ ] 파일 업로드
- [ ] API 호출

---

## 🎉 다음 단계

Frontend 배포 완료 후:
1. ✅ Backend 배포 (Railway 또는 Render)
2. ✅ `NEXT_PUBLIC_BACKEND_API_URL` 업데이트
3. ✅ 전체 기능 테스트

---

## 💡 유용한 명령어

### Vercel CLI 사용 (선택사항)
```bash
# Vercel CLI 설치
npm i -g vercel

# 로그인
vercel login

# 배포
vercel

# 프로덕션 배포
vercel --prod

# 환경 변수 설정
vercel env add NEXT_PUBLIC_SUPABASE_URL
```

---

## 📞 도움말

문제가 발생하면:
1. Vercel 대시보드의 **Build Logs** 확인
2. GitHub Issues에 문제 리포트
3. [Vercel 문서](https://vercel.com/docs) 참고

