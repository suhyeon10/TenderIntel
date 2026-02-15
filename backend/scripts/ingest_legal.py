"""
법률 문서 인덱싱 스크립트
backend/data/legal/ 하위의 모든 파일을 legal_chunks 테이블에 인덱싱
"""

import sys
from pathlib import Path
from typing import List, Dict, Any

# 프로젝트 루트를 Python 경로에 추가
backend_root = Path(__file__).resolve().parent.parent
project_root = backend_root.parent
sys.path.insert(0, str(backend_root))

from core.supabase_vector_store import SupabaseVectorStore
from core.generator_v2 import LLMGenerator
from core.legal_chunker import LegalChunker, extract_doc_type_from_path

# DocumentProcessor는 PDF/HWP 파일 처리 시에만 지연 로드
_DocumentProcessor = None

def get_document_processor():
    """DocumentProcessor 지연 로드"""
    global _DocumentProcessor
    if _DocumentProcessor is None:
        from core.document_processor_v2 import DocumentProcessor
        _DocumentProcessor = DocumentProcessor()
    return _DocumentProcessor


LEGAL_BASE_PATH = Path(__file__).resolve().parent.parent / "data" / "legal"


def get_external_id_from_path(file_path: Path) -> str:
    """
    파일 경로에서 external_id 생성
    예: backend/data/legal/cases/case_01_intern_termination.md -> case_01_intern_termination
    """
    # 파일명에서 확장자 제거
    stem = file_path.stem
    return stem


def get_source_type_from_path(file_path: Path) -> str:
    """
    파일 경로에서 source_type 추출
    """
    path_str = str(file_path)
    if "cases" in path_str or "case" in path_str.lower():
        return "case"
    elif "manuals" in path_str or "manual" in path_str.lower():
        return "manual"
    elif "laws" in path_str or "law" in path_str.lower():
        return "law"
    else:
        return "law"  # 기본값


