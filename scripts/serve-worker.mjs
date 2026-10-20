import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const worker = (await import(pathToFileURL(path.join(root, "dist", "server", "index.js")).href)).default;
const port = Number(process.env.ARCHITECT_LAB_PORT || 8787);
const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
};

const server = http.createServer(async (incoming, outgoing) => {
  try {
    const chunks = [];
    let received = 0;
    for await (const chunk of incoming) {
      received += chunk.length;
      if (received > 128000) {
        outgoing.writeHead(413, { "content-type": "application/json" });
        outgoing.end(JSON.stringify({ error: "Request body is too large." }));
        return;
      }
      chunks.push(chunk);
    }
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(`http://127.0.0.1:${port}${incoming.url || "/"}`, {
      method: incoming.method,
      headers: incoming.headers,
      body,
    });
    const response = await worker.fetch(request, env, {});
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    outgoing.writeHead(500, { "content-type": "application/json" });
    outgoing.end(JSON.stringify({ error: "Local server error." }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Architect Lab is running at http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
