-- 법률 인덱싱 audit 로그용 테이블 (선택 사항)
-- 파일 manifest(JSONL)와 병행 사용 가능. 이 테이블이 있으면 인덱싱 스크립트에서 INSERT 가능하도록 확장 가능.

CREATE TABLE IF NOT EXISTS public.linkus_legal_ingestion_manifest (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_hash TEXT,
    source_type TEXT NOT NULL,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    embedding_model TEXT DEFAULT 'bge-m3',
    status TEXT NOT NULL,
    error_message TEXT,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linkus_legal_ingestion_manifest_external_id
    ON public.linkus_legal_ingestion_manifest(external_id);
CREATE INDEX IF NOT EXISTS idx_linkus_legal_ingestion_manifest_ingested_at
    ON public.linkus_legal_ingestion_manifest(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_linkus_legal_ingestion_manifest_status
    ON public.linkus_legal_ingestion_manifest(status);

COMMENT ON TABLE public.linkus_legal_ingestion_manifest IS
'법률 코퍼스 인덱싱 이력 (audit). JSONL manifest와 병행 사용 가능.';
