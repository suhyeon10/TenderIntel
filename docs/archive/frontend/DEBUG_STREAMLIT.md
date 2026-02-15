# 🔍 Streamlit 실행 문제 해결

## 문제: http://localhost:8501에 아무것도 안 보임

### 해결 방법

#### 1. 직접 실행해서 오류 확인

새 터미널에서:

```bash
cd frontend
python -m streamlit run streamlit_app.py
```

오류 메시지를 확인하세요.

#### 2. 포트 확인

다른 프로그램이 8501 포트를 사용 중일 수 있습니다:

```bash
netstat -ano | findstr :8501
```

다른 포트로 실행:

```bash
python -m streamlit run streamlit_app.py --server.port 8502
```

#### 3. Streamlit 재설치

```bash
pip install --upgrade streamlit
```

#### 4. 브라우저 캐시 삭제

- 브라우저에서 `Ctrl + Shift + Delete`
- 캐시 삭제 후 다시 접속

#### 5. 수동 실행 (권장)

터미널에서 직접 실행하면 오류 메시지를 볼 수 있습니다:

```bash
cd C:\Users\suhyeonjang\linkers-public\frontend
python -m streamlit run streamlit_app.py
```

실행 후 터미널에 표시되는 URL을 확인하세요:
- 보통: `http://localhost:8501`
- 또는: `http://192.168.x.x:8501`

#### 6. 백엔드 서버 확인

Streamlit이 실행되어도 백엔드 서버가 없으면 작동하지 않습니다:

```bash
cd backend
python main.py
```

백엔드가 `http://localhost:8000`에서 실행 중이어야 합니다.

## 빠른 체크리스트

- [ ] Streamlit 실행 중인가? (`python -m streamlit run streamlit_app.py`)
- [ ] 터미널에 오류 메시지가 있는가?
- [ ] 백엔드 서버가 실행 중인가? (`http://localhost:8000`)
- [ ] 브라우저에서 정확한 URL로 접속했는가?

