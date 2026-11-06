import { performance } from "node:perf_hooks";
import type { Fossil, ReplayReport, ReplayResult } from "./types.js";
import { bodyFromBuffer, bodyToBuffer, joinUrl, normalizeHeaders, round } from "./utils.js";
import { diffBodies, diffHeaders } from "./diff.js";

export interface ReplayOptions {
  target: string;
  fossilFile: string;
  extraHeaders: Record<string, string>;
  timeoutMs: number;
}

export async function replayFossils(fossils: Fossil[], options: ReplayOptions): Promise<ReplayReport> {
  const results: ReplayResult[] = [];
  for (const fossil of fossils) results.push(await replayOne(fossil, options));
  const passed = results.filter(result => result.ok).length;

  return {
    generatedAt: new Date().toISOString(),
    targetBaseUrl: options.target,
    fossilFile: options.fossilFile,
    total: results.length,
    passed,
    failed: results.length - passed,
    results
  };
}

async function replayOne(fossil: Fossil, options: ReplayOptions): Promise<ReplayResult> {
  const targetUrl = joinUrl(options.target, fossil.request.path);
  const headers = { ...fossil.request.headers, ...lowercaseHeaders(options.extraHeaders) };
  delete headers.host;
  delete headers["content-length"];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const started = performance.now();
    const response = await fetch(targetUrl, {
      method: fossil.request.method,
      headers,
      body: fossil.request.body && !["GET","HEAD"].includes(fossil.request.method) ? bodyToBuffer(fossil.request.body) : undefined,
      redirect: "manual",
      signal: controller.signal
    });

    const responseBuffer = Buffer.from(await response.arrayBuffer());
    const latency = round(performance.now() - started);
    const afterHeaders = normalizeHeaders(response.headers, false);
    const afterBody = bodyFromBuffer(responseBuffer, response.headers.get("content-type"));
    const body = diffBodies(fossil.response.body, afterBody);
    const headerDiff = diffHeaders(fossil.response.headers, afterHeaders);
    const statusEqual = response.status === fossil.response.status;
    const ok = statusEqual && body.equal && headerDiff.changed.length === 0 && headerDiff.added.length === 0 && headerDiff.removed.length === 0;

    return {
      fossilId: fossil.id,
      method: fossil.request.method,
      path: fossil.request.path,
      targetUrl,
      ok,
      status: { before: fossil.response.status, after: response.status, equal: statusEqual },
      latency: {
        beforeMs: fossil.response.latencyMs,
        afterMs: latency,
        deltaMs: round(latency - fossil.response.latencyMs),
        ratio: fossil.response.latencyMs > 0 ? round(latency / fossil.response.latencyMs) : null
      },
      headers: headerDiff,
      body,
      error: null
    };
  } catch (error) {
    return {
      fossilId: fossil.id,
      method: fossil.request.method,
      path: fossil.request.path,
      targetUrl,
      ok: false,
      status: { before: fossil.response.status, after: null, equal: false },
      latency: { beforeMs: fossil.response.latencyMs, afterMs: null, deltaMs: null, ratio: null },
      headers: { changed: [], added: [], removed: [] },
      body: { equal: false, kind: "empty", summary: "Replay did not receive a response." },
      error: error instanceof Error ? error.message : "unknown replay error"
    };
  } finally {
    clearTimeout(timer);
  }
}

function lowercaseHeaders(input: Record<string, string>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) output[key.toLowerCase()] = value;
  return output;
}
