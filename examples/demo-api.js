import http from "node:http";

const version = process.env.DEMO_VERSION ?? "old";
const port = Number(process.env.PORT ?? 9091);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (req.method === "GET" && url.pathname === "/users/42") {
    const body = version === "old"
      ? { id: 42, name: "Ada", role: "admin", avatar: null }
      : { id: "42", name: "Ada", avatar: { url: "/avatars/42.png" } };
    return reply(res, 200, body);
  }

  if (req.method === "POST" && url.pathname === "/search") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const input = raw ? JSON.parse(raw) : {};
    const body = version === "old"
      ? { query: input.query ?? "", results: ["alpha", "beta"] }
      : { query: input.query ?? "", results: ["alpha", "beta", "gamma"], tookMs: 3 };
    return reply(res, 200, body);
  }

  return reply(res, 404, { error: "not_found" });
});

server.listen(port, "127.0.0.1", () => console.log(`demo-api ${version} listening on ${port}`));

function reply(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "x-demo-version": version,
    "content-length": Buffer.byteLength(json)
  });
  res.end(json);
}
