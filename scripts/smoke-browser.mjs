// Browser integration checks using installed Edge and its DevTools protocol.
// Uses a fresh temporary browser profile; no paid AI calls or browser packages.
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import assert from "node:assert/strict";

const browser = process.env.BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const profile = await mkdtemp(path.join(os.tmpdir(), "hld-browser-"));
const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); }); });
const processHandle = spawn(browser, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions", `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
let socket;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let version;
  for (let i = 0; i < 100; i++) { try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(100); } }
  if (!version) throw new Error("Edge did not expose its debugging endpoint.");
  socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const waiting = new Map(), errors = [], requests = [];
  socket.onmessage = async event => {
    const message = JSON.parse(event.data);
    if (message.id) { const pending = waiting.get(message.id); waiting.delete(message.id); if (message.error) pending?.reject(new Error(JSON.stringify(message.error))); else pending?.resolve(message.result); }
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text + ": " + (message.params.exceptionDetails.exception?.description ?? ""));
    if (message.method === "Fetch.requestPaused") {
      const { requestId, request } = message.params;
      requests.push(JSON.parse(request.postData));
      await send("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: "application/json" }], body: Buffer.from(JSON.stringify({ score: 74, summary: "Browser fixture review.", strengths: ["Connected request path", "Explicit storage"], improvements: ["Specify failover", "Define timeouts"], followUp: "What happens during a database failure?", findings: [{ severity: "high", dimension: "reliability", title: "Plan database recovery", evidence: "general", recommendation: "Add a restore drill with a recovery target." }] })).toString("base64") }, message.sessionId);
    }
  };
  function send(method, params = {}, sessionId) {
    const id = ++nextId;
    return new Promise((resolve, reject) => { waiting.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });
  }
  async function page(url, worker) {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const cmd = (method, params) => send(method, params, sessionId);
    const evaluate = async expression => {
      const r = await cmd("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    };
    const wait = async expression => { for (let i = 0; i < 150; i++) { if (await evaluate(expression)) return; await sleep(200); } throw new Error("Timed out: " + expression + "\n" + errors.join("\n") + "\n" + await evaluate("document.body.innerText.slice(-1500)")); };
    const click = async selector => { await wait(`!!document.querySelector(${JSON.stringify(selector)})`); await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); };
    const set = async (selector, value) => evaluate(`(() => {const el=document.querySelector(${JSON.stringify(selector)}); el.value=${JSON.stringify(value)}; el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await cmd("Page.enable"); await cmd("Runtime.enable");
    await cmd("Fetch.enable", { patterns: [{ urlPattern: "*/api/coach", requestStage: "Request" }] });
    await cmd("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    await cmd("Page.navigate", { url });
    await wait(worker ? "document.querySelectorAll('.challenge').length===30" : "!!document.querySelector('[data-ready=true]')");
    await click(worker ? "#begin" : "button.primary-button");
    await wait("!!document.querySelector('.aw-canvas')");
    await click('[data-action="starter"]');
    assert.equal(await evaluate("document.querySelectorAll('[data-node]').length"), 3);
    assert.equal(await evaluate("document.querySelectorAll('[data-edge]').length"), 2);
    await set('[data-node-prop="notes"]', 'Owns aliases; use a unique index and replication. Define restore time and authorization for private links.');
    await set('[data-setting="traffic"]', '9000');
    await wait("document.querySelector('.aw-analysis').textContent.includes('Bottleneck')");
    await click('[data-add="cache"]');
    await wait("document.querySelector('.aw-analysis').textContent.includes('disconnected')");
    const nodeId = await evaluate("document.querySelector('[data-node]:last-child').dataset.node");
    await set('.aw-failure', nodeId);
    await click('[data-action="undo"]');
    assert.equal(await evaluate("document.querySelectorAll('[data-node]').length"), 3);
    await click('[data-action="redo"]');
    assert.equal(await evaluate("document.querySelectorAll('[data-node]').length"), 4);
    // Pointer-driven dragging through the actual browser input system.
    const start = await evaluate("(() => {const r=document.querySelector('[data-node]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()");
    const original = await evaluate("document.querySelector('[data-node]').getAttribute('transform')");
    await cmd("Input.dispatchMouseEvent", { type: "mousePressed", button: "left", clickCount: 1, x: start.x, y: start.y });
    await cmd("Input.dispatchMouseEvent", { type: "mouseMoved", button: "left", buttons: 1, x: start.x + 40, y: start.y + 20 });
    await cmd("Input.dispatchMouseEvent", { type: "mouseReleased", button: "left", clickCount: 1, x: start.x + 40, y: start.y + 20 });
    assert.notEqual(await evaluate("document.querySelector('[data-node]').getAttribute('transform')"), original);
    const stored = await evaluate("JSON.parse(localStorage.getItem('architect-lab-progress-v1'))");
    assert.equal(stored['short-links'].diagram.nodes.length, 4);
    assert.equal(stored['short-links'].diagram.traffic, 9000);
    if (!worker) await click('#session-tab-notes');
    await wait(worker ? "!!document.querySelector('#answer')" : "!!document.querySelector('textarea.design-editor')");
    // Framework native textarea setter triggers React's controlled-input handler.
    const noteSelector = worker ? '#answer' : 'textarea.design-editor';
    await evaluate(`(() => {const el=document.querySelector(${JSON.stringify(noteSelector)});Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'1000 requests per second. POST /links accepts a URL. Use SQL with a unique index and cache reads because they dominate. Retry on timeout with idempotency. Check tenant authorization.');el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await click(worker ? '#ai-review' : '.session-footer button.primary-button');
    await wait("document.body.textContent.includes('Plan database recovery')");
    const submitted = requests.at(-1);
    assert.equal(submitted.diagram.nodes.length, 4);
    assert.ok(submitted.answer.includes('POST /links'));
    await click(worker ? '#close' : '.session-header button[aria-label="Close practice room"]');
    await click(worker ? '#begin' : 'button.primary-button');
    await wait("document.querySelectorAll('[data-node]').length===4");
    await cmd("Page.captureScreenshot", { format: "png" }).then(async r => { await mkdir('outputs', { recursive: true }); await writeFile(`outputs/${worker ? 'worker' : 'framework'}-desktop.png`, Buffer.from(r.data, 'base64')); });
    await cmd("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await sleep(200);
    assert.equal(await evaluate("document.documentElement.scrollWidth > window.innerWidth"), false, 'Mobile page should not overflow horizontally');
    assert.equal(await evaluate("document.querySelector('.architecture-workbench').scrollWidth > document.querySelector('.architecture-workbench').clientWidth"), false, 'Mobile workbench content should fit its container');
    if (!worker) { await click('#session-tab-review'); assert.ok(await evaluate("document.querySelector('.session-review').getClientRects().length>0")); await click('#session-tab-canvas'); }
    await cmd("Page.captureScreenshot", { format: "png" }).then(async r => { await writeFile(`outputs/${worker ? 'worker' : 'framework'}-mobile.png`, Buffer.from(r.data, 'base64')); });
    const previousOrigin = await evaluate("performance.timeOrigin");
    await cmd("Page.reload");
    await wait(`performance.timeOrigin !== ${previousOrigin}`);
    await wait(worker ? "document.querySelectorAll('.challenge').length===30" : "!!document.querySelector('[data-ready=true]')");
    await click(worker ? '#begin' : 'button.primary-button');
    await wait("document.querySelectorAll('[data-node]').length===4");
    console.log(`${worker ? 'Worker' : 'Framework'} browser checks passed: draw, connect, edit, drag, undo/redo, traffic, review payload, grounded findings UI, autosave, reopen, reload, and mobile layout.`);
    await send("Target.closeTarget", { targetId });
  }
  for (const url of process.argv.slice(2).length ? process.argv.slice(2) : ["http://127.0.0.1:5173", "http://127.0.0.1:8787"]) await page(url, url.includes('8787'));
  assert.deepEqual(errors, [], 'Unexpected browser exceptions');
} finally {
  socket?.close(); processHandle.kill();
  // Remove only the verified temporary profile generated by this script.
  if (path.dirname(profile) === path.resolve(os.tmpdir()) && path.basename(profile).startsWith('hld-browser-')) {
    try { await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 }); } catch { /* Edge may retain handles briefly. */ }
  }
}
