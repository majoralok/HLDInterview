# Reference analysis and product upgrade

The three local checkouts were inspected as source repositories. Their code and runtimes were not merged wholesale. The new workbench, graph engine, and shared review contract are original implementations within HLDInterview's existing browser/Worker architecture; no new runtime dependency was added.

| Reference | Source evidence inspected | Strong idea | Integration |
| --- | --- | --- | --- |
| [SystemDesign.ai](https://github.com/ccd97/SystemDesign.ai) | `SystemDesign.ai-main/README.md`, `src/features/judge/api/buildJudgePrompt.ts`, recorder and canvas source layout | Judge the actual diagram together with the candidate's explanation; guided interview practice | Diagram + notes are submitted together. Component rationale is editable and saved. Interview phases guide scope, estimates, contracts, drawing, and defense. |
| [SystemForge / system-design-simulator](https://github.com/vijaygupta18/system-design-simulator) | `system-design-simulator-main/src/engine/simulator.ts`, `src/scoring/scorer.ts`, component/concept data, interview UI | Connectivity matters; use traffic and failure experiments to teach architecture | The shared engine traces entry paths, distinguishes disconnected components, splits balancer traffic, models fan-out and cache-miss fractions, excludes async work from base sync latency, and refuses to estimate reachable cycles. Component guidance explains decisions. |
| arch-review | `arch-review-main/src/arch_review/reviewer.py`, `prompts.py`, `models.py`, README and eval descriptions | Severity-ranked actionable risks with evidence; reject invented quotes; calibrate rather than reward complexity | Shared strict review schema + instructions, server grounding pass, severity ordering, omission markers, findings UI, and deterministic fixtures that exercise grounding and request validation. |

Local reference folders remain on disk. They are excluded from the main app's TypeScript, ESLint, and Git inputs, so unrelated Electron/Python dependencies are not accidentally built or published. The user's existing `arch.md` is preserved.

## Learning loop

1. Choose one of the existing 30 challenges and read its scale, requirements, and constraints.
2. Follow the interview phases. Add components, connect them, and annotate their responsibilities and rationale.
3. Estimate the load and change offered traffic. Observe bottlenecks, graph gaps, and capacity assumptions.
4. Fail a component and explain the recovery strategy. The model itself does not implement failover.
5. Write API contracts, data keys, consistency decisions, and alternatives in Design notes.
6. Run a private offline coverage check or explicitly submit diagram + notes for AI review.
7. Inspect severity, evidence, and recommendations; revise and review again. Export notes/progress/diagrams or the framework review as needed.

## Review contract

The server validates graph shape and size, known component types, unique IDs, coordinates, replicas, finite capacity/latency/traffic values, edge endpoints, protocol, mode, and traffic fractions. It resolves the challenge brief from its own bank and builds the diagram text itself.

The model returns a score, summary, strengths, improvements, follow-up, and up to 12 findings across six review dimensions. Each finding includes severity, title, evidence, and recommendation. Only quotes that occur in the submitted design survive grounding (case and whitespace normalized); omissions must use the explicit `general` marker. The UI calls those omissions unspecified in the submission.

The [official Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) informed the strict JSON schema. Grounding checks that quoted evidence exists; it cannot prove that a recommendation is correct or that an omission is a real production flaw. Offline regression fixtures test serialization and grounding. Live-model recall, false-positive rate, and human calibration are not measured by these fixtures.

## Deliberate boundaries

- Voice recording/transcription and time-aligned session replay from SystemDesign.ai are not implemented in this upgrade. They require a distinct recording workflow and provider configuration.
- No reference solution is silently inserted into a learner's draft. The starter path is only client → service → database.
- Capacities are teaching assumptions, not measured hardware or vendor specifications. Replica scaling is linear in this model; real database writes and shared resources require separate treatment.
- The graph engine is a DAG model. It reports reachable cycles rather than inventing traffic or latency results. Replies are not separate arrows on the request graph.
- Offline scores measure written coverage only; disconnected or merely present components do not earn coverage points.
- Existing browser storage and v1 backups are retained. Progress does not sync across devices. Complete review history is not persisted; framework reviews can be exported as Markdown.

## Naming

**ScaleSketch** is the implemented working name: short, easy to say, and tied to the drawing/scale learning loop. Tagline: **Draw. Reason. Design at scale.**

Other options: **DraftScale** (architecture iteration), **ScaleRehearsal** (interview practice), or keeping **Architect Lab** (continuity). A basic web search found unrelated existing ScaleSketch usage, including an [AI startup mention on its cofounder's profile](https://cal.com/aether-a1); the working name is not a claim of commercial or domain availability. No GitHub repository, hosting identity, or URL has been renamed.
