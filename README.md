# steerhead 🐂

> Your AI agent is a bull. Raw power, no direction. Steerhead is the driver.

Every AI coding agent has the same flaw: **context drift**. New session? It forgets your architecture. Long conversation? It contradicts its own decisions. You repeat yourself, the agent drifts, and trust erodes.

Steerhead fixes this with a simple idea: **every message is a fresh single-shot API call, and the context is assembled from a local database — not from chat history.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

---

## How it works

```
Normal AI chat:
  You ←→ Agent [growing chat history → context degrades]

Steerhead:
  You ←→ Steerhead ←→ Agent API
              ↑
     builds context from SQLite
     every message is single-shot
     constraints auto-extracted
     memory persists across sessions
```

1. You send a message
2. Steerhead queries the local DB — what constraints and history are relevant?
3. Assembles a surgical system prompt (not the entire chat history)
4. Fires one clean API call
5. Gets the response, auto-extracts any decisions as constraints
6. Stores everything locally
7. Next message starts fresh — but fully informed

**The memory lives in SQLite, not in the chat thread.**

---

## What it looks like

- **Project-scoped**: each project gets its own isolated database
- **Auto-extracted constraints**: when the agent decides "use PostgreSQL" or "auth via JWT", steerhead captures it automatically
- **Session list**: chats are persisted and browsable like Claude.ai
- **Context token counter**: see exactly how many tokens of context are being injected
- **Agent-agnostic**: works with any OpenAI-compatible API (Groq, OpenRouter, Ollama, etc.)

---

## Quick start

```bash
# Clone
git clone https://github.com/josephmjustin/steerhead.git
cd steerhead

# Add your API key
cp .env.example .env
# Edit .env with your key (Groq, OpenAI, Anthropic, etc.)

# Start (backend + frontend)
.\start.ps1        # Windows
# or manually:
cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000
cd frontend && npm install && npm run dev

# Open http://localhost:5173
```

### Supported providers

| Provider | Base URL | Free tier |
|----------|----------|-----------|
| Groq | `https://api.groq.com/openai/v1` | ✅ 500K tokens/min |
| OpenRouter | `https://openrouter.ai/api/v1` | ✅ Free models |
| Ollama | `http://localhost:11434/v1` | ✅ Local |
| OpenAI | `https://api.openai.com/v1` | Paid |
| Anthropic | Via adapter (coming) | Paid |

---

## Architecture

```
steerhead/
├── backend/
│   └── app/
│       ├── main.py         ← FastAPI routes (project/session/chat/constraints)
│       ├── agent.py        ← single-shot logic + constraint extraction
│       └── database.py     ← SQLite schema (per-project DBs)
├── frontend/
│   └── src/
│       └── App.jsx         ← React UI (project picker + chat + sidebar)
└── .env                    ← your API key (never committed)
```

### Data model

```
~/.steerhead/
├── registry.db             ← project list
└── projects/
    ├── my-app/
    │   └── steerhead.db    ← sessions, messages, constraints, reasoning pairs
    └── another-project/
        └── steerhead.db    ← completely isolated
```

---

## Core features

- **Single-shot architecture** — every message is a fresh API call. No growing context window. No degradation.
- **Auto constraint extraction** — agent decisions are captured via a second LLM pass and stored as key-value pairs.
- **Project isolation** — each project gets its own SQLite database. No cross-contamination.
- **Session persistence** — chats are stored and browsable. Auto-titled.
- **Local-first** — no cloud, no telemetry, no accounts. Your code stays on your machine.
- **Agent-agnostic** — any OpenAI-compatible endpoint works out of the box.
- **Context efficiency** — only relevant constraints are injected. 146 tokens beats 80,000 tokens of chat history.

---

## Roadmap

| Status | Feature |
|--------|---------|
| ✅ Done | Single-shot chat with context injection |
| ✅ Done | Auto constraint extraction |
| ✅ Done | Project-scoped databases |
| ✅ Done | Session management with auto-titles |
| ✅ Done | Multi-provider support (Groq, OpenRouter, Ollama) |
| 🔜 Next | Git diff capture (pair diffs with agent reasoning) |
| 🔜 Next | Drift detection (flag when agent contradicts constraints) |
| 📋 Planned | Memory classification (facts vs events vs instructions vs tasks) |
| 📋 Planned | Vector search for relevant context retrieval |
| 📋 Planned | VS Code extension |
| 📋 Planned | CLI mode (`steerhead ask "how should I..."`) |

---

## Who is this for?

Solo developers who use AI agents daily and are tired of:
- Repeating the same architectural decisions every session
- Agents contradicting themselves after long conversations
- Starting from zero context in every new chat
- Losing the "why" behind code changes

If you've ever thought "I told you this already" while talking to an AI agent, steerhead is for you.

---

## Contributing

This is early-stage OSS and contributions are very welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md).

Good first issues:
- Improve constraint extraction accuracy
- Add git diff capture
- Build drift detection
- Add dark/light theme toggle
- Write tests

---

## License

MIT — see [LICENSE](./LICENSE).
