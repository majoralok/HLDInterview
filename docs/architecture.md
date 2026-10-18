# Architecture

## Runtime shape

```text
Browser
  ├─ roadmap, filters, timer, editor
  ├─ localStorage progress + drafts
  └─ POST /api/coach (explicit action only)
                 │
                 ▼
Cloudflare Worker / Vinext server
  ├─ validates origin, shape, and size
  ├─ applies best-effort per-isolate throttling
  ├─ keeps OPENAI_API_KEY server-side
  └─ POST https://api.openai.com/v1/responses
                 │
                 ▼
Structured review JSON → validation → browser
```

Two delivery paths implement this boundary:

- `worker/index.js` is the zero-dependency production artifact source used when a hermetic build is required.
- `app/` plus `components/` is the Vinext/React implementation for framework-based development and extension.

Both preserve the same privacy rule: only an explicit AI-review action sends the current answer to the server.

## Design choices

- **Local-first persistence:** keeps setup simple and the app genuinely useful offline. Export provides a recovery path. It does not claim cross-device synchronization.
- **Server-side AI boundary:** the API key never enters the client bundle. The browser calls only the same-origin `/api/coach` route.
- **Structured outputs:** the coaching UI receives a stable score/summary/list/follow-up shape instead of parsing prose.
- **Offline rubric:** a deterministic fallback avoids making core practice dependent on API availability or spend.
- **Static question bank:** the curated curriculum is versioned, reviewable, and works without a database.

## Production controls

- request bodies are limited to 25,000 characters
- cross-origin review calls are rejected
- upstream requests time out after 45 seconds
- upstream authentication details are not returned to clients
- OpenAI responses are requested with `store: false`
- review responses send `cache-control: no-store`
- a private Sites deployment supplies a platform authentication boundary

The in-memory limiter is intentionally best-effort because Worker isolates do not share memory. For a public high-volume launch, replace it with a durable edge rate limiter and add authenticated per-user quotas.

## Extension points

1. Add D1/Postgres persistence keyed by authenticated user ID for cross-device sync.
2. Add a diagram canvas and store its serialized graph with each attempt.
3. Add voice input through a realtime API as a separate, permissioned feature.
4. Add team rubrics and anonymized calibration sets for evaluator quality.
5. Add import validation for exported progress files.
