"""
문서 파일 경로 및 URL 생성 헬퍼 함수
다른 API에서 문서 파일 경로를 확인하고 URL을 생성할 때 사용
"""

from typing import Optional
from core.supabase_vector_store import SupabaseVectorStore


def get_document_file_path(
    source_type: str,
    external_id: str
) -> str:
    """
    문서 파일 경로 생성 (Storage 상대 경로)
    
    Args:
        source_type: 'law' | 'manual' | 'case' | 'standard_contract'
        external_id: 파일 ID (MD5 해시 또는 파일명)
    
    Returns:
        Storage 경로 (예: "laws/437f9719fcdf4fb0a3b011315b75c56c.pdf")
    
    Example:
        >>> get_document_file_path("law", "abc123")
        "laws/abc123.pdf"
        >>> get_document_file_path("manual", "def456.pdf")
        "manuals/def456.pdf"
    """
    # source_type을 폴더명으로 변환
    folder_mapping = {
        "law": "laws",
        "manual": "manuals",
        "case": "cases",
        "standard_contract": "standard_contracts",
    }
    folder_name = folder_mapping.get(source_type, "laws")
    
    # external_id에 확장자가 없으면 .pdf 추가
    if not external_id.lower().endswith(".pdf"):
        file_name = f"{external_id}.pdf"
    else:
        file_name = external_id
    
    return f"{folder_name}/{file_name}"


def get_document_file_url(
    external_id: str,
    source_type: str,
    expires_in: int = 3600
) -> Optional[str]:
    """
    문서 파일 Signed URL 생성 (Supabase Storage)
    
    Args:
        external_id: 파일 ID (legal_chunks.external_id)
        source_type: 소스 타입 ('law' | 'manual' | 'case' | 'standard_contract')
        expires_in: URL 만료 시간 (초, 기본값: 3600 = 1시간)
    
    Returns:
        Signed URL 또는 None (파일이 없거나 오류 발생 시)
    
    Example:
        >>> url = get_document_file_url("abc123", "law")
        >>> # "https://xxx.supabase.co/storage/v1/object/sign/legal-sources/laws/abc123.pdf?..."
    """
    if not external_id:
        return None
    
    try:
        vector_store = SupabaseVectorStore()
        return vector_store.get_storage_file_url(
            external_id=external_id,
            source_type=source_type,
            expires_in=expires_in
        )
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(f"파일 URL 생성 실패 (external_id={external_id}, source_type={source_type}): {str(e)}")
        return None


def get_document_api_url(
    external_id: str,
    source_type: str,
    backend_url: Optional[str] = None,
    download: bool = False
) -> str:
    """
    문서 파일 API URL 생성 (백엔드 /api/v2/legal/file 엔드포인트)
    
    Args:
        external_id: 파일 ID
        source_type: 소스 타입 ('law' | 'manual' | 'case' | 'standard_contract')
        backend_url: 백엔드 URL (None이면 환경 변수에서 가져옴)
        download: 다운로드 모드 여부 (True면 download=true 파라미터 추가)
    
    Returns:
        API URL (예: "http://localhost:8000/api/v2/legal/file?path=laws/abc123.pdf&download=true")
    
    Example:
        >>> url = get_document_api_url("abc123", "law", download=True)
        >>> # "http://localhost:8000/api/v2/legal/file?path=laws/abc123.pdf&download=true"
    """
    import os
    from config import settings
    
    if not backend_url:
        backend_url = os.getenv("BACKEND_URL") or os.getenv("NEXT_PUBLIC_BACKEND_API_URL") or "http://localhost:8000"
    
    file_path = get_document_file_path(source_type, external_id)
    
    url = f"{backend_url}/api/v2/legal/file?path={file_path}"
    if download:
        url += "&download=true"
    
    return url


def get_document_public_url(
    external_id: str,
    source_type: str,
    supabase_url: Optional[str] = None
) -> Optional[str]:
    """
    문서 파일 Public URL 생성 (Public 버킷인 경우)
    
    Args:
        external_id: 파일 ID
        source_type: 소스 타입 ('law' | 'manual' | 'case' | 'standard_contract')
        supabase_url: Supabase URL (None이면 환경 변수에서 가져옴)
    
    Returns:
        Public URL 또는 None
    
    Example:
        >>> url = get_document_public_url("abc123", "law")
        >>> # "https://xxx.supabase.co/storage/v1/object/public/legal-sources/laws/abc123.pdf"
    """
    import os
    from config import settings
    
    if not supabase_url:
        supabase_url = os.getenv("SUPABASE_URL") or settings.supabase_url
    
    if not supabase_url:
        return None
    
    file_path = get_document_file_path(source_type, external_id)
    return f"{supabase_url}/storage/v1/object/public/legal-sources/{file_path}"

