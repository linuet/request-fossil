import http from "node:http";
import { performance } from "node:perf_hooks";
import type { Fossil } from "./types.js";
import { appendFossil } from "./io.js";
import { bodyFromBuffer, joinUrl, normalizeHeaders, shortId } from "./utils.js";

export interface RecordOptions {
  target: string;
  host: string;
  port: number;
  out: string;
  includeSensitive: boolean;
}

export function startRecordingProxy(options: RecordOptions): http.Server {
  return http.createServer(async (req, res) => {
    try {
      const requestBody = await readIncomingBody(req);
      const requestHeaders = normalizeHeaders(req.headers, options.includeSensitive);
      const targetUrl = joinUrl(options.target, req.url ?? "/");
      const started = performance.now();

      const upstream = await fetch(targetUrl, {
        method: req.method ?? "GET",
        headers: requestHeaders,
        body: requestBody.length > 0 && !["GET","HEAD"].includes(req.method ?? "GET") ? requestBody : undefined,
        redirect: "manual"
      });

      const responseBuffer = Buffer.from(await upstream.arrayBuffer());
      const latencyMs = performance.now() - started;
      const responseHeaders = normalizeHeaders(upstream.headers, options.includeSensitive);

      for (const [name, value] of Object.entries(responseHeaders)) res.setHeader(name, value);
      res.statusCode = upstream.status;
      res.end(responseBuffer);

      const fossil: Fossil = {
        version: 1,
        id: shortId(),
        recordedAt: new Date().toISOString(),
        sourceBaseUrl: options.target,
        request: {
          method: req.method ?? "GET",
          path: req.url ?? "/",
          headers: requestHeaders,
          body: bodyFromBuffer(requestBody, req.headers["content-type"] ?? null)
        },
        response: {
          status: upstream.status,
          headers: responseHeaders,
          body: bodyFromBuffer(responseBuffer, upstream.headers.get("content-type")),
          latencyMs: Math.round(latencyMs * 10) / 10
        }
      };

      await appendFossil(options.out, fossil);
      console.log(`${fossil.id}  ${fossil.request.method.padEnd(6)} ${fossil.request.path}  ${fossil.response.status}  ${fossil.response.latencyMs}ms`);
    } catch (error) {
      res.statusCode = 502;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "proxy_error", message: error instanceof Error ? error.message : "unknown error" }));
    }
  });
}

async function readIncomingBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}
