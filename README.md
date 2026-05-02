# steerhead

> Your AI agent is a bull. Raw power, no direction. Steerhead is the driver.

Claude and every other coding agent suffer from the same flaw: every new session, they forget. Architectural decisions evaporate. Constraints get re-litigated. You repeat yourself, the agent drifts, and trust erodes. Steerhead fixes this by keeping micro-level memory of every decision — then injecting it before the agent can forget.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

---

## The concept

The agent is the engine. Steerhead is the driver.

You write code. The agent helps. Steerhead watches every diff the agent produces, pairs it with the agent's reasoning, and stores both locally in SQLite. The next time a session starts — or the next time the agent is about to suggest something that conflicts with a past decision — Steerhead injects the relevant context automatically.

The agent never loses the plot. You never repeat yourself.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     steerhead UI                     │
│                 (React + Vite, local)                │
└────────────────────────┬────────────────────────────┘
                         │ HTTP
┌────────────────────────▼────────────────────────────┐
│                   FastAPI server                     │
│                                                      │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────┐  │
│  │  Session    │   │   Memory     │   │  Drift   │  │
│  │  Manager   │   │   Store      │   │ Detector │  │
│  └──────┬──────┘   └──────┬───────┘   └────┬─────┘  │
│         │                 │                │        │
│  ┌──────▼─────────────────▼────────────────▼─────┐  │
│  │               SQLite (local)                  │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │         Agent Adapter Layer                   │  │
│  │   ┌─────────────┐     ┌───────────────────┐   │  │
│  │   │ Claude API  │     │  (future adapters)│   │  │
│  │   └─────────────┘     └───────────────────┘   │  │
│  └───────────────────────────────────────────────┘  │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │         GitPython — diff capture              │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Quick start

```bash
pip install steerhead

# Initialise steerhead in your project repo
cd your-project
steerhead init

# Start the local UI
steerhead run
# → open http://localhost:7331
```

Set your Anthropic API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

---

## Core features

- **Micro-level memory** — every diff the agent produces is stored alongside the agent's reasoning. Indexed per file, per function, per decision.
- **Auto context injection** — before every session, steerhead assembles a context brief from the stored memory and prepends it to the system prompt. The agent starts informed.
- **Drift detection** — steerhead compares new agent output against stored constraints and flags violations before they land in your codebase.
- **Local-first** — no cloud, no telemetry, no accounts. Your code and your reasoning stay on your machine.
- **Agent-agnostic** — Claude API is the default. Other providers slot in via adapters.
- **Git-native** — diffs are captured via GitPython. Memory is tied to git history, not chat history.

---

## Roadmap

| Status | Feature |
|--------|---------|
| v0.1 | Core memory store (diff + reasoning pairs) |
| v0.1 | Claude API adapter |
| v0.1 | Local React UI |
| v0.2 | Auto context injection |
| v0.2 | Session manager |
| v0.3 | Drift detection engine |
| v0.4 | OpenAI adapter |
| v0.5 | VS Code extension |
| v1.0 | Plugin API for custom adapters |

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR.

---

## License

MIT — see [LICENSE](./LICENSE).
