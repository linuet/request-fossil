import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Fossil } from "./types.js";

export async function appendFossil(path: string, fossil: Fossil): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, JSON.stringify(fossil) + "\n", "utf8");
}

export async function readFossils(path: string): Promise<Fossil[]> {
  const text = await readFile(path, "utf8");
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

  return lines.map((line, index) => {
    try {
      const parsed = JSON.parse(line) as Fossil;
      if (parsed.version !== 1 || !parsed.request || !parsed.response) throw new Error("unsupported fossil");
      return parsed;
    } catch (error) {
      throw new Error(`Invalid fossil at line ${index + 1}: ${error instanceof Error ? error.message : "parse error"}`);
    }
  });
}
