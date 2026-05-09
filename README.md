# Learnly — AI-Powered E-Learning Platform

> **PCD/26/21** · ENSI 2025/2026  
> Yassine BEN NACEF & Oussama BEN SOLTAN · Supervised by Dr. Manel BEN SASSI

Learnly is an inclusive e-learning platform designed to run on a **Raspberry Pi 4** for low-bandwidth, offline-first campus deployments. It combines a hybrid recommendation engine, AI-generated content (summaries, simplified videos, learning paths), and real-time network-quality awareness.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Django 4.2 · Django REST Framework · SimpleJWT · Whoosh · SQLite |
| Frontend | React 18 · Vite · Tailwind CSS · Chart.js · Axios |
| LLM (local) | Ollama (`qwen2:1.5b`) |
| LLM (cloud fallback) | DeepSeek · Mistral · OpenAI-compatible |

---

## Implemented Modules

| # | Module | Status |
|---|---|---|
| 1 | Authentication & Profiles — JWT, roles (student/teacher/admin), learning progress, bookmarks | ✅ |
| 2 | Resource Manager — file/URL upload, DCAT metadata, Whoosh full-text search | ✅ |
| 3 | Context Collection — network quality logs, campus zone detection, interaction events | ✅ |
| 4 | Recommendation Engine — 5-signal hybrid scoring (popularity · content · collaborative · location · network) | ✅ |
| 5 | LLM Module — summarise, simplify, variants, learning path, AI video generation (Ollama + cloud fallback) | ✅ |
| 6 | User Interface — React SPA, responsive, mobile-first | ✅ |
| 7 | Feedback — 1–5 star ratings, comments, content suggestions | ✅ |
| 8 | Admin Dashboard — KPIs, usage timeline, network monitoring, resource performance | ✅ |

---

## Project Structure

```
project/
├── backend/
│   ├── config/             # settings.py, urls.py, wsgi.py
│   ├── apps/
│   │   ├── authentication/ # User, StudentProfile, TeacherProfile, LearningProgress
│   │   ├── resources/      # Resource, Category, Whoosh indexer
│   │   ├── context/        # NetworkQualityLog, CampusLocation, UserInteraction
│   │   ├── recommendations/# Hybrid scoring engine
│   │   ├── feedback/       # Rating, Comment, ContentSuggestion
│   │   ├── dashboard/      # Admin-only analytics views
│   │   └── llm/            # OllamaClient, LLMCache, GeneratedVideo
│   ├── manage.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── src/
        ├── pages/          # HomePage, ResourcesPage, RecommendationsPage, AdminDashboardPage …
        ├── components/     # Navbar, Sidebar, ResourceCard, VideoPlayer …
        ├── services/api.js # Axios instance with JWT auto-refresh
        ├── context/        # AuthContext, CompletedContext, BookmarkedContext
        └── hooks/          # useNetworkMonitor, useDebounce
```

---

## Quick Start (PC / local development)

### 1 — Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env if needed (defaults work for local dev with Ollama)

# Apply migrations and build the Whoosh index
python manage.py migrate
python manage.py rebuild_index

# (Optional) load sample data
python manage.py seed_data

# Start the development server
python manage.py runserver
# → API available at http://localhost:8000
```

### 2 — Frontend

```bash
cd frontend
npm install
npm run dev
# → UI available at http://localhost:5173
```

### 3 — LLM (optional — required only for AI features)

Install [Ollama](https://ollama.com) and pull the default model:

```bash
ollama pull qwen2:1.5b
ollama serve          # runs on http://localhost:11434
```

If you skip this step the rest of the platform works normally; only the summarise / simplify / video-generation endpoints will return errors.

---

## Key API Endpoints

| Method | URL | Description |
|---|---|---|
| POST | `/api/auth/login/` | Obtain JWT token pair |
| POST | `/api/auth/register/` | Register new user |
| GET | `/api/resources/` | List resources (filterable) |
| GET | `/api/resources/search/?q=` | Full-text search (Whoosh) |
| GET | `/api/recommendations/` | Personalised recommendations |
| POST | `/api/context/network/` | Log network quality |
| GET | `/api/llm/summarise/<id>/` | AI summary of a resource |
| GET | `/api/llm/learning-path/` | AI-generated learning path |
| GET | `/api/dashboard/overview/` | Admin KPIs |

---

## Non-Functional Requirements

| Criterion | Implementation |
|---|---|
| **Performance < 2 s** | Django cache (5 min lists, 3 min recommendations), SQLite WAL, pagination |
| **Security** | JWT (8 h access + 7 d refresh), RBAC, CORS strict, soft-delete on resources |
| **Low bandwidth** | Network penalty in scoring, format affinity per campus zone |
| **RAM ≤ 600 MB** | SQLite, local memory cache, WhiteNoise static serving — no Redis/Elasticsearch |
