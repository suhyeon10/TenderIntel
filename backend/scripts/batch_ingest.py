"""
배치 인입 스크립트
폴더의 모든 파일을 자동으로 RAG에 반영

처리 파이프라인:
raw/ → processed/ → indexed/
"""

import os
import sys
import argparse
import json
import shutil
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime

# 상위 디렉토리를 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.orchestrator_v2 import Orchestrator
from core.supabase_vector_store import SupabaseVectorStore
from core.legal_chunker import LegalChunker, extract_doc_type_from_path
from core.document_processor_v2 import DocumentProcessor
from core.generator_v2 import LLMGenerator


class BatchIngester:
    """배치 인입 처리기"""
    
    def __init__(self, base_data_dir: str = None):
        self.orchestrator = Orchestrator()
        self.store = SupabaseVectorStore()
        self.results: List[Dict[str, Any]] = []
        
        # 데이터 디렉토리 설정
        if base_data_dir is None:
            base_data_dir = Path(__file__).parent.parent / "data"
        self.base_data_dir = Path(base_data_dir)
        
        # 단순 구조: processed/, indexed/ (선택사항)
        self.processed_dir = self.base_data_dir / "processed"
        self.indexed_dir = self.base_data_dir / "indexed"
        self.temp_dir = self.base_data_dir / "temp"
        
        # 디렉토리 생성 (필요시)
        for dir_path in [self.processed_dir, self.indexed_dir, self.temp_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
        
        # indexed 하위 디렉토리 생성
        (self.indexed_dir / "reports").mkdir(exist_ok=True)
        (self.indexed_dir / "exports").mkdir(exist_ok=True)
    
    def scan_folder(self, folder_path: str, extensions: List[str] = None) -> List[Path]:
        """
        폴더 스캔하여 파일 목록 반환
        
        Args:
            folder_path: 스캔할 폴더 경로
            extensions: 허용할 파일 확장자 (기본: ['.pdf', '.txt', '.hwp', '.hwpx'])
        
        Returns:
            파일 경로 리스트
        """
        if extensions is None:
            extensions = ['.pdf', '.txt', '.hwp', '.hwpx', '.html', '.htm', '.csv']
        
        folder = Path(folder_path)
        if not folder.exists():
            raise FileNotFoundError(f"폴더를 찾을 수 없습니다: {folder_path}")
        
        files = []
        # 특수문자가 있는 파일명도 찾기 위해 모든 파일을 스캔한 후 확장자로 필터링
        for file_path in folder.rglob("*"):
            if file_path.is_file():
                # README.md 등 제외
                if file_path.name.lower() in ['readme.md', '.gitkeep']:
                    continue
                # 확장자 확인 (대소문자 무시)
                if file_path.suffix.lower() in [ext.lower() for ext in extensions]:
                    files.append(file_path)
        
        return sorted(files)
    
    def extract_meta_from_filename(self, file_path: Path) -> Dict[str, Any]:
        """
        파일명에서 메타데이터 추출
        
        예시:
        - "나라장터_2024-001_웹사이트구축.pdf" 
          → source=나라장터, external_id=2024-001, title=웹사이트구축
        - "입찰_나라장터_2024-001_웹사이트구축.pdf"
          → type=입찰, source=나라장터, external_id=2024-001, title=웹사이트구축
        - "낙찰_나라장터_2024-001_낙찰자정보.pdf"
          → type=낙찰, source=나라장터, external_id=2024-001, title=낙찰자정보
        """
        filename = file_path.stem  # 확장자 제거
        
        # 파일명 패턴 파싱 (선택사항)
        # 기본값 설정
        meta = {
            "type": "입찰",  # 기본값: 입찰 공고
            "source": "batch_upload",
            "external_id": filename,
            "title": filename,
            "agency": None,
            "budget_min": None,
            "budget_max": None,
            "start_date": None,
            "end_date": None,
        }
        
        # 파일명에서 타입 추출 (입찰/낙찰)
        filename_lower = filename.lower()
        if filename_lower.startswith("입찰_"):
            meta["type"] = "입찰"
            filename = filename[3:]  # "입찰_" 제거
        elif filename_lower.startswith("낙찰_"):
            meta["type"] = "낙찰"
            filename = filename[3:]  # "낙찰_" 제거
        elif "낙찰" in filename_lower or "winner" in filename_lower or "award" in filename_lower:
            meta["type"] = "낙찰"
        
        # 파일명에서 정보 추출 시도
        parts = filename.split('_')
        if len(parts) >= 2:
            meta["source"] = parts[0]
            meta["external_id"] = parts[1] if len(parts) > 1 else filename
            meta["title"] = '_'.join(parts[2:]) if len(parts) > 2 else parts[1]
        
        return meta
    
    def process_file(
        self,
        file_path: Path,
        meta: Dict[str, Any] = None,
        verbose: bool = True,
        default_type: str = None,
        mode: str = "announcements"
    ) -> Dict[str, Any]:
        """
        단일 파일 처리
        
        Args:
            file_path: 파일 경로
            meta: 메타데이터 (없으면 파일명에서 추출)
            verbose: 진행 상황 출력 여부
            default_type: 기본 문서 타입 ("입찰" 또는 "낙찰", None이면 자동 감지)
        
        Returns:
            처리 결과
        """
        if meta is None:
            meta = self.extract_meta_from_filename(file_path)
        
        # default_type이 있으면 타입 강제 설정
        if default_type and default_type in ["입찰", "낙찰"]:
            meta["type"] = default_type
        
        result = {
            "file": str(file_path),
            "status": "pending",
            "announcement_id": None,
            "legal_document_id": None,
            "error": None,
            "started_at": datetime.now().isoformat(),
        }
        
        try:
            if verbose:
                print(f"[처리 중] {file_path.name} (모드: {mode})")
            
            # Legal 모드 처리
            if mode == "legal":
                return self._process_legal_file(file_path, meta, verbose)
            
            # Announcements 모드 처리 (기존 로직)
            # 파일 타입 결정
            suffix = file_path.suffix.lower()
            if suffix == ".pdf":
                file_type = "pdf"
            elif suffix in [".hwp", ".hwpx"]:
                file_type = "hwp"
            elif suffix == ".txt":
                file_type = "text"
            elif suffix in [".html", ".htm"]:
                file_type = "html"
            elif suffix == ".csv":
                # CSV는 특별 처리 (여러 공고를 한 파일에 포함)
                return self.process_csv_file(file_path, verbose=verbose)
            else:
                file_type = None  # 자동 감지
            
            # 1. 원본 파일 처리 (텍스트 추출)
            process_result = self.orchestrator.processor.process_file(
                file_path=str(file_path),
                file_type=file_type
            )
            
            # process_file은 (text, chunks) 튜플 반환
            if isinstance(process_result, tuple):
                text, chunks = process_result
            else:
                # 호환성을 위해
                text = process_result
                chunks = []
            
            # 2. processed/ 폴더에 저장 (텍스트 + 메타데이터) - 선택사항
            processed_file = None
            if self.processed_dir.exists():
                processed_file = self._save_processed_file(
                    file_path=file_path,
                    text=text,
                    meta=meta
                )
            
            # 3. 벡터 인덱싱 (RAG 파이프라인)
            announcement_id = self.orchestrator.process_announcement(meta, text)
            
            # 4. 청크 임베딩 저장
            chunk_texts = [chunk.content for chunk in chunks]
            embeddings = self.orchestrator.generator.embed(chunk_texts)
            
            chunk_payload = [
                {
                    "chunk_index": chunk.index,
                    "content": chunk.content,
                    "embedding": embeddings[i],
                    "metadata": chunk.metadata
                }
                for i, chunk in enumerate(chunks)
            ]
            
            self.store.bulk_upsert_chunks(announcement_id, chunk_payload)
            
            result.update({
                "status": "success",
                "announcement_id": announcement_id,
                "processed_file": str(processed_file) if processed_file else None,
                "chunks_count": len(chunks),
                "completed_at": datetime.now().isoformat(),
            })
            
            if verbose:
                print(f"[완료] {file_path.name} → {announcement_id} ({len(chunks)}개 청크)")
        
        except Exception as e:
            result.update({
                "status": "failed",
                "error": str(e),
                "completed_at": datetime.now().isoformat(),
            })
            
            if verbose:
                print(f"[실패] {file_path.name} - {str(e)}")
        
        return result
    
    def process_csv_file(
        self,
        file_path: Path,
        verbose: bool = True
    ) -> Dict[str, Any]:
        """
        CSV 파일 처리 (여러 공고를 한 파일에 포함)
        
        CSV 형식:
        - title, source, external_id, agency, budget_min, budget_max, start_date, end_date, file_path
        
        file_path 컬럼이 있으면 해당 파일을 읽고, 없으면 CSV의 다른 컬럼을 텍스트로 사용
        """
        import csv
        
        result = {
            "file": str(file_path),
            "status": "pending",
            "announcement_ids": [],
            "processed_count": 0,
            "error": None,
            "started_at": datetime.now().isoformat(),
        }
        
        try:
            if verbose:
                print(f"[CSV 처리] {file_path.name}")
            
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
            
            if not rows:
                raise ValueError("CSV 파일이 비어있습니다.")
            
            if verbose:
                print(f"  📋 {len(rows)}개 공고 발견")
            
            announcement_ids = []
            
            for i, row in enumerate(rows, 1):
                try:
                    # 타입 확인 (입찰/낙찰)
                    row_type = row.get("type", row.get("document_type", "입찰")).strip()
                    if row_type not in ["입찰", "낙찰"]:
                        # 파일명이나 다른 컬럼에서 타입 추출 시도
                        if "낙찰" in str(row.get("title", "")).lower() or "winner" in str(row.get("title", "")).lower():
                            row_type = "낙찰"
                        else:
                            row_type = "입찰"
                    
                    # 메타데이터 추출
                    meta = {
                        "type": row_type,
                        "source": row.get("source", "csv_upload"),
                        "external_id": row.get("external_id", f"{file_path.stem}_{i}"),
                        "title": row.get("title", f"{row_type} {i}"),
                        "agency": row.get("agency"),
                        "budget_min": int(row["budget_min"]) if row.get("budget_min") else None,
                        "budget_max": int(row["budget_max"]) if row.get("budget_max") else None,
                        "start_date": row.get("start_date"),
                        "end_date": row.get("end_date"),
                        # 낙찰자 정보 (낙찰인 경우)
                        "winner_company": row.get("winner_company") if row_type == "낙찰" else None,
                        "winner_amount": int(row["winner_amount"]) if row.get("winner_amount") and row_type == "낙찰" else None,
                        "winner_team_id": int(row["winner_team_id"]) if row.get("winner_team_id") and row_type == "낙찰" else None,
                    }
                    
                    # 파일 경로가 있으면 해당 파일 처리
                    if row.get("file_path"):
                        file_path_str = row["file_path"]
                        if not os.path.isabs(file_path_str):
                            # 상대 경로면 CSV 파일 기준으로 해석
                            file_path_str = str(file_path.parent / file_path_str)
                        
                        if not os.path.exists(file_path_str):
                            if verbose:
                                print(f"  ⚠️  [{i}] 파일을 찾을 수 없음: {file_path_str}")
                            continue
                        
                        # 입찰 공고 처리
                        if meta["type"] == "입찰":
                            announcement_id = self.orchestrator.process_file(
                                file_path=file_path_str,
                                file_type=None,
                                meta=meta
                            )
                            announcement_ids.append(announcement_id)
                            
                            if verbose:
                                print(f"  ✅ [{i}/{len(rows)}] [입찰] {meta['title']} → {announcement_id}")
                        
                        # 낙찰자 정보 처리
                        elif meta["type"] == "낙찰":
                            # 낙찰자 정보도 공고로 저장하되, 메타데이터에 낙찰 정보 포함
                            announcement_id = self.orchestrator.process_file(
                                file_path=file_path_str,
                                file_type=None,
                                meta=meta
                            )
                            announcement_ids.append(announcement_id)
                            
                            # 낙찰 이력 저장 (선택사항)
                            if meta.get("winner_team_id") or meta.get("winner_company"):
                                self._save_winner_info(
                                    announcement_id=announcement_id,
                                    meta=meta,
                                    verbose=verbose
                                )
                            
                            if verbose:
                                print(f"  ✅ [{i}/{len(rows)}] [낙찰] {meta['title']} → {announcement_id}")
                    
                    # 텍스트 컬럼이 있으면 텍스트로 처리
                    elif row.get("text") or row.get("content"):
                        text = row.get("text") or row.get("content", "")
                        if text.strip():
                            announcement_id = self.orchestrator.process_announcement(meta, text)
                            announcement_ids.append(announcement_id)
                            
                            # 낙찰자 정보 저장 (낙찰인 경우)
                            if meta["type"] == "낙찰" and (meta.get("winner_team_id") or meta.get("winner_company")):
                                self._save_winner_info(
                                    announcement_id=announcement_id,
                                    meta=meta,
                                    verbose=verbose
                                )
                            
                            if verbose:
                                print(f"  ✅ [{i}/{len(rows)}] [{meta['type']}] {meta['title']} → {announcement_id}")
                        else:
                            if verbose:
                                print(f"  ⚠️  [{i}] 텍스트가 비어있음")
                    
                    else:
                        if verbose:
                            print(f"  ⚠️  [{i}] file_path 또는 text 컬럼이 필요합니다")
                
                except Exception as e:
                    if verbose:
                        print(f"  ❌ [{i}] 오류: {str(e)}")
                    continue
            
            result.update({
                "status": "success",
                "announcement_ids": announcement_ids,
                "processed_count": len(announcement_ids),
                "completed_at": datetime.now().isoformat(),
            })
            
            if verbose:
                print(f"[CSV 완료] {len(announcement_ids)}개 공고 처리됨")
        
        except Exception as e:
            result.update({
                "status": "failed",
                "error": str(e),
                "completed_at": datetime.now().isoformat(),
            })
            
            if verbose:
                print(f"[CSV 실패] {file_path.name} - {str(e)}")
        
        return result
    
    def _process_legal_file(
        self,
        file_path: Path,
        meta: Dict[str, Any] = None,
        verbose: bool = True
    ) -> Dict[str, Any]:
        """
        법률/계약 문서 처리 (legal 모드)
        
        Args:
            file_path: 파일 경로
            meta: 메타데이터 (없으면 파일명에서 추출)
            verbose: 진행 상황 출력 여부
        
        Returns:
            처리 결과
        """
        result = {
            "file": str(file_path),
            "status": "pending",
            "legal_document_id": None,
            "error": None,
            "started_at": datetime.now().isoformat(),
        }
        
        try:
            # 메타데이터 추출
            if meta is None:
                meta = {}
            
            # 파일명에서 기본 정보 추출
            filename = file_path.stem
            if not meta.get("title"):
                meta["title"] = filename
            
            # 파일 경로에서 doc_type 추출
            file_path_str = str(file_path)
            doc_type = extract_doc_type_from_path(file_path_str)
            meta["doc_type"] = doc_type
            
            # source 추출 (폴더 구조에서)
            if "laws" in file_path_str.lower() or "법" in file_path_str.lower():
                source = "moel"  # 고용노동부
            elif "standard_contracts" in file_path_str.lower() or "계약" in file_path_str.lower():
                source = "mss"  # 중소벤처기업부
            elif "manuals" in file_path_str.lower() or "매뉴얼" in file_path_str.lower():
                source = "mcst"  # 문화체육관광부
            else:
                source = "unknown"
            
            meta["source"] = source
            
            # 파일 경로를 상대 경로로 변환 (안전하게)
            try:
                # 절대 경로로 변환
                file_path_abs = Path(file_path).resolve()
                base_data_dir_abs = self.base_data_dir.resolve()
                
                # base_data_dir의 하위 경로인지 확인
                if str(file_path_abs).startswith(str(base_data_dir_abs)):
                    meta["file_path"] = str(file_path_abs.relative_to(base_data_dir_abs))
                else:
                    # 하위 경로가 아니면 파일명만 사용하거나 전체 경로 사용
                    # data/legal/... 형태로 시작하는지 확인
                    file_path_str = str(file_path)
                    if "data" in file_path_str:
                        # data 이후의 경로만 추출
                        data_idx = file_path_str.find("data")
                        meta["file_path"] = file_path_str[data_idx:]
                    else:
                        # 그 외에는 파일명만
                        meta["file_path"] = file_path.name
            except Exception as e:
                # 오류 발생 시 파일명만 사용
                meta["file_path"] = file_path.name
            
            # 1. 텍스트 추출
            processor = DocumentProcessor()
            suffix = file_path.suffix.lower()
            if suffix == ".pdf":
                file_type = "pdf"
            elif suffix in [".hwp", ".hwpx"]:
                file_type = "hwp"
            elif suffix == ".txt":
                file_type = "text"
            elif suffix in [".html", ".htm"]:
                file_type = "html"
            else:
                file_type = None
            
            text, _ = processor.process_file(str(file_path), file_type)
            
            # 2. Legal Chunker로 청크 생성
            chunker = LegalChunker(max_chars=1200, overlap=200)
            legal_chunks = chunker.build_legal_chunks(
                text=text,
                source_name=source,
                file_path=meta["file_path"]
            )
            
            if not legal_chunks:
                raise Exception("법률 청크 생성 실패")
            
            # 3. 법률 문서 저장
            legal_document_id = self.store.upsert_legal_document(meta, text)
            
            # 4. 청크 임베딩 생성 및 저장
            generator = LLMGenerator()
            chunk_texts = [chunk.text for chunk in legal_chunks]
            embeddings = generator.embed(chunk_texts)
            
            chunk_payload = [
                {
                    "section_title": chunk.section_title,
                    "chunk_index": chunk.chunk_index,
                    "text": chunk.text,
                    "embedding": embeddings[i],
                    "meta": {}
                }
                for i, chunk in enumerate(legal_chunks)
            ]
            
            self.store.bulk_upsert_legal_chunks(legal_document_id, chunk_payload)
            
            result.update({
                "status": "success",
                "legal_document_id": legal_document_id,
                "chunks_count": len(legal_chunks),
                "completed_at": datetime.now().isoformat(),
            })
            
            if verbose:
                print(f"[완료] {file_path.name} → {legal_document_id} ({len(legal_chunks)}개 청크)")
        
        except Exception as e:
            result.update({
                "status": "failed",
                "error": str(e),
                "completed_at": datetime.now().isoformat(),
            })
            
            if verbose:
                print(f"[실패] {file_path.name} - {str(e)}")
        
        return result
    
    def _save_processed_file(
        self,
        file_path: Path,
        text: str,
        meta: Dict[str, Any]
    ) -> Path:
        """
        전처리된 파일을 processed/ 폴더에 저장
        
        Args:
            file_path: 원본 파일 경로
            text: 추출된 텍스트
            meta: 메타데이터
        
        Returns:
            저장된 파일 경로
        """
        try:
            # 출처별 폴더 구조 유지
            source = meta.get("source", "기타")
            doc_type = meta.get("type", "입찰")
            
            # processed/{source}/{type}/ 구조 생성
            processed_source_dir = self.processed_dir / source / doc_type
            processed_source_dir.mkdir(parents=True, exist_ok=True)
            
            # 파일명 생성 (원본 파일명 기반)
            filename = file_path.stem + ".json"
            processed_file = processed_source_dir / filename
            
            # JSON 형식으로 저장 (텍스트 + 메타데이터)
            processed_data = {
                "source_file": str(file_path),
                "extracted_at": datetime.now().isoformat(),
                "meta": meta,
                "text": text,
                "text_length": len(text),
            }
            
            with open(processed_file, 'w', encoding='utf-8') as f:
                json.dump(processed_data, f, ensure_ascii=False, indent=2)
            
            return processed_file
        
        except Exception as e:
            print(f"[경고] processed 파일 저장 실패: {str(e)}")
            return None
    
    def _save_winner_info(
        self,
        announcement_id: str,
        meta: Dict[str, Any],
        verbose: bool = True
    ):
        """
        낙찰자 정보 저장 (bidding_history 테이블에 저장)
        """
        try:
            from supabase import create_client
            import os
            
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            
            if not supabase_url or not supabase_key:
                if verbose:
                    print(f"  ⚠️  Supabase 설정이 없어 낙찰자 정보를 저장할 수 없습니다")
                return
            
            supabase = create_client(supabase_url, supabase_key)
            
            # bidding_history에 낙찰 정보 저장
            winner_data = {
                "announcement_id": announcement_id,
                "is_won": True,
                "actual_amount": meta.get("winner_amount"),
            }
            
            if meta.get("winner_team_id"):
                winner_data["team_id"] = meta["winner_team_id"]
            
            # 기존 공고 ID로 찾기 (external_id로 매칭)
            if meta.get("external_id"):
                # announcements 테이블에서 external_id로 찾기
                ann_result = supabase.table("announcements")\
                    .select("id")\
                    .eq("external_id", meta["external_id"])\
                    .eq("source", meta.get("source", ""))\
                    .order("version", desc=True)\
                    .limit(1)\
                    .execute()
                
                if ann_result.data and len(ann_result.data) > 0:
                    winner_data["announcement_id"] = ann_result.data[0]["id"]
            
            # 낙찰 이력 저장
            result = supabase.table("bidding_history")\
                .insert(winner_data)\
                .execute()
            
            if verbose:
                print(f"    💾 낙찰자 정보 저장됨")
        
        except Exception as e:
            if verbose:
                print(f"    ⚠️  낙찰자 정보 저장 실패: {str(e)}")
    
    def process_folder(
        self,
        folder_path: str,
        extensions: List[str] = None,
        parallel: bool = False,
        max_workers: int = 3,
        verbose: bool = True,
        auto_detect_type: bool = True,
        mode: str = "announcements"
    ) -> Dict[str, Any]:
        """
        폴더의 모든 파일 배치 처리
        
        Args:
            folder_path: 폴더 경로
            extensions: 허용할 파일 확장자
            parallel: 병렬 처리 여부
            max_workers: 병렬 처리 시 최대 워커 수
            verbose: 진행 상황 출력 여부
            auto_detect_type: 파일명에서 입찰/낙찰 자동 감지 (기본: True)
        
        Returns:
            배치 처리 결과
        """
        folder = Path(folder_path)
        
        # 하위 폴더 구조 확인 (bids/winners 또는 입찰/낙찰)
        bids_folder = folder / "bids"
        winners_folder = folder / "winners"
        bids_folder_kr = folder / "입찰"
        winners_folder_kr = folder / "낙찰"
        
        # 하위 폴더가 있으면 각각 처리
        has_bids = bids_folder.exists() or bids_folder_kr.exists()
        has_winners = winners_folder.exists() or winners_folder_kr.exists()
        
        if has_bids or has_winners:
            if verbose:
                print(f"[구조 감지] 하위 폴더 구조 발견")
            
            results = {
                "total": 0,
                "success": 0,
                "failed": 0,
                "results": [],
                "bids": {"total": 0, "success": 0, "failed": 0},
                "winners": {"total": 0, "success": 0, "failed": 0}
            }
            
            # 입찰 폴더 처리
            bids_path = bids_folder if bids_folder.exists() else bids_folder_kr
            if bids_path.exists():
                if verbose:
                    print(f"\n[입찰 공고] {bids_path} 처리 중...")
                bids_result = self._process_single_folder(
                    str(bids_path), extensions, parallel, max_workers, verbose, "입찰"
                )
                results["bids"] = {
                    "total": bids_result["total"],
                    "success": bids_result["success"],
                    "failed": bids_result["failed"]
                }
                results["total"] += bids_result["total"]
                results["success"] += bids_result["success"]
                results["failed"] += bids_result["failed"]
                results["results"].extend(bids_result["results"])
            
            # 낙찰 폴더 처리
            winners_path = winners_folder if winners_folder.exists() else winners_folder_kr
            if winners_path.exists():
                if verbose:
                    print(f"\n[낙찰자 정보] {winners_path} 처리 중...")
                winners_result = self._process_single_folder(
                    str(winners_path), extensions, parallel, max_workers, verbose, "낙찰"
                )
                results["winners"] = {
                    "total": winners_result["total"],
                    "success": winners_result["success"],
                    "failed": winners_result["failed"]
                }
                results["total"] += winners_result["total"]
                results["success"] += winners_result["success"]
                results["failed"] += winners_result["failed"]
                results["results"].extend(winners_result["results"])
            
            # 결과 출력
            if verbose:
                print(f"\n{'='*50}")
                print(f"[완료] 배치 처리 완료")
                print(f"   전체: {results['total']}개")
                print(f"   입찰: {results['bids']['success']}/{results['bids']['total']}개 성공")
                print(f"   낙찰: {results['winners']['success']}/{results['winners']['total']}개 성공")
                print(f"   실패: {results['failed']}개")
                print(f"{'='*50}")
            
            results["processed_at"] = datetime.now().isoformat()
            return results
        
        # 단일 폴더 처리 (기존 로직)
        return self._process_single_folder(
            folder_path, extensions, parallel, max_workers, verbose, 
            "입찰" if not auto_detect_type else None,
            mode=mode
        )
    
    def _process_single_folder(
        self,
        folder_path: str,
        extensions: List[str] = None,
        parallel: bool = False,
        max_workers: int = 3,
        verbose: bool = True,
        default_type: str = None,
        mode: str = "announcements"
    ) -> Dict[str, Any]:
        """
        단일 폴더 처리 (내부 메서드)
        
        Args:
            default_type: 기본 문서 타입 ("입찰" 또는 "낙찰", None이면 자동 감지)
        """
        # 파일 스캔
        files = self.scan_folder(folder_path, extensions)
        
        if not files:
            if verbose:
                print(f"[경고] 처리할 파일이 없습니다: {folder_path}")
            return {
                "total": 0,
                "success": 0,
                "failed": 0,
                "results": []
            }
        
        if verbose:
            print(f"[발견] 파일: {len(files)}개")
            if default_type:
                print(f"[타입] {default_type}로 처리")
            print(f"[시작] 처리 시작...\n")
        
        # 파일 처리
        if parallel:
            # 병렬 처리 (멀티프로세싱)
            from concurrent.futures import ThreadPoolExecutor
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                results = list(executor.map(
                    lambda f: self.process_file(f, verbose=verbose, default_type=default_type, mode=mode),
                    files
                ))
        else:
            # 순차 처리
            results = []
            for i, file in enumerate(files, 1):
                if verbose:
                    print(f"[{i}/{len(files)}] ", end="")
                result = self.process_file(file, verbose=verbose, default_type=default_type, mode=mode)
                results.append(result)
        
        # 결과 집계
        success_count = sum(1 for r in results if r["status"] == "success")
        failed_count = sum(1 for r in results if r["status"] == "failed")
        
        summary = {
            "total": len(files),
            "success": success_count,
            "failed": failed_count,
            "results": results,
            "processed_at": datetime.now().isoformat(),
        }
        
        # 결과 출력
        print(f"\n{'='*50}")
        print(f"[완료] 배치 처리 완료")
        print(f"   전체: {summary['total']}개")
        print(f"   성공: {summary['success']}개")
        print(f"   실패: {summary['failed']}개")
        print(f"{'='*50}")
        
        return summary
    
    def save_report(self, summary: Dict[str, Any], output_path: str = None):
        """
        처리 결과 리포트 저장
        
        Args:
            summary: 배치 처리 결과
            output_path: 리포트 저장 경로 (없으면 자동 생성)
        """
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = self.indexed_dir / "reports" / f"report_{timestamp}.json"
        else:
            output_path = Path(output_path)
        
        # 리포트 디렉토리 생성
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        # JSON 저장
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        
        print(f"[저장] 리포트: {output_path}")


def main():
    """메인 함수"""
    parser = argparse.ArgumentParser(description="공고/법률 문서 배치 인입 스크립트")
    parser.add_argument(
        "folder",
        type=str,
        help="처리할 폴더 경로"
    )
    parser.add_argument(
        "--mode",
        type=str,
        choices=["announcements", "legal"],
        default="announcements",
        help="처리 모드: announcements (공고) 또는 legal (법률/계약) (기본: announcements)"
    )
    parser.add_argument(
        "--extensions",
        type=str,
        nargs="+",
        default=[".pdf", ".txt", ".html", ".htm", ".csv"],
        help="처리할 파일 확장자 (기본: .pdf .txt .html .htm .csv)"
    )
    parser.add_argument(
        "--parallel",
        action="store_true",
        help="병렬 처리 활성화"
    )
    parser.add_argument(
        "--max-workers",
        type=int,
        default=3,
        help="병렬 처리 시 최대 워커 수 (기본: 3)"
    )
    parser.add_argument(
        "--report",
        type=str,
        help="리포트 저장 경로 (선택)"
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="진행 상황 출력 안 함"
    )
    
    args = parser.parse_args()
    
    # 배치 처리기 생성
    ingester = BatchIngester()
    
    # 폴더 처리
    summary = ingester.process_folder(
        folder_path=args.folder,
        extensions=args.extensions,
        parallel=args.parallel,
        max_workers=args.max_workers,
        verbose=not args.quiet,
        mode=args.mode
    )
    
    # 리포트 저장
    if args.report or not args.quiet:
        ingester.save_report(summary, args.report)
    
    # 실패한 파일이 있으면 종료 코드 1
    if summary["failed"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()

