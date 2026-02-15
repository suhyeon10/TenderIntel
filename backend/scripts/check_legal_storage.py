"""
법률 문서 저장 위치 확인 스크립트
"""

import os
import sys
from pathlib import Path

# 상위 디렉토리를 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.supabase_vector_store import SupabaseVectorStore
from config import settings

def check_legal_storage():
    """법률 문서 저장 현황 확인"""
    print("=" * 60)
    print("법률 문서 저장 위치 확인")
    print("=" * 60)
    
    store = SupabaseVectorStore()
    store._ensure_initialized()  # Supabase 클라이언트 초기화
    
    try:
        # 1. legal_documents 테이블 확인
        print("\n[1] legal_documents 테이블 (문서 메타데이터)")
        print("-" * 60)
        result = store.sb.table("legal_documents")\
            .select("id, title, source, doc_type, file_path, created_at")\
            .order("created_at", desc=True)\
            .limit(10)\
            .execute()
        
        if result.data:
            print(f"총 {len(result.data)}개 문서 (최근 10개만 표시)")
            for i, doc in enumerate(result.data, 1):
                print(f"\n  [{i}] {doc.get('title', '제목 없음')}")
                print(f"      ID: {doc.get('id')}")
                print(f"      출처: {doc.get('source', 'unknown')}")
                print(f"      타입: {doc.get('doc_type', 'law')}")
                print(f"      경로: {doc.get('file_path', 'N/A')}")
                print(f"      생성일: {doc.get('created_at', 'N/A')}")
        else:
            print("  저장된 문서가 없습니다.")
        
        # 2. legal_chunks 테이블 확인
        print("\n[2] legal_chunks 테이블 (청크 및 임베딩)")
        print("-" * 60)
        result = store.sb.table("legal_chunks")\
            .select("id, legal_document_id, section_title, chunk_index, text")\
            .limit(5)\
            .execute()
        
        if result.data:
            print(f"총 청크 수 확인 중...")
            count_result = store.sb.table("legal_chunks")\
                .select("id", count="exact")\
                .execute()
            total_chunks = count_result.count if hasattr(count_result, 'count') else len(result.data)
            print(f"  총 청크 수: {total_chunks}개 (샘플 5개 표시)")
            for i, chunk in enumerate(result.data[:5], 1):
                print(f"\n  [{i}] 청크 #{chunk.get('chunk_index', 0)}")
                print(f"      문서 ID: {chunk.get('legal_document_id')}")
                print(f"      섹션: {chunk.get('section_title', 'N/A')}")
                print(f"      텍스트: {chunk.get('text', '')[:100]}...")
        else:
            print("  저장된 청크가 없습니다.")
        
        # 3. legal_document_bodies 테이블 확인 (선택사항)
        print("\n[3] legal_document_bodies 테이블 (원본 본문)")
        print("-" * 60)
        try:
            result = store.sb.table("legal_document_bodies")\
                .select("id, legal_document_id")\
                .limit(5)\
                .execute()
            
            if result.data:
                print(f"  저장된 본문: {len(result.data)}개")
            else:
                print("  저장된 본문이 없습니다. (테이블이 없을 수도 있습니다)")
        except Exception as e:
            print(f"  테이블이 없거나 접근할 수 없습니다: {str(e)}")
        
        # 4. 저장 위치 요약
        print("\n" + "=" * 60)
        print("저장 위치 요약")
        print("=" * 60)
        print("""
법률 문서는 Supabase 데이터베이스에 저장됩니다:

1. legal_documents 테이블
   - 문서 메타데이터 (제목, 출처, 타입, 파일 경로 등)
   - 위치: Supabase 프로젝트 > Table Editor > legal_documents

2. legal_chunks 테이블
   - 문서를 조(제n조) 단위로 분할한 청크
   - 각 청크의 임베딩 벡터 (384차원)
   - 위치: Supabase 프로젝트 > Table Editor > legal_chunks

3. legal_document_bodies 테이블 (선택사항)
   - 원본 문서 본문 전체
   - 위치: Supabase 프로젝트 > Table Editor > legal_document_bodies

Supabase 대시보드에서 확인:
- URL: https://supabase.com/dashboard/project/[프로젝트ID]
- Table Editor에서 위 테이블들을 확인할 수 있습니다.
        """)
        
    except Exception as e:
        print(f"\n[오류] 저장 위치 확인 실패: {str(e)}")
        print("\n확인 사항:")
        print("1. Supabase 연결 설정이 올바른지 확인 (.env 파일)")
        print("2. legal_documents, legal_chunks 테이블이 생성되었는지 확인")
        print("3. README.md의 SQL 스크립트를 실행했는지 확인")


if __name__ == "__main__":
    check_legal_storage()

