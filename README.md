# Architect Lab

Architect Lab is a local-first system design interview studio. It combines a curated roadmap with timed practice, structured answer templates, progress tracking, an offline rubric, and optional AI feedback through the OpenAI Responses API.

The product is original. ScaleMock was used only as a product-category reference; the interface, copy, question briefs, scoring flow, and implementation in this repository were created for Architect Lab.

## What is included

- 18 curated HLD challenges across core patterns, infrastructure, real-time systems, data-intensive systems, and AI systems
- search plus difficulty, category, and bookmark filters
- browser-local completion, attempt, score, draft, and bookmark persistence
- portable JSON progress export
- focused practice room with a countdown timer and reusable answer framework
- offline deterministic rubric, so the app remains useful without any paid service
- server-side AI review with strict structured output
- input size limits, same-origin checks, best-effort rate limiting, request timeout, and sanitized upstream errors
- responsive and keyboard-accessible UI
- private OpenAI Sites deployment configuration and GitHub CI

## Run locally

Prerequisites: Node.js 22.13 or newer and npm.

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

Without a key, all study, timer, notes, progress, export, and local-rubric features still work.

For the dependency-free Worker version (no package install required), run:

```bash
npm run dev:worker
```

It starts on `http://127.0.0.1:8787`. Set `ARCHITECT_LAB_PORT` to use another port.

## Verify a release

```bash
npm run typecheck
npm run lint
npm run build
```

Or run all three:

```bash
npm run check
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

Progress and drafts live in browser `localStorage` under `architect-lab-progress-v1`. They are sent nowhere unless the user clicks **AI review**. That action sends only the selected question brief and current answer to this app's server route, which then calls OpenAI with `store: false`.

For shared multi-user deployments, replace browser persistence with an authenticated database before promising cross-device sync. The current local-first behavior is deliberate and is clearly disclosed in the UI.

## Architecture

See [docs/architecture.md](docs/architecture.md) for system boundaries and [docs/product-evidence.md](docs/product-evidence.md) for the reference-site analysis and remaining REA limitation.

## License

MIT
