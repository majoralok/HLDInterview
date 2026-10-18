"use client";

import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronLeft,
  Circle,
  Clock3,
  Download,
  Flame,
  Gauge,
  LayoutDashboard,
  Menu,
  Pause,
  Play,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Category, DesignProblem, Difficulty } from "@/lib/problem-bank";

type ProgressStatus = "todo" | "in_progress" | "done";
type ProgressEntry = {
  status: ProgressStatus;
  bookmarked: boolean;
  score?: number;
  attempts: number;
  lastPracticed?: string;
  draft?: string;
};
type ProgressMap = Record<string, ProgressEntry>;
type Feedback = {
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  followUp: string;
};

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

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function starterTemplate(problem: DesignProblem) {
  return `1. SCOPE & ASSUMPTIONS\n- Clarify users, use cases, exclusions, and consistency needs.\n\n2. CAPACITY ESTIMATES\n- Traffic, storage, bandwidth, and growth assumptions.\n\n3. API & DATA MODEL\n- Key endpoints/events, entities, indexes, and idempotency.\n\n4. HIGH-LEVEL DESIGN\n- Request flow and responsibilities of each component.\n\n5. DEEP DIVE\n- ${problem.focus.join("; ")}\n\n6. RELIABILITY & OPERATIONS\n- Failure modes, observability, recovery, security, and cost.\n\n7. TRADE-OFFS\n- Alternatives considered and why this design fits the stated constraints.`;
}

