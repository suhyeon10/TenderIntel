"""
법률 RAG 인덱싱 공용 유틸리티 (T1/T2/T4)

- external_id 생성 규칙 통일
- legal_chunks 메타데이터 표준 스키마
- source_type 결정
- ingestion manifest (audit) 기록

표준 metadata 필드 (legal_chunks.metadata 또는 JSONB):
  schema_version, source_type, external_id, title, file_path,
  topic_main, doc_type, doc_effective_date, doc_version,
  ocr_used, source_modality, page

사용: scripts.index_contracts_from_data (단일 진입점)에서 import
"""

from pathlib import Path
from typing import Dict, Any, Optional
import hashlib

# 표준 메타데이터 스키마 버전 (스키마 변경 시 증가)
LEGAL_CHUNK_METADATA_SCHEMA_VERSION = "1.0"

# source_modality 값 (멀티모달 확장용)
SOURCE_MODALITY_TEXT = "text"
SOURCE_MODALITY_PDF_TEXT = "pdf_text"
SOURCE_MODALITY_PDF_OCR = "pdf_ocr"
SOURCE_MODALITY_IMAGE_OCR = "image_ocr"


def make_external_id(file_path: Path, base_path: Path) -> str:
    """
    문서별 고유 ID 생성 (재현 가능, 경로 정규화 기반).

    규칙: base_path 기준 상대 경로를 정규화한 뒤 UTF-8 바이트의 SHA-256 해시 앞 32자 사용.
    - 동일한 상대 경로 → 항상 동일한 external_id
    - path hash / stem 혼용 제거

    Args:
        file_path: 파일 절대 또는 상대 경로
        base_path: 법률 데이터 루트 (예: backend/data/legal)

    Returns:
        32자 hex 문자열 (예: a1b2c3d4e5f6...)
    """
    try:
        if file_path.is_absolute() and base_path.is_absolute():
            rel = file_path.relative_to(base_path)
        else:
            rel = Path(str(file_path)).resolve().relative_to(Path(base_path).resolve())
    except ValueError:
        rel = file_path
    # 정규화: 슬래시 통일, 대소문자 유지
    normalized = str(rel).replace("\\", "/").strip("/")
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return digest[:32]


def get_source_type_from_path(file_path: Path) -> str:
    """
    파일 경로에서 source_type 추출.

    Returns:
        'standard_contract' | 'law' | 'manual' | 'case' | 'unknown'
    """
    path_str = str(file_path).replace("\\", "/")
    if "standard_contracts" in path_str:
        return "standard_contract"
    if "laws" in path_str:
        return "law"
    if "manuals" in path_str or "manual" in path_str.lower():
        return "manual"
    if "cases" in path_str or "case" in path_str.lower():
        return "case"
    return "unknown"


def extraction_source_to_modality(extraction_source: Optional[str]) -> str:
    """
    DocumentProcessor 추출 소스 → source_modality 표준값.

    extraction_source 예: 'pdf_text', 'pdf_ocr', 'image_ocr', 'hwp_text', 'html_text'
    """
    if not extraction_source:
        return SOURCE_MODALITY_TEXT
    s = (extraction_source or "").lower()
    if "pdf_ocr" in s or s == "pdf_ocr":
        return SOURCE_MODALITY_PDF_OCR
    if "pdf" in s and "text" in s:
        return SOURCE_MODALITY_PDF_TEXT
    if "image" in s or "ocr" in s:
        return SOURCE_MODALITY_IMAGE_OCR
    return SOURCE_MODALITY_TEXT


def build_standard_metadata(
    *,
    source_type: str,
    external_id: str,
    title: str,
    file_path: Optional[str] = None,
    chunk_index: int = 0,
    topic_main: Optional[str] = None,
    doc_type: Optional[str] = None,
    doc_effective_date: Optional[str] = None,
    doc_version: Optional[str] = None,
    ocr_used: bool = False,
    source_modality: Optional[str] = None,
    page: Optional[int] = None,
    extraction_source: Optional[str] = None,
    **extra: Any,
) -> Dict[str, Any]:
    """
    legal_chunks용 표준 메타데이터 딕셔너리 생성.

    최소 필드 (표준 스키마):
    - schema_version
    - source_type
    - external_id
    - title
    - file_path
    - topic_main
    - doc_type
    - doc_effective_date
    - doc_version
    - ocr_used
    - source_modality
    - page

    Args:
        extraction_source: DocumentProcessor의 source_type (pdf_ocr, pdf_text 등).
            있으면 source_modality 미지정 시 여기서 유도.
        extra: 추가 필드는 그대로 metadata에 포함.
    """
    if source_modality is None and extraction_source:
        source_modality = extraction_source_to_modality(extraction_source)
    if source_modality is None:
        source_modality = SOURCE_MODALITY_TEXT

    meta = {
        "schema_version": LEGAL_CHUNK_METADATA_SCHEMA_VERSION,
        "source_type": source_type,
        "external_id": external_id,
        "title": title or "",
        "file_path": file_path or "",
        "topic_main": topic_main,
        "doc_type": doc_type,
        "doc_effective_date": doc_effective_date,
        "doc_version": doc_version,
        "ocr_used": ocr_used,
        "source_modality": source_modality,
        "page": page,
        **extra,
    }
    # None 값은 제거하지 않음 (스키마 문서화/필터링에 유리). 필요 시 호출측에서 제거.
    return meta


def append_ingestion_manifest_entry(
    manifest_path: Path,
    *,
    external_id: str,
    file_path: str,
    file_hash: Optional[str] = None,
    source_type: str,
    chunk_count: int,
    embedding_model: str = "bge-m3",
    status: str,
    error_message: Optional[str] = None,
    ingested_at: Optional[str] = None,
) -> None:
    """
    인덱싱 결과를 manifest 파일(JSONL)에 한 줄 추가 (audit 로그).
    """
    import json
    from datetime import datetime
    entry = {
        "external_id": external_id,
        "file_path": file_path,
        "file_hash": file_hash,
        "source_type": source_type,
        "chunk_count": chunk_count,
        "embedding_model": embedding_model,
        "status": status,
        "error_message": error_message,
        "ingested_at": ingested_at or datetime.utcnow().isoformat() + "Z",
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(manifest_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
