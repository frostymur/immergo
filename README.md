# immergo

AI-powered adaptive tutor for Kazakh schoolchildren — teaches any subject in KZ / RU / EN with real-time voice, math rendering, and teacher analytics.

🏆 **Future Minds 2026 · Social Impact Hackathon — Finalist**

---

## 🌐 Live Demo

| Resource | Link |
|----------|------|
| Live Platform | `localhost:3000` (local dev) |
| Backend API Docs | `localhost:8000/docs` |
| GitHub | [hyphypnotic/immergo](https://github.com/hyphypnotic/immergo) |

---

## 💡 About The Project

Every schoolchild in Kazakhstan learns in one of three languages — Kazakh, Russian, or English — and each has different learning needs, weak topics, and exam goals (ЕНТ, олимпиады, school program). One-size-fits-all tutoring doesn't work.

**immergo** is an AI tutoring platform that acts as a personal teacher for every student. It diagnoses weak topics, builds an adaptive lesson plan, and delivers live interactive lessons — with the AI adjusting difficulty in real time based on student answers, re-explaining concepts when asked, and quizzing when ready.

The system is built around the **Adaptive Tutoring + Teacher Oversight** model:

- **Diagnostic Assessment** — a 15-question test per subject identifies weak topics and sets the difficulty baseline (beginner / intermediate / advanced)
- **Adaptive Lesson Delivery** — the AI tutor adjusts difficulty on the fly (1–5 scale), clarifies before explaining, re-explains with analogies on demand, and quizzes when concepts are understood
- **Judge-Call** — a separate LLM evaluates student answers independently before the tutor responds, ensuring honest grading and preventing the teacher from accepting wrong answers
- **Teacher Analytics** — teachers see per-student weak-topic heatmaps, lesson completion stats, streaks, and can manage classes

Grounded in the real Kazakh curriculum (ЕНТ Physics 12, school Physics 9), with curated diagnostic questions across all topics.

---

## ✨ Features

### Adaptive Lesson Engine

The core of immergo — a real-time interactive lesson delivered as a streaming chat with structured blocks (notes, diagrams, formulas, tasks, quizzes). The AI follows 6 teaching rules enforced via system prompt:

- **Clarify First** — asks what the student already knows before lecturing
- **Re-Explain on Demand** — switches to analogies/simpler language when asked (via "Explain it simpler" quick chip)
- **Quiz Mode** — immediately quizzes when a concept is explained, even mid-lesson
- **Task Difficulty Ladder** — 5 difficulty levels (⚡ 1–5), auto-adjusts per student performance
- **Practice Turns** — balances explanation with student practice
- **Fair Grading** — judge-call evaluates answers independently

All lesson content renders with **KaTeX** math ($...$), **Markdown** (tables, lists, bold), and structured blocks.

### Judge-Call (Independent Answer Verification)

Before the AI tutor responds to a student's answer, a separate LLM (qwen3-8 / alemllm — deliberately different from the lesson model) evaluates whether the answer is correct. If `is_answer = false` (not an answer), no feedback is given and the task stays pending. If `correct = false`, the tutor explains with scaffolding based on the judge's reason. This prevents the teacher model from accepting wrong answers.

### Voice & Language

- **3 languages**: Kazakh (kk-KZ), Russian (ru-RU), English (en-US)
- **Edge-TTS** voices per language — selectable in Settings (AigulNeural / DauletNeural for KZ, SvetlanaNeural / DmitryNeural for RU, 17+ voices for EN)
- All lesson content is streamed to audio in the selected voice
- Voice selection persists per language in localStorage

### Diagnostic Assessment

- 15-question curated test per subject (e.g., Physics 12 ЕНТ)
- Available in all 3 UI languages
- Evaluates weak topics and sets difficulty level
- Results feed directly into the lesson roadmap

### Student Roadmap

- Personalized learning path based on diagnostic results
- Shows progress through topics with step indicators
- Locked/unlocked states guide sequential learning

### Gamification

- **XP** earned per lesson completion
- **Streak** tracking (daily learning streaks)
- **Confetti** animation on lesson completion
- **Badges** for milestones

### Teacher Dashboard

- **Class Overview** — per-class analytics with student roster
- **Weak-Topic Heatmap** — visual heatmap of student weaknesses across topics
- **Lesson Completion Stats** — who's learning, who's not
- **Class Insights** — aggregated class-level analytics
- **Student Management** — invite links, class roster, grade assignment

### Whiteboard Workspace

- Full-screen distraction-free lesson environment
- Streaming AI blocks with typewriter animation
- Quick chips (Explain simpler, Quiz me) that don't interrupt the AI
- Click-to-select text for AI questions
- Speech queue management (interruption-safe)
- TTS playback with pause/resume

### Knowledge Base (RAG)

- Upload PDFs/text to a workspace
- Vector embeddings (1024-dim) via Alem embedder
- Semantic search over uploaded materials
- Used by the AI tutor for context during lessons

### Marketing Landing

- Lumi.co-inspired design with animated hero, orbit preview
- Feature showcase (How It Works)
- Student/teacher sections with stats
- i18n (KZ/RU/EN)

---

## 🏗️ Architecture & Tech Stack

### Client Tier

| Technology | Role |
|-----------|------|
| Next.js 16 | React framework, App Router, Server Components |
| React 19 | UI component model |
| Tailwind CSS 4 | Utility-first styling, mobile-first responsive |
| KaTeX | Math formula rendering ($...$ in lesson content) |
| Framer Motion | Animations and transitions |
| Lucide React | Icon library |
| TypeScript 5 | End-to-end type safety |

### Application Tier

| Technology | Role |
|-----------|------|
| Python FastAPI | Async REST API, SSE streaming, auto-generated OpenAPI docs |
| edge-tts | Microsoft Azure TTS voices (KZ/RU/EN) — free, no API key |
| OpenAI Python SDK | LLM client (connects to alemllm and llm.alem.ai endpoints) |
| Langfuse | LLM observability and tracing |

### Data Tier

| Technology | Role |
|-----------|------|
| Supabase | PostgreSQL 15, Auth, Row-Level Security, Realtime |
| pgvector | 1024-dim vector embeddings for RAG-based knowledge base |

### Database Schema

15 migrations, core tables:

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (role, grade, default_goal, lang) |
| `workspaces` | Class/topic workspaces (title, grade, teacher_id) |
| `class_memberships` | Student-class relationships |
| `lesson_sessions` | AI lesson sessions (status, difficulty, topic) |
| `lesson_blocks` | Individual lesson messages (note, formula, task, quiz, etc.) |
| `lesson_highlights` | Student highlights/annotations |
| `lesson_plans` | Adaptive lesson plans (steps, current position) |
| `diagnostic_tests` | Curated diagnostic question banks |
| `diagnostic_results` | Student diagnostic results + weak topics |
| `roadmaps` | Student learning paths |
| `source_chunks` | Vector-indexed document chunks for RAG |
| `user_preferences` | User settings (voice, theme) |

---

### AI / LLMs

| Model | Provider | Role |
|-------|----------|------|
| gemma4 | llm.alem.ai | Lesson delivery (live tutoring turns) |
| qwen3-8 | llm.alem.ai | Planning, diagnostics, roadmap, judge-call |
| alemllm | llm.alem.ai | Kazakh-language lessons and judge-call |
| text-1024 | llm.alem.ai | Vector embeddings for RAG |

Lesson delivery uses gemma4 by default (configurable via `LESSON_LLM_MODEL`). Planning and diagnostics always use qwen3-8/alemllm. Judge-call uses qwen3-8/alemllm (deliberately different from the teacher model).

### Observability

| Tool | Role |
|------|------|
| Langfuse | Per-call LLM tracing, token counts, prompt debugging |

---

## 🚀 Getting Started

### Prerequisites

- Python 3.12+
- Node.js 20+
- Supabase project (free tier works)
- Alem API keys (llm.alem.ai)

### 1. Clone the Repository

```bash
git clone https://github.com/hyphypnotic/immergo.git
cd immergo
```

### 2. Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/postgres

# Kazakh LLM (alemllm)
ALEM_LLM_API_KEY=your_alem_key
ALEM_LLM_BASE_URL=https://llm.alem.ai/v1

# Russian / English LLM (qwen3-8)
QWEN_API_KEY=your_qwen_key
QWEN_API_BASE=https://llm.alem.ai/v1
QWEN_MODEL=qwen3-8

# Lesson delivery override (optional — defaults to qwen3-8/alemllm)
LESSON_LLM_API_KEY=your_gemma_key
LESSON_LLM_BASE_URL=https://llm.alem.ai/v1
LESSON_LLM_MODEL=gemma4

# Embeddings
ALEM_EMBED_API_KEY=your_embed_key
ALEM_EMBED_BASE_URL=https://llm.alem.ai/v1

# Observability (optional)
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
```

Start the backend:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Start the frontend:

```bash
npm run dev
```

### 4. Database

Run the migrations in `supabase/migrations/` in order (001–015) against your Supabase PostgreSQL instance. Then run the seed:

```bash
psql $DATABASE_URL -f supabase/seeds/01_demo_fizika_12_ent.sql
```

This creates the demo class "Физика 12" with curated diagnostic questions in 3 languages.

### 5. Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| aigul.student@demo.kz | demo123456 | Student |
| (teacher account via Supabase Dashboard) | — | Teacher |

---

## 📂 Project Structure

```
immergo/
├── backend/
│   ├── app/
│   │   ├── core/config.py          # Settings (Pydantic BaseSettings)
│   │   ├── db/database.py          # Supabase DB queries
│   │   ├── models/                 # SQLModel schemas
│   │   ├── routers/ai.py           # All API endpoints
│   │   ├── schemas/ai.py           # Request/response models
│   │   └── services/
│   │       ├── llm.py              # LLM client, lesson system prompt, judge-call, plan merging
│   │       ├── tts.py              # Edge-TTS synthesis + voice catalog
│   │       ├── embeddings.py       # Vector embeddings (text-1024)
│   │       ├── pdf_parser.py       # PDF-to-markdown
│   │       └── storage.py          # Supabase Storage
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── auth/page.tsx           # Login/register
│   │   ├── dashboard/page.tsx      # Teacher dashboard
│   │   ├── diagnostic/page.tsx     # Diagnostic test
│   │   ├── my-classes/page.tsx     # Teacher class management
│   │   ├── roadmap/page.tsx        # Student learning path
│   │   ├── settings/page.tsx       # User settings (language, grade, voice)
│   │   ├── teacher/page.tsx        # Teacher overview
│   │   └── workspace/page.tsx      # AI lesson workspace
│   ├── components/
│   │   ├── MarketingLanding.tsx    # Public landing page
│   │   ├── AppShell.tsx            # Layout with sidebar
│   │   ├── AuthCard.tsx            # Auth form
│   │   ├── LocaleProvider.tsx      # i18n (KZ/RU/EN)
│   │   ├── Sidebar.tsx             # Navigation
│   │   ├── Confetti.tsx            # Lesson completion confetti
│   │   ├── ReminderBell.tsx        # Notification bell
│   │   └── LogoutButton.tsx        # Logout (mobile + desktop)
│   ├── lib/
│   │   ├── api.ts                  # Backend API client
│   │   ├── rich.tsx                # KaTeX + Markdown renderer
│   │   ├── voices.ts               # Voice selection (localStorage)
│   │   └── supabase/               # Supabase client
│   └── public/icon.svg             # App icon (favicon)
└── supabase/
    ├── migrations/                  # 15 SQL migrations
    └── seeds/                       # Demo data
```

---

## 🧪 Testing

Backend — Python unit tests:

```bash
cd backend
python -m pytest tests/ -v
```

Frontend — TypeScript check:

```bash
cd frontend
npx tsc --noEmit
npx eslint app/ lib/
```

E2E — live backend + frontend running, test with demo account:

```bash
# Sign in as student, verify lesson flow
node /tmp/e2e-*.mjs
```

---

## 🌍 Deployment

### Environment Variables

All secrets live in `.env` files (gitignored). Never commit API keys.

### Production Checklist

- [ ] Set `CORS_ORIGINS` to your production domain
- [ ] Configure Supabase RLS policies for multi-tenant isolation
- [ ] Set `LESSON_LLM_*` for lesson delivery model
- [ ] Enable Langfuse tracing for production observability
- [ ] Run all 15 migrations against production database
- [ ] Seed demo data if needed

---

## 📊 Demo Walkthrough

1. **Login** — `aigul.student@demo.kz` / `demo123456`
2. **Diagnostic** — 15-question Physics test (12 класс, ЕНТ), all 3 languages
3. **Roadmap** — personalized topic path based on diagnostic results
4. **Workspace** — AI tutor delivers adaptive lesson with KaTeX formulas, voice, quiz
5. **Settings** — pick voice per language (KZ/RU/EN)
6. **Teacher Dashboard** — heatmap, class analytics, student management

---

## 🏆 Team

| Name | Role |
|------|------|
| Timur Iskakov | Backend, LLM integration, infrastructure, full-stack |
| Aidon | Frontend, UI/UX, marketing landing |

---

## 📄 License

Built for Future Minds 2026 Hackathon · Social Impact.
