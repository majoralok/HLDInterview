"use client";

import {
  ArrowRight,
  Bookmark,
  Check,
  Circle,
  Clock3,
  Download,
  Flame,
  Gauge,
  LayoutDashboard,
  Menu,
  Play,
  Search,
  Sparkles,
  Target,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Category, DesignProblem, Difficulty } from "@/lib/problem-bank";
import { DesignSession } from "./design-session";
import { emptyDiagram, designSubmission } from "@/public/architecture-core.js";
import type { Diagram } from "@/public/architecture-core.js";
import type { Feedback } from "@/public/practice-core.js";
import lessons from "@/data/python-lessons.json";
import { parseProgress, parseImport, MAX_IMPORT_BYTES, localAssessment, writtenAnswer, isFeedback } from "@/public/practice-core.js";

type ProgressStatus = "todo" | "in_progress" | "done";
type ProgressEntry = {
  status: ProgressStatus;
  bookmarked: boolean;
  score?: number;
  attempts: number;
  lastPracticed?: string;
  draft?: string;
  diagram?: Diagram;
};
type ProgressMap = Record<string, ProgressEntry>;
const STORAGE_KEY = "architect-lab-progress-v1";
const emptyProgress = (): ProgressEntry => ({ status: "todo", bookmarked: false, attempts: 0 });

const statusLabel: Record<ProgressStatus, string> = {
  todo: "Not started",
  in_progress: "In progress",
  done: "Completed",
};

function nextStatus(status: ProgressStatus): ProgressStatus {
  if (status === "todo") return "in_progress";
  if (status === "in_progress") return "done";
  return "todo";
}

function starterTemplate(problem: DesignProblem) {
  return `1. SCOPE & ASSUMPTIONS\n- Clarify users, use cases, exclusions, and consistency needs.\n\n2. CAPACITY ESTIMATES\n- Traffic, storage, bandwidth, and growth assumptions.\n\n3. API & DATA MODEL\n- Key endpoints/events, entities, indexes, and idempotency.\n\n4. HIGH-LEVEL DESIGN\n- Request flow and responsibilities of each component.\n\n5. DEEP DIVE\n- ${problem.focus.join("; ")}\n\n6. RELIABILITY & OPERATIONS\n- Failure modes, observability, recovery, security, and cost.\n\n7. TRADE-OFFS\n- Alternatives considered and why this design fits the stated constraints.`;
}

