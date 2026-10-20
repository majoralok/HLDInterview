// Compatibility entry point; the build implementation lives in Python.
import { spawnSync } from "node:child_process";
import path from "node:path";

const result = spawnSync("python", [path.join(import.meta.dirname, "build_worker.py")], { stdio: "inherit" });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
