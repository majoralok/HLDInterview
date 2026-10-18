export type Difficulty = "Foundation" | "Intermediate" | "Advanced";
export type Category =
  | "Core patterns"
  | "Data intensive"
  | "Real time"
  | "Infrastructure"
  | "AI systems";

export type DesignProblem = {
  id: string;
  order: number;
  title: string;
  shortTitle: string;
  summary: string;
  difficulty: Difficulty;
  category: Category;
  minutes: number;
  focus: string[];
  scale: string;
  requirements: string[];
  constraints: string[];
  checkpoints: string[];
  interviewerPush: string;
};

const p = (
  order: number,
  id: string,
  shortTitle: string,
  title: string,
  summary: string,
  difficulty: Difficulty,
  category: Category,
  minutes: number,
  scale: string,
  focus: string[],
  requirements: string[],
  constraints: string[],
  checkpoints: string[],
  interviewerPush: string,
): DesignProblem => ({
  order,
  id,
  shortTitle,
  title,
  summary,
  difficulty,
  category,
  minutes,
  scale,
  focus,
  requirements,
  constraints,
  checkpoints,
  interviewerPush,
});

export const problemBank: DesignProblem[] = [
  p(1, "short-links", "Short links", "Design a resilient short-link service", "Create compact links, redirect globally, and keep popular destinations fast without losing consistency.", "Foundation", "Core patterns", 35, "120M redirects/day · 8K writes/sec peak", ["key generation", "caching", "read-heavy traffic"], ["Create custom aliases", "Redirect with low latency", "Expire or disable a link", "Return basic click analytics"], ["p99 under 80 ms", "No alias collision", "Multi-region reads", "Creation abuse controls"], ["API and idempotency", "alias strategy", "cache policy", "partition key", "hot-link protection"], "A celebrity link receives three million requests in five minutes. What changes?"),
  p(2, "rate-limiter", "Rate limiter", "Design a distributed rate limiter", "Protect APIs with tenant-aware quotas while keeping enforcement fast across many gateway instances.", "Foundation", "Infrastructure", 40, "2M checks/sec · 40K tenants", ["token bucket", "atomicity", "failure modes"], ["Per-user and per-route limits", "Burst allowance", "Dynamic policy updates", "Standard limit headers"], ["Under 5 ms latency", "Bounded overshoot", "Regional fault tolerance", "Policy-based fail-open"], ["algorithm choice", "counter ownership", "atomic update", "config propagation", "fallback behavior"], "The shared counter store is unavailable for 45 seconds. Which customers fail open?"),
  p(3, "paste-service", "Paste service", "Design a secure paste service", "Store snippets with expiry, access controls, and efficient retrieval for public and private pastes.", "Foundation", "Core patterns", 35, "20M pastes · 10:1 read/write ratio", ["object storage", "TTL", "content safety"], ["Create text pastes", "Optional expiry and password", "Syntax-friendly display", "Delete owned content"], ["Strong private access", "Malware and secret scanning", "Cheap cold retention", "Fast public reads"], ["metadata vs blob storage", "ID entropy", "TTL cleanup", "authorization", "abuse pipeline"], "How do you remove a leaked credential from caches and replicas quickly?"),
  p(4, "activity-feed", "Activity feed", "Design a personalized activity feed", "Rank and deliver a fresh home feed for users who follow ordinary accounts and huge creators.", "Intermediate", "Data intensive", 45, "80M DAU · 12K posts/sec", ["fan-out", "ranking", "pagination"], ["Publish posts", "Follow accounts", "Rank a home feed", "Cursor pagination and hides"], ["p95 under 250 ms", "Fresh within seconds", "Celebrity traffic", "Eventual consistency"], ["fan-out strategy", "timeline store", "ranking stage", "cursor design", "repair path"], "A creator has 90 million followers. Explain the exact write and read path."),
  p(5, "chat", "Chat platform", "Design a multi-device chat platform", "Support durable direct and group messages, presence, delivery receipts, and offline synchronization.", "Intermediate", "Real time", 50, "25M connections · 700K messages/sec", ["WebSocket", "ordering", "offline sync"], ["Direct and group messages", "Delivery/read state", "Presence and typing", "Multi-device history"], ["Conversation ordering", "At-least-once transport", "Fast reconnect", "Encrypted transport"], ["connection gateway", "message IDs", "partitioning", "delivery state", "push notifications"], "A phone reconnects after a week while another device read half the messages. How does sync work?"),
  p(6, "cloud-drive", "Cloud drive", "Design a cloud file drive", "Upload large files, synchronize folders, preserve versions, and share content safely across devices.", "Intermediate", "Data intensive", 50, "2 PB/day ingress · files up to 100 GB", ["chunking", "deduplication", "sync conflicts"], ["Resumable uploads", "Folder sync", "Version history", "Secure sharing"], ["No corrupt partial files", "Duplicate efficiency", "Conflict handling", "Virus scanning"], ["chunk manifest", "upload protocol", "metadata model", "change journal", "garbage collection"], "Two offline laptops rename and edit the same file. What deterministic outcome do users see?"),
  p(7, "video", "Video streaming", "Design a global video streaming service", "Ingest source video, transcode adaptive renditions, and stream reliably through a global edge network.", "Intermediate", "Data intensive", 50, "8M concurrent viewers · 5K uploads/hour", ["transcoding", "CDN", "adaptive bitrate"], ["Video upload", "Transcoding pipeline", "Adaptive playback", "Continue watching"], ["Low startup delay", "No single-region dependency", "Cost-aware egress", "DRM-ready assets"], ["ingestion", "job orchestration", "segment format", "CDN hierarchy", "playback telemetry"], "A live event attracts four times the forecast audience in one country. Walk through mitigation."),
  p(8, "autocomplete", "Autocomplete", "Design search autocomplete", "Return relevant suggestions on every keystroke while learning from trends and resisting manipulation.", "Intermediate", "Data intensive", 40, "250K queries/sec · 20 languages", ["prefix index", "ranking", "freshness"], ["Prefix suggestions", "Regional trends", "Personalized boosts", "Safety filtering"], ["p99 under 60 ms", "Trend freshness under 5 min", "Typo tolerance", "Manipulation resistance"], ["trie or FST", "offline pipeline", "edge cache", "ranking features", "filtering"], "A breaking-news term goes from zero to dominant in three minutes. How does it enter the index?"),
  p(9, "notifications", "Notifications", "Design a notification delivery platform", "Fan out transactional and bulk notifications across push, email, and SMS with preference controls.", "Intermediate", "Infrastructure", 45, "1B notifications/day · 300K/sec burst", ["queues", "priorities", "idempotency"], ["Multi-channel delivery", "Templates and locale", "Preferences and quiet hours", "Delivery status"], ["Transactional traffic wins", "No duplicate billing", "Provider failover", "Auditable consent"], ["event contract", "priority queues", "provider adapters", "dedupe key", "retry and DLQ"], "A marketing blast is running when password-reset traffic spikes. Show the scheduling policy."),
  p(10, "ticketing", "Ticketing", "Design a high-demand ticketing system", "Sell limited seats fairly during flash demand without overselling or losing payment state.", "Advanced", "Data intensive", 55, "5M waiting users · 70K checkouts/sec", ["inventory locks", "queues", "sagas"], ["Browse events", "Hold seats", "Pay and issue ticket", "Cancel and refund"], ["Never oversell", "Fair admission", "Hold expiry", "Payment reconciliation"], ["waiting room", "seat state machine", "hold ownership", "payment saga", "anti-bot"], "Payment succeeds after the hold expired. What is the source of truth and recovery path?"),
  p(11, "metrics", "Metrics platform", "Design a metrics monitoring platform", "Ingest high-cardinality time series, query dashboards, and evaluate alerts at operational scale.", "Advanced", "Infrastructure", 55, "15M samples/sec · 18-month retention", ["time series", "downsampling", "cardinality"], ["Metric ingestion", "Range queries", "Dashboards", "Rule-based alerts"], ["Durable ingestion", "Recent queries under 2 sec", "Tiered retention", "Tenant isolation"], ["write path", "series identity", "storage layout", "rollups", "alert evaluator"], "One tenant creates ten million unique label combinations. How do you contain it?"),
  p(12, "crawler", "Web crawler", "Design a polite web crawler", "Discover and fetch pages at scale while respecting host limits, recrawl priorities, and duplicate content.", "Advanced", "Infrastructure", 50, "5B URLs · 25K fetches/sec", ["frontier", "politeness", "deduplication"], ["URL discovery", "Robots compliance", "Content storage", "Scheduled recrawl"], ["Per-host limits", "Avoid crawl traps", "Content dedupe", "Crash-safe frontier"], ["frontier partitions", "canonicalization", "scheduler", "fetch workers", "change frequency"], "A calendar exposes effectively infinite URLs. Where and how do you stop the trap?"),
  p(13, "collaborative-editor", "Collaborative editor", "Design a collaborative document editor", "Enable simultaneous edits, comments, presence, and offline recovery without corrupting documents.", "Advanced", "Real time", 55, "200 editors/document · 2M active docs", ["CRDT or OT", "snapshots", "presence"], ["Concurrent editing", "Live cursors", "Comments", "Version restoration"], ["Convergent state", "Offline edits", "Low interaction latency", "Bounded operation log"], ["conflict algorithm", "session service", "operation log", "snapshots", "permission changes"], "An offline editor returns after access was revoked. How are local operations handled?"),
  p(14, "ride-dispatch", "Ride dispatch", "Design a ride dispatch marketplace", "Match riders and nearby drivers in real time while balancing latency, fairness, and supply.", "Advanced", "Real time", 55, "3M drivers · 80K requests/min", ["geospatial", "matching", "state machines"], ["Driver location", "Ride request", "Matching and offer", "Trip lifecycle"], ["Match under 3 sec", "No double assignment", "Stale GPS tolerance", "Regional isolation"], ["spatial index", "location stream", "dispatch window", "offer lease", "trip state"], "A stadium empties at once. How do you prevent every rider targeting the same drivers?"),
  p(15, "ledger", "Payment ledger", "Design a payment ledger", "Record money movement with immutable accounting, idempotent APIs, and robust reconciliation.", "Advanced", "Data intensive", 60, "35K transactions/sec · 7-year retention", ["double entry", "idempotency", "reconciliation"], ["Authorize and capture", "Refund", "Balance query", "Settlement reconciliation"], ["No lost money", "Immutable audit trail", "Exact decimal arithmetic", "Regional recovery"], ["ledger entries", "transaction boundary", "idempotency keys", "outbox", "reconciliation"], "A timeout occurs after commit but before the API response. Walk through the retry."),
  p(16, "feature-flags", "Feature flags", "Design a feature flag service", "Evaluate configuration locally at huge read volume while propagating safe changes in seconds.", "Intermediate", "Infrastructure", 45, "10M evaluations/sec · 100K flags", ["control plane", "data plane", "rollouts"], ["Boolean and multivariate flags", "Targeting rules", "Percentage rollout", "Audit and rollback"], ["Evaluation under 1 ms", "SDK works offline", "Consistent bucketing", "Propagation under 10 sec"], ["config model", "streaming updates", "SDK cache", "hash bucketing", "kill switch"], "A malformed rule reaches 20% of SDKs. How do you stop and repair it safely?"),
  p(17, "rag", "RAG platform", "Design a multi-tenant RAG platform", "Ingest private knowledge, retrieve grounded context, and produce traceable answers across many tenants.", "Advanced", "AI systems", 60, "50K tenants · 1B chunks · 5K queries/sec", ["ingestion", "retrieval", "evaluation"], ["Document ingestion", "Hybrid retrieval", "Grounded generation", "Citations and feedback"], ["Strict tenant isolation", "Fresh deletes", "Prompt-injection defense", "Quality evaluation"], ["chunk pipeline", "metadata ACLs", "hybrid search", "reranking", "answer and eval loop"], "A document is deleted for compliance. How do you prove it cannot appear in an answer?"),
  p(18, "model-serving", "Model serving", "Design a large-model serving gateway", "Route inference across models and accelerators with batching, quotas, streaming, and graceful overload.", "Advanced", "AI systems", 60, "60K requests/min · mixed model fleet", ["continuous batching", "routing", "backpressure"], ["Streaming generation", "Model selection", "Tenant quotas", "Usage accounting"], ["Token latency SLOs", "GPU memory limits", "Priority traffic", "Safe retries"], ["gateway", "scheduler", "batcher", "KV cache", "overload policy"], "Premium and batch workloads compete for one GPU pool. Describe admission and preemption."),
];

export const categories = [...new Set(problemBank.map((problem) => problem.category))];
