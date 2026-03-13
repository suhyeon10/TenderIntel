# Linkus Legal Backend

FastAPI backend for contract analysis, situation analysis, legal retrieval, and legal agent chat.

## Scope

This backend currently powers the legal product under the frontend `/legal` flows.

Primary capabilities:

- contract upload and analysis
- situation-based legal analysis
- legal document retrieval
- legal chat with contract or situation context
- OCR-backed document intake for scanned PDFs

## Core Areas

```text
backend/
  api/
  core/
  models/
  scripts/
  data/
```

- `api/`: FastAPI routes
- `core/`: document processing, OCR, RAG, storage, agent logic
- `models/`: request and response schemas
- `scripts/`: local utilities for OCR, ingestion, and indexing

## Main Routes

### Legal v2

- `POST /api/v2/legal/analyze-contract`
- `GET /api/v2/legal/contracts/{doc_id}`
- `GET /api/v2/legal/contracts/history`
- `POST /api/v2/legal/analyze-situation`
- `GET /api/v2/legal/search`
- `POST /api/v2/legal/chat`

### Agent Chat

- `POST /api/v2/legal/agent/chat`

This route supports:

- `plain` mode
- `contract` mode
- `situation` mode

## Important Components

### Document Processing

- `core/document_processor_v2.py`
- PDF text extraction with OCR fallback
- contract-oriented chunking and clause splitting

### Retrieval And Analysis

- `core/legal_rag_service.py`
- `core/contract_storage.py`
- `core/agent_chat_service.py`
- `core/agent_prompts.py`

### Route Entry Points

- `api/routes_legal_v2.py`
- `api/routes_legal_agent.py`

## OCR Status

OCR is already active in the backend pipeline.

- scanned and image-based PDFs are supported through OCR fallback
- contract mode prefers OCR when processing contracts
- OCR uses `pytesseract`, `pdf2image`, and `Pillow`

Required Python packages are already listed in `requirements.txt`.

### External OCR Dependencies

For local OCR quality and PDF image conversion, install:

- Tesseract OCR
- Poppler

If OCR is missing, the backend can still handle text-based PDFs, but scanned PDFs may fail or degrade.

## Local Setup

### 1. Create virtual environment

```bash
cd backend
python -m venv venv
source venv/bin/activate
```

On Windows:

```bash
cd backend
python -m venv venv
venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment

Create `backend/.env` with at least:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=...
OPENAI_API_KEY=...
```

Optional settings commonly used here:

```env
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=INFO
LLM_MODEL=gpt-4o-mini
USE_OLLAMA=false
CHUNK_SIZE=1500
CHUNK_OVERLAP=300
```

### 4. Run server

```bash
python main.py
```

Or:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Local URLs

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- Health check: `http://localhost:8000/api/health`

## Useful Scripts

- `scripts/test_ocr.py`: test OCR on scanned PDFs
- `scripts/index_contracts_from_data.py`: ingest legal documents
- `scripts/check_legal_files.py`: inspect indexed legal files
- `scripts/upload_legal_files_to_storage.py`: upload source files to storage

## Notes

- This repository still contains some older or secondary routes, but the legal v2 and agent paths are the current primary backend surface.
- For high-level architecture, see [ARCHITECTURE.md](/C:/Users/suhyeonjang/.codex/worktrees/b7b1/linkers-public/ARCHITECTURE.md).
- The root repo summary lives in [README.md](/C:/Users/suhyeonjang/.codex/worktrees/b7b1/linkers-public/README.md).
