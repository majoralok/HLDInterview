"""Build a standalone Worker and Python learning material using the standard library."""

import ast
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]

LESSONS = {
    "short-links": ("estimate_capacity", "Quantify read traffic separately from writes. Size the cache for hot links and discuss collision retries."),
    "rate-limiter": ("TokenBucket", "Explain refill and bursts, then move the read-modify-write into one atomic operation per quota key."),
    "paste-service": ("chunk_digest", "Separate content blobs from access metadata. A digest identifies content; it never grants access."),
    "activity-feed": ("page_after", "Use a unique tie-breaker for stable pagination. Explain fan-out decisions separately from ranking."),
    "chat": ("page_after", "Resume from a conversation sequence and unique message ID. Discuss deduplication and retention gaps."),
    "cloud-drive": ("chunk_digest", "Hash chunks for integrity and deduplication; enforce tenant ownership before exposing a matching blob."),
    "video": ("estimate_capacity", "Model segment bandwidth and regional concurrency. Account for encoding ladders and CDN cache misses."),
    "autocomplete": ("reciprocal_rank_fusion", "Combine ranked suggestion sources; explain prefix retrieval, language handling, and freshness separately."),
    "notifications": ("Ledger", "An idempotency key must identify one logical operation. External provider delivery needs its own deduplication boundary."),
    "ticketing": ("Ledger", "Use an atomic state transition for inventory ownership. A payment retry must not consume inventory twice."),
    "metrics": ("estimate_capacity", "Estimate samples per second, bytes per sample, and retention tiers; cardinality adds metadata overhead."),
    "crawler": ("TokenBucket", "Use one politeness budget per host; partition ownership so independent workers cannot exceed the shared budget."),
    "collaborative-editor": ("page_after", "An ordered operation log helps replay; it does not resolve concurrent edits. Choose CRDT or OT and prove convergence."),
    "ride-dispatch": ("TokenBucket", "Bound admission during demand spikes. Matching still needs geospatial search and an atomic driver lease."),
    "ledger": ("Ledger", "Keep money in integer minor units. Commit balanced entries and the idempotency record in one durable transaction."),
    "feature-flags": ("rollout_enabled", "Use deterministic hashing rather than Python's randomized hash(). Keep identity encoding consistent across SDKs."),
    "rag": ("reciprocal_rank_fusion", "Fuse lexical and vector candidates only after tenant and document ACL filtering; enforce deletes before generation."),
    "model-serving": ("TokenBucket", "Budget tokens as well as requests. Separate admission quotas from GPU batching and KV-cache scheduling."),
    "distributed-cache": ("estimate_capacity", "Size the hot working set separately from the full dataset; add replication, value overhead, and headroom."),
    "message-queue": ("Ledger", "A durable acknowledgement and a business side effect have separate commit boundaries. Use an idempotent consumer or transactional outbox."),
    "job-scheduler": ("Ledger", "Bind the idempotency key to one scheduled occurrence. A lease needs a fencing token; an in-memory lock cannot fence another worker."),
    "load-balancer": ("TokenBucket", "Admission control bounds traffic reaching a backend pool. Explain health, routing, draining, and retry budgets separately."),
    "dns": ("estimate_capacity", "Estimate lookup traffic, cache hit rate, and per-record overhead. Account for TTL expiry and negative-cache entries."),
    "product-search": ("reciprocal_rank_fusion", "Combine independently ranked candidate sources. Price and inventory correctness still belong to the checkout source of truth."),
    "ad-clicks": ("Ledger", "A replayed event must not apply a billable effect twice. Production deduplication must survive restarts and have an explicit retention window."),
    "log-pipeline": ("estimate_capacity", "Separate raw bytes, compressed archive size, and indexed size. Include replication and incident-driven ingestion spikes."),
    "unique-ids": ("estimate_capacity", "First quantify peak ID generation and per-node sequence capacity. This capacity model does not implement a unique ID algorithm."),
    "webhooks": ("TokenBucket", "Maintain a destination-specific dispatch budget, then add durable retry state and signed event identities."),
    "location-sharing": ("page_after", "A sequence cursor helps reconnecting viewers catch up. Recheck session ACLs and reject stale position updates."),
    "ai-evaluation": ("chunk_digest", "Hash immutable dataset artifacts for lineage. Pin model, prompt, sampling, and judge versions in the run manifest too."),
}


def learning_material() -> dict:
    source = (ROOT / "examples/python/patterns.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    imports = "\n".join(ast.get_source_segment(source, node) for node in tree.body
                        if isinstance(node, (ast.Import, ast.ImportFrom)))
    snippets = {}
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.ClassDef)):
            start = min([node.lineno] + [item.lineno for item in node.decorator_list])
            snippets[node.name] = "\n".join(source.splitlines()[start - 1:node.end_lineno])
    return {key: {"pattern": name, "note": note, "code": imports + "\n\n\n" + snippets[name]}
            for key, (name, note) in LESSONS.items()}


def build() -> None:
    problems = json.loads((ROOT / "data/problems.json").read_text(encoding="utf-8"))
    lessons = learning_material()
    if {problem["id"] for problem in problems} != lessons.keys():
        raise ValueError("Every challenge must have Python learning material")
    # This JSON is derived, but tracked so framework builds do not require Python.
    (ROOT / "data/python-lessons.json").write_text(
        json.dumps(lessons, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    source = (ROOT / "worker/index.js").read_text(encoding="utf-8")
    source = source.replace('import { readReviewRequest } from "../lib/review-request.js";',
                            (ROOT / "lib/review-request.js").read_text(encoding="utf-8").replace("export ", ""))
    core = (ROOT / "public/practice-core.js").read_text(encoding="utf-8")
    for marker, value in [("const PROBLEMS = []; // @build:problems", problems),
                          ("const LESSONS = {}; // @build:lessons", lessons),
                          ('const CORE_JS = ""; // @build:core', core),
                          ('const APP_JS = ""; // @build:app', (ROOT / "public/worker-app.js").read_text(encoding="utf-8"))]:
        if marker not in source:
            raise ValueError(f"Missing build marker: {marker}")
        source = source.replace(marker, marker.split(" = ")[0] + " = " + json.dumps(value, ensure_ascii=False) + ";", 1)
    dist = ROOT / "dist"
    if dist.is_symlink() or dist.resolve().parent != ROOT:
        raise ValueError("Refusing to replace dist outside the checkout")
    if dist.exists():
        shutil.rmtree(dist)
    (dist / "server").mkdir(parents=True)
    (dist / ".openai").mkdir()
    (dist / "server/index.js").write_text(source, encoding="utf-8")
    hosting = json.loads((ROOT / ".openai/hosting.json").read_text(encoding="utf-8"))
    hosting.pop("static", None)
    (dist / ".openai/hosting.json").write_text(json.dumps(hosting, indent=2) + "\n", encoding="utf-8")
    print("Built standalone Worker and Python lessons in dist/.")


if __name__ == "__main__":
    build()
