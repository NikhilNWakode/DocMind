# DocMind — AI Document Intelligence Platform

Upload a document, ask questions, get AI-powered answers with citations. Each chat is scoped to a single document for focused, accurate retrieval.

**Live Demo:** [docmind-ai.vercel.app](https://docmind-ai.vercel.app)

## How It Works

1. **Upload** a PDF, DOCX, or TXT inside the chat
2. Document is automatically processed (extracted, chunked, embedded, indexed)
3. **Ask questions** — AI retrieves relevant passages and streams an answer with source citations
4. **New document = new chat** — each conversation is tied to one document

## Features

- **Document-Scoped RAG** — Each chat queries only its linked document for precise answers
- **AI-Powered Q&A** — Streaming responses with source citations (Llama 3.3 70B via Groq)
- **Multi-Format Support** — PDF, DOCX, TXT, and images (OCR via Tesseract)
- **Real-Time Processing** — SSE streaming for both chat responses and ingestion progress
- **JWT Authentication** — Secure access with access + refresh tokens
- **Dark Mode UI** — Polished interface with Framer Motion animations

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS v4 |
| Backend | FastAPI, Python 3.12 |
| Database | PostgreSQL (Render) |
| Vector DB | Qdrant Cloud |
| Cache/Pubsub | Redis |
| LLM | Groq API (Llama 3.3 70B) |
| Embeddings | HuggingFace Inference API (all-MiniLM-L6-v2) |
| Auth | JWT (bcrypt + python-jose) |
| Hosting | Vercel (frontend) + Render (backend) |

## Architecture

```
Next.js Frontend (Vercel)
  |
  v
FastAPI Backend (Render)
  ├── JWT Auth + Rate Limiting (Redis)
  ├── SSE Streaming (chat + ingestion progress)
  |
  ├── Document Ingestion Pipeline
  |   Upload -> Extract (PyMuPDF) -> Chunk (tiktoken) -> Embed (HF API) -> Index (Qdrant)
  |
  ├── RAG Query Pipeline
  |   Embed query -> Vector search (filtered by document_id) -> Build context -> Stream LLM response
  |
  └── Conversation History (PostgreSQL)
```

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL, Redis, Qdrant (or use Docker)

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -e ".[dev]"

# Configure
cp .env.example .env
# Edit .env: set DATABASE_URL, REDIS_URL, QDRANT_URL, LLM_API_KEY (Groq), HF_TOKEN

alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
# Set NEXT_PUBLIC_API_URL=http://localhost:8000 in .env.local
npm run dev
```

### Access
| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

## Deployment

### Backend (Render)
1. Create a **Web Service** on [Render](https://render.com) pointing to the repo
2. Set root directory to `backend`
3. Build command: `pip install .`
4. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add environment variables: `DATABASE_URL`, `REDIS_URL`, `QDRANT_URL`, `QDRANT_API_KEY`, `LLM_API_KEY`, `HF_TOKEN`, `JWT_SECRET_KEY`, `CORS_ORIGINS`, `APP_ENV=production`

Migrations run automatically on startup.

### Frontend (Vercel)
1. Import repo on [Vercel](https://vercel.com)
2. Set root directory to `frontend`
3. Add env var: `NEXT_PUBLIC_API_URL=https://your-backend.onrender.com`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `QDRANT_URL` | Qdrant Cloud endpoint |
| `QDRANT_API_KEY` | Qdrant Cloud API key |
| `LLM_API_KEY` | Groq API key ([free](https://console.groq.com/keys)) |
| `HF_TOKEN` | HuggingFace token ([free](https://huggingface.co/settings/tokens)) |
| `JWT_SECRET_KEY` | Random secret for JWT signing |
| `CORS_ORIGINS` | Allowed frontend origins (comma-separated or `*`) |
| `APP_ENV` | `development` or `production` |
| `NEXT_PUBLIC_API_URL` | Backend URL (frontend build-time) |

## Project Structure

```
backend/
  app/
    api/v1/          # Route handlers (auth, chat, documents, health, ingestion, workspaces)
    models/          # SQLAlchemy models (user, document, conversation, workspace)
    schemas/         # Pydantic request/response schemas
    services/        # Business logic (chat, document, embedding, extraction, chunking, vector store)
    tasks/           # Background tasks (document ingestion)
    infrastructure/  # DB, Redis, Qdrant, S3, LLM clients
    config.py        # Settings from env vars
    main.py          # FastAPI app factory

frontend/
  src/
    app/             # Next.js pages (landing, login, register, dashboard)
    components/      # UI components (chat, landing, ui primitives)
    stores/          # Zustand stores (auth, chat)
    lib/             # API client, utilities
```

## License

MIT
