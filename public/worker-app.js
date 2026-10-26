import { parseProgress, parseImport, MAX_IMPORT_BYTES, writtenAnswer, localAssessment, isFeedback } from "/practice-core.js";
import { emptyDiagram, designSubmission, PHASES, phaseAt } from "/architecture-core.js";
import { createWorkbench } from "/architecture-workbench.js";

const KEY = "architect-lab-progress-v1";
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
let problems = [], lessons = {}, progress = {}, selected = "", savedOnly = false;
let timerId, seconds = 2700, running = false, deadline = 0, reviewing = false, returnFocus;
let workbench, diagram = emptyDiagram();

function notice(message) {
  $("#storage-message").textContent = message;
  $("#storage-message").hidden = !message;
}
function entry(id) { return progress[id] || { status: "todo", bookmarked: false, attempts: 0 }; }
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(progress)); }
  catch { notice("Browser storage is unavailable or full. Export your progress before closing this page."); }
}
function patch(id, value) {
  progress[id] = { ...entry(id), ...value };
  save();
  render();
}
function filtered() {
  const query = $("#search").value.trim().toLowerCase();
  return problems.filter(problem => (!query || [problem.title, problem.summary, ...problem.focus].join(" ").toLowerCase().includes(query))
    && ($("#difficulty").value === "All" || problem.difficulty === $("#difficulty").value)
    && ($("#category").value === "All" || problem.category === $("#category").value)
    && (!savedOnly || entry(problem.id).bookmarked));
}
function render() {
  const values = Object.values(progress), done = values.filter(item => item.status === "done").length;
  const scores = values.filter(item => Number.isFinite(item.score));
  $("#done-count").textContent = done;
  $("#attempt-count").textContent = values.filter(item => item.attempts > 0).length;
  $("#avg-score").textContent = scores.length ? Math.round(scores.reduce((sum, item) => sum + item.score, 0) / scores.length) : "—";
  $("#progress-bar").style.width = (done / problems.length * 100) + "%";
  const list = filtered();
  $("#result-count").textContent = list.length + " challenges";
  $("#challenge-list").innerHTML = list.map(problem => {
    const item = entry(problem.id);
    return `<div class="challenge ${problem.id === selected ? "selected" : ""}">
      <button class="status ${item.status}" data-action="status" data-id="${problem.id}" aria-label="Update ${esc(problem.shortTitle)} status; currently ${item.status}">${item.status === "done" ? "✓" : ""}</button>
      <button class="pick" data-action="select" data-id="${problem.id}"><b>${String(problem.order).padStart(2, "0")} · ${esc(problem.shortTitle)}</b><small>${esc(problem.difficulty)} · ${problem.minutes} min${Number.isFinite(item.score) ? " · " + item.score + "/100" : ""}</small></button>
      <button class="star" data-action="star" data-id="${problem.id}" aria-label="Bookmark ${esc(problem.shortTitle)}" aria-pressed="${item.bookmarked}">${item.bookmarked ? "★" : "☆"}</button></div>`;
  }).join("") || '<p class="empty">No matching challenges.</p>';
  const problem = problems.find(item => item.id === selected);
  if (!problem) return;
  const lesson = lessons[problem.id];
  $("#detail").innerHTML = `<div class="pills"><span class="pill ${problem.difficulty}">${esc(problem.difficulty)}</span><span class="pill">${esc(problem.category)}</span><span class="pill">◷ ${problem.minutes} min</span></div>
    <h2>${esc(problem.title)}</h2><p class="summary">${esc(problem.summary)}</p>
    <div class="scale-card"><span class="kicker">Scale card</span><b>${esc(problem.scale)}</b><div class="chips">${problem.focus.map(item => `<span class="chip">${esc(item)}</span>`).join("")}</div></div>
    <div class="columns"><div><h3>Core requirements</h3><ul>${problem.requirements.map(item => `<li>${esc(item)}</li>`).join("")}</ul></div><div><h3>Design constraints</h3><ul>${problem.constraints.map(item => `<li>${esc(item)}</li>`).join("")}</ul></div></div>
    <div class="pressure"><span class="kicker">Interviewer pressure test</span><br>“${esc(problem.interviewerPush)}”</div>
    ${lesson ? `<details class="lesson"><summary>Study a Python pattern · ${esc(lesson.pattern)}</summary><p>${esc(lesson.note)}</p><p>This is a focused teaching model. Explain the production boundaries in its docstring.</p><pre><code>${esc(lesson.code)}</code></pre></details>` : ""}
    <button class="button primary practice-button" data-action="practice" data-id="${problem.id}">Open practice room →</button>`;
}
function template(problem) {
  return `1. SCOPE & ASSUMPTIONS\n- Users, use cases, exclusions, consistency.\n\n2. CAPACITY ESTIMATES\n- Traffic, storage, bandwidth, growth.\n\n3. API & DATA MODEL\n- Endpoints/events, entities, indexes, idempotency.\n\n4. HIGH-LEVEL DESIGN\n- Request flow and component responsibilities.\n\n5. DEEP DIVE\n- ${problem.focus.join("; ")}\n\n6. RELIABILITY & OPERATIONS\n- Failures, observability, recovery, security, cost.\n\n7. TRADE-OFFS\n- Alternatives and why this design fits.`;
}
function openRoom(id) {
  selected = id;
  const problem = problems.find(item => item.id === id), item = entry(id);
  returnFocus = document.activeElement;
  $("#room-title").textContent = problem.title;
  $("#answer").value = item.draft ?? template(problem);
  $("#char-count").textContent = $("#answer").value.length + " / 25,000 characters";
  $("#checkpoint-list").innerHTML = problem.checkpoints.map(text => `<li>${esc(text)}</li>`).join("");
  $("#pressure").textContent = problem.interviewerPush;
  $("#score").textContent = "";
  $("#feedback-body").className = "empty";
  $("#feedback-body").textContent = "Write your design, then request a coverage check or AI feedback.";
  seconds = problem.minutes * 60;
  deadline = Date.now() + seconds * 1000;
  running = true;
  showTime();
  clearInterval(timerId);
  timerId = setInterval(tick, 250);
  $("#modal").hidden = false;
  diagram = item.diagram ?? emptyDiagram();
  workbench?.destroy();
  workbench = createWorkbench($("#architecture-host"), { value: diagram, onChange: value => { diagram = value; progress[selected] = { ...entry(selected), diagram }; save(); } });
  document.body.style.overflow = "hidden";
  $("#close").focus();
  patch(id, { status: item.status === "todo" ? "in_progress" : item.status });
}
function closeRoom() {
  if (reviewing) return;
  clearInterval(timerId);
  running = false;
  $("#modal").hidden = true;
  document.body.style.overflow = "";
  // render() replaces the detail button, so use its current counterpart.
  if (returnFocus?.isConnected) returnFocus.focus();
  else $(".practice-button")?.focus();
}
function tick() {
  if (!running) return;
  seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  if (!seconds) running = false;
  showTime();
}
function showTime() {
  $("#timer").textContent = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  $("#pause").textContent = running ? "Ⅱ" : "▶";
  $("#pause").setAttribute("aria-label", running ? "Pause timer" : "Resume timer");
  const problem = problems.find(p => p.id === selected);
  if (problem) { const phase = PHASES[phaseAt(problem.minutes * 60 - seconds, problem.minutes * 60)]; $("#phase-guide").innerHTML = `<div class="worker-phase"><b>${esc(phase.name)}</b>${esc(phase.prompt)}</div>`; }
}
function showError(message) {
  $("#feedback-body").className = "";
  $("#feedback-body").textContent = message;
}
function showReview(review) {
  $("#score").textContent = review.score + "/100";
  $("#feedback-body").className = "";
  $("#feedback-body").innerHTML = `<p class="review-summary">${esc(review.summary)}</p><div class="review-section"><b>What worked</b><ul>${review.strengths.map(item => `<li>${esc(item)}</li>`).join("")}</ul></div><div class="review-section"><b>Make it stronger</b><ul>${review.improvements.map(item => `<li>${esc(item)}</li>`).join("")}</ul></div>${(review.findings ?? []).map(f => `<article class="worker-finding"><small>${esc(f.severity)} · ${esc(f.dimension)}</small><b>${esc(f.title)}</b>${f.evidence.trim().toLowerCase() === "general" ? "<p>Not specified in this submission</p>" : `<blockquote>${esc(f.evidence)}</blockquote>`}<p>${esc(f.recommendation)}</p></article>`).join("")}<div class="followup"><b>Next question</b><p>${esc(review.followUp)}</p></div>`;
}
function complete(review, id, answer) {
  const item = entry(id);
  patch(id, { draft: answer, score: review.score, status: "done", attempts: item.attempts + 1, lastPracticed: new Date().toISOString() });
  showReview(review);
  running = false;
  showTime();
}
function localReview() {
  if (reviewing) return;
  const problem = problems.find(item => item.id === selected), answer = $("#answer").value;
  try { complete(localAssessment(answer, problem, template(problem), diagram), selected, answer); }
  catch (error) { showError(error.message); }
}
async function aiReview() {
  if (reviewing) return;
  const id = selected, answer = $("#answer").value, problem = problems.find(item => item.id === id);
  if (writtenAnswer(designSubmission(answer, diagram), template(problem)).replace(/\s/g, "").length < 120) {
    showError("Write at least 120 non-whitespace characters of your own design before requesting feedback.");
    return;
  }
  reviewing = true;
  workbench?.setDisabled(true);
  for (const selector of ["#ai-review", "#local-review", "#close", "#xclose", "#answer"]) $(selector).disabled = true;
  $("#ai-review").textContent = "Reviewing…";
  try {
    const response = await fetch("/api/coach", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ problem: { id }, answer, diagram }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Review failed.");
    if (!isFeedback(data)) throw new Error("The reviewer returned invalid feedback.");
    complete(data, id, answer);
  } catch (error) { showError(error.message); }
  finally {
    reviewing = false;
    workbench?.setDisabled(false);
    for (const selector of ["#ai-review", "#local-review", "#close", "#xclose", "#answer"]) $(selector).disabled = false;
    $("#ai-review").textContent = "AI review ✦";
  }
}
function exportData() {
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), progress }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob), anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "scalesketch-progress.json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("#import").onclick = () => $("#import-file").click();
$("#import-file").onchange = async event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    if (file.size > MAX_IMPORT_BYTES) throw new Error("Progress files must be smaller than 1 MB.");
    const imported = parseImport(await file.text(), problems.map(problem => problem.id));
    progress = { ...progress, ...imported };
    notice("Imported " + Object.keys(imported).length + " challenges. Entries in the backup replace matching local entries.");
    save();
    render();
  } catch (error) { notice(error.message); }
};
document.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button || !$("#modal").hidden) return;
  const { id, action } = button.dataset;
  if (action === "select") { selected = id; render(); }
  if (action === "status") patch(id, { status: entry(id).status === "todo" ? "in_progress" : entry(id).status === "in_progress" ? "done" : "todo" });
  if (action === "star") patch(id, { bookmarked: !entry(id).bookmarked });
  if (action === "practice") openRoom(id);
});
for (const id of ["search", "difficulty", "category"]) $("#" + id).addEventListener(id === "search" ? "input" : "change", render);
$("#saved").onclick = () => { savedOnly = !savedOnly; $("#saved").textContent = savedOnly ? "★ Saved" : "☆ Saved"; render(); };
$("#begin").onclick = () => { if (selected) openRoom(selected); };
$("#export").onclick = exportData;
$("#close").onclick = $("#xclose").onclick = closeRoom;
$("#pause").onclick = () => { tick(); running = !running && seconds > 0; deadline = Date.now() + seconds * 1000; showTime(); };
$("#answer").addEventListener("input", event => {
  $("#char-count").textContent = event.target.value.length + " / 25,000 characters";
  progress[selected] = { ...entry(selected), draft: event.target.value };
  save();
});
$("#local-review").onclick = localReview;
$("#ai-review").onclick = aiReview;
document.addEventListener("keydown", event => {
  if ($("#modal").hidden) return;
  if (event.key === "Escape") closeRoom();
  if (event.key !== "Tab") return;
  const controls = [...$("#modal").querySelectorAll("button:not(:disabled),textarea:not(:disabled),input:not(:disabled),select:not(:disabled),summary,[tabindex='0']")].filter(element => element.getClientRects().length);
  const first = controls[0], last = controls[controls.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});
try {
  const responses = await Promise.all([fetch("/api/problems"), fetch("/api/lessons")]);
  if (responses.some(response => !response.ok)) throw new Error("Roadmap request failed");
  [problems, lessons] = await Promise.all(responses.map(response => response.json()));
  try { progress = parseProgress(JSON.parse(localStorage.getItem(KEY) || "{}"), problems.map(problem => problem.id)); }
  catch { notice("Saved progress could not be read. Import a backup, or export new progress before closing this page."); }
  selected = problems[0].id;
  render();
} catch { $("#challenge-list").textContent = "Could not load the roadmap. Reload to try again."; }
