# DocMind - AI Document Intelligence Platform

A production-grade RAG (Retrieval-Augmented Generation) platform for intelligent document analysis. Upload documents, ask questions, and get AI-generated answers with precise citations.

## Features

- **Semantic Document Search** — Hybrid retrieval (Dense + BM25 + RRF fusion) with cross-encoder reranking
- **AI-Powered Q&A** — Stream answers with source citations using Llama 3.3 70B via Groq
- **Multi-Format Support** — PDF, DOCX, TXT, and images (OCR via Tesseract)
- **Real-Time Processing** — SSE streaming for chat responses and ingestion progress
- **Workspace Isolation** — Collection-per-workspace in Qdrant for multi-tenant data separation
- **Semantic Caching** — Redis-backed cosine similarity cache for repeated queries
- **Conversation Memory** — Context-aware follow-up questions with summarization
- **Dark Mode UI** — Polished Next.js frontend with Framer Motion animations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, Python 3.12 |
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Database | PostgreSQL 16 |
| Vector DB | Qdrant |
| Cache | Redis 7 |
| LLM | Groq (Llama 3.3 70B) — free |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) |
| Reranker | cross-encoder/ms-marco-MiniLM-L-6-v2 |
| Storage | MinIO / S3 / Cloudflare R2 |
| Auth | JWT (access + refresh tokens) |

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local frontend dev)
- Python 3.11+ (for local backend dev)

### Option 1: Docker (Full Stack)
```bash
# Clone
git clone https://github.com/NikhilNWakode/DocMind.git
cd DocMind

# Configure
cp backend/.env.example backend/.env
# Edit backend/.env and add your Groq API key (free: https://console.groq.com/keys)

# Run
docker compose up -d
```

### Option 2: Local Development
```bash
# 1. Start infrastructure
docker compose -f docker-compose.dev.yml up -d

# 2. Backend
cd backend
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Access
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| MinIO Console | http://localhost:9001 |

## Architecture

```
Client (Next.js)
  |
  v
FastAPI Backend
  ├── JWT Auth
  ├── Rate Limiting (slowapi + Redis)
  ├── SSE Streaming (chat + ingestion progress)
  |
  ├── Document Ingestion Pipeline
  |   Extract -> Chunk -> Embed -> Index (Qdrant)
  |
  ├── Hybrid Retrieval
  |   Dense (Qdrant) + BM25 -> RRF Fusion -> Cross-Encoder Rerank
  |
  ├── Semantic Cache (Redis)
  └── Conversation Memory (summarization)
```

## Deployment

Deploy to Render using the included `render.yaml` blueprint:

1. Push to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com) → New → Blueprint
3. Connect your repo — Render auto-detects `render.yaml`
4. Fill in environment variables when prompted

