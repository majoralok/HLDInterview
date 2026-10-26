"use client";
import { useState } from "react";
import { Check, ChevronLeft, Clock3, Download, Pause, Play, RotateCcw, Sparkles, X } from "lucide-react";
import type { DesignProblem } from "@/lib/problem-bank";
import { PHASES, phaseAt } from "@/public/architecture-core.js";
import type { Diagram } from "@/public/architecture-core.js";
import type { Feedback } from "@/public/practice-core.js";
import { ArchitectureCanvas } from "./architecture-canvas";

type Props = { problem: DesignProblem; diagram: Diagram; onDiagram: (diagram: Diagram) => void; answer: string; onAnswer: (answer: string) => void;
  secondsLeft: number; running: boolean; onToggle: () => void; onReset: () => void; onClose: () => void;
  reviewing: boolean; feedback: Feedback | null; error: string; onLocal: () => void; onAI: () => void; storageMessage: string };

export function DesignSession(p: Props) {
  const [tab, setTab] = useState("canvas");
  const [side, setSide] = useState("brief");
  const [manualPhase, setManualPhase] = useState<number | null>(null);
  const total = p.problem.minutes * 60;
  const phase = manualPhase ?? phaseAt(total - p.secondsLeft, total);
  const clock = `${String(Math.floor(p.secondsLeft / 60)).padStart(2, "0")}:${String(p.secondsLeft % 60).padStart(2, "0")}`;
  function exportReview() {
    if (!p.feedback) return;
    const f = p.feedback;
    const text = `# ${p.problem.title}\n\nScore: ${f.score}/100\n\n${f.summary}\n\n## Strengths\n${f.strengths.map(s => "- " + s).join("\n")}\n\n## Improvements\n${f.improvements.map(s => "- " + s).join("\n")}\n\n${(f.findings ?? []).map(r => `### ${r.severity.toUpperCase()}: ${r.title}\n${r.dimension}\nEvidence: ${r.evidence}\n\n${r.recommendation}`).join("\n\n")}\n\nNext question: ${f.followUp}`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
    const a = document.createElement("a"); a.href = url; a.download = `scalesketch-${p.problem.id}-review.md`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <div className="design-session">
    <header className="session-header"><div className="session-heading"><button className="icon-button" disabled={p.reviewing} onClick={p.onClose} aria-label="Close practice room"><ChevronLeft size={19} /></button><div><p className="overline">ScaleSketch / Practice studio</p><h2 id="mock-title">{p.problem.shortTitle}</h2></div></div><div className="session-clock"><span className={`timer ${p.secondsLeft < 300 ? "urgent" : ""}`}><Clock3 size={15} />{clock}</span><button className="icon-button" onClick={p.onToggle} aria-label={p.running ? "Pause timer" : "Start timer"}>{p.running ? <Pause size={16} /> : <Play size={16} />}</button><button className="icon-button" onClick={p.onReset} aria-label="Reset timer"><RotateCcw size={16} /></button><button className="icon-button" disabled={p.reviewing} onClick={p.onClose} aria-label="Close"><X size={17} /></button></div></header>
    <div className="session-phases" aria-label="Interview phases">{PHASES.map((item, i) => <button key={item.name} className={i === phase ? "current" : ""} onClick={() => setManualPhase(i)} aria-pressed={i === phase}><span>{i + 1}</span>{item.name}<small>{Math.round(item.share * p.problem.minutes)} min</small></button>)}<button className="phase-auto" onClick={() => setManualPhase(null)} aria-pressed={manualPhase === null}>Auto</button></div>
    <p className="phase-prompt"><b>{PHASES[phase].name}:</b> {PHASES[phase].prompt}</p>
    <div className="session-tabs" role="tablist" aria-label="Workspace view">{[["canvas", "Architecture"], ["notes", "Design notes"], ["brief", "Brief"], ["review", "Coach review"]].map(([id, label]) => <button role="tab" id={`session-tab-${id}`} aria-controls={`session-panel-${id}`} aria-selected={tab === id} key={id} onClick={() => { setTab(id); if (id === "brief") setSide("brief"); }}>{label}{id === "review" && p.feedback ? ` · ${p.feedback.score}/100` : ""}</button>)}</div>
    <div className={`session-workspace view-${tab}`}>
      <section className="session-canvas" id="session-panel-canvas" aria-labelledby="session-tab-canvas" role="tabpanel" hidden={tab !== "canvas"}><ArchitectureCanvas value={p.diagram} onChange={p.onDiagram} disabled={p.reviewing} /></section>
      <section className="session-notes" id="session-panel-notes" aria-labelledby="session-tab-notes" role="tabpanel" hidden={tab !== "notes"}><div className="session-panel-heading"><b>Your design rationale</b><small>{p.answer.length.toLocaleString()} / 25,000 characters</small></div><p className="session-hint">Explain APIs, access patterns, assumptions, and trade-offs. Your diagram is included automatically in both reviews.</p><textarea className="design-editor" aria-label="System design answer" value={p.answer} onChange={e => p.onAnswer(e.target.value)} disabled={p.reviewing} maxLength={25000} spellCheck /></section>
      <aside className="session-side"><div className="session-side-tabs"><button aria-pressed={side === "brief"} onClick={() => setSide("brief")}>Challenge brief</button><button aria-pressed={side === "review"} onClick={() => setSide("review")}>Review{p.feedback ? ` · ${p.feedback.score}` : ""}</button></div>
        <div id="session-panel-brief" role="tabpanel" aria-labelledby="session-tab-brief" className={`session-brief ${tab === "review" || side === "review" ? "session-hidden" : ""}`}><span className="difficulty-pill" data-level={p.problem.difficulty}>{p.problem.difficulty}</span><h3>{p.problem.title}</h3><p>{p.problem.summary}</p><div className="session-scale">{p.problem.scale}</div><h4>Requirements</h4><ul>{p.problem.requirements.map(r => <li key={r}>{r}</li>)}</ul><h4>Constraints</h4><ul>{p.problem.constraints.map(r => <li key={r}>{r}</li>)}</ul><h4>Your checkpoints</h4><ol>{p.problem.checkpoints.map(r => <li key={r}>{r}</li>)}</ol><div className="session-pressure"><h4>Interviewer pressure test</h4><p>{p.problem.interviewerPush}</p></div></div>
        <div id="session-panel-review" role="tabpanel" aria-labelledby="session-tab-review" className={`session-review ${tab !== "review" && side !== "review" ? "session-hidden" : ""}`} aria-live="polite">
          {p.reviewing && <div className="review-pending"><Sparkles size={22} /><h3>Tracing your design…</h3><p>Reviewing your notes and connected architecture.</p></div>}
          {p.error && <div className="session-error" role="alert">{p.error}<button onClick={p.onLocal} disabled={p.reviewing}>Run offline coverage check</button></div>}
          {!p.feedback && !p.reviewing && <div className="review-empty"><Sparkles size={28} /><h3>A second pair of eyes.</h3><p>Draw your architecture, explain the decisions, then request a review. Findings include severity, evidence, and a practical next step.</p><p>Offline coverage checks work without an API key.</p></div>}
          {p.feedback && <><div className="review-score"><span>{p.feedback.score}<small>/100</small></span><b>{p.feedback.summary.startsWith("Offline") ? "Coverage check" : "AI assessment"}</b></div><p>{p.feedback.summary}</p><h4>What worked</h4><ul className="feedback-list">{p.feedback.strengths.map(s => <li key={s}>{s}</li>)}</ul><h4>Make it stronger</h4><ul className="feedback-list">{p.feedback.improvements.map(s => <li key={s}>{s}</li>)}</ul>{p.feedback.findings?.map((f, i) => <article className="review-finding" key={i}><div><span className={`severity severity-${f.severity}`}>{f.severity}</span><small>{f.dimension}</small></div><h4>{f.title}</h4>{f.evidence.trim().toLowerCase() === "general" ? <p className="finding-evidence">Not specified in this submission</p> : <blockquote>{f.evidence}</blockquote>}<p>{f.recommendation}</p></article>)}<div className="session-pressure"><h4>Defend this decision</h4><p>{p.feedback.followUp}</p></div><button className="secondary-button" onClick={exportReview}><Download size={14} />Export review</button></>}
        </div>
      </aside>
    </div>
    <footer className="session-footer"><p>{p.storageMessage || "Draft + diagram save in this browser. AI review sends both to OpenAI."}</p><div><button className="secondary-button" disabled={p.reviewing} onClick={() => { setSide("review"); setTab("review"); p.onLocal(); }}>Offline check</button><button className="primary-button" disabled={p.reviewing} onClick={() => { setSide("review"); setTab("review"); p.onAI(); }}><Sparkles size={15} />{p.reviewing ? "Reviewing…" : "Review my design"}</button>{p.feedback && <button className="icon-button" disabled={p.reviewing} onClick={p.onClose} aria-label="Finish session"><Check size={18} /></button>}</div></footer>
  </div>;
}
