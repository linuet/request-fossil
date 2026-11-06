import test from "node:test";
import assert from "node:assert/strict";
import { joinUrl, normalizeHeaders } from "../src/core/utils.js";

test("joinUrl preserves base path and query", () => {
  assert.equal(joinUrl("https://example.com/api", "/users?id=1"), "https://example.com/api/users?id=1");
});

test("sensitive headers are redacted by default", () => {
  const headers = normalizeHeaders({ authorization: "Bearer secret", cookie: "session=abc", "x-request-id": "123" });
  assert.equal(headers.authorization, undefined);
  assert.equal(headers.cookie, undefined);
  assert.equal(headers["x-request-id"], "123");
});
