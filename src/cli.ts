#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readFossils } from "./core/io.js";
import { startRecordingProxy } from "./core/proxy.js";
import { replayFossils } from "./core/replay.js";
import { renderHtmlReport } from "./report/html.js";

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.includes("-h") || args.includes("--help")) return printHelp();
    const command = args[0];
    if (command === "record") return void await commandRecord(args.slice(1));
    if (command === "replay") return void await commandReplay(args.slice(1));
    if (command === "inspect") return void await commandInspect(args.slice(1));
    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    console.error(`request-fossil: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  }
}

async function commandRecord(args: string[]): Promise<void> {
  const parsed = parseOptions(args);
  const target = required(parsed.values.target, "--target");
  const out = resolve(parsed.values.out ?? "fossils/traffic.jsonl");
  const host = parsed.values.host ?? "127.0.0.1";
  const port = intOption(parsed.values.port ?? "8787", "--port");
  const server = startRecordingProxy({ target, host, port, out, includeSensitive: parsed.flags.has("include-sensitive") });

  server.listen(port, host, () => {
    console.log("request-fossil · record\n");
    console.log(`proxy:  http://${host}:${port}`);
    console.log(`target: ${target}`);
    console.log(`out:    ${out}\n`);
    console.log("Sensitive auth/cookie headers are omitted by default.");
    console.log("Press Ctrl+C to stop recording.");
  });
}

async function commandReplay(args: string[]): Promise<void> {
  const parsed = parseOptions(args);
  const fossilFile = resolve(required(parsed.positionals[0], "fossil file"));
  const target = required(parsed.values.target, "--target");
  const reportDir = resolve(parsed.values.out ?? "reports/latest");
  const timeoutMs = intOption(parsed.values.timeout ?? "10000", "--timeout");
  const extraHeaders = parseHeaders(parsed.multi.header ?? []);
  const fossils = await readFossils(fossilFile);
  const report = await replayFossils(fossils, { target, fossilFile, extraHeaders, timeoutMs });

  await mkdir(reportDir, { recursive: true });
  const jsonPath = resolve(reportDir, "report.json");
  const htmlPath = resolve(reportDir, "index.html");
  await writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  await writeFile(htmlPath, renderHtmlReport(report), "utf8");

  console.log("request-fossil · replay\n");
  for (const result of report.results) {
    console.log(`${result.ok ? "PASS " : "DRIFT"}  ${result.method.padEnd(6)} ${result.path}`);
    if (!result.ok) {
      console.log(`       status ${result.status.before} → ${result.status.after ?? "ERR"}`);
      console.log(`       ${result.body.summary}`);
    }
  }
  console.log(`\npassed: ${report.passed}/${report.total}`);
  console.log(`json:   ${jsonPath}`);
  console.log(`html:   ${htmlPath}`);
  if (report.failed > 0) process.exitCode = 2;
}

async function commandInspect(args: string[]): Promise<void> {
  const fossilFile = resolve(required(args[0], "fossil file"));
  const fossils = await readFossils(fossilFile);
  console.log(`fossils: ${fossils.length}`);
  for (const fossil of fossils) {
    console.log(`${fossil.id}  ${fossil.recordedAt}  ${fossil.request.method.padEnd(6)} ${fossil.request.path}  → ${fossil.response.status}  ${fossil.response.latencyMs}ms`);
  }
}

interface ParsedOptions {
  values: Record<string, string>;
  multi: Record<string, string[]>;
  flags: Set<string>;
  positionals: string[];
}

function parseOptions(args: string[]): ParsedOptions {
  const values: Record<string, string> = {};
  const multi: Record<string, string[]> = {};
  const flags = new Set<string>();
  const positionals: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) { positionals.push(arg); continue; }

    const raw = arg.slice(2);
    const equal = raw.indexOf("=");
    const key = equal >= 0 ? raw.slice(0, equal) : raw;
    const inline = equal >= 0 ? raw.slice(equal + 1) : null;

    if (key === "include-sensitive") { flags.add(key); continue; }

    const value = inline ?? args[++i];
    if (value === undefined || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    if (key === "header") (multi.header ??= []).push(value);
    else values[key] = value;
  }

  return { values, multi, flags, positionals };
}

function parseHeaders(items: string[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const item of items) {
    const index = item.indexOf(":");
    if (index <= 0) throw new Error(`Invalid --header: ${item}`);
    headers[item.slice(0, index).trim()] = item.slice(index + 1).trim();
  }
  return headers;
}

function intOption(value: string, name: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function required(value: string | undefined, label: string): string {
  if (!value) throw new Error(`${label} is required`);
  return value;
}

function printHelp(): void {
  console.log(`request-fossil\n\nRecord real HTTP traffic and replay it against another backend.\n\nRecord:\n  request-fossil record --target http://localhost:3000\n\nReplay:\n  request-fossil replay fossils/prod.jsonl --target http://localhost:3000\n\nInspect:\n  request-fossil inspect fossils/prod.jsonl\n\nRecord options:\n  --target <url>\n  --host <host>\n  --port <port>\n  --out <file>\n  --include-sensitive\n\nReplay options:\n  --target <url>\n  --out <dir>\n  --timeout <ms>\n  --header \"K: V\"`);
}

await main();
