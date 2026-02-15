# 배포 가이드

Linkus Legal 프로젝트를 무료로 배포하는 방법을 안내합니다.

## 📑 목차

1. [배포 전략](#-배포-전략)
2. [Frontend 배포 (Vercel)](#1-frontend-배포-vercel---완전-무료)
3. [Backend 배포 (Railway)](#2-backend-배포-railway---무료-크레딧)
4. [Backend 배포 (Render)](#3-backend-배포-render---완전-무료-대안)
5. [Frontend와 Backend 연결](#-frontend와-backend-연결)
6. [배포 확인](#-배포-확인)
7. [배포 팁](#-배포-팁)
8. [무료 플랜 비교](#-무료-플랜-비교)
9. [문제 해결](#-문제-해결)

---

## 📋 배포 전략

- **Frontend (Next.js)**: Vercel (무료, 자동 배포)
- **Backend (FastAPI)**: Railway 또는 Render (무료 플랜)

### ⚠️ 중요: Monorepo 구조

현재 프로젝트는 **Monorepo 구조**입니다 (Frontend와 Backend가 같은 저장소에 있음).  
**분리할 필요 없습니다!** 각 배포 플랫폼에서 **Root Directory** 설정만으로 원하는 폴더만 배포할 수 있습니다.

```
linkers-public/          ← GitHub 저장소 루트
├── src/                 ← Frontend (Vercel에서 배포)
├── backend/             ← Backend (Railway/Render에서 배포)
├── package.json
└── README.md
```

---

## 1️⃣ Frontend 배포 (Vercel) - 완전 무료

### 단계별 가이드

1. [Vercel](https://vercel.com) 접속 및 GitHub 계정으로 로그인
2. **"Add New Project"** 클릭
3. GitHub 저장소 선택
4. 프로젝트 설정:
   - **Root Directory**: `./` (기본값) ⚠️ **Monorepo이므로 루트 그대로 사용**
   - **Framework Preset**: Next.js (자동 감지)
5. 환경 변수 설정:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   NEXT_PUBLIC_BACKEND_API_URL=https://your-backend.railway.app
   NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
   ```
6. 배포 완료

### Vercel 무료 플랜 제한
- ✅ 무제한 프로젝트
- ✅ 100GB 대역폭/월
- ✅ 자동 HTTPS
- ✅ 글로벌 CDN
- ✅ 자동 배포

---

## 2️⃣ Backend 배포 (Railway) - 무료 크레딧

### 단계별 가이드

1. [Railway](https://railway.app) 접속 및 GitHub 계정으로 로그인
2. **"New Project"** → **"Deploy from GitHub repo"** 선택
3. 서비스 설정:
   - **Root Directory**: `backend` ⚠️ **중요: Monorepo이므로 backend 폴더만 지정**
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python main.py`
4. 환경 변수 설정:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   PORT=8000
   HOST=0.0.0.0
   ```
5. 배포 완료 후 공개 URL 확인

### Railway 무료 플랜
- ✅ $5 크레딧/월 (소규모 프로젝트 충분)
- ✅ 자동 HTTPS
- ✅ GitHub 연동
- ✅ 로그 확인 가능

---

## 3️⃣ Backend 배포 (Render) - 완전 무료 대안

### 단계별 가이드

1. [Render](https://render.com) 접속 및 GitHub 계정으로 로그인
2. **"New +"** → **"Web Service"** 클릭
3. 서비스 설정:
   - **Root Directory**: `backend` ⚠️ **중요: Monorepo이므로 backend 폴더만 지정**
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python main.py`
   - **Plan**: `Free` 선택
4. 환경 변수 설정 (Railway와 동일)
5. 배포 완료

### Render 무료 플랜
- ✅ 완전 무료
- ✅ 자동 HTTPS
- ⚠️ 15분 비활성 시 슬립 (첫 요청 지연)

---

## 🔗 Frontend와 Backend 연결

1. Backend URL 확인 (Railway 또는 Render)
2. Vercel 대시보드에서 `NEXT_PUBLIC_BACKEND_API_URL` 업데이트
3. Vercel이 자동으로 재배포

---

## 🧪 배포 확인

### Frontend 확인
```bash
https://your-app.vercel.app
```

### Backend 확인
```bash
curl https://your-backend.railway.app/api/health
```

---

## 💡 배포 팁

### 1. CORS 설정
Backend의 `main.py`에서 Frontend 도메인을 허용:
```python
allow_origins=[
    "https://your-app.vercel.app",
    "http://localhost:3000",
]
```

### 2. 환경 변수 관리
- 절대 `.env` 파일을 Git에 커밋하지 마세요
- 모든 민감한 정보는 배포 플랫폼의 환경 변수로 설정

### 3. 로그 확인
- **Vercel**: 대시보드 → Deployments → 함수 로그
- **Railway**: 대시보드 → Deployments → 로그 탭
- **Render**: 대시보드 → Logs 탭

---

## 🆓 무료 플랜 비교

| 플랫폼 | Frontend | Backend | 제한사항 |
|--------|----------|---------|----------|
| **Vercel** | ✅ 완전 무료 | ❌ | Next.js 최적화 |
| **Railway** | ❌ | ✅ $5/월 크레딧 | 소규모 프로젝트 충분 |
| **Render** | ❌ | ✅ 완전 무료 | 15분 비활성 시 슬립 |

### 추천 조합
- **가장 쉬움**: Vercel (Frontend) + Railway (Backend)
- **완전 무료**: Vercel (Frontend) + Render (Backend)

---

## 🚨 문제 해결

### Monorepo 관련 문제
- **"package.json을 찾을 수 없습니다"**: Vercel의 Root Directory를 `./`로 설정
- **"requirements.txt를 찾을 수 없습니다"**: Railway/Render의 Root Directory를 `backend`로 설정

### Backend가 응답하지 않는 경우
1. 환경 변수 확인
2. 로그 확인
3. 포트 확인

### Frontend에서 Backend 연결 실패
1. CORS 오류: Backend의 `allow_origins`에 Frontend URL 추가
2. 환경 변수: `NEXT_PUBLIC_BACKEND_API_URL` 확인
3. HTTPS: 모든 URL이 `https://`로 시작하는지 확인

---

## 추가 정보

- 환경 설정: [SETUP.md](./SETUP.md)
- 문제 해결: [backend/TROUBLESHOOTING.md](./backend/TROUBLESHOOTING.md)

