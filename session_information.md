# Session Information: vLLM Self-Hosting Project

## What This Project Is

A repo at `/Users/apple/project/vllmSelfHosting` that automates deploying LLM models. It currently has:
- `deploy_model.sh` (797 lines) — deploys models on **Linux GPU servers** using vLLM + systemd + nginx + LiteLLM
- `deploy_cpu.sh` (750+ lines) — deploys models on **CPU systems** (Mac/Linux/WSL) using Ollama
- `test/` — 4 unit test suites (31 tests) + live integration test for `deploy_cpu.sh`
- `README.md` — documentation for both scripts

Everything above is **complete and tested**. Branch: `feature/cpu_integration`.

---

## What Needs To Be Built Next: Web Frontend

### The Goal

Build a **Next.js web dashboard** inside a `frontend/` folder that lets users control the ENTIRE system from a browser. Flow:

```
User clones repo → runs ./setup.sh → opens localhost:3000 → controls everything from the dashboard
```

No terminal commands needed after setup. The frontend IS the control panel.

### Implementation Plan Location

**The detailed plan is at:**

```
/Users/apple/.gemini/antigravity/brain/339ef0fa-cd42-4d01-aeb0-c6688504c041/implementation_plan.md
```

This plan contains EVERYTHING needed:
- Complete project structure (every file and folder)
- 5 pages with detailed component breakdown
- 12 API routes with request/response specs
- 7 phased implementation order
- 85+ tests across 4 layers (unit, API, integration, E2E)
- Security considerations
- All architecture decisions explained

---

## Tech Stack for Frontend

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) |
| UI Library | shadcn/ui (MCP server available — use it!) |
| Styling | Tailwind CSS |
| Language | TypeScript |
| Validation | Zod |
| Charts | Recharts (via shadcn) |
| Unit Tests | Vitest + React Testing Library |
| E2E Tests | Playwright |
| Shell Exec | Node.js `child_process.spawn()` |

### MCP Servers Available

- **shadcn-ui** — has `listComponents`, `listBlocks`, `searchBlocks`, `getBlockInstall` tools
- **context7** — has `resolve-library-id`, `query-docs` for looking up library documentation

### Key shadcn/ui Blocks to Install

| Block | Purpose |
|-------|---------|
| `dashboard-shell-01` | Main layout (sidebar + header) |
| `sidebar-01` | Navigation sidebar |
| `statistics-01` | KPI stat cards |
| `widget-01` | Analytics overview |
| `widget-05` | Activity timeline |
| `table-01` | Sortable data table |

---

## Existing Scripts (DO NOT MODIFY)

### deploy_cpu.sh
- **Input**: `./deploy_cpu.sh <hf_repo> [--background|--foreground]`
- **What it does**: Detects system → picks GGUF quant → pulls via Ollama (3-tier fallback) → tests API
- **Ollama API**: `localhost:11434`
- **OpenAI-compatible**: `localhost:11434/v1/chat/completions`
- **Testable**: Has `TESTING=1` guard so functions can be sourced

### deploy_model.sh
- **Input**: `./deploy_model.sh <hf_repo> <gpu_slot>`
- **GPU 0** → port 8104, **GPU 1** → port 8105
- **What it does**: Creates systemd service → downloads model → starts vLLM → configures LiteLLM + nginx
- **Requires**: Linux with NVIDIA GPUs
- **vLLM API**: `localhost:8104/v1/chat/completions` (or 8105)

---

## User's System

| Property | Value |
|----------|-------|
| OS | macOS |
| CPU | Intel Core i7-9750H @ 2.60GHz |
| Arch | x86_64 (NOT Apple Silicon) |
| Total RAM | 16 GB |
| CPU Cores | 12 |

---

## Architecture: How Frontend Talks to Scripts

```
Browser (localhost:3000)
    ↓ fetch()
Next.js API Routes (server-side)
    ↓ child_process.spawn()
deploy_cpu.sh / deploy_model.sh
    ↓ stdout/stderr streamed back via SSE
Browser displays real-time progress
```

For chat:
```
Browser → /api/chat → Ollama API (localhost:11434/api/chat) → SSE stream back
Browser → /api/chat → vLLM API  (localhost:8104/v1/chat/completions) → SSE stream back
```

