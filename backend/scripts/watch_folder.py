"""
폴더 감시 스크립트
새 파일이 추가되면 자동으로 RAG에 반영
"""

import os
import sys
import time
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import asyncio
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.orchestrator_v2 import Orchestrator


class AnnouncementHandler(FileSystemEventHandler):
    """파일 시스템 이벤트 핸들러"""
    
    def __init__(self, watch_extensions: list = None):
        super().__init__()
        self.orchestrator = Orchestrator()
        self.watch_extensions = watch_extensions or ['.pdf', '.txt', '.hwp', '.hwpx', '.html', '.htm']
        self.processed_files = set()
    
    def on_created(self, event):
        """새 파일 생성 시"""
        if event.is_directory:
            return
        
        file_path = Path(event.src_path)
        
        # 확장자 확인
        if file_path.suffix.lower() not in self.watch_extensions:
            return
        
        # 이미 처리된 파일인지 확인
        if str(file_path) in self.processed_files:
            return
        
        # 파일이 완전히 쓰여졌는지 확인 (작은 지연)
        time.sleep(1)
        
        if not file_path.exists():
            return
        
        print(f"🆕 새 파일 발견: {file_path.name}")
        
        # 별도 스레드에서 처리
        import threading
        thread = threading.Thread(target=self.process_file, args=(file_path,))
        thread.daemon = True
        thread.start()
    
    def process_file(self, file_path: Path):
        """파일 처리"""
        try:
            # 메타데이터 추출
            meta = {
                "source": "watch_folder",
                "external_id": file_path.stem,
                "title": file_path.stem,
            }
            
            # 파일 타입 결정 (자동 감지)
            file_type = None
            
            # 처리
            announcement_id = self.orchestrator.process_file(
                file_path=str(file_path),
                file_type=file_type,
                meta=meta
            )
            
            # 처리 완료 표시
            self.processed_files.add(str(file_path))
            
            print(f"✅ 처리 완료: {file_path.name} → {announcement_id}")
        
        except Exception as e:
            print(f"❌ 처리 실패: {file_path.name} - {str(e)}")


def watch_folder(folder_path: str, extensions: list = None):
    """
    폴더 감시 시작
    
    Args:
        folder_path: 감시할 폴더 경로
        extensions: 감시할 파일 확장자
    """
    folder = Path(folder_path)
    if not folder.exists():
        raise FileNotFoundError(f"폴더를 찾을 수 없습니다: {folder_path}")
    
    print(f"👀 폴더 감시 시작: {folder_path}")
    print(f"   확장자: {extensions or ['.pdf', '.txt', '.html', '.htm']}")
    print(f"   종료하려면 Ctrl+C를 누르세요\n")
    
    # 이벤트 핸들러 생성
    event_handler = AnnouncementHandler(extensions)
    
    # 옵저버 생성
    observer = Observer()
    observer.schedule(event_handler, str(folder), recursive=True)
    observer.start()
    
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\n👋 감시 종료")
    
    observer.join()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="폴더 감시 및 자동 인입")
    parser.add_argument(
        "folder",
        type=str,
        help="감시할 폴더 경로"
    )
    parser.add_argument(
        "--extensions",
        type=str,
        nargs="+",
        default=[".pdf", ".txt", ".html", ".htm"],
        help="감시할 파일 확장자"
    )
    
    args = parser.parse_args()
    
    watch_folder(args.folder, args.extensions)

