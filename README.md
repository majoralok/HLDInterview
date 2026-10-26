# ScaleSketch

**Draw. Reason. Design at scale.** ScaleSketch (formerly Architect Lab) is a local-first system design practice studio. Draw an architecture, explain your decisions, explore traffic and failures, then improve it with evidence-based AI feedback.

The upgrade draws on the three local reference projects. See [the feature comparison and naming notes](docs/reference-analysis.md) for what was adopted, the source files inspected, and the boundaries of the implementation.

The idea was inspired by [ScaleMock's system design sheet](https://www.scalemock.com/sheet/system-design). Architect Lab has its own interface, wording, question briefs, scoring flow, and implementation.

## What is included

- 30 curated HLD challenges across core patterns, infrastructure, real-time systems, data-intensive systems, and AI systems
- visual architecture canvas with 12 component types, pointer/touch dragging, background panning, zoom/fit, keyboard movement, undo/redo, and JSON import/export
- labeled directed connections with protocol, synchronous/asynchronous mode, and traffic share for cache misses or sampled work
- editable component responsibilities, replica counts, capacity, and base latency assumptions
- connectivity-aware traffic lab with bottlenecks, disconnected-node warnings, cycle detection, and component failure drills
- back-of-envelope QPS, storage, and bandwidth calculator with explicit units and assumptions
- five guided interview phases, challenge brief, design notes, and review views accessible on mobile
- grounded AI findings ranked by severity across reliability, scalability, security, cost, operability, and maintainability; invented evidence quotes are dropped server-side
- Markdown review export in the framework studio
- search plus difficulty, category, and bookmark filters
- browser-local completion, attempt, score, draft, and bookmark persistence
- portable JSON progress export and validated import (backup entries replace matching local entries)
- expandable Python pattern examples for every challenge, backed by runnable standard-library implementations
- focused practice room with a countdown timer and reusable answer framework
- offline coverage rubric that excludes untouched template prompts and reports only detected signals
- server-side AI review with strict structured output
- input size limits, same-origin checks, best-effort rate limiting, request timeout, and sanitized upstream errors
- responsive and keyboard-accessible UI
- private OpenAI Sites deployment configuration and GitHub CI

## Run locally

Prerequisites: Node.js 22.13 or newer and npm. The standalone Worker build and tests also require Python 3.11 or newer (`python` on PATH). CI uses Node.js 24 and Python 3.11.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:5173`.

AI review is optional. Add `OPENAI_API_KEY` to `.env.local`; never expose the key in browser code. You may override the default model with `OPENAI_MODEL`.

```dotenv
OPENAI_API_KEY=your-server-side-key
OPENAI_MODEL=gpt-5-mini
```

Without a key, all drawing, simulation, study, timer, notes, progress, export, and offline coverage features still work. Existing Architect Lab progress and version 1 backups remain compatible; diagrams are an optional field on each progress entry.

The traffic lab is an illustrative DAG model, not a load test. Capacities are editable assumptions, replicas scale linearly in the model, fan-in sums calls, failed components stop forwarding, and async branches do not contribute to synchronous base latency. Database write scaling, queue dynamics, automatic failover, and latency percentiles require separate reasoning. The assumptions are also visible in the interface.

For the dependency-free Worker version (no package install required), run:

```bash
npm run dev:worker
```

It builds with Python and starts on `http://127.0.0.1:8787`. Set `ARCHITECT_LAB_PORT` to use another port. This command loads `.env.local` when present.

## Python learning examples

Open a challenge and expand **Study a Python pattern**. All interview implementation examples use Python; the existing browser interface and Cloudflare runtime retain JavaScript/TypeScript.

The seven reusable models in [examples/python/patterns.py](examples/python/patterns.py) cover capacity estimation, token buckets, cursor pagination, content hashes, rank fusion, deterministic rollouts, and idempotent transfers. Each challenge explains how the pattern applies and what remains to be designed. These are focused teaching models, not complete distributed implementations.

```python
from examples.python.patterns import Ledger, TokenBucket, estimate_capacity

load = estimate_capacity(
    daily_requests=120_000_000,
    peak_factor=4,
    bytes_per_item=512,
    retention_days=30,
)
print(load)

bucket = TokenBucket(capacity=10, refill_per_second=2)
print(bucket.allow())

ledger = Ledger({"alice": 1000, "bob": 0})
ledger.transfer("payment-123", "alice", "bob", 250)
ledger.transfer("payment-123", "alice", "bob", 250)  # retry has no extra effect
assert ledger.balance("alice") == 750
```

Edit questions in [data/problems.json](data/problems.json) and lesson mappings in [scripts/build_worker.py](scripts/build_worker.py). Run `npm run build:worker` after changing Python patterns or lesson mappings; it refreshes the tracked `data/python-lessons.json` used by the framework app. Both app variants consume the same curriculum and browser logic.

## Verify a release

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Run the three framework checks together:

```bash
npm run check
```

`npm test` runs Python unit tests and HTTP integration checks against the built Worker. Node is used to execute the browser logic under test. No paid API calls or Python packages are required. `npm run check` checks the framework; run `npm test` separately.

For browser integration checks on Windows with Edge installed, start both local servers (`npm run dev` and `npm run dev:worker`) in separate terminals, then run:

```bash
node scripts/smoke-browser.mjs
```

This uses a fresh temporary Edge profile and intercepts review calls with a local fixture. It checks drawing, editing, pointer dragging, traffic controls, undo/redo, graph persistence, review payloads, and 390px layouts in both variants. Set `BROWSER_PATH` for a different installed Chromium browser, or pass a server URL to test one variant. Screenshots go to ignored `outputs/`. These checks validate integration, not the quality of a live model's judgments.

## Prepare for GitHub

```bash
python scripts/check_repository.py
git status --short
git diff --check
git diff
```

The read-only audit checks tracked and untracked source candidates for common credential patterns, large files, accidentally tracked ignored files, and missing ignore rules. Review the diff too: pattern scanning cannot identify every possible secret.

`.gitignore` excludes dependencies, compiled artifacts, local environment files, credentials, Python virtual environments and bytecode, caches, logs, personal progress backups, editor settings, and local agent state. Keep `.env.example`, `package-lock.json`, source code under `build/`, migrations, and `.openai/hosting.json`; they are reproducible project inputs. The hosting project ID is configuration, not a credential.

When ready to publish your reviewed changes:

```bash
git add .
git diff --cached --stat
git commit -m "Expand system design practice with Python patterns and safer progress tracking"
git push origin main
```

## Deploy

This repository is configured for OpenAI Sites through [`.openai/hosting.json`](.openai/hosting.json). Configure `OPENAI_API_KEY` as a hosted runtime secret; do not add it to Git, build arguments, or the hosting manifest.

The dependency-free production Worker can be built and validated without a package install:

```bash
npm run build:worker
npm run validate:worker
```

It emits `dist/server/index.js` and is the artifact used by the included Sites deployment. The Vinext source under `app/` and `components/` is the maintainable framework implementation and can also be built when dependencies are available.

To build the Vinext variant for another Cloudflare-compatible environment:

```bash
npm ci
npm run build
```

Deploy the generated Worker artifacts from `dist/` with the provider's Worker deployment process.

## Data and privacy

Progress, notes, and diagrams live in browser `localStorage` under the existing `architect-lab-progress-v1` key. They are sent nowhere unless the user requests AI review. That action sends the selected question ID, notes, and validated diagram to this app's server route. The server resolves its own trusted brief and serializes diagram structure into the review input, then calls OpenAI with `store: false`. Import and export stay in the browser. Backups contain your drafts and diagrams; keep them private.

The offline rubric measures coverage in your own notes and component rationale; generated component labels and capacity defaults do not earn coverage points. It also reports graph reachability, capacity risks, and recovery prompts. A diagram-only submission can receive a 0 coverage score despite a connected graph, because reasoning still needs to be explained. The timer accounts for elapsed wall time in background tabs. Storage failures are shown in the interface so you can export a backup.

For shared multi-user deployments, replace browser persistence with an authenticated database before promising cross-device sync. The current local-first behavior is deliberate and is clearly disclosed in the UI.

## Architecture

See [docs/architecture.md](docs/architecture.md) for system boundaries and [docs/product-evidence.md](docs/product-evidence.md) for the reference-site analysis and remaining REA limitation.

## License

MIT
