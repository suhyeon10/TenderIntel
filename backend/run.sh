#!/bin/bash

# 백엔드 서버 실행 스크립트

echo "🚀 Linkus Public RAG Backend 서버 시작..."

# 가상환경 활성화 (있는 경우)
if [ -d "venv" ]; then
    source venv/bin/activate
    echo "✅ 가상환경 활성화됨"
fi

# .env 파일 확인
if [ ! -f ".env" ]; then
    echo "⚠️  .env 파일이 없습니다. .env.example을 참고하여 생성하세요."
    exit 1
fi

# 서버 실행
python main.py