function localScore(answer: string, problem: DesignProblem) {
  const lower = answer.toLowerCase();
  const sectionSignals = ["scope", "estimate", "api", "data", "design", "reliability", "trade-off"];
  const checkpointHits = problem.checkpoints.filter((item) => lower.includes(item.split(" ")[0].toLowerCase())).length;
  const completeness = Math.min(42, Math.floor(answer.trim().length / 45));
  const structure = sectionSignals.filter((signal) => lower.includes(signal)).length * 4;
  return Math.min(100, 24 + completeness + structure + checkpointHits * 3);
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
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setProgress(JSON.parse(saved) as ProgressMap);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress, hydrated]);

  useEffect(() => {
    if (!running || secondsLeft <= 0) return;
    const timer = window.setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [running, secondsLeft]);

  const closeMock = useCallback(() => {
    setRunning(false);
    setMockOpen(false);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && mockOpen) closeMock();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [closeMock, mockOpen]);

  const selected = problems.find((problem) => problem.id === selectedId) ?? problems[0];
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
    setAnswer(entry.draft || starterTemplate(problem));
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
    const score = localScore(answer, selected);
    const entry = progress[selected.id] ?? emptyProgress();
    patchProgress(selected.id, {
      draft: answer,
      score,
      status: "done",
      attempts: entry.attempts + 1,
      lastPracticed: new Date().toISOString(),
    });
    setFeedback({
      score,
      summary: "Local rubric complete. This score measures structure and coverage; connect OpenAI for design-specific critique.",
      strengths: ["You completed a timed design pass", "The answer has a reusable interview structure"],
      improvements: selected.checkpoints.slice(0, 3).map((item) => `Make your ${item} decision explicit and quantify the trade-off.`),
      followUp: selected.interviewerPush,
    });
    setRunning(false);
  }

  async function requestAiReview() {
    if (answer.replace(/\s/g, "").length < 120) {
      setReviewError("Add a little more detail before asking for a review.");
      return;
    }
    setReviewing(true);
    setReviewError("");
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ problem: selected, answer }),
      });
      const payload = (await response.json()) as Feedback & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Review failed. Try again.");
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
    anchor.download = `architect-lab-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color:var(--canvas)/88%] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between px-5 lg:px-8">
          <a href="#top" className="group flex items-center gap-3" aria-label="Architect Lab home">
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--ink)] text-[var(--lime)] shadow-[4px_4px_0_var(--lime)] transition-transform group-hover:-translate-y-0.5">
              <LayoutDashboard size={20} strokeWidth={2.4} />
            </span>
            <span>
              <span className="block font-[var(--font-display)] text-lg font-bold leading-none tracking-tight">Architect Lab</span>
              <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--muted-ink)]">System design studio</span>
            </span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-semibold md:flex" aria-label="Primary navigation">
            <a className="nav-link active" href="#roadmap">Roadmap</a>
            <a className="nav-link" href="#practice">Practice room</a>
            <a className="nav-link" href="#progress">Progress</a>
          </nav>
          <div className="flex items-center gap-2">
            <button className="icon-button hidden sm:grid" onClick={exportProgress} aria-label="Export progress" title="Export progress">
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
        <section className="hero-grid mx-auto max-w-[1480px] px-5 pb-12 pt-12 lg:px-8 lg:pb-16 lg:pt-20">
          <div className="max-w-4xl">
            <div className="eyebrow"><Sparkles size={14} /> Your interview training ground</div>
            <h1 className="mt-6 max-w-4xl font-[var(--font-display)] text-[clamp(3.1rem,7vw,7rem)] font-black leading-[0.88] tracking-[-0.06em]">
              Think clearly.<br />Design <span className="text-[var(--orange)]">at scale.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[var(--muted-ink)] lg:text-xl">
              A focused system design workspace that turns a question bank into deliberate practice—complete with timed rounds, decision checkpoints, and an AI interviewer when you want one.
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
        Architect Lab · local-first by design · your answers remain in your browser unless you request an AI review
      </footer>

      {mockOpen && (
        <div className="fixed inset-0 z-50 flex bg-[rgba(10,16,13,0.78)] p-0 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="mock-title">
          <div className="m-auto flex h-full w-full max-w-[1440px] flex-col overflow-hidden bg-[var(--canvas)] shadow-2xl sm:h-[calc(100vh-40px)] sm:rounded-[26px]">
            <header className="flex min-h-[72px] items-center justify-between gap-4 border-b border-[var(--line)] px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <button className="icon-button" onClick={closeMock} aria-label="Close practice room"><ChevronLeft size={19} /></button>
                <div className="min-w-0"><p className="overline">Live practice</p><h2 id="mock-title" className="truncate font-[var(--font-display)] text-base font-bold sm:text-lg">{selected.title}</h2></div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`timer ${secondsLeft < 300 ? "urgent" : ""}`}><Clock3 size={16} /> {formatClock(secondsLeft)}</div>
                <button className="icon-button" onClick={() => setRunning((value) => !value)} aria-label={running ? "Pause timer" : "Start timer"}>{running ? <Pause size={17} /> : <Play size={17} />}</button>
                <button className="icon-button hidden sm:grid" onClick={() => setSecondsLeft(selected.minutes * 60)} aria-label="Reset timer"><RotateCcw size={17} /></button>
                <button className="icon-button" onClick={closeMock} aria-label="Close"><X size={18} /></button>
              </div>
            </header>

            <div className="grid min-h-0 flex-1 lg:grid-cols-[330px_minmax(0,1fr)_360px]">
              <aside className="hidden overflow-y-auto border-r border-[var(--line)] bg-[var(--paper)] p-6 lg:block">
                <p className="detail-heading">Your checkpoints</p>
                <ol className="mt-5 space-y-4">
                  {selected.checkpoints.map((item, index) => <li key={item} className="flex gap-3 text-sm leading-5"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--ink)] text-[10px] font-bold text-[var(--lime)]">{index + 1}</span><span>{item}</span></li>)}
                </ol>
                <div className="mt-8 border-t border-[var(--line)] pt-6"><p className="detail-heading">Pressure test</p><p className="mt-3 text-sm italic leading-6 text-[var(--muted-ink)]">“{selected.interviewerPush}”</p></div>
              </aside>

              <section className="flex min-h-0 flex-col">
                <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3">
                  <span className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--muted-ink)]">Design notes</span>
                  <span className="text-xs text-[var(--muted-ink)]">{answer.length.toLocaleString()} characters · autosaved</span>
                </div>
                <textarea className="design-editor" value={answer} onChange={(event) => saveDraft(event.target.value)} spellCheck aria-label="System design answer" />
                <div className="flex flex-col gap-3 border-t border-[var(--line)] bg-[var(--paper)] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs leading-5 text-[var(--muted-ink)]">Use the rubric for a private offline check, or send this answer to OpenAI for deeper feedback.</p>
                  <div className="flex shrink-0 gap-2"><button className="secondary-button" onClick={finishLocally}>Use local rubric</button><button className="primary-button" onClick={requestAiReview} disabled={reviewing}>{reviewing ? "Reviewing…" : <><Sparkles size={15} /> AI review</>}</button></div>
                </div>
              </section>

              <aside className="overflow-y-auto border-t border-[var(--line)] bg-white p-5 lg:border-l lg:border-t-0 lg:p-6">
                <div className="flex items-center justify-between"><p className="detail-heading">Coach review</p>{feedback && <span className="score-badge">{feedback.score}/100</span>}</div>
                {!feedback && !reviewError && <div className="mt-8 rounded-2xl border border-dashed border-[var(--line-strong)] p-6 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--lime-wash)] text-[var(--ink)]"><Sparkles size={21} /></span><h3 className="mt-4 font-[var(--font-display)] text-lg font-bold">Feedback when you’re ready</h3><p className="mt-2 text-sm leading-6 text-[var(--muted-ink)]">You’ll get a score, concrete strengths, missed risks, and a follow-up question.</p></div>}
                {reviewError && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">{reviewError}<button className="mt-3 block font-bold underline" onClick={finishLocally}>Run the local rubric instead</button></div>}
                {feedback && <div className="mt-6 space-y-6"><p className="text-sm leading-6 text-[var(--muted-ink)]">{feedback.summary}</p><div><p className="feedback-heading good">What worked</p><ul className="feedback-list">{feedback.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div><div><p className="feedback-heading improve">Make it stronger</p><ul className="feedback-list">{feedback.improvements.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="rounded-xl bg-[var(--ink)] p-4 text-white"><p className="overline text-[var(--lime)]">Next interviewer question</p><p className="mt-2 text-sm leading-6">{feedback.followUp}</p></div><button className="primary-button w-full justify-center" onClick={closeMock}>Finish session <Check size={16} /></button></div>}
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
