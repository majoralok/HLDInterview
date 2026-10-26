# Architect Lab: Architecture and Debugging Guide

Architect Lab is a local-first system-design interview practice application. The easiest way to understand it is as three layers: curriculum data, browser practice logic, and optional server-side AI review.

## High-level architecture

```text
data/problems.json
        |
        v
lib/problem-bank.ts
        |
        v
app/page.tsx --------> PracticeStudio
                         |
                         |-- filters/questions/timer/editor
                         |-- progress and drafts -> localStorage
                         |-- offline rubric -> practice-core.js
                         |
                         `-- AI review
                                  |
                                  v
                           POST /api/coach
                                  |
                           validate request
                           rate-limit client
                                  |
                                  v
                         OpenAI Responses API
                                  |
                         validate structured result
                                  |
                                  v
                          feedback in browser
```

## 1. Application entry point

The root page is intentionally small:

- `app/page.tsx`

```tsx
export default function Home() {
  return <PracticeStudio problems={problemBank} />;
}
```

The startup flow is:

1. Load the static question bank.
2. Pass all questions into `PracticeStudio`.
3. Let `PracticeStudio` handle nearly all user-interface and browser behavior.

The global HTML wrapper, page metadata, and global stylesheet are configured in `app/layout.tsx`.

## 2. Curriculum and data model

`data/problems.json` is the source of truth for the 30 design challenges.

`lib/problem-bank.ts` defines the TypeScript structure:

```ts
type DesignProblem = {
  id: string;
  order: number;
  title: string;
  shortTitle: string;
  summary: string;
  difficulty: Difficulty;
  category: Category;
  minutes: number;
  focus: string[];
  scale: string;
  requirements: string[];
  constraints: string[];
  checkpoints: string[];
  interviewerPush: string;
};
```

Important fields:

| Field | Used for |
|---|---|
| `id` | Stable identifier for progress, drafts, API validation, and lessons |
| `difficulty`, `category` | Question filtering |
| `minutes` | Initial practice timer value |
| `focus` | Important deep-dive topics and the starter template |
| `requirements`, `constraints` | Challenge detail screen |
| `checkpoints` | Interview-room sidebar |
| `interviewerPush` | Follow-up question and local-rubric output |

When adding a question, its ID must also have a lesson mapping in `scripts/build_worker.py`. Tests enforce the one-to-one relationship.

## 3. Main browser component

Most application behavior lives in `components/practice-studio.tsx`.

It begins with `"use client"` because it needs browser-only capabilities:

- React state and effects
- `localStorage`
- timers
- keyboard events
- file import and export
- network requests

### Important state

| State | Meaning |
|---|---|
| `progress` | Per-question status, score, attempts, bookmark, and draft |
| `selectedId` | Question currently displayed |
| `query` | Search text |
| `difficulty`, `category` | Active filters |
| `bookmarksOnly` | Whether only saved questions appear |
| `mockOpen` | Whether the practice-room modal is open |
| `secondsLeft`, `running` | Timer state |
| `answer` | Current editor contents |
| `feedback` | Local or AI review |
| `reviewing` | Whether an AI request is in progress |
| `reviewError` | User-visible review error |
| `hydrated` | Prevents saved data from being overwritten before it loads |

### Progress record

```ts
type ProgressEntry = {
  status: "todo" | "in_progress" | "done";
  bookmarked: boolean;
  score?: number;
  attempts: number;
  lastPracticed?: string;
  draft?: string;
};
```

The browser stores a map shaped like:

```json
{
  "chat": {
    "status": "done",
    "bookmarked": true,
    "score": 82,
    "attempts": 2,
    "lastPracticed": "2026-10-20T10:00:00.000Z",
    "draft": "My proposed architecture..."
  }
}
```

The storage key is:

```text
architect-lab-progress-v1
```

Inspect it in Chrome or Edge under:

```text
Developer Tools
-> Application
-> Local Storage
-> http://localhost:5173
-> architect-lab-progress-v1
```

## 4. Browser startup flow

The first effect in `PracticeStudio` loads saved progress:

```text
Component mounts
    |
    v
Read localStorage
    |
    v
JSON.parse
    |
    v
parseProgress validates every recognized entry
    |
    v
Set React progress state
    |
    v
