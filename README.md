# request-fossil

Record real HTTP requests as fossils, then replay them against a new backend version and see exactly what drifted.

```text
production request from Oct 17
            ↓
       saved fossil
            ↓
       replay against
            ↓
      current localhost
```

`request-fossil` is a small TypeScript CLI for regression testing APIs with real traffic.

It is not a load tester and it is not an API mocking framework. Its job is simpler: **capture what really happened, then ask whether the new backend still behaves the same way.**

## Features

- local reverse proxy recorder
- JSONL fossil storage
- method, path, query, headers and body
- response status, headers, body and original latency
- replay against another base URL
- status diff
- response-header diff
- structural JSON diff
- text diff
- binary change detection
- latency comparison
- JSON replay report
- standalone HTML replay report
- `inspect` command
- sensitive-header redaction by default
- replay header overrides
- no runtime dependencies

## Install

```bash
npm install
npm run build
```

## Record traffic

Suppose the original API is:

```text
http://localhost:9091
```

Start the recorder:

```bash
node dist/cli.js record \
  --target http://localhost:9091 \
  --port 8787 \
  --out fossils/session.jsonl
```

Point the client at:

```text
http://127.0.0.1:8787
```

The proxy forwards every request and appends the completed interaction to the JSONL fossil file.

## Replay

Run a newer backend locally, for example:

```text
http://localhost:3000
```

Then:

```bash
node dist/cli.js replay \
  fossils/session.jsonl \
  --target http://localhost:3000
```

Example:

```text
PASS   GET    /health

DRIFT  GET    /users/42
       status 200 → 200
       $.id: number → string; $.role: removed; $.avatar: null → object
```

Reports are written to:

```text
reports/latest/report.json
reports/latest/index.html
```

## Fossil format

Each line is one interaction. Bodies are Base64 so JSON, text and binary payloads are all representable.

```json
{
  "version": 1,
  "id": "81b8e6b7d8a1",
  "recordedAt": "2026-11-06T11:00:00.000Z",
  "sourceBaseUrl": "https://api.example.com",
  "request": {
    "method": "GET",
    "path": "/users/42",
    "headers": {"accept":"application/json"},
    "body": null
  },
  "response": {
    "status": 200,
    "headers": {"content-type":"application/json"},
    "body": {"encoding":"base64","data":"...","bytes":54,"contentType":"application/json"},
    "latencyMs": 43.7
  }
}
```

## Sensitive headers

By default these are not stored:

```text
Authorization
Proxy-Authorization
Cookie
Set-Cookie
X-API-Key
X-Auth-Token
```

For replay, inject a fresh credential:

```bash
node dist/cli.js replay fossils/prod.jsonl \
  --target http://localhost:3000 \
  --header "Authorization: Bearer NEW_TOKEN"
```

`--header` is repeatable.

Recording sensitive headers is opt-in:

```bash
request-fossil record \
  --target https://api.example.com \
  --include-sensitive
```

Never commit sensitive fossils.

## Inspect

```bash
node dist/cli.js inspect fossils/session.jsonl
```

## Demo

Build first:

```bash
npm install
npm run build
```

Start the old API:

```bash
DEMO_VERSION=old PORT=9091 node examples/demo-api.js
```

Start Request Fossil:

```bash
node dist/cli.js record \
  --target http://127.0.0.1:9091 \
  --out fossils/demo.jsonl
```

Send traffic through the proxy:

```bash
curl http://127.0.0.1:8787/users/42

curl -X POST http://127.0.0.1:8787/search \
  -H "content-type: application/json" \
  -d '{"query":"memory"}'
```

Stop the old API, then start the changed version:

```bash
DEMO_VERSION=new PORT=9092 node examples/demo-api.js
```

Replay:

```bash
node dist/cli.js replay \
  fossils/demo.jsonl \
  --target http://127.0.0.1:9092
```

Both recorded responses intentionally drift.

## What counts as drift?

A replay fails when any of these differ:

- HTTP status
- non-volatile response headers
- response body

Latency is reported but does not fail a replay by itself.

Volatile transport headers such as `Date`, `Content-Length`, `Connection` and `Transfer-Encoding` are ignored.

## JSON comparison

JSON is compared structurally, not as raw text. Property order and formatting do not matter.

Useful messages look like:

```text
$.id: number → string
$.role: removed
$.avatar: null → object
$.results.length: 2 → 3
```

## Commands

```text
request-fossil record
request-fossil replay
request-fossil inspect
```

## Project structure

```text
request-fossil/
├── src/
│   ├── core/
│   │   ├── diff.ts
│   │   ├── io.ts
│   │   ├── proxy.ts
│   │   ├── replay.ts
│   │   ├── types.ts
│   │   └── utils.ts
│   ├── report/
│   │   └── html.ts
│   └── cli.ts
├── tests/
│   ├── diff.test.ts
│   └── utils.test.ts
├── examples/
│   └── demo-api.js
├── package.json
├── tsconfig.json
└── README.md
```

## Limitations

- HTTP/1.1 proxy interface only
- WebSockets are not recorded
- streaming responses are buffered
- multipart uploads are recorded as raw bytes
- dynamic IDs/timestamps inside JSON are treated as real differences
- replay order is sequential
- no automatic secret detection inside bodies

Possible future additions: JSON ignore paths, latency thresholds, parallel replay, HAR import/export, CI annotations and WebSocket fossils.

## Responsible use

Record only traffic you are authorized to inspect. Bodies can contain personal data or secrets even when sensitive headers are redacted.

## Requirements

- Node.js 20+
- npm

## License

MIT
