import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const entry = path.join(root, "dist", "server", "index.js");
const manifestPath = path.join(root, "dist", ".openai", "hosting.json");
if (!existsSync(entry) || !existsSync(manifestPath)) throw new Error("Worker artifact is incomplete.");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
if (!manifest.project_id || manifest.static) throw new Error("Worker hosting manifest is invalid.");

const worker = (await import(`${pathToFileURL(entry).href}?v=${Date.now()}`)).default;
if (!worker || typeof worker.fetch !== "function") throw new Error("Worker must export fetch().");

const home = await worker.fetch(new Request("https://architect-lab.test/"), {}, {});
const css = await worker.fetch(new Request("https://architect-lab.test/app.css"), {}, {});
const clientScript = await worker.fetch(new Request("https://architect-lab.test/app.js"), {}, {});
const health = await worker.fetch(new Request("https://architect-lab.test/api/health"), {}, {});
const missingKey = await worker.fetch(new Request("https://architect-lab.test/api/coach", {
  method: "POST",
  headers: { "content-type": "application/json", origin: "https://architect-lab.test" },
  body: JSON.stringify({ problem: { title: "Test", requirements: [], constraints: [] }, answer: "A".repeat(140) }),
}), {}, {});

if (home.status !== 200 || !(await home.text()).includes("Architect Lab")) throw new Error("Home smoke test failed.");
if (css.status !== 200 || !(await css.text()).includes("--lime")) throw new Error("CSS smoke test failed.");
if (clientScript.status !== 200) throw new Error("Client JavaScript route failed.");
new Function(await clientScript.text());
if (health.status !== 200) throw new Error("Health endpoint failed.");
if (missingKey.status !== 503) throw new Error("Missing-key safety path failed.");
console.log("Worker artifact validated: home, CSS, health, and safe AI fallback.");
