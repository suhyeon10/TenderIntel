-- migrations/011_tender_indexes.sql
-- Tender-level and chunk-level indexes (revision-scoped)

CREATE TABLE IF NOT EXISTS public.tender_index_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_pk UUID NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
    tender_revision_pk UUID NOT NULL REFERENCES public.tender_revisions(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    tender_id TEXT NOT NULL,
    revision_hash TEXT NOT NULL,
    title TEXT,
    agency TEXT,
    deadline TEXT,
    region TEXT,
    category TEXT,
    budget_min BIGINT,
    budget_max BIGINT,
    urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    search_text TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_tender_index_documents_revision UNIQUE (tender_revision_pk)
);

CREATE INDEX IF NOT EXISTS idx_tender_index_documents_keyword ON public.tender_index_documents USING gin (to_tsvector('simple', search_text));
CREATE INDEX IF NOT EXISTS idx_tender_index_documents_region ON public.tender_index_documents(region);
CREATE INDEX IF NOT EXISTS idx_tender_index_documents_category ON public.tender_index_documents(category);
CREATE INDEX IF NOT EXISTS idx_tender_index_documents_deadline ON public.tender_index_documents(deadline);

CREATE TABLE IF NOT EXISTS public.tender_index_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tender_revision_pk UUID NOT NULL REFERENCES public.tender_revisions(id) ON DELETE CASCADE,
    revision_hash TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_hash TEXT NOT NULL,
    chunk_text TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    vector_stub JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uq_tender_index_chunks_revision_chunk_hash UNIQUE (tender_revision_pk, chunk_hash)
);

CREATE INDEX IF NOT EXISTS idx_tender_index_chunks_revision_pk ON public.tender_index_chunks(tender_revision_pk);
CREATE INDEX IF NOT EXISTS idx_tender_index_chunks_text ON public.tender_index_chunks USING gin (to_tsvector('simple', chunk_text));

DROP TRIGGER IF EXISTS trg_tender_index_documents_set_updated_at ON public.tender_index_documents;
CREATE TRIGGER trg_tender_index_documents_set_updated_at
BEFORE UPDATE ON public.tender_index_documents
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
