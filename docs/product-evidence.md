# Reference product evidence

This note separates observable behavior from product decisions. It is not a source-code reconstruction.

## Observed from public ScaleMock pages

- The public product describes HLD and LLD practice sheets with 25, 75, and 150-problem tracks.
- It advertises topic progression, company tags, progress tracking, AI mock interviews, and AI design feedback.
- Its public FAQ says progress is browser-scoped rather than cloud-synchronized.
- Individual public problem pages expose a title, difficulty, tags, a problem statement, functional requirements, non-functional requirements, and—on LLD pages—implementation expectations.

Sources:

- https://www.scalemock.com/
- https://www.scalemock.com/sheet/system-design
- https://www.scalemock.com/hld/design-vpn
- https://www.scalemock.com/lld/car-rental

## Product inferences

- A useful local alternative needs a browsable curriculum, clear progression, persistent progress, and a focused problem workspace.
- AI feedback should be an enhancement rather than a hard dependency.
- A practice loop benefits from explicit checkpoints and an interviewer pressure test, not only a static solution article.

These are design inferences, not claims about ScaleMock's implementation.

## Unknowns and REA status

The active Codex session did not expose REA MCP tools. The local Codex configuration contains a version-pinned REA MCP registration, but the sandbox could not fetch or execute the package and npm returned an access error. A restarted Codex session with the REA server connected is needed for runtime DOM, accessibility, listener, or network evidence. No claim in this repository depends on unobserved private implementation details.