---

## 5 Pages to Build

| Page | Route | Purpose |
|------|-------|---------|
| Dashboard | `/` | Stats cards, model list, activity log, quick actions |
| Deploy | `/deploy` | CPU/GPU mode selector, model input, quant table, real-time deploy progress |
| Models | `/models` | All models table, start/stop/remove, **API endpoint URLs shown** |
| Chat | `/chat` | Model picker, ChatGPT-style chat, streaming responses, localStorage history |
| System | `/system` | OS, CPU, RAM detection, service health, resource charts |

---

## 12 API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/deploy` | POST | Spawn deploy script |
| `/api/deploy/stream` | GET | SSE deployment progress |
| `/api/models` | GET | List all models |
| `/api/models/[name]` | GET | Model details + API URL |
| `/api/models/[name]` | DELETE | Remove model |
| `/api/models/[name]/start` | POST | Start model |
| `/api/models/[name]/stop` | POST | Stop model |
| `/api/chat` | POST | Chat (SSE streaming) |
| `/api/system` | GET | System info |
| `/api/health` | GET | Service health checks |

---

## Testing (CRITICAL — Very Important!)

### 85+ Tests Across 4 Layers

| Layer | Tool | Count | What |
|-------|------|-------|------|
| Unit | Vitest + RTL | ~40 | Components, hooks, utils, validators |
| API | Vitest | ~20 | All 12 API routes, validation, edge cases |
| Integration | Vitest + RTL | ~15 | Full page rendering with mocked data |
| E2E | Playwright | ~10 | Real browser user flows |

### Test Commands
```bash
cd frontend
npm run test              # unit + API + integration (vitest)
npm run test:e2e          # end-to-end (playwright)
npm run test:all          # everything
```

### What MUST Be Tested
- Every component: renders correctly, handles loading/error/empty states
- Every API route: valid input, invalid input, malicious input, server errors
- Deploy flow: mode selection → form → progress streaming → completion
- Chat flow: model picker → send message → streaming response display
- Model management: list → delete with confirmation → verify removal
- Navigation: all sidebar links work, active page highlighted
- Responsive: mobile viewport renders correctly
- Security: Zod rejects bad model names, no shell injection possible

---

## Implementation Order (7 Phases)

1. **Foundation** — Init Next.js, install shadcn/ui + all components, dashboard-shell layout, setup.sh, Vitest + Playwright config
2. **System & Health APIs** — `/api/system`, `/api/health`, System page, tests
3. **Dashboard** — Stats cards, model summary, activity log, tests
4. **Model Management** — `/api/models` CRUD, Models page with table, API endpoint URLs, tests
5. **Deployment** — `/api/deploy` + SSE stream, Deploy page with mode selector + progress, tests
6. **Chat** — `/api/chat` streaming proxy, Chat page with model picker + message UI, tests
7. **Polish** — Dark/light theme, responsive, error boundaries, remaining E2E tests, README update

---

## Key Rules for Implementation

1. **DO NOT modify** `deploy_cpu.sh` or `deploy_model.sh` — they are complete
2. **Use `spawn()` NOT `exec()`** for running shell scripts from API routes
3. **Validate ALL inputs with Zod** before passing to shell scripts
4. **Stream deployment output** via Server-Sent Events (SSE), not WebSockets
5. **Chat history in localStorage** — no database needed
6. **No authentication** — it's localhost, user's own machine
7. **Use shadcn/ui MCP server** to install components and blocks
8. **Run tests after each phase** — don't wait until the end
9. **`setup.sh`** at repo root should: check Node.js, cd frontend, npm install, npm run dev

---

## Previous Work Summary

| What | Status |
|------|--------|
| `deploy_cpu.sh` | ✅ Complete, 750+ lines, tested |
| Unit tests (31) | ✅ All passing |
| Live integration test | ✅ Passed (smollm:135m + TinyLlama) |
| 3-tier deployment fallback | ✅ Verified end-to-end |
| `deploy_model.sh` | ✅ Pre-existing, untouched |
| README.md | ✅ Updated with CPU section |
| Git pushed | ✅ Branch `feature/cpu_integration` |
| Frontend | ❌ Not started — THIS IS THE NEXT TASK |
