import { createHash, randomUUID } from "node:crypto";
import type { FossilBody } from "./types.js";

export const SENSITIVE_HEADERS = new Set([
  "authorization","proxy-authorization","cookie","set-cookie","x-api-key","x-auth-token"
]);

export function normalizeHeaders(
  headers: Headers | Record<string, string | string[] | undefined>,
  includeSensitive = false
): Record<string, string> {
  const out: Record<string, string> = {};

  if (headers instanceof Headers) {
    for (const [name, value] of headers.entries()) {
      const key = name.toLowerCase();
      if (!includeSensitive && SENSITIVE_HEADERS.has(key)) continue;
      if (isHopByHop(key)) continue;
      out[key] = value;
    }
    return out;
  }

  for (const [name, raw] of Object.entries(headers)) {
    if (raw === undefined) continue;
    const key = name.toLowerCase();
    if (!includeSensitive && SENSITIVE_HEADERS.has(key)) continue;
    if (isHopByHop(key) || key === "host") continue;
    out[key] = Array.isArray(raw) ? raw.join(", ") : raw;
  }
  return out;
}

export function bodyFromBuffer(buffer: Buffer, contentType: string | null): FossilBody | null {
  if (buffer.length === 0) return null;
  return { encoding: "base64", data: buffer.toString("base64"), bytes: buffer.length, contentType };
}

export function bodyToBuffer(body: FossilBody | null): Buffer {
  return body ? Buffer.from(body.data, "base64") : Buffer.alloc(0);
}

export function joinUrl(base: string, path: string): string {
  const url = new URL(base);
  const basePath = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
  const incoming = path.startsWith("/") ? path : `/${path}`;
  const parsedIncoming = new URL(incoming, "http://request-fossil.local");
  url.pathname = `${basePath}${parsedIncoming.pathname}` || "/";
  url.search = parsedIncoming.search;
  return url.toString();
}

export function shortId(): string {
  return randomUUID().replaceAll("-", "").slice(0, 12);
}

export function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function isHopByHop(name: string): boolean {
  return new Set(["connection","keep-alive","proxy-authenticate","proxy-authorization","te","trailer","transfer-encoding","upgrade","content-length"]).has(name);
}
