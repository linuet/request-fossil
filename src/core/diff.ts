import type { BodyDiff, FossilBody } from "./types.js";
import { bodyToBuffer, sha256 } from "./utils.js";

export function diffBodies(before: FossilBody | null, after: FossilBody | null): BodyDiff {
  if (!before && !after) return { equal: true, kind: "empty", summary: "Both bodies are empty." };

  const left = bodyToBuffer(before);
  const right = bodyToBuffer(after);
  if (left.length === right.length && sha256(left) === sha256(right)) {
    return { equal: true, kind: detectKind(before?.contentType ?? after?.contentType ?? null), summary: "Body is unchanged." };
  }

  const contentType = before?.contentType ?? after?.contentType ?? "";

  if (contentType.includes("application/json") || looksLikeJson(left) || looksLikeJson(right)) {
    try {
      const a = JSON.parse(left.toString("utf8") || "null");
      const b = JSON.parse(right.toString("utf8") || "null");
      const changes = jsonDiff(a, b);
      return {
        equal: changes.length === 0,
        kind: "json",
        summary: changes.length === 0 ? "JSON is structurally equal." : changes.slice(0, 8).join("; ") + (changes.length > 8 ? `; +${changes.length - 8} more` : "")
      };
    } catch {}
  }

  if (isTextLike(contentType) || looksTextual(left) || looksTextual(right)) {
    return { equal: false, kind: "text", summary: textSummary(left.toString("utf8"), right.toString("utf8")) };
  }

  return { equal: false, kind: "binary", summary: `Binary body changed: ${left.length} → ${right.length} bytes.` };
}

export function diffHeaders(before: Record<string, string>, after: Record<string, string>) {
  const ignore = new Set(["date","server","content-length","connection","keep-alive","transfer-encoding"]);
  const changed: string[] = [], added: string[] = [], removed: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of [...keys].sort()) {
    if (ignore.has(key)) continue;
    const a = before[key], b = after[key];
    if (a === undefined) added.push(key);
    else if (b === undefined) removed.push(key);
    else if (a !== b) changed.push(key);
  }
  return { changed, added, removed };
}

function detectKind(contentType: string | null): BodyDiff["kind"] {
  if (!contentType) return "binary";
  if (contentType.includes("json")) return "json";
  if (isTextLike(contentType)) return "text";
  return "binary";
}

function jsonDiff(a: unknown, b: unknown, path = "$"): string[] {
  if (typeof a !== typeof b) return [`${path}: ${typeOf(a)} → ${typeOf(b)}`];
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return Object.is(a, b) ? [] : [`${path}: ${preview(a)} → ${preview(b)}`];
  }
  if (Array.isArray(a) !== Array.isArray(b)) return [`${path}: ${typeOf(a)} → ${typeOf(b)}`];

  if (Array.isArray(a) && Array.isArray(b)) {
    const changes: string[] = [];
    if (a.length !== b.length) changes.push(`${path}.length: ${a.length} → ${b.length}`);
    const max = Math.min(Math.max(a.length, b.length), 20);
    for (let i = 0; i < max; i++) {
      if (i >= a.length) changes.push(`${path}[${i}]: added`);
      else if (i >= b.length) changes.push(`${path}[${i}]: removed`);
      else changes.push(...jsonDiff(a[i], b[i], `${path}[${i}]`));
    }
    return changes;
  }

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const changes: string[] = [];
  for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
    if (!(key in left)) changes.push(`${path}.${key}: added`);
    else if (!(key in right)) changes.push(`${path}.${key}: removed`);
    else changes.push(...jsonDiff(left[key], right[key], `${path}.${key}`));
  }
  return changes;
}

function typeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function preview(value: unknown): string {
  const raw = JSON.stringify(value);
  if (raw === undefined) return String(value);
  return raw.length > 45 ? raw.slice(0, 42) + "..." : raw;
}

function isTextLike(contentType: string): boolean {
  return contentType.startsWith("text/") || contentType.includes("xml") || contentType.includes("javascript") || contentType.includes("x-www-form-urlencoded");
}

function looksLikeJson(buffer: Buffer): boolean {
  const text = buffer.toString("utf8").trim();
  return text.startsWith("{") || text.startsWith("[");
}

function looksTextual(buffer: Buffer): boolean {
  if (buffer.length === 0) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 512));
  let printable = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126)) printable++;
  }
  return printable / sample.length > 0.9;
}

function textSummary(a: string, b: string): string {
  const aLines = a.split(/\r?\n/), bLines = b.split(/\r?\n/);
  const max = Math.max(aLines.length, bLines.length);
  for (let i = 0; i < max; i++) {
    if (aLines[i] !== bLines[i]) return `Text changed near line ${i + 1}: ${short(aLines[i])} → ${short(bLines[i])}`;
  }
  return `Text body changed: ${a.length} → ${b.length} chars.`;
}

function short(value: string | undefined): string {
  if (value === undefined) return "<missing>";
  const clean = value.trim();
  if (!clean) return "<empty>";
  return clean.length > 50 ? clean.slice(0, 47) + "..." : clean;
}