Mark hydration complete
```

The second effect saves `progress` whenever it changes.

The `hydrated` guard is important. Without it, the initial empty state could overwrite existing browser progress before the initial read completes.

`parseProgress()` also drops unknown question IDs and unexpected fields, preventing malformed imported data from becoming application state.

## 5. Question selection and filtering

The filtered question list is calculated with `useMemo()` in `components/practice-studio.tsx`.

It checks:

```text
Text search
AND selected difficulty
AND selected category
AND bookmark requirement
```

The text search covers the title, summary, category, and focus topics.

`patchProgress()` performs immutable state updates:

```ts
setProgress((current) => ({
  ...current,
  [id]: {
    ...(current[id] ?? emptyProgress()),
    ...patch,
  },
}));
```

The functional state update uses the latest React state rather than a potentially stale value captured by an earlier render.

## 6. Starting a practice session

`openMock()` is the main transition into the practice room:

```text
Select problem
    |
    v
Load saved draft or create starter template
    |
    v
Reset timer using problem.minutes
    |
    v
Clear previous feedback and errors
    |
    v
Start timer and open modal
    |
    v
Change status from todo to in_progress
```

The starter template contains seven sections:

1. Scope and assumptions
2. Capacity estimates
3. API and data model
4. High-level design
5. Deep dive
6. Reliability and operations
7. Trade-offs

Every editor change calls `saveDraft()`. That updates the current `answer` and the current progress entry. The progress persistence effect subsequently writes the updated map to `localStorage`.

## 7. Timer implementation

The timer fires every 250 milliseconds but does not blindly subtract one second per interval. It compares `Date.now()` with the previous timestamp:

```ts
const elapsed = Math.floor((now - last) / 1000);
setSecondsLeft((value) => Math.max(0, value - elapsed));
```

This design handles background-tab throttling. If the browser suspends timers for ten seconds, the next callback subtracts approximately ten seconds rather than one.

Useful timer debugging points:

- the interval callback
- the effect that stops the timer at zero
- the timer reset button
- the `running` and `secondsLeft` state values

## 8. Offline review flow

The offline rubric is implemented in `public/practice-core.js`.

First, `writtenAnswer()` removes unchanged starter-template lines. This stops the template itself from satisfying the minimum-answer requirement.

Then `localAssessment()` requires at least 120 non-whitespace characters and looks for six categories:

- capacity estimates
- API or event contracts
- storage decisions
- failure recovery
- security boundaries
- alternatives and trade-offs

Its score is based on detected keywords and answer length:

```js
hits.length * 12 + lengthBonus
```

This is a coverage checker, not a correctness evaluator. An architecturally incorrect answer could receive a good local score if it contains the expected vocabulary.

When debugging local review, inspect:

- the raw `answer`
- the template-stripped content
- detected and missing criteria
- calculated score
- the progress entry before and after completion

## 9. AI review flow

The browser function is `requestAiReview()` in `components/practice-studio.tsx`.

It sends:

```json
{
  "problem": {
    "id": "chat"
  },
  "answer": "Candidate's complete answer"
}
```

The browser sends only the problem ID, not a trusted problem definition.

### Server-side flow

The endpoint is `app/api/coach/route.ts`:

```text
POST /api/coach
    |
    v
readReviewRequest()
    |-- same-origin check
    |-- Content-Type check
    |-- 128 KB request-stream limit
    |-- JSON validation
    |-- answer-length validation
    `-- trusted problem lookup
    |
    v
Rate limit: 8 reviews per 10 minutes
    |
    v
Check OPENAI_API_KEY
    |
    v
Call OpenAI Responses API
    |-- 45-second timeout
    |-- store: false
    `-- strict JSON schema
    |
    v
Extract output text
    |
    v
Parse and validate result
    |
    v
