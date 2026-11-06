export interface FossilBody {
  encoding: "base64";
  data: string;
  bytes: number;
  contentType: string | null;
}

export interface FossilRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: FossilBody | null;
}

export interface FossilResponse {
  status: number;
  headers: Record<string, string>;
  body: FossilBody | null;
  latencyMs: number;
}

export interface Fossil {
  version: 1;
  id: string;
  recordedAt: string;
  sourceBaseUrl: string;
  request: FossilRequest;
  response: FossilResponse;
}

export interface BodyDiff {
  equal: boolean;
  kind: "empty" | "json" | "text" | "binary";
  summary: string;
}

export interface ReplayResult {
  fossilId: string;
  method: string;
  path: string;
  targetUrl: string;
  ok: boolean;
  status: { before: number; after: number | null; equal: boolean };
  latency: { beforeMs: number; afterMs: number | null; deltaMs: number | null; ratio: number | null };
  headers: { changed: string[]; added: string[]; removed: string[] };
  body: BodyDiff;
  error: string | null;
}

export interface ReplayReport {
  generatedAt: string;
  targetBaseUrl: string;
  fossilFile: string;
  total: number;
  passed: number;
  failed: number;
  results: ReplayResult[];
}
