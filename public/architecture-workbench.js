import { COMPONENTS, emptyDiagram, parseDiagram, analyzeDiagram, estimateCapacity } from "./architecture-core.js";

const esc = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const fmt = value => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : "∞";

// A DOM island used by React and the dependency-free Worker, with one implementation.
export function createWorkbench(host, options = {}) {
  let diagram = parseDiagram(options.value ?? emptyDiagram()), selected = "", source = "", failed = "", disabled = !!options.disabled;
  let history = [], future = [], view = { x: 0, y: 0, width: 1200, height: 720 }, drag = null;
  let editingBefore = null;
  let panelId = null;
  const uid = "arch-" + crypto.randomUUID();
  host.classList.add("architecture-workbench");
  host.innerHTML = `<div class="aw-toolbar"><div><span class="aw-live-dot"></span><b>Architecture canvas</b><small>Build it. Break it. Explain it.</small></div><div class="aw-actions"><button data-action="undo" title="Undo (Ctrl/Cmd+Z)">↶ Undo</button><button data-action="redo" title="Redo (Ctrl/Cmd+Shift+Z)">↷</button><button data-action="out" aria-label="Zoom out">−</button><button data-action="in" aria-label="Zoom in">+</button><button data-action="fit">Fit</button><button data-action="export">Export diagram</button><button data-action="import">Import</button><input class="aw-file" type="file" accept=".json,application/json" hidden></div></div>
    <div class="aw-layout"><aside class="aw-library"><p class="aw-kicker">Components <span>tap to add</span></p><div class="aw-palette">${COMPONENTS.map(c => `<button data-add="${c.type}" title="${esc(c.tip)}"><span style="background:${c.color}">${c.icon}</span>${c.label}<i>+</i></button>`).join("")}</div><details class="aw-guide"><summary>How to draw</summary><p>Add components, then drag to position. Select a node and choose Connect; select its destination. Or use the connection form below. Arrow keys move a selected node. Delete removes it. Use Fit to see all components.</p></details></aside>
    <section class="aw-stage"><div class="aw-canvas-wrap"><svg class="aw-canvas" viewBox="0 0 1200 720" role="img" aria-label="Editable system architecture. Components and connections can also be selected below."><defs><pattern id="${uid}-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#cfd8cf"/></pattern><marker id="${uid}-arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0,0 L10,4 L0,8" fill="#536b5b"/></marker></defs><rect class="aw-grid" width="3600" height="2400" x="-600" y="-400" fill="url(#${uid}-grid)"/><g class="aw-edges"></g><g class="aw-nodes"></g></svg><div class="aw-empty"><span>◇ → ▤</span><h3>Your next great design starts here.</h3><p>Add a client, a service, and a data store.<br>Connect them to trace your first request.</p><button data-action="starter">Add a starter path</button></div><div class="aw-canvas-caption">Solid = sync · Dashed = async <span class="aw-count"></span></div></div>
    <div class="aw-selection"></div><form class="aw-wire"><b>Connect</b><label>From<select name="source" aria-label="Connection source"></select></label><span>→</span><label>To<select name="target" aria-label="Connection destination"></select></label><button type="submit">Add connection</button></form></section></div>
    <div class="aw-tools"><section><div class="aw-panel-title"><span class="aw-kicker">Traffic lab</span><span class="aw-assumption">Illustrative model</span></div><div class="aw-traffic-controls"><label>Offered requests / sec<input data-setting="traffic" type="number" min="0" max="1000000000" step="100"></label><label>Failure drill<select class="aw-failure" aria-label="Failed component"><option value="">All components healthy</option></select></label></div><div class="aw-analysis" aria-live="polite"></div><details class="aw-guide"><summary>Model assumptions</summary><p>Capacities are editable teaching assumptions, not vendor benchmarks. One request visits each outgoing branch; a load balancer splits evenly. Traffic share models cache misses or sampled work. Fan-in adds traffic and can double-count joins. Replicas scale capacity linearly; database writes and shared bottlenecks need separate reasoning. Failed nodes stop forwarding; no automatic failover or queueing is modeled. Latency is a base synchronous path estimate, not p99 or a load test. Cycles are reported instead of estimated.</p></details></section>
    <section><div class="aw-panel-title"><span class="aw-kicker">Back-of-envelope</span><span class="aw-assumption">Decimal units</span></div><div class="aw-estimates"><label>Requests / day<input data-estimate="daily" type="number" min="0" max="1000000000000000" value="86400000"></label><label>Peak multiplier<input data-estimate="peak" type="number" min="1" max="1000" value="3"></label><label>Bytes / request stored<input data-estimate="bytes" type="number" min="0" max="1000000000" value="500"></label><label>Retention days<input data-estimate="days" type="number" min="0" max="36500" value="30"></label></div><div class="aw-estimate-output"></div><p class="aw-footnote">Assumes one stored record per request. Excludes replication, indexes, protocol overhead, and compression.</p></section></div><p class="aw-message" role="status"></p>`;
  const $ = selector => host.querySelector(selector);
  const announce = text => { $(".aw-message").textContent = text; };
  const snapshot = () => JSON.stringify(diagram);
  function commit(before) {
    if (snapshot() === before) return;
    history = [...history.slice(-39), before]; future = [];
    options.onChange?.(parseDiagram(diagram)); render();
  }
  function mutate(fn) { if (disabled) return; const before = snapshot(); fn(); commit(before); }
  function add(type, x, y) {
    if (diagram.nodes.length >= 60) return announce("The canvas supports up to 60 components.");
    const c = COMPONENTS.find(item => item.type === type), i = diagram.nodes.length;
    const n = { id: crypto.randomUUID(), type, label: c.label, notes: "", x: x ?? 60 + i % 6 * 260, y: y ?? 80 + Math.floor(i / 6) * 140, capacity: c.capacity, replicas: 1, latency: c.latency };
    diagram.nodes.push(n); selected = n.id; return n.id;
  }
  function wire(from, to) {
    if (!from || !to || from === to) return announce("Choose two different components.");
    if (diagram.edges.length >= 120) return announce("The canvas supports up to 120 connections.");
    if (diagram.edges.some(e => e.source === from && e.target === to)) return announce("These components are already connected in this direction.");
    diagram.edges.push({ id: crypto.randomUUID(), source: from, target: to, protocol: "HTTP", async: false, fraction: 1 }); source = "";
  }
  function render() {
    const analysis = analyzeDiagram(diagram, failed);
    $(".aw-empty").hidden = diagram.nodes.length > 0;
    $(".aw-count").textContent = `${diagram.nodes.length} components · ${diagram.edges.length} connections`;
    $(".aw-canvas").setAttribute("viewBox", `${view.x} ${view.y} ${view.width} ${view.height}`);
    $(".aw-edges").innerHTML = diagram.edges.map(e => {
      const a = diagram.nodes.find(n => n.id === e.source), b = diagram.nodes.find(n => n.id === e.target);
      const ax = a.x + 190, ay = a.y + 42, bx = b.x, by = b.y + 42;
      return `<g data-edge="${esc(e.id)}" class="aw-edge ${selected === e.id ? "selected" : ""}"><path d="M${ax},${ay} C${ax + 65},${ay} ${bx - 65},${by} ${bx},${by}" fill="none" stroke="${selected === e.id ? "#e55d31" : "#536b5b"}" stroke-width="2.5" ${e.async ? 'stroke-dasharray="8 5"' : ""} marker-end="url(#${uid}-arrow)"/><rect x="${(ax + bx) / 2 - 64}" y="${(ay + by) / 2 - 22}" width="128" height="20" rx="7" fill="#f4f7ef"/><text x="${(ax + bx) / 2}" y="${(ay + by) / 2 - 8}" text-anchor="middle" fill="#526458" font-size="11">${esc(e.protocol)}${e.async ? " · async" : ""}${e.fraction < 1 ? ` · ${Math.round(e.fraction * 100)}%` : ""}</text></g>`;
    }).join("");
    $(".aw-nodes").innerHTML = diagram.nodes.map(n => {
      const c = COMPONENTS.find(c => c.type === n.type), m = analysis.metrics.find(m => m.id === n.id);
      const status = n.id === failed ? "OFFLINE" : m ? `${fmt(m.qps)} rps · ${fmt(m.utilization * 100)}%` : "not on request path";
      return `<g data-node="${esc(n.id)}" transform="translate(${n.x},${n.y})" class="aw-node ${selected === n.id ? "selected" : ""}"><rect width="190" height="84" rx="13" fill="#fff" stroke="${source === n.id ? "#e55d31" : selected === n.id ? "#162c20" : m?.utilization > 1 ? "#cb3c28" : "#cad4c8"}" stroke-width="${selected === n.id ? 3 : 1.5}"/><rect x="11" y="13" width="30" height="30" rx="8" fill="${c.color}"/><text x="26" y="34" text-anchor="middle" font-size="21" fill="#162c20">${c.icon}</text><text x="49" y="29" font-size="13" font-weight="700" fill="#162c20">${esc(n.label.length > 18 ? n.label.slice(0, 17) + "…" : n.label)}</text><text x="49" y="46" font-size="10" fill="#647066">${n.replicas} replica${n.replicas === 1 ? "" : "s"} · ${n.latency} ms</text><text x="13" y="69" font-size="11" fill="${m?.utilization > 1 ? "#b42318" : "#647066"}">${status}</text></g>`;
    }).join("");
    const node = diagram.nodes.find(n => n.id === selected), edge = diagram.edges.find(e => e.id === selected);
    const choices = diagram.nodes.map(n => `<option value="${esc(n.id)}">${esc(n.label)}</option>`).join("");
    $(".aw-wire [name=source]").innerHTML = '<option value="">Choose source</option>' + choices;
    $(".aw-wire [name=target]").innerHTML = '<option value="">Choose destination</option>' + choices;
    $(".aw-wire [name=source]").value = node?.id ?? "";
    if (panelId !== selected) {
      panelId = selected;
      $(".aw-selection").innerHTML = `<label class="aw-select-label">Inspect <select class="aw-select" aria-label="Select component or connection"><option value="">Select on the canvas or here</option>${choices}${diagram.edges.map(e => `<option value="${esc(e.id)}">${esc(diagram.nodes.find(n => n.id === e.source).label)} → ${esc(diagram.nodes.find(n => n.id === e.target).label)}</option>`).join("")}</select></label>` + (node ? `<div class="aw-properties"><label>Name<input data-node-prop="label" maxlength="100" value="${esc(node.label)}"></label><label>RPS / replica<input data-node-prop="capacity" type="number" min="1" max="1000000000" value="${node.capacity}"></label><label>Replicas<input data-node-prop="replicas" type="number" min="1" max="1000" value="${node.replicas}"></label><label>Latency (ms)<input data-node-prop="latency" type="number" min="0" max="60000" value="${node.latency}"></label><button data-action="connect">Connect →</button><button data-action="delete">Remove</button></div><label class="aw-note">Responsibility & decision rationale<textarea data-node-prop="notes" maxlength="1200" placeholder="Why this component? What data does it own? What happens when it fails?">${esc(node.notes)}</textarea></label><p class="aw-concept">${esc(COMPONENTS.find(c => c.type === node.type).tip)}</p>` : edge ? `<div class="aw-properties"><label>Protocol<select data-edge-prop="protocol">${["HTTP", "gRPC", "WebSocket", "SQL", "Events"].map(p => `<option ${p === edge.protocol ? "selected" : ""}>${p}</option>`).join("")}</select></label><label>Mode<select data-edge-prop="async"><option value="false" ${!edge.async ? "selected" : ""}>Synchronous</option><option value="true" ${edge.async ? "selected" : ""}>Asynchronous</option></select></label><label>Traffic share (%)<input data-edge-prop="fraction" type="number" min="0" max="100" value="${edge.fraction * 100}"></label><button data-action="delete">Remove connection</button></div>` : `<p class="aw-concept">Select a component to edit capacity, replicas, and rationale. Select a connection to edit its protocol and traffic share.</p>`);
    }
    if ($("[data-action=connect]")) $("[data-action=connect]").textContent = source ? "Cancel connection" : "Connect →";
    $(".aw-select").innerHTML = '<option value="">Select on the canvas or here</option>' + choices + diagram.edges.map(e => `<option value="${esc(e.id)}">${esc(diagram.nodes.find(n => n.id === e.source).label)} → ${esc(diagram.nodes.find(n => n.id === e.target).label)}</option>`).join("");
    $(".aw-select").value = selected;
    $("[data-setting=traffic]").value = diagram.traffic;
    $(".aw-failure").innerHTML = '<option value="">All components healthy</option>' + choices;
    $(".aw-failure").value = failed;
    $(".aw-analysis").innerHTML = `<div class="aw-results"><div><b>${analysis.cyclic ? "—" : analysis.bottlenecks.length}</b><span>over capacity</span></div><div><b>${analysis.latency === null ? "—" : fmt(analysis.latency) + " ms"}</b><span>base sync path</span></div><div><b>${analysis.disconnected.length}</b><span>disconnected</span></div></div>${analysis.bottlenecks.length ? `<p class="aw-risk">Bottleneck: ${analysis.bottlenecks.map(id => esc(diagram.nodes.find(n => n.id === id).label)).join(", ")}. Add capacity or reduce offered traffic.</p>` : ""}<ul class="aw-warnings">${analysis.warnings.map(w => `<li>${esc(w)}</li>`).join("")}</ul>`;
    host.querySelectorAll("input,select,textarea,button").forEach(el => { el.disabled = disabled; });
    $("[data-action=undo]").disabled = disabled || !history.length;
    $("[data-action=redo]").disabled = disabled || !future.length;
    estimates();
  }
  function estimates() {
    const values = Object.fromEntries([...host.querySelectorAll("[data-estimate]")].map(el => [el.dataset.estimate, Number(el.value)]));
    const valid = [...host.querySelectorAll("[data-estimate]")].every(el => el.value && el.checkValidity());
    const e = estimateCapacity(values.daily, values.peak, values.bytes, values.days);
    $(".aw-estimate-output").innerHTML = valid ? `<b>${fmt(e.averageQps)} <small>avg QPS</small></b><b>${fmt(e.peakQps)} <small>peak QPS</small></b><b>${fmt(e.storageGB)} <small>GB stored</small></b><b>${fmt(e.bandwidthMbps)} <small>Mbps peak</small></b>` : "Enter valid nonnegative estimates.";
  }
  function fit() {
    if (!diagram.nodes.length) view = { x: 0, y: 0, width: 1200, height: 720 };
    else { const minX = Math.min(...diagram.nodes.map(n => n.x)) - 60, minY = Math.min(...diagram.nodes.map(n => n.y)) - 60;
      const width = Math.max(700, Math.max(...diagram.nodes.map(n => n.x)) + 250 - minX), height = Math.max(420, Math.max(...diagram.nodes.map(n => n.y)) + 144 - minY);
      view = { x: minX, y: minY, width: Math.max(width, height * 5 / 3), height: Math.max(height, width * 3 / 5) }; }
    render();
  }
  function action(name) {
    if (disabled) return;
    if (name === "undo" && history.length) { future.push(snapshot()); diagram = JSON.parse(history.pop()); selected = source = ""; options.onChange?.(parseDiagram(diagram)); render(); }
    if (name === "redo" && future.length) { history.push(snapshot()); diagram = JSON.parse(future.pop()); selected = source = ""; options.onChange?.(parseDiagram(diagram)); render(); }
    if (name === "connect") { source = source ? "" : selected; announce(source ? "Select a destination on the canvas." : "Connection cancelled."); render(); }
    if (name === "delete") mutate(() => { diagram.nodes = diagram.nodes.filter(n => n.id !== selected); diagram.edges = diagram.edges.filter(e => e.id !== selected && e.source !== selected && e.target !== selected); if (failed === selected) failed = ""; selected = source = ""; });
    if (name === "fit") fit();
    if (name === "in" || name === "out") { const factor = name === "in" ? .8 : 1.25; if (view.width * factor < 300 || view.width * factor > 4800) return; view.x += view.width * (1 - factor) / 2; view.y += view.height * (1 - factor) / 2; view.width *= factor; view.height *= factor; render(); }
    if (name === "starter") mutate(() => { const a = add("client", 80, 180), b = add("service", 440, 180), c = add("database", 800, 180); wire(a, b); wire(b, c); });
    if (name === "import") $(".aw-file").click();
    if (name === "export") { const url = URL.createObjectURL(new Blob([JSON.stringify(diagram, null, 2)], { type: "application/json" })); const a = document.createElement("a"); a.href = url; a.download = "scalesketch-diagram.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  function onClick(event) {
    const button = event.target.closest("button");
    if (button?.dataset.add) return mutate(() => { add(button.dataset.add); });
    if (button?.dataset.action) return action(button.dataset.action);
    const node = event.target.closest("[data-node]"), edge = event.target.closest("[data-edge]");
    if (disabled || drag?.moved) return;
    if (node) { const id = node.dataset.node; if (source && source !== id) return mutate(() => { wire(source, id); selected = id; }); selected = id; render(); }
    else if (edge) { selected = edge.dataset.edge; render(); }
  }
  function point(event) { const p = new DOMPoint(event.clientX, event.clientY); return p.matrixTransform($(".aw-canvas").getScreenCTM().inverse()); }
  function onDown(event) {
    const node = event.target.closest("[data-node]");
    if (disabled || source || event.button !== 0) return;
    if (!node) {
      if (!event.target.matches(".aw-grid")) return;
      drag = { pan: true, x: event.clientX, y: event.clientY, view: { ...view }, moved: false };
      $(".aw-canvas").setPointerCapture(event.pointerId); return;
    }
    const n = diagram.nodes.find(n => n.id === node.dataset.node), p = point(event);
    drag = { id: n.id, x: p.x - n.x, y: p.y - n.y, before: snapshot(), moved: false, pointerId: event.pointerId };
    $(".aw-canvas").setPointerCapture(event.pointerId);
  }
  function onMove(event) {
    if (!drag) return;
    if (drag.pan) {
      const matrix = $(".aw-canvas").getScreenCTM();
      view.x = drag.view.x - (event.clientX - drag.x) / matrix.a;
      view.y = drag.view.y - (event.clientY - drag.y) / matrix.d;
      drag.moved = true; $(".aw-canvas").setAttribute("viewBox", `${view.x} ${view.y} ${view.width} ${view.height}`); return;
    }
    const n = diagram.nodes.find(n => n.id === drag.id), p = point(event);
    const x = Math.max(0, Math.min(2400, Math.round(p.x - drag.x))), y = Math.max(0, Math.min(1400, Math.round(p.y - drag.y)));
    if (Math.abs(n.x - x) + Math.abs(n.y - y) < 3 && !drag.moved) return;
    n.x = x; n.y = y; drag.moved = true;
    // Only redraw the graph during a drag, preserving pointer capture on the SVG.
    render();
  }
  function onUp(event) {
    if (!drag) return;
    const previous = drag; drag = null;
    if ($(".aw-canvas").hasPointerCapture(event.pointerId)) $(".aw-canvas").releasePointerCapture(event.pointerId);
    if (previous.moved && !previous.pan) { selected = previous.id; commit(previous.before); }
  }
  function onInput(event) {
    const el = event.target, key = el.dataset.nodeProp;
    if (disabled || !["label", "notes"].includes(key)) return;
    const node = diagram.nodes.find(n => n.id === selected);
    if (!node) return;
    editingBefore ??= snapshot();
    node[key] = key === "label" ? (el.value.trim() || node.label) : el.value;
    options.onChange?.(parseDiagram(diagram));
  }
  async function onChange(event) {
    const el = event.target;
    if (disabled) return;
    if (el.matches(".aw-file")) {
      const file = el.files[0]; el.value = ""; if (!file) return;
      try { if (file.size > 200000) throw new Error("Diagram files must be smaller than 200 KB."); const next = parseDiagram(JSON.parse(await file.text())); mutate(() => { diagram = next; selected = source = failed = ""; }); fit(); announce("Diagram imported. Undo restores the previous canvas."); } catch (e) { announce(e.message); }
    } else if (el.matches(".aw-select")) { selected = el.value; render(); }
    else if (el.matches(".aw-failure")) { failed = el.value; render(); }
    else if (el.dataset.estimate) estimates();
    else if (el.dataset.nodeProp || el.dataset.edgeProp || el.dataset.setting) {
      if (!el.checkValidity() || (el.type === "number" && !el.value)) return announce("Enter a value within the field limits.");
      if (editingBefore && ["label", "notes"].includes(el.dataset.nodeProp)) { const before = editingBefore; editingBefore = null; commit(before); return; }
      mutate(() => {
        if (el.dataset.nodeProp) { const n = diagram.nodes.find(n => n.id === selected), key = el.dataset.nodeProp; n[key] = ["label", "notes"].includes(key) ? (el.value.trim() || (key === "label" ? n.label : "")) : Number(el.value); }
        if (el.dataset.edgeProp) { const e = diagram.edges.find(e => e.id === selected), key = el.dataset.edgeProp; e[key] = key === "async" ? el.value === "true" : key === "fraction" ? Number(el.value) / 100 : el.value; }
        if (el.dataset.setting) diagram.traffic = Number(el.value);
      });
    }
  }
  function onSubmit(event) { if (!event.target.matches(".aw-wire")) return; event.preventDefault(); mutate(() => wire($(".aw-wire [name=source]").value, $(".aw-wire [name=target]").value)); }
  function onKey(event) {
    if (event.target.matches("input,textarea,select") || disabled) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); action(event.shiftKey ? "redo" : "undo"); }
    if (["Delete", "Backspace"].includes(event.key) && selected) { event.preventDefault(); action("delete"); }
    if (event.key.startsWith("Arrow") && diagram.nodes.some(n => n.id === selected)) { event.preventDefault(); mutate(() => { const n = diagram.nodes.find(n => n.id === selected), delta = event.shiftKey ? 40 : 10; n.x = Math.max(0, Math.min(2400, n.x + (event.key === "ArrowRight" ? delta : event.key === "ArrowLeft" ? -delta : 0))); n.y = Math.max(0, Math.min(1400, n.y + (event.key === "ArrowDown" ? delta : event.key === "ArrowUp" ? -delta : 0))); }); }
  }
  host.tabIndex = 0;
  const listeners = { click: onClick, input: onInput, change: onChange, submit: onSubmit, pointerdown: onDown, pointermove: onMove, pointerup: onUp, pointercancel: onUp, keydown: onKey };
  for (const [event, handler] of Object.entries(listeners)) host.addEventListener(event, handler);
  render(); fit();
  return { setDisabled(value) { disabled = value; render(); }, destroy() { for (const [event, handler] of Object.entries(listeners)) host.removeEventListener(event, handler); host.replaceChildren(); } };
}
