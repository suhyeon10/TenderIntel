"""
간단한 문서 인덱싱 스크립트 (해커톤용)
ChromaDB 또는 Supabase에 문서를 인덱싱합니다.
"""

import os
import sys
from pathlib import Path

# 상위 디렉토리를 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))


from langchain_text_splitters import RecursiveCharacterTextSplitter
from config import settings

def ingest_documents(docs_dir: str = None, use_chromadb: bool = None):
    """
    문서 폴더 → 벡터DB 인덱싱
    
    Args:
        docs_dir: 문서 폴더 경로 (기본: ./data/announcements)
        use_chromadb: ChromaDB 사용 여부 (None이면 설정에서 자동 감지)
    """
    # 기본 경로 설정
    if docs_dir is None:
        docs_dir = os.getenv("DOCS_DIR", "./data/announcements")
    
    if use_chromadb is None:
        use_chromadb = settings.use_chromadb
    
    print(f"[로딩] 문서 폴더: {docs_dir}")
    
    # 문서 로드 (pypdf 사용)
    try:
        from pypdf import PdfReader
        from langchain_core.documents import Document
        import glob
        
        pdf_files = glob.glob(os.path.join(docs_dir, "*.pdf"))
        if not pdf_files:
            print(f"[경고] {docs_dir}에서 PDF 파일을 찾을 수 없습니다.")
            return
        
        print(f"[발견] PDF 파일: {len(pdf_files)}개")
        docs = []
        for pdf_file in pdf_files:
            try:
                reader = PdfReader(pdf_file)
                for page_num, page in enumerate(reader.pages):
                    text = page.extract_text()
                    if text:
                        docs.append(Document(
                            page_content=text,
                            metadata={
                                "source": pdf_file,
                                "page": page_num + 1
                            }
                        ))
                print(f"  - 로드 완료: {os.path.basename(pdf_file)} ({len(reader.pages)}페이지)")
            except Exception as e:
                print(f"  - 로드 실패: {os.path.basename(pdf_file)} - {str(e)}")
    except ImportError:
        print("[오류] pypdf를 사용할 수 없습니다.")
        print("[해결] pip install pypdf")
        return
    
    if not docs:
        print(f"[경고] 로드된 문서가 없습니다.")
        return
    
    print(f"[완료] 총 문서 페이지: {len(docs)}개")
    
    # 청킹
    print(f"[처리] 청킹 중...")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap
    )
    splits = splitter.split_documents(docs)
    print(f"[완료] 청크: {len(splits)}개")
    
    # 벡터 DB 선택
    if use_chromadb:
        # ChromaDB 사용
        try:
            from langchain_community.vectorstores import Chroma
            from langchain_community.embeddings import HuggingFaceEmbeddings
            
            persist_dir = os.getenv("CHROMA_DIR", settings.chroma_persist_dir)
            model_name = settings.local_embedding_model
            
            print(f"[임베딩] 모델: {model_name}")
            embeddings = HuggingFaceEmbeddings(model_name=model_name)
            
            print(f"[저장] ChromaDB: {persist_dir}")
            db = Chroma.from_documents(
                splits, 
                embeddings, 
                persist_directory=persist_dir
            )
            db.persist()
            print("[완료] ChromaDB에 저장 완료!")
            
        except ImportError:
            print("[오류] ChromaDB가 설치되지 않았습니다.")
            print("[해결] pip install chromadb")
            return
    else:
        # Supabase 사용
        try:
            from core.orchestrator_v2 import Orchestrator
            from pathlib import Path
            
            print(f"[임베딩] 모델: {settings.local_embedding_model}")
            print(f"[저장] Supabase pgvector")
            
            orchestrator = Orchestrator()
            
            # 각 PDF 파일을 개별적으로 처리
            for i, pdf_file in enumerate(pdf_files, 1):
                # 메타데이터 추출
                filename = os.path.basename(pdf_file)
                meta = {
                    "source": "batch_ingest",
                    "external_id": filename,
                    "title": os.path.splitext(filename)[0],
                }
                
                # 파일 처리
                try:
                    announcement_id = orchestrator.process_file(
                        file_path=pdf_file,
                        file_type="pdf",
                        meta=meta
                    )
                    print(f"[{i}/{len(pdf_files)}] 완료: {filename} -> {announcement_id}")
                except Exception as e:
                    print(f"[{i}/{len(pdf_files)}] 실패: {filename} - {str(e)}")
            
            print("[완료] Supabase에 저장 완료!")
            
        except Exception as e:
            print(f"[오류] Supabase 저장 실패: {str(e)}")
            return


def main():
    """메인 함수"""
    import argparse
    
    parser = argparse.ArgumentParser(description="문서 인덱싱 스크립트 (해커톤용)")
    parser.add_argument(
        "--docs-dir",
        type=str,
        default=None,
        help="문서 폴더 경로 (기본: ./data/announcements)"
    )
    parser.add_argument(
        "--chromadb",
        action="store_true",
        help="ChromaDB 사용 (기본: Supabase)"
    )
    parser.add_argument(
        "--supabase",
        action="store_true",
        help="Supabase 사용 (기본)"
    )
    
    args = parser.parse_args()
    
    use_chromadb = args.chromadb if args.chromadb else (not args.supabase and settings.use_chromadb)
    
    ingest_documents(
        docs_dir=args.docs_dir,
        use_chromadb=use_chromadb
    )


if __name__ == "__main__":
    main()

