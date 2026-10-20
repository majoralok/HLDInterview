// Shared browser behavior for React and the standalone Worker.
export const MAX_ANSWER = 25000;
export const MAX_IMPORT_BYTES = 1000000;

export function parseProgress(value, ids) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Progress must be an object.");
  const result = {};
  for (const id of ids) {
    if (!Object.hasOwn(value, id)) continue;
    const item = value[id];
    if (!item || !["todo", "in_progress", "done"].includes(item.status)
      || typeof item.bookmarked !== "boolean"
      || !Number.isSafeInteger(item.attempts) || item.attempts < 0
      || (item.score !== undefined && (!Number.isInteger(item.score) || item.score < 0 || item.score > 100))
      || (item.draft !== undefined && (typeof item.draft !== "string" || item.draft.length > MAX_ANSWER))
      || (item.lastPracticed !== undefined && (typeof item.lastPracticed !== "string" || !Number.isFinite(Date.parse(item.lastPracticed))))) {
      throw new Error("Invalid progress for " + id + ". Your existing progress has been kept.");
    }
    result[id] = { status: item.status, bookmarked: item.bookmarked, attempts: item.attempts };
    for (const key of ["score", "draft", "lastPracticed"]) {
      if (item[key] !== undefined) result[id][key] = item[key];
    }
  }
  return result;
}

export function parseImport(text, ids) {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error("Progress files must be smaller than 1 MB.");
  const data = JSON.parse(text);
  if (!data || data.version !== 1) throw new Error("Unsupported progress backup version.");
  const result = parseProgress(data.progress, ids);
  if (!Object.keys(result).length) throw new Error("No recognized challenges in this backup.");
  return result;
}

export function writtenAnswer(answer, template) {
  const prompts = new Set(template.split("\n").map(line => line.trim()).filter(Boolean));
  return answer.split("\n").map(line => line.trim())
    .filter(line => line && !prompts.has(line) && !/^\d+\.\s+[A-Z &-]+$/.test(line)).join("\n");
}

export function localAssessment(answer, problem, template) {
  const content = writtenAnswer(answer, template);
  if (content.replace(/\s/g, "").length < 120) {
    throw new Error("Write at least 120 non-whitespace characters of your own design before requesting feedback.");
  }
  const criteria = [
    ["Capacity estimates with units", /\b\d+(?:\.\d+)?\s*(?:k|m|b|ms|sec|seconds|qps|rps|requests|gb|mb|tb|users|%)\b/i],
    ["API or event contracts", /\b(get|post|put|delete|endpoint|event|payload|schema)\b/i],
    ["Storage and access decisions", /\b(index|partition|shard|replica|sql|database|cache)\b/i],
    ["Failure and recovery behavior", /\b(retry|timeout|failover|recovery|outage|backpressure)\b/i],
    ["Security and tenant boundaries", /\b(auth|authorization|authentication|acl|encrypt|tenant|permission)\b/i],
    ["Alternatives and trade-offs", /\b(because|trade.?off|instead|alternative|versus|however)\b/i],
  ];
  const hits = criteria.filter(([, pattern]) => pattern.test(content));
  const missing = criteria.filter(([, pattern]) => !pattern.test(content));
  return {
    score: Math.min(100, hits.length * 12 + Math.min(28, Math.floor(content.length / 80))),
    summary: "Offline coverage check only. Keywords and length cannot establish design correctness or interview readiness.",
    strengths: hits.length ? hits.map(([label]) => "Detected: " + label.toLowerCase() + ".") : ["You wrote an original design attempt."],
    improvements: missing.length ? missing.map(([label]) => "Make explicit: " + label.toLowerCase() + ".") : ["Trace a concrete request through every component and justify each decision against the scale card."],
    followUp: problem.interviewerPush,
  };
}

export function isFeedback(value) {
  return !!value && Number.isInteger(value.score) && value.score >= 0 && value.score <= 100
    && typeof value.summary === "string" && typeof value.followUp === "string"
    && [value.strengths, value.improvements].every(list => Array.isArray(list) && list.every(item => typeof item === "string"));
}
