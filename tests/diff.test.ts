import test from "node:test";
import assert from "node:assert/strict";
import { diffBodies, diffHeaders } from "../src/core/diff.js";
import { bodyFromBuffer } from "../src/core/utils.js";

test("JSON body drift is described", () => {
  const before = bodyFromBuffer(Buffer.from(JSON.stringify({ id: 42, role: "admin" })), "application/json");
  const after = bodyFromBuffer(Buffer.from(JSON.stringify({ id: "42" })), "application/json");
  const diff = diffBodies(before, after);
  assert.equal(diff.equal, false);
  assert.match(diff.summary, /id/);
  assert.match(diff.summary, /role/);
});

test("volatile headers are ignored", () => {
  const diff = diffHeaders(
    { "content-type": "application/json", date: "yesterday" },
    { "content-type": "application/json", date: "today" }
  );
  assert.deepEqual(diff, { changed: [], added: [], removed: [] });
});