export function PracticeStudio({ problems }: { problems: DesignProblem[] }) {
  const [progress, setProgress] = useState<ProgressMap>({});
  const [selectedId, setSelectedId] = useState(problems[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "All">("All");
  const [category, setCategory] = useState<Category | "All">("All");
  const [bookmarksOnly, setBookmarksOnly] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [mockOpen, setMockOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(45 * 60);
  const [running, setRunning] = useState(false);
  const [answer, setAnswer] = useState("");
  const [diagram, setDiagram] = useState<Diagram>(emptyDiagram);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setProgress(parseProgress(JSON.parse(saved), problems.map((problem) => problem.id)));
    } catch {
      setStorageMessage("Saved progress could not be read. Import a backup, or export your new progress before closing this page.");
    }
    setHydrated(true);
  }, [problems]);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); }
    catch { setStorageMessage("Browser storage is unavailable or full. Export your progress before closing this page."); }
  }, [progress, hydrated]);

  useEffect(() => {
    if (!running) return;
    let last = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = Math.floor((now - last) / 1000);
      last += elapsed * 1000;
      setSecondsLeft((value) => Math.max(0, value - elapsed));
    }, 250);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => { if (secondsLeft === 0) setRunning(false); }, [secondsLeft]);

  const closeMock = useCallback(() => {
    if (reviewing) return;
    setRunning(false);
    setMockOpen(false);
  }, [reviewing]);

  useEffect(() => {
    if (!mockOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, [mockOpen]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && mockOpen) closeMock();
      if (event.key === "Tab" && mockOpen && dialog.current) {
        const controls = Array.from(dialog.current.querySelectorAll<HTMLElement>("button:not(:disabled), textarea:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex='0']"))
          .filter((element) => element.getClientRects().length);
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeMock, mockOpen]);

  const selected = problems.find((problem) => problem.id === selectedId) ?? problems[0];
  const lesson = lessons[selected.id as keyof typeof lessons];
  const selectedProgress = progress[selected.id] ?? emptyProgress();
  const completed = Object.values(progress).filter((item) => item.status === "done").length;
  const attempted = Object.values(progress).filter((item) => item.attempts > 0).length;
  const scored = Object.values(progress).filter((item) => typeof item.score === "number");
  const averageScore = scored.length
    ? Math.round(scored.reduce((sum, item) => sum + (item.score ?? 0), 0) / scored.length)
    : 0;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return problems.filter((problem) => {
      const matchesText = !needle || [problem.title, problem.summary, problem.category, ...problem.focus]
        .join(" ")
        .toLowerCase()
        .includes(needle);
      return matchesText
        && (difficulty === "All" || problem.difficulty === difficulty)
        && (category === "All" || problem.category === category)
        && (!bookmarksOnly || progress[problem.id]?.bookmarked);
    });
  }, [bookmarksOnly, category, difficulty, problems, progress, query]);

  function patchProgress(id: string, patch: Partial<ProgressEntry>) {
    setProgress((current) => ({
      ...current,
      [id]: { ...(current[id] ?? emptyProgress()), ...patch },
    }));
  }

  function openMock(problem: DesignProblem) {
    setSelectedId(problem.id);
    const entry = progress[problem.id] ?? emptyProgress();
    setAnswer(entry.draft ?? starterTemplate(problem));
    setDiagram(entry.diagram ?? emptyDiagram());
    setSecondsLeft(problem.minutes * 60);
    setFeedback(null);
    setReviewError("");
    setRunning(true);
    setMockOpen(true);
    patchProgress(problem.id, { status: entry.status === "todo" ? "in_progress" : entry.status });
  }

  function saveDraft(value: string) {
    setAnswer(value);
    patchProgress(selected.id, { draft: value });
  }

  function finishLocally() {
    if (reviewing) return;
    let review: Feedback;
    try { review = localAssessment(answer, selected, starterTemplate(selected), diagram); }
    catch (error) { setReviewError(error instanceof Error ? error.message : "Could not assess this answer."); return; }
    setReviewError("");
    const score = review.score;
    const entry = progress[selected.id] ?? emptyProgress();
    patchProgress(selected.id, {
      draft: answer,
      score,
      status: "done",
      attempts: entry.attempts + 1,
      lastPracticed: new Date().toISOString(),
    });
    setFeedback(review);
    setRunning(false);
  }

  async function requestAiReview() {
    if (reviewing) return;
    if (writtenAnswer(designSubmission(answer, diagram), starterTemplate(selected)).replace(/\s/g, "").length < 120) {
      setReviewError("Write at least 120 non-whitespace characters of your own design before requesting feedback.");
      return;
    }
    setReviewing(true);
    setReviewError("");
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ problem: { id: selected.id }, answer, diagram }),
      });
      const payload = (await response.json()) as Feedback & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Review failed. Try again.");
      if (!isFeedback(payload)) throw new Error("The reviewer returned invalid feedback.");
      setFeedback(payload);
      const entry = progress[selected.id] ?? emptyProgress();
      patchProgress(selected.id, {
        draft: answer,
        score: payload.score,
        status: "done",
        attempts: entry.attempts + 1,
        lastPracticed: new Date().toISOString(),
      });
      setRunning(false);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Review failed. Try again.");
    } finally {
      setReviewing(false);
    }
  }

  function exportProgress() {
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: 1,
      progress,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `scalesketch-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importProgress(file?: File) {
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error("Progress files must be smaller than 1 MB.");
      const imported = parseImport(await file.text(), problems.map((problem) => problem.id));
      setProgress((current) => ({ ...current, ...imported }));
      setStorageMessage(`Imported ${Object.keys(imported).length} challenges. Backup entries replace matching local entries.`);
    } catch (error) { setStorageMessage(error instanceof Error ? error.message : "Could not import this backup."); }
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]" data-ready={hydrated ? "true" : "false"}>
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color:var(--canvas)/88%] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between px-5 lg:px-8">
          <a href="#top" className="group flex items-center gap-3" aria-label="ScaleSketch home">
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--ink)] text-[var(--lime)] shadow-[4px_4px_0_var(--lime)] transition-transform group-hover:-translate-y-0.5">
              <LayoutDashboard size={20} strokeWidth={2.4} />
            </span>
            <span>
              <span className="block font-[var(--font-display)] text-lg font-bold leading-none tracking-tight">ScaleSketch</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted-ink)]">System design studio</span>
            </span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-semibold md:flex" aria-label="Primary navigation">
            <a className="nav-link active" href="#roadmap">Roadmap</a>
            <a className="nav-link" href="#practice">Practice room</a>
            <a className="nav-link" href="#progress">Progress</a>
          </nav>
          <div className="flex items-center gap-2">
            <input ref={importInput} type="file" accept="application/json,.json" className="hidden" onChange={(event) => { void importProgress(event.target.files?.[0]); event.target.value = ""; }} />
            <button className="icon-button" onClick={() => importInput.current?.click()} aria-label="Import progress" title="Import a backup; matching entries replace local entries">
              <Upload size={18} />
            </button>
            <button className="icon-button" onClick={exportProgress} aria-label="Export progress" title="Export progress">
              <Download size={18} />
            </button>
            <button className="primary-button hidden sm:inline-flex" onClick={() => openMock(selected)}>
              Start a mock <ArrowRight size={16} />
            </button>
            <button className="icon-button md:hidden" onClick={() => setMobileMenu((value) => !value)} aria-label="Toggle menu">
              {mobileMenu ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
        {mobileMenu && (
          <nav className="border-t border-[var(--line)] px-5 py-4 text-sm font-semibold md:hidden" aria-label="Mobile navigation">
            <div className="mx-auto flex max-w-[1480px] flex-col gap-3">
              <a href="#roadmap" onClick={() => setMobileMenu(false)}>Roadmap</a>
              <a href="#practice" onClick={() => setMobileMenu(false)}>Practice room</a>
              <button className="primary-button mt-1 justify-center" onClick={() => { setMobileMenu(false); openMock(selected); }}>Start a mock</button>
            </div>
          </nav>
        )}
      </header>

      <main id="top">
        {storageMessage && <p role="status" className="bg-[var(--orange-wash)] px-5 py-3 text-sm">{storageMessage}</p>}
        <section className="hero-grid mx-auto max-w-[1480px] px-5 pb-12 pt-12 lg:px-8 lg:pb-16 lg:pt-20">
          <div className="max-w-4xl">
            <div className="eyebrow"><Sparkles size={14} /> Your interview training ground</div>
            <h1 className="mt-6 max-w-4xl font-[var(--font-display)] text-[clamp(3.1rem,7vw,7rem)] font-black leading-[0.88] tracking-[-0.06em]">
              Think clearly.<br />Design <span className="text-[var(--orange)]">at scale.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--muted-ink)] lg:text-xl">
              Draw the system. Trace the requests. Defend the trade-offs. Turn 30 real-world challenges into deliberate practice with a visual canvas, traffic experiments, and evidence-based AI review.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button className="primary-button large" onClick={() => openMock(selected)}><Play size={17} fill="currentColor" /> Begin practice</button>
              <a className="secondary-button large" href="#roadmap">Explore roadmap <ArrowRight size={17} /></a>
            </div>
          </div>

          <div className="hero-panel" id="progress">
            <div className="flex items-start justify-between">
              <div>
                <p className="overline text-[var(--lime)]">Current sprint</p>
                <h2 className="mt-2 font-[var(--font-display)] text-2xl font-bold">Build the habit</h2>
              </div>
              <span className="grid size-11 place-items-center rounded-full border border-white/15 bg-white/5 text-[var(--lime)]"><Flame size={21} /></span>
            </div>
            <div className="mt-8 flex items-end gap-3">
              <span className="font-[var(--font-display)] text-7xl font-black leading-none">{completed}</span>
              <span className="pb-2 text-sm text-white/55">of {problems.length}<br />completed</span>
            </div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[var(--lime)] transition-all duration-500" style={{ width: `${(completed / problems.length) * 100}%` }} />
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="metric-tile"><Target size={17} /><span className="metric-value">{attempted}</span><span className="metric-label">attempted</span></div>
              <div className="metric-tile"><Gauge size={17} /><span className="metric-value">{averageScore || "—"}</span><span className="metric-label">avg. score</span></div>
            </div>
            <p className="mt-6 border-t border-white/10 pt-5 text-xs leading-5 text-white/45">Progress stays in this browser. Export it anytime as a portable JSON file.</p>
          </div>
        </section>

        <section id="roadmap" className="border-y border-[var(--line)] bg-[var(--paper)]">
          <div className="mx-auto max-w-[1480px] px-5 py-12 lg:px-8 lg:py-16">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div>
                <p className="overline">Curated roadmap</p>
                <h2 className="section-title">Choose your next design.</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-[var(--muted-ink)]">Start with fundamentals, then move into ambiguous, failure-heavy systems. Every brief includes an interviewer pressure test.</p>
            </div>

            <div className="mt-9 grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto_auto_auto]">
              <label className="search-box">
                <Search size={18} />
                <span className="sr-only">Search challenges</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by system or concept..." />
              </label>
              <select className="filter-select" value={difficulty} onChange={(event) => setDifficulty(event.target.value as Difficulty | "All")} aria-label="Filter by difficulty">
                <option>All</option><option>Foundation</option><option>Intermediate</option><option>Advanced</option>
              </select>
              <select className="filter-select" value={category} onChange={(event) => setCategory(event.target.value as Category | "All")} aria-label="Filter by category">
                <option>All</option><option>Core patterns</option><option>Data intensive</option><option>Real time</option><option>Infrastructure</option><option>AI systems</option>
              </select>
              <button className={`filter-button ${bookmarksOnly ? "selected" : ""}`} onClick={() => setBookmarksOnly((value) => !value)} aria-pressed={bookmarksOnly}>
                <Bookmark size={16} fill={bookmarksOnly ? "currentColor" : "none"} /> Saved
              </button>
            </div>

            <div className="mt-6 grid min-h-[720px] overflow-hidden rounded-[28px] border border-[var(--line)] bg-[var(--canvas)] shadow-[0_24px_80px_rgba(17,25,21,0.07)] lg:grid-cols-[390px_minmax(0,1fr)]" id="practice">
              <div className="border-b border-[var(--line)] lg:border-b-0 lg:border-r">
                <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted-ink)]">{filtered.length} challenges</span>
                  <span className="text-xs text-[var(--muted-ink)]">Click circle to update</span>
                </div>
                <div className="max-h-[420px] overflow-y-auto p-2 lg:max-h-[720px]">
                  {filtered.map((problem) => {
                    const item = progress[problem.id] ?? emptyProgress();
                    const isSelected = selected.id === problem.id;
                    return (
                      <article key={problem.id} className={`challenge-row ${isSelected ? "selected" : ""}`}>
                        <button
                          className={`status-button ${item.status}`}
                          onClick={() => patchProgress(problem.id, { status: nextStatus(item.status) })}
                          aria-label={`Set ${problem.title} status; currently ${statusLabel[item.status]}`}
                          title={statusLabel[item.status]}
                        >
                          {item.status === "done" ? <Check size={15} /> : <Circle size={15} fill={item.status === "in_progress" ? "currentColor" : "none"} />}
                        </button>
                        <button className="min-w-0 flex-1 text-left" onClick={() => setSelectedId(problem.id)}>
                          <span className="block truncate text-sm font-bold">{problem.order.toString().padStart(2, "0")} · {problem.shortTitle}</span>
                          <span className="mt-1 flex items-center gap-2 text-[11px] text-[var(--muted-ink)]"><span>{problem.difficulty}</span><span aria-hidden="true">•</span><span>{problem.minutes} min</span>{typeof item.score === "number" && <><span aria-hidden="true">•</span><strong>{item.score}/100</strong></>}</span>
                        </button>
                        <button className="row-bookmark" onClick={() => patchProgress(problem.id, { bookmarked: !item.bookmarked })} aria-label={item.bookmarked ? "Remove bookmark" : "Bookmark challenge"}>
                          <Bookmark size={15} fill={item.bookmarked ? "currentColor" : "none"} />
                        </button>
                      </article>
                    );
                  })}
                  {!filtered.length && <div className="p-10 text-center text-sm text-[var(--muted-ink)]">No challenges match those filters.</div>}
                </div>
              </div>

              <article className="flex min-w-0 flex-col p-6 sm:p-9 lg:p-12">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`difficulty-pill ${selected.difficulty.toLowerCase()}`}>{selected.difficulty}</span>
                  <span className="soft-pill">{selected.category}</span>
                  <span className="soft-pill"><Clock3 size={13} /> {selected.minutes} min</span>
                </div>
                <div className="mt-7 flex items-start justify-between gap-6">
                  <div>
                    <p className="overline">Challenge {selected.order.toString().padStart(2, "0")}</p>
                    <h3 className="mt-3 max-w-3xl font-[var(--font-display)] text-4xl font-bold leading-tight tracking-[-0.035em] sm:text-5xl">{selected.title}</h3>
                  </div>
                  <button className={`icon-button shrink-0 ${selectedProgress.bookmarked ? "active" : ""}`} onClick={() => patchProgress(selected.id, { bookmarked: !selectedProgress.bookmarked })} aria-label="Bookmark selected challenge">
                    <Bookmark size={18} fill={selectedProgress.bookmarked ? "currentColor" : "none"} />
                  </button>
                </div>
                <p className="mt-5 max-w-3xl text-lg leading-8 text-[var(--muted-ink)]">{selected.summary}</p>

                <div className="mt-8 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5 sm:flex sm:items-center sm:justify-between">
                  <div><p className="overline">Scale card</p><p className="mt-2 font-[var(--font-display)] text-xl font-bold">{selected.scale}</p></div>
                  <div className="mt-4 flex flex-wrap gap-2 sm:mt-0 sm:justify-end">{selected.focus.map((item) => <span className="focus-chip" key={item}>{item}</span>)}</div>
                </div>

                <div className="mt-8 grid gap-8 md:grid-cols-2">
                  <div>
                    <p className="detail-heading">Core requirements</p>
                    <ul className="detail-list">{selected.requirements.map((item) => <li key={item}><Check size={15} />{item}</li>)}</ul>
                  </div>
                  <div>
                    <p className="detail-heading">Design constraints</p>
                    <ul className="detail-list">{selected.constraints.map((item) => <li key={item}><Target size={15} />{item}</li>)}</ul>
                  </div>
                </div>

                <div className="mt-8 border-l-4 border-[var(--orange)] bg-[var(--orange-wash)] px-5 py-4">
                  <p className="overline text-[var(--orange-deep)]">Interviewer pressure test</p>
                  <p className="mt-2 font-medium leading-6">“{selected.interviewerPush}”</p>
                </div>

                {lesson && <details className="my-8 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-5">
                  <summary className="cursor-pointer font-bold">Study a Python pattern · {lesson.pattern}</summary>
                  <p className="mt-4 text-sm leading-6 text-[var(--muted-ink)]">{lesson.note}</p>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted-ink)]">This is a focused teaching model. Explain the production boundaries in its docstring.</p>
                  <pre className="mt-4 max-h-[420px] overflow-auto rounded-xl bg-[var(--ink)] p-4 text-xs leading-6 text-[var(--lime)]"><code>{lesson.code}</code></pre>
                </details>}
                <div className="mt-auto flex flex-col gap-3 border-t border-[var(--line)] pt-8 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[var(--muted-ink)]">Your draft and progress save automatically in this browser.</p>
                  <button className="primary-button justify-center" onClick={() => openMock(selected)}><Play size={16} fill="currentColor" /> Open practice room</button>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1480px] px-5 py-12 lg:px-8 lg:py-16">
          <div className="rounded-[28px] bg-[var(--ink)] px-6 py-8 text-white sm:px-10 sm:py-10 lg:flex lg:items-center lg:justify-between">
            <div><p className="overline text-[var(--lime)]">A repeatable interview loop</p><h2 className="mt-3 font-[var(--font-display)] text-3xl font-bold">Clarify → estimate → design → defend.</h2></div>
            <div className="mt-7 grid grid-cols-2 gap-3 text-sm lg:mt-0 lg:grid-cols-4">
              {["Scope the problem", "Quantify the load", "Trace the hot path", "Name the trade-offs"].map((item, index) => <div className="loop-step" key={item}><span>0{index + 1}</span>{item}</div>)}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)] px-5 py-7 text-center text-xs text-[var(--muted-ink)]">
        ScaleSketch · local-first by design · your answers remain in your browser unless you request an AI review
      </footer>

      {mockOpen && (
        <div ref={dialog} className="fixed inset-0 z-50 flex bg-[rgba(10,16,13,0.78)] p-0 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="mock-title">
          <DesignSession problem={selected} diagram={diagram} onDiagram={value => { setDiagram(value); patchProgress(selected.id, { diagram: value }); }}
            answer={answer} onAnswer={saveDraft} secondsLeft={secondsLeft} running={running}
            onToggle={() => setRunning(value => !value && secondsLeft > 0)} onReset={() => setSecondsLeft(selected.minutes * 60)}
            onClose={closeMock} reviewing={reviewing} feedback={feedback} error={reviewError}
            onLocal={finishLocally} onAI={() => { void requestAiReview(); }} storageMessage={storageMessage} />
        </div>
      )}
    </div>
  );
}
