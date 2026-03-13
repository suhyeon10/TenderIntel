# Linkus Legal

<p align="center">
  <img src="demo.gif" alt="Linkus Legal demo" width="600" />
</p>

AI-assisted legal product focused on contract review, situation analysis, and grounded legal chat.

## Overview

This repository currently operates as a legal workflow product with:

- contract upload and risk analysis
- situation-based legal analysis
- legal search across laws, guides, and related materials
- contract and situation-aware legal chat

The main user experience lives in the Next.js `/legal` routes, while legal analysis and retrieval are handled by the FastAPI backend.

## Current Product Scope

### Frontend

- Next.js 14 App Router
- legal flows under `src/app/legal`
- API client layer in `src/apis/legal.service.ts`
- Supabase auth and storage integration

### Backend

- FastAPI app under `backend/`
- legal APIs under `/api/v2/legal`
- contract analysis, situation analysis, legal search, and agent chat
- RAG over legal documents and contract chunks

### OCR And Multimodal Intake

OCR is already implemented in the backend.

- `backend/core/document_processor_v2.py` supports PDF text extraction with OCR fallback
- OCR uses `pytesseract` and `pdf2image`
- contract mode prefers OCR for scanned or image-based PDFs

The current UI is still mostly text-centered, but the ingestion layer already supports OCR-based document intake and can be extended into a stronger multimodal legal workflow.

## Research Extension Direction

This codebase is also a practical base for a legal-agent research track:

1. Multimodal intake for scanned contracts, screenshots, and clause images
2. Multi-agent orchestration for issue extraction, retrieval, verification, and drafting
3. Evaluation focused on grounded citation quality and hallucination reduction
4. Continual legal updates with PEFT or LoRA adapters plus replay memory

## Project Structure

```text
src/
  app/
  apis/
  components/
backend/
  api/
  core/
  scripts/
ARCHITECTURE.md
backend/README.md
```

- `src/`: Next.js frontend
- `backend/api/`: FastAPI routes
- `backend/core/`: legal analysis, OCR, RAG, storage, and agent logic
- `ARCHITECTURE.md`: current top-level architecture summary
- `backend/README.md`: backend-specific setup and operational details

## Quick Start

### Frontend

```bash
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
# optionally override the default port (8000) e.g.:
#
#   # *nix shell
#   export PORT=4000
#   python main.py
#
#   # Windows PowerShell
#   $env:PORT = "4000"; python main.py
#
# The server also reads PORT from backend/.env if present.
python main.py
```

## Key Docs

- [ARCHITECTURE.md](/C:/Users/suhyeonjang/.codex/worktrees/b7b1/linkers-public/ARCHITECTURE.md)
- [backend/README.md](/C:/Users/suhyeonjang/.codex/worktrees/b7b1/linkers-public/backend/README.md)

## Notes

- Some legacy routes and older product surfaces still remain in the repository.
- The legal product under `/legal` is the current primary surface.
- If OCR quality matters, install Tesseract and Poppler as described in `backend/README.md`.

## License

MIT