Return review to browser
```

Request validation is shared through `lib/review-request.js`.

The most important trust-boundary decision is:

```js
const problem = problems.find((item) => item.id === body.problem?.id);
return { problem, answer: body.answer };
```

The server ignores client-supplied titles, requirements, and instructions. It uses the supplied ID to retrieve the trusted server-owned problem. This prevents a browser from replacing the problem brief with injected instructions.

### AI response contract

The model must return:

```json
{
  "score": 0,
  "summary": "...",
  "strengths": ["..."],
  "improvements": ["..."],
  "followUp": "..."
}
```

The structured-output schema constrains the model response. `isReview()` then validates it again before the server or client trusts it.

## 10. Expected API failures

When debugging `/api/coach`, inspect the request in the browser Network tab and check its status and JSON response.

| Status | Likely reason |
|---|---|
| `400` | Bad JSON, unknown problem, or invalid answer |
| `403` | Cross-origin request |
| `413` | Request larger than 128 KB |
| `415` | Content type is not `application/json` |
| `429` | Local review limit or upstream OpenAI quota |
| `502` | Invalid response, timeout, or upstream failure |
| `503` | Missing or rejected API key |

For local AI reviews, `.env.local` needs:

```dotenv
OPENAI_API_KEY=your-server-side-key
OPENAI_MODEL=gpt-5-mini
```

Restart the development server after changing environment variables.

## 11. Two application implementations

The repository contains two delivery paths.

### Framework path

```text
app/
components/
lib/
vite.config.ts
build/sites-worker.ts
```

This is the React/Vinext version used for maintainable development.

Run it with:

```powershell
npm run dev
```

Open `http://localhost:5173`.

### Standalone Worker path

```text
worker/index.js
public/worker-app.js
scripts/build_worker.py
dist/server/index.js
```

Run it with:

```powershell
npm run dev:worker
```

Open `http://127.0.0.1:8787`.

The Python build script injects the following into the standalone Worker artifact:

- problems
- lessons
- shared browser core
- Worker-specific browser application

Do not debug or manually modify `dist/server/index.js`; it is generated. Modify the source files and run:

```powershell
npm run build:worker
```

### Main maintenance risk

Only some logic is shared.

Shared:

- curriculum
- Python lesson generation
- backup validation
- local rubric
- request validation

Duplicated:

- React UI versus `public/worker-app.js`
- framework API route versus the Worker review function
- response schema and AI instructions

A UI or AI behavior change may need to be applied to both paths. This is the first place to look when something works on port `5173` but behaves differently on port `8787`.

## 12. Python lesson generation

`examples/python/patterns.py` contains reusable teaching implementations, including:

- capacity estimation
- token buckets
- cursor pagination
- content hashes
- reciprocal rank fusion
- deterministic rollouts
- idempotent transfers

`scripts/build_worker.py` parses that file with Python's `ast` module, extracts the required function or class source, and creates `data/python-lessons.json`.

The build fails if the lesson IDs do not exactly match the problem IDs. This prevents a challenge from being published without corresponding learning material.

## 13. Currently unused or optional scaffolding

These files support future hosted capabilities but are not central to the current practice flow:

- `db/schema.ts`: intentionally empty database schema
- `db/index.ts`: optional Cloudflare D1 access
- `app/chatgpt-auth.ts`: hosted ChatGPT user-header helpers
- `lib/connectors.ts`: request-scoped connector support

Current user progress does not use authentication or a database. It remains in the browser.

## 14. Practical debugging sequence

### UI problem

1. Run `npm run dev`.
2. Open browser Developer Tools.
3. Put breakpoints in `openMock()`, `saveDraft()`, or `finishLocally()`.
4. Inspect the React state values.
5. Inspect `architect-lab-progress-v1` in Local Storage.
6. Confirm that the selected question ID exists in `data/problems.json`.

### AI-review problem

1. Put a breakpoint in `requestAiReview()`.
2. Inspect the `/api/coach` request in the Network tab.
3. Check the response status and JSON body.
4. Put a breakpoint or temporary log in the `POST()` route.
5. Step through `readReviewRequest()`.
6. Verify that `OPENAI_API_KEY` is visible only to the server.
7. Inspect the upstream OpenAI status.
8. Confirm that `readOutputText()` and `isReview()` accept the response.

### Standalone Worker problem

1. Modify source files, never `dist/`.
2. Run `npm run build:worker`.
3. Run `npm run validate:worker`.
4. Test `/api/health`.
5. Compare the behavior with the framework server.

## 15. Verification commands

Run the browser, Worker, and learning-model tests with:

```powershell
npm test
```

Check TypeScript types with:

```powershell
npm run typecheck
```

Run the complete framework verification with:

```powershell
npm run check
```

Build and validate the standalone Worker with:

```powershell
npm run build:worker
npm run validate:worker
```

At the time this guide was written, all 19 automated tests and the TypeScript typecheck passed.