def process_file(
    file_path: Path,
    store: SupabaseVectorStore,
    generator: LLMGenerator,
    chunker: LegalChunker
) -> int:
    """
    단일 파일 처리 및 인덱싱
    
    Returns:
        저장된 청크 개수
    """
    print(f"\n[처리 중] {file_path.name}")
    
    # 메타데이터 준비 (중복 체크를 위해 먼저 실행)
    external_id = get_external_id_from_path(file_path)
    source_type = get_source_type_from_path(file_path)
    title = file_path.stem  # 파일명에서 확장자 제거
    
    # 중복 체크: 이미 저장된 문서인지 확인 (파일 읽기 전에 체크)
    try:
        if store.check_legal_chunks_exist(external_id):
            print(f"  ⏭ 이미 저장된 문서입니다. 건너뜁니다. (external_id: {external_id})")
            return 0
    except Exception as e:
        print(f"[경고] 중복 체크 실패, 계속 진행: {str(e)}")
    
    # 파일 읽기
    try:
        if file_path.suffix.lower() in ['.pdf', '.hwp', '.hwpx', '.hwps']:
            # PDF/HWP 파일은 DocumentProcessor 사용 (지연 로드)
            processor = get_document_processor()
            text, _ = processor.process_file(str(file_path), file_type=None)
        elif file_path.suffix.lower() in ['.md', '.txt']:
            # 텍스트 파일 (md, txt 등)
            try:
                text = file_path.read_text(encoding='utf-8')
            except UnicodeDecodeError:
                text = file_path.read_text(encoding='cp949')
        else:
            print(f"[경고] 지원하지 않는 파일 형식: {file_path.suffix}")
            return 0
    except Exception as e:
        print(f"[오류] 파일 읽기 실패: {file_path.name} - {str(e)}")
        import traceback
        traceback.print_exc()
        return 0
    
    if not text or not text.strip():
        print(f"[경고] 빈 파일: {file_path.name}")
        return 0
    
    # 상대 경로 계산
    try:
        file_path_rel = str(file_path.relative_to(project_root))
    except:
        file_path_rel = str(file_path)
    
    # 청킹
    legal_chunks = chunker.build_legal_chunks(
        text=text,
        source_name=source_type,
        file_path=file_path_rel,
        doc_id=external_id
    )
    
    if not legal_chunks:
        print(f"[경고] 청크가 생성되지 않음: {file_path.name}")
        return 0
    
    print(f"  → {len(legal_chunks)}개 청크 생성")
    
    # 각 청크에 대해 임베딩 생성 및 저장
    chunks_to_store = []
    for idx, legal_chunk in enumerate(legal_chunks):
        # 임베딩 생성
        try:
            embedding = generator.embed_one(legal_chunk.text)
        except Exception as e:
            print(f"[경고] 임베딩 생성 실패 (청크 {idx}): {str(e)}")
            continue
        
        # 메타데이터 구성
        metadata = {
            "source_type": source_type,
            "external_id": external_id,
            "title": title,
            "chunk_index": legal_chunk.chunk_index,
            "file_path": file_path_rel,
        }
        
        # 케이스 파일인 경우 추가 메타데이터 추출 시도
        if source_type == "case":
            # 케이스 파일에서 situation, issues 추출 시도
            # (간단한 휴리스틱 - 실제로는 더 정교한 파싱 필요)
            lines = legal_chunk.text.split('\n')
            situation = ""
            issues = []
            
            for line in lines[:10]:  # 처음 10줄만 확인
                if "상황" in line or "사건" in line:
                    situation = line.strip()
                if "이슈" in line or "문제" in line:
                    issues.append(line.strip())
            
            if situation:
                metadata["situation"] = situation
            if issues:
                metadata["issues"] = issues
        
        chunks_to_store.append({
            "content": legal_chunk.text,
            "embedding": embedding,
            "metadata": metadata
        })
    
    # 일괄 저장
    try:
        store.bulk_upsert_legal_chunks(chunks_to_store)
        print(f"  ✓ {len(chunks_to_store)}개 청크 저장 완료")
        return len(chunks_to_store)
    except Exception as e:
        print(f"[오류] 저장 실패: {file_path.name} - {str(e)}")
        return 0


def main():
    """메인 함수"""
    print("=" * 60)
    print("법률 문서 인덱싱 시작")
    print("=" * 60)
    
    # 초기화
    print("\n[초기화] 컴포넌트 로딩 중...")
    store = SupabaseVectorStore()
    generator = LLMGenerator()
    chunker = LegalChunker(max_chars=1200, overlap=200)
    print("[완료] 컴포넌트 로딩 완료")
    
    # 처리할 파일 목록 수집
    files_to_process = []
    
    # cases/
    cases_dir = LEGAL_BASE_PATH / "cases"
    if cases_dir.exists():
        files_to_process.extend(cases_dir.glob("*.md"))
    
    # laws/
    laws_dir = LEGAL_BASE_PATH / "laws"
    if laws_dir.exists():
        files_to_process.extend(laws_dir.glob("*.pdf"))
        files_to_process.extend(laws_dir.glob("*.md"))
        files_to_process.extend(laws_dir.glob("*.txt"))
    
    # manuals/
    manuals_dir = LEGAL_BASE_PATH / "manuals"
    if manuals_dir.exists():
        files_to_process.extend(manuals_dir.glob("*.pdf"))
        files_to_process.extend(manuals_dir.glob("*.hwp"))
        files_to_process.extend(manuals_dir.glob("*.hwpx"))
        files_to_process.extend(manuals_dir.glob("*.md"))
    
    print(f"\n총 {len(files_to_process)}개 파일 발견")
    
    # 각 파일 처리
    total_chunks = 0
    for file_path in files_to_process:
        chunks_count = process_file(
            file_path=file_path,
            store=store,
            generator=generator,
            chunker=chunker
        )
        total_chunks += chunks_count
    
    print("\n" + "=" * 60)
    print(f"인덱싱 완료: 총 {total_chunks}개 청크 저장")
    print("=" * 60)


if __name__ == "__main__":
    main()
