#!/bin/bash
# 배치 처리 실행 스크립트 (Linux/Mac)

FOLDER=${1:-"./data/announcements"}
EXTENSIONS=${2:-".pdf .txt"}

echo "🚀 배치 인입 시작"
echo "   폴더: $FOLDER"
echo "   확장자: $EXTENSIONS"
echo ""

cd "$(dirname "$0")/.."
python scripts/batch_ingest.py "$FOLDER" --extensions $EXTENSIONS --parallel

