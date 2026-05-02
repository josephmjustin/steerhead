# Contributing to steerhead

First off — thank you. Whether this is your first open source contribution or your hundredth, we're glad you're here.

This document will get you set up and explain how contributions work. If anything is unclear, open an issue and ask. There are no dumb questions.

---

## Table of contents

- [Setting up your dev environment](#setting-up-your-dev-environment)
- [Making changes](#making-changes)
- [Pull request guidelines](#pull-request-guidelines)
- [Issue labels](#issue-labels)
- [Code style](#code-style)

---

## Setting up your dev environment

You'll need Python 3.11+ and Node 18+.

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/steerhead.git
cd steerhead

# 2. Create a virtual environment
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# 3. Install the project in editable mode with dev dependencies
pip install -e ".[dev]"

# 4. Install frontend dependencies
cd frontend
npm install
cd ..

# 5. Set your API key for local testing
export ANTHROPIC_API_KEY=sk-ant-...

# 6. Run the backend
uvicorn steerhead.main:app --reload --port 7331

# 7. In a separate terminal, run the frontend
cd frontend
npm run dev
```

---

## Making changes

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/issue-number-short-description
   ```

2. Make your changes. Keep commits small and focused — one logical change per commit.

3. Run the linters before pushing:
   ```bash
   ruff check .
   black --check .
   ```

4. If you're adding a feature, add a test. If you're fixing a bug, add a test that would have caught it.

5. Push your branch and open a pull request against `main`.

---

## Pull request guidelines

- **Title**: use the imperative mood. "Add drift detection" not "Added drift detection".
- **Description**: explain *why*, not just *what*. Link the issue it closes (`Closes #123`).
- **Size**: keep PRs focused. A PR that does one thing is easier to review and faster to merge.
- **Breaking changes**: flag them explicitly in the PR description.
- **Tests**: PRs that add features without tests will be asked to add them before merge.
- **Draft PRs**: use them if you want early feedback before the work is complete.

A maintainer will review your PR within a few days. We may ask for changes — this is normal and not a rejection.

---

## Issue labels

| Label | Meaning |
|-------|---------|
| `good first issue` | Suitable for first-time contributors. Scoped, well-defined, doesn't require deep knowledge of the codebase. |
| `bug` | Something is broken. Reproduction steps are expected in the issue. |
| `enhancement` | A new feature or improvement to existing behaviour. |
| `documentation` | Docs-only change — README, docstrings, comments. |
| `help wanted` | We'd like community input but it isn't a good-first-issue (more context needed). |
| `wontfix` | Out of scope for this project. Closed with explanation. |
| `question` | Not a bug, not a feature — needs clarification before triaging. |

If you're looking for a place to start, filter by [`good first issue`](../../issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22).

---

## Code style

We use [black](https://github.com/psf/black) for formatting and [ruff](https://github.com/astral-sh/ruff) for linting.

```bash
# Format
black .

# Lint
ruff check .

# Fix auto-fixable lint issues
ruff check --fix .
```

Both are configured in `pyproject.toml`. CI will enforce them — easier to run locally first.

- Line length: 88 (black default).
- Imports: sorted by ruff (isort-compatible).
- Type hints: required for all public functions.
- Docstrings: one-line summary only. Don't narrate the obvious.
