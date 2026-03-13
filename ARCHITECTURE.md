# LINKUS Public Architecture

This document summarizes the current architecture of the repository based on the active code paths.

## 1. High-Level Shape

```text
User
  -> Next.js frontend (`src/`)
     -> legal pages, UI, route handlers, auth/session wiring
     -> API client calls to FastAPI and Supabase
        -> FastAPI backend (`backend/`)
           -> document processing and OCR
           -> legal retrieval and analysis
           -> contract/situation chat orchestration
              -> Supabase Postgres, Storage, pgvector
```

The current primary product surface is the legal domain under `/legal`.

## 2. Main Layers

### Frontend

Main folders:

- `src/app/`
- `src/components/`
- `src/apis/`
- `src/supabase/`
- `src/types/`

Current active routes are centered on:

- `/legal`
- `/legal/contract`
- `/legal/contract/[docId]`
- `/legal/contract/[docId]/assist`
- `/legal/situation`
- `/legal/situation/[id]`
- `/legal/assist`
- `/legal/search`

The frontend is responsible for:

- user interaction and page composition
- session and auth wiring
- calling backend legal APIs
- reading some Supabase-backed data paths

### Backend

Main folders:

- `backend/api/`
- `backend/core/`
- `backend/models/`
- `backend/scripts/`

The backend is responsible for:

- contract analysis
- situation analysis
- legal search
- legal agent chat
- OCR-backed document ingestion
- persistence of analysis and chat data

## 3. Backend Entry Points

The main backend application entry point is:

- `backend/main.py`

Important route modules:

- `backend/api/routes_legal.py`
- `backend/api/routes_legal_v2.py`
- `backend/api/routes_legal_agent.py`

In practice, the legal v2 and legal agent routes are the most important active surfaces.

## 4. Core Backend Services

Important service files:

- `backend/core/document_processor_v2.py`
- `backend/core/legal_rag_service.py`
- `backend/core/contract_storage.py`
- `backend/core/agent_chat_service.py`
- `backend/core/agent_prompts.py`

### Document Processing And OCR

`document_processor_v2.py` is responsible for:

- PDF text extraction
- OCR fallback for scanned PDFs
- contract-oriented chunking
- clause splitting and paragraph splitting

OCR is already implemented and uses:

- `pytesseract`
- `pdf2image`
- `Pillow`

For contract processing, OCR is preferred when handling scanned or image-based PDFs.

### Retrieval And Analysis

`legal_rag_service.py` and related storage layers handle:

- retrieval from `legal_chunks`
- retrieval from `contract_chunks`
- grounded legal analysis
- contract and situation answer generation support

### Agent Chat

`routes_legal_agent.py` and `agent_chat_service.py` handle unified legal chat flows for:

- plain mode
- contract mode
- situation mode

The contract chat path now also supports selected issue context and session continuity.

## 5. Main Data Surfaces

The current data layer is centered on Supabase.

Important tables and surfaces include:

- `contract_analyses`
- `contract_issues`
- `contract_chunks`
- `legal_chunks`
- `legal_chat_sessions`
- `legal_chat_messages`

These are used across:

- contract analysis result pages
- legal search and retrieval
- contract-aware chat
- situation-aware chat

## 6. Main Request Flows

### Contract Analysis

```text
Frontend contract upload
  -> POST /api/v2/legal/analyze-contract
  -> document processing and OCR
  -> chunking and retrieval
  -> legal analysis
  -> save analysis and chunk data
  -> return result to frontend
```

### Situation Analysis

```text
Frontend situation form
  -> POST /api/v2/legal/analyze-situation
  -> legal retrieval
  -> situation analysis
  -> save report/result
  -> return result to frontend
```

### Legal Agent Chat

```text
Frontend legal chat
  -> POST /api/v2/legal/agent/chat
  -> load chat session and context
  -> retrieve contract/legal sources
  -> build prompt and generate answer
  -> save chat messages
  -> return answer and used sources
```

## 7. Current Strengths

- The repository already has a working legal product surface.
- OCR is implemented rather than only planned.
- Contract, situation, search, and chat flows are connected through one backend domain.
- Retrieval and persistence are already integrated with Supabase.

## 8. Current Risks

### Mixed API access patterns

Some frontend flows call FastAPI directly, while others go through Next.js route handlers first.

### Broad backend responsibilities

Some backend files currently own a wide range of responsibilities, especially:

- `routes_legal_v2.py`
- `legal_rag_service.py`
- `contract_storage.py`

### Active and legacy domains in one repository

The current active product is the legal domain, but some older or secondary routes and domains still remain in the repository.

### Data access patterns are not fully unified

Some reads are handled through backend APIs, while others are handled through Next.js handlers or direct Supabase access.

## 9. Recommended Cleanup Direction

1. Keep `/legal` clearly marked as the active primary product surface.
2. Gradually standardize API entry patterns.
3. Split large backend services by domain responsibility when adding major new features.
4. Mark older routes and domains as legacy in docs and folder organization where possible.

## 10. Research Extension Fit

This architecture is already suitable for extension into a legal-agent research platform.

Most practical next steps are:

1. stronger multimodal intake on top of the existing OCR pipeline
2. multi-agent orchestration for issue extraction, retrieval, verification, and drafting
3. grounded citation evaluation
4. continual legal update experiments using PEFT or LoRA adapters

## 11. Summary

The current repository is best understood as:

- a Next.js legal frontend
- a FastAPI legal analysis and agent backend
- a Supabase-backed persistence and retrieval layer

Its core function is to support grounded legal workflows around contract review, situation analysis, and legal chat.
