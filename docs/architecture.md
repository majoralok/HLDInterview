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

- `worker/index.js` is the standalone production template. `scripts/build_worker.py` injects the shared curriculum, Python lessons, and browser modules into a zero-dependency Worker artifact.
- `app/` plus `components/` is the Vinext/React implementation for framework-based development and extension.

`data/problems.json` is the single curriculum source. `examples/python/patterns.py` contains runnable teaching models; the Python builder extracts their source and combines it with the challenge-specific lesson mappings. The generated `data/python-lessons.json` is tracked for framework builds. `public/practice-core.js` owns backup validation, template exclusion, coverage scoring, and feedback validation for both interfaces. `lib/review-request.js` validates both server routes.

Both preserve the same privacy rule: only an explicit AI-review action sends the current answer to the server.

## Design choices

- **Local-first persistence:** keeps setup simple. After the page loads, editing and the local rubric need no network. Export and validated import provide a recovery path; imported entries replace matching local entries. There is no automatic cross-device synchronization or service-worker offline loading.
- **Server-side AI boundary:** the API key never enters the client bundle. The browser calls only the same-origin `/api/coach` route.
- **Structured outputs:** the coaching UI receives a stable score/summary/list/follow-up shape instead of parsing prose.
- **Offline rubric:** a deterministic fallback avoids making core practice dependent on API availability or spend.
- **Static question bank:** the curated curriculum is versioned, reviewable, and works without a database.

## Production controls

- answers are limited to 25,000 characters; request streams are capped at 128,000 bytes before JSON parsing
- question IDs resolve to the server-owned curriculum; client-supplied briefs are ignored
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
5. Add per-attempt history and rubric calibration against human-reviewed designs.
