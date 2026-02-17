# LLM Dashboard — Frontend

A full-featured web dashboard for managing self-hosted LLM deployments via **Ollama** (CPU) and **vLLM** (GPU).

Built with **Next.js 14** · **shadcn/ui** · **Tailwind CSS** · **TypeScript**

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **npm**
- **Ollama** installed and running (`ollama serve`)
- (Optional) **vLLM** for GPU deployments

### One-Command Setup

From the repo root:

```bash
chmod +x setup.sh && ./setup.sh
```

This installs dependencies and starts the dev server.

### Manual Setup

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

---

## 📖 Usage Guide

### Dashboard (`/`)

The home page shows a live overview:

- **Stats Cards** — Models deployed, models running, RAM usage, active mode (CPU/GPU)
- **Deployed Models** — Quick list of all models with status indicators
- **Recent Activity** — Log of deploy, start, stop, and delete events
- **Quick Actions** — "Deploy Model" and "Open Chat" buttons

### Deploy (`/deploy`)

Deploy a new model in two modes:

| Mode | Tab | What it does |
|------|-----|-------------|
| **CPU** | CPU (Ollama) | Enter a HuggingFace repo name → runs `deploy_cpu.sh` → auto-selects best quantization |
| **GPU** | GPU (vLLM) | Enter model name + GPU slot (0 or 1) → runs `deploy_model.sh` |

- Real-time deployment progress is streamed via SSE (Server-Sent Events)
- Quantization reference table shows Q2_K through Q8_0 options

### Models (`/models`)

Manage all deployed models in a table:

| Column | Description |
|--------|-------------|
| **Model** | Model name |
| **Type** | CPU or GPU badge |
| **Status** | 🟢 Running / 🔴 Stopped |
| **Size** | Model file size |
| **Quantization** | Quant level (e.g., Q4_K_M) |
| **API Endpoint** | Clickable URL with copy button |
| **Actions** | ▶ Start · ⏹ Stop · 🗑 Delete |

### Chat (`/chat`)

Interactive chat with any running model:

- **Conversation sidebar** — Create, switch, delete conversations
- **Model selector** — Pick from running models (shows status badge)
- **Streaming responses** — Token-by-token output from Ollama
- **Persistence** — Conversations saved in `localStorage`

### System (`/system`)

System hardware and service health:

- **OS / CPU / RAM / Hostname** cards
- **Service Health** — Ollama and vLLM status with health badges
- **Memory Usage** chart (Recharts bar chart)

---

## 🧪 Running Tests

```bash
# Unit tests (Vitest)
npm run test

# Watch mode
npm run test -- --watch

# E2E tests (Playwright) — requires dev server running
npx playwright test
```

**Current: 47/47 tests passing** across validators, utils, API client, and components.

---

## 🏗 Production Build

```bash
npm run build
npm start
```

---

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages & API routes
│   │   ├── api/
│   │   │   ├── chat/           # POST — streaming chat proxy
│   │   │   ├── deploy/         # POST — start deploy + GET SSE stream
│   │   │   ├── health/         # GET — Ollama/vLLM health
│   │   │   ├── models/         # GET list, GET/DELETE [name], POST start/stop
│   │   │   └── system/         # GET — OS/CPU/RAM info
│   │   ├── chat/page.tsx
│   │   ├── deploy/page.tsx
│   │   ├── models/page.tsx
│   │   ├── system/page.tsx
│   │   └── page.tsx            # Dashboard
│   ├── components/
│   │   ├── dashboard/          # StatsCards, ModelSummary, ActivityLog
│   │   ├── layout/             # Sidebar, Header, ModeToggle
│   │   ├── system/             # SystemOverview, ResourceChart
│   │   └── ui/                 # shadcn/ui components
│   ├── hooks/                  # useModels, useSystemInfo, useDeploy, useSSE
│   └── lib/                    # api.ts, types.ts, constants.ts, validators.ts, utils.ts
└── __tests__/                  # Vitest unit + API tests
```

---

## ⚙️ Configuration

Key constants are in `src/lib/constants.ts`:

| Constant | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API address |
| `VLLM_PORTS` | `{0: 8104, 1: 8105}` | vLLM ports per GPU slot |
| `POLL_INTERVAL.models` | `10000` | Model list refresh (ms) |
| `POLL_INTERVAL.health` | `15000` | Health check refresh (ms) |

---

## 🛡 Security

- All model names are validated with Zod against command injection (blocks `;`, `|`, `` ` ``, `$()`, etc.)
- API input validation on every route
- No direct shell command construction from user input
