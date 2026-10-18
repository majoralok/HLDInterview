import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(path.join(dist, "server"), { recursive: true });
mkdirSync(path.join(dist, ".openai"), { recursive: true });
cpSync(path.join(root, "worker", "index.js"), path.join(dist, "server", "index.js"));

const hosting = JSON.parse(readFileSync(path.join(root, ".openai", "hosting.json"), "utf8"));
delete hosting.static;
writeFileSync(path.join(dist, ".openai", "hosting.json"), `${JSON.stringify(hosting, null, 2)}\n`);
console.log("Built dependency-free Worker artifact in dist/.");
