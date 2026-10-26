// Deterministic teaching tools shared by both UIs and the server. No runtime dependencies.
export const COMPONENTS = [
  { type: "client", label: "Client", icon: "◎", capacity: 1000000, latency: 0, color: "#c7f36b", tip: "Start a request here. State users, access patterns, and peak traffic." },
  { type: "cdn", label: "CDN", icon: "◈", capacity: 100000, latency: 5, color: "#a8ddf5", tip: "Cache public assets near users. Define TTLs, invalidation, and private-content access." },
  { type: "balancer", label: "Load balancer", icon: "⑂", capacity: 50000, latency: 2, color: "#bfc7ff", tip: "Splits requests equally across outgoing connections. Discuss health checks and draining." },
  { type: "service", label: "API service", icon: "◇", capacity: 1000, latency: 10, color: "#c7f36b", tip: "Define one responsibility, API contract, timeout budget, and idempotency boundary." },
  { type: "cache", label: "Cache", icon: "ϟ", capacity: 20000, latency: 1, color: "#f6d28d", tip: "Set the cache-to-database traffic share to the miss rate. Discuss stale reads and stampedes." },
  { type: "database", label: "SQL database", icon: "▤", capacity: 2000, latency: 8, color: "#bfc7ff", tip: "Choose keys and indexes from access patterns. Replicas add reads; writes need a partitioning strategy." },
  { type: "nosql", label: "NoSQL store", icon: "▥", capacity: 5000, latency: 5, color: "#bfc7ff", tip: "Explain partition keys, hot partitions, consistency, and conditional updates." },
  { type: "queue", label: "Message queue", icon: "≋", capacity: 10000, latency: 3, color: "#f6d28d", tip: "Use an async connection for background work. Plan retries, dead letters, and consumer idempotency." },
  { type: "worker", label: "Worker", icon: "⚙", capacity: 500, latency: 30, color: "#f5bbaa", tip: "Bound concurrency and queue age. Explain what happens after a crash mid-task." },
  { type: "storage", label: "Object storage", icon: "▱", capacity: 10000, latency: 20, color: "#a8ddf5", tip: "Separate metadata from blobs. Cover signed uploads, lifecycle, and content validation." },
  { type: "search", label: "Search index", icon: "⌕", capacity: 3000, latency: 15, color: "#f5bbaa", tip: "Treat the index as derived data. Explain freshness, reindexing, and tenant filtering." },
  { type: "gateway", label: "API gateway", icon: "⊞", capacity: 15000, latency: 3, color: "#a8ddf5", tip: "Enforce identity, quotas, and request limits. Avoid turning the gateway into a single failure point." },
];
export const PHASES = [
  { name: "Clarify", share: 0.11, prompt: "Who uses this system? Name the top two use cases, exclusions, latency target, and consistency requirement." },
  { name: "Estimate", share: 0.11, prompt: "Convert daily requests into average and peak QPS. Estimate storage and bandwidth with explicit units." },
  { name: "Contract", share: 0.16, prompt: "Write the main API/event payloads, entity keys, indexes, and idempotency boundaries in your notes." },
  { name: "Draw", share: 0.34, prompt: "Trace a write and a read from client to storage. Label protocols and mark background work as async." },
  { name: "Defend", share: 0.28, prompt: "Fail a component, find the bottleneck, and defend consistency, recovery, security, and cost trade-offs." },
];
export function phaseAt(elapsed, total) {
  let boundary = 0;
  return PHASES.findIndex((phase, index) => { boundary += phase.share * total; return elapsed < boundary || index === PHASES.length - 1; });
}
export function emptyDiagram() { return { version: 1, nodes: [], edges: [], traffic: 1000 }; }
const finite = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const shortText = (value, max) => typeof value === "string" && value.length <= max;
export function parseDiagram(value) {
  if (!value || value.version !== 1 || !Array.isArray(value.nodes) || !Array.isArray(value.edges)
    || value.nodes.length > 60 || value.edges.length > 120 || !finite(value.traffic, 0, 1000000000)) throw new Error("Invalid diagram or diagram limits exceeded (60 components, 120 connections).");
  const ids = new Set();
  const nodes = value.nodes.map(node => {
    if (!node || !shortText(node.id, 80) || !node.id || ids.has(node.id) || !COMPONENTS.some(item => item.type === node.type)
      || !shortText(node.label, 100) || !node.label.trim() || !shortText(node.notes, 1200)
      || !finite(node.x, 0, 2400) || !finite(node.y, 0, 1400) || !finite(node.capacity, 1, 1000000000)
      || !Number.isInteger(node.replicas) || node.replicas < 1 || node.replicas > 1000 || !finite(node.latency, 0, 60000)) throw new Error("Invalid diagram component.");
    ids.add(node.id);
    return Object.fromEntries(["id", "type", "label", "notes", "x", "y", "capacity", "replicas", "latency"].map(key => [key, node[key]]));
  });
  const pairs = new Set(), edgeIds = new Set();
  const edges = value.edges.map(edge => {
    const pair = `${edge?.source}->${edge?.target}`;
    if (!edge || !shortText(edge.id, 80) || !edge.id || edgeIds.has(edge.id) || !ids.has(edge.source) || !ids.has(edge.target)
      || edge.source === edge.target || pairs.has(pair) || !["HTTP", "gRPC", "WebSocket", "SQL", "Events"].includes(edge.protocol)
      || typeof edge.async !== "boolean" || !finite(edge.fraction, 0, 1)) throw new Error("Invalid or duplicate diagram connection.");
    edgeIds.add(edge.id); pairs.add(pair);
    return Object.fromEntries(["id", "source", "target", "protocol", "async", "fraction"].map(key => [key, edge[key]]));
  });
  return { version: 1, nodes, edges, traffic: value.traffic };
}
export function describeDiagram(diagram) {
  if (!diagram?.nodes.length) return "";
  return "ARCHITECTURE DIAGRAM (candidate-supplied assumptions, not measured benchmarks)\n"
    + `Offered traffic: ${diagram.traffic} requests/sec\n`
    + diagram.nodes.map(n => `[${n.id}] ${n.label} (${n.type}); ${n.replicas} replicas; assumed ${n.capacity} requests/sec/replica; ${n.latency} ms; ${n.notes}`).join("\n")
    + "\nConnections:\n" + diagram.edges.map(e => `[${e.source}] -> [${e.target}] ${e.protocol}, ${e.async ? "async" : "sync"}, traffic share ${Math.round(e.fraction * 100)}%`).join("\n");
}
export function designSubmission(answer, diagram) { return [answer, describeDiagram(diagram)].filter(Boolean).join("\n\n"); }
export function estimateCapacity(daily, peak, bytes, days) {
  return { averageQps: daily / 86400, peakQps: daily / 86400 * peak, storageGB: daily * bytes * days / 1e9, bandwidthMbps: daily / 86400 * peak * bytes * 8 / 1e6 };
}
export function analyzeDiagram(diagram, failedId = "") {
  const { nodes, edges, traffic } = diagram;
  const byId = new Map(nodes.map(n => [n.id, n]));
  const outgoing = new Map(nodes.map(n => [n.id, edges.filter(e => e.source === n.id)]));
  const explicit = nodes.filter(n => n.type === "client");
  const entries = explicit.length ? explicit : nodes.filter(n => !edges.some(e => e.target === n.id) && outgoing.get(n.id).length);
  const reachable = new Set(), queue = entries.map(n => n.id);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]; if (reachable.has(id)) continue; reachable.add(id);
    for (const e of outgoing.get(id)) if (e.fraction > 0) queue.push(e.target);
  }
  const activeEdges = edges.filter(e => reachable.has(e.source) && reachable.has(e.target) && e.fraction > 0);
  const indegree = new Map([...reachable].map(id => [id, activeEdges.filter(e => e.target === id).length]));
  const ready = [...reachable].filter(id => indegree.get(id) === 0), order = [];
  for (let i = 0; i < ready.length; i++) {
    const id = ready[i]; order.push(id);
    for (const e of activeEdges.filter(e => e.source === id)) { indegree.set(e.target, indegree.get(e.target) - 1); if (!indegree.get(e.target)) ready.push(e.target); }
  }
  const warnings = [], metrics = [];
  const disconnected = nodes.filter(n => !reachable.has(n.id));
  if (!entries.length && nodes.length) warnings.push("No entry path. Add a client and connect it to the system.");
  if (disconnected.length) warnings.push(`${disconnected.map(n => n.label).join(", ")} disconnected from offered traffic.`);
  if (order.length !== reachable.size) return { metrics: [], warnings: [...warnings, "A reachable cycle prevents this DAG model from estimating traffic. Separate request, response, and feedback paths."], latency: null, bottlenecks: [], disconnected: disconnected.map(n => n.id), cyclic: true };
  const incoming = new Map(nodes.map(n => [n.id, 0])), latencies = new Map();
  for (const n of entries) { incoming.set(n.id, traffic / entries.length); latencies.set(n.id, 0); }
  for (const id of order) {
    const n = byId.get(id), qps = incoming.get(id), cap = id === failedId ? 0 : n.capacity * n.replicas;
    const utilization = cap ? qps / cap : qps ? Infinity : 0;
    const served = Math.min(qps, cap);
    const base = latencies.get(id);
    const latency = base === undefined ? null : base + n.latency;
    metrics.push({ id, qps, capacity: cap, utilization, dropped: qps - served, latency, failed: id === failedId });
    const links = activeEdges.filter(e => e.source === id);
    for (const e of links) {
      incoming.set(e.target, incoming.get(e.target) + served * e.fraction / (n.type === "balancer" ? links.length : 1));
      if (!e.async && latency !== null) latencies.set(e.target, Math.max(latencies.get(e.target) ?? 0, latency));
    }
    if (qps > 0 && n.replicas === 1 && ["service", "database", "nosql", "queue", "balancer", "gateway"].includes(n.type)) warnings.push(`${n.label}: one instance; explain failover and recovery.`);
  }
  const bottlenecks = metrics.filter(m => m.utilization > 1).map(m => m.id);
  return { metrics, warnings, latency: Math.max(0, ...metrics.map(m => m.latency ?? 0)), bottlenecks, disconnected: disconnected.map(n => n.id), cyclic: false };
}
