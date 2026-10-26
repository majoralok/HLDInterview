import { parseDiagram, designSubmission } from "../public/architecture-core.js";
export class ReviewRequestError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function readReviewRequest(request, problems) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) throw new Error("origin");
    } catch { throw new ReviewRequestError("Cross-origin review requests are not allowed.", 403); }
  }
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new ReviewRequestError("Use application/json for review requests.", 415);
  }
  const reader = request.body?.getReader();
  let text = "", size = 0;
  if (reader) {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 128000) {
          await reader.cancel();
          throw new ReviewRequestError("Request body is too large.", 413);
        }
        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } catch (error) {
      if (error instanceof ReviewRequestError) throw error;
      throw new ReviewRequestError("Request body must be valid UTF-8 JSON.", 400);
    } finally { reader.releaseLock(); }
  }
  let body;
  try { body = JSON.parse(text); }
  catch { throw new ReviewRequestError("Request body must be valid JSON.", 400); }
  if (!body || typeof body !== "object" || typeof body.answer !== "string"
    || body.answer.length > 25000) {
    throw new ReviewRequestError("An answer between 120 and 25,000 characters is required.", 400);
  }
  const problem = problems.find(item => item.id === body.problem?.id);
  if (!problem) throw new ReviewRequestError("Select a recognized design challenge.", 400);
  let diagram;
  try { if (body.diagram !== undefined) diagram = parseDiagram(body.diagram); }
  catch { throw new ReviewRequestError("The architecture diagram is invalid.", 400); }
  const answer = designSubmission(body.answer, diagram);
  if (answer.replace(/\s/g, "").length < 120) throw new ReviewRequestError("An answer between 120 and 25,000 characters is required.", 400);
  // The server owns the brief and serializes the validated diagram itself.
  return { problem, answer };
}
