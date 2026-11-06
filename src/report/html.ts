import type { ReplayReport } from "../core/types.js";

export function renderHtmlReport(report: ReplayReport): string {
  const cards = report.results.map(result => {
    const status = result.ok ? "PASS" : "DRIFT";
    const headerChanges = [
      ...result.headers.changed.map(key => `changed: ${key}`),
      ...result.headers.added.map(key => `added: ${key}`),
      ...result.headers.removed.map(key => `removed: ${key}`)
    ];

    return `
<article class="case ${result.ok ? "pass" : "fail"}">
  <div class="case-top">
    <div><span class="method">${escapeHtml(result.method)}</span><strong>${escapeHtml(result.path)}</strong></div>
    <span class="pill">${status}</span>
  </div>
  <div class="grid">
    <div><span>STATUS</span><strong>${result.status.before} → ${result.status.after ?? "ERR"}</strong></div>
    <div><span>LATENCY</span><strong>${result.latency.beforeMs} → ${result.latency.afterMs ?? "ERR"} ms</strong></div>
    <div><span>BODY</span><strong>${escapeHtml(result.body.kind)}</strong></div>
  </div>
  <p>${escapeHtml(result.body.summary)}</p>
  ${headerChanges.length ? `<p class="muted">${escapeHtml(headerChanges.join(" · "))}</p>` : ""}
  ${result.error ? `<p class="error">${escapeHtml(result.error)}</p>` : ""}
</article>`;
  }).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>request-fossil replay report</title>
<style>
*{box-sizing:border-box}:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#0b1015;color:#eef3f7}body{margin:0;padding:30px;background:#0b1015}main{width:min(1180px,100%);margin:auto}.eyebrow{color:#71808f;font-size:10px;letter-spacing:.17em;font-weight:900}h1{margin:8px 0 0;font-size:clamp(48px,8vw,84px);line-height:.9;letter-spacing:-.065em}.sub{margin:15px 0 0;color:#7a8997}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:24px 0}.stat{padding:15px 17px;border:1px solid #25313c;border-radius:15px;background:#111820}.stat span,.grid span{display:block;color:#71808f;font-size:9px;letter-spacing:.12em}.stat strong{display:block;margin-top:3px;font-size:25px}.cases{display:grid;gap:10px}.case{padding:17px;border:1px solid #25313c;border-radius:17px;background:#111820}.case.fail{border-color:#63313a}.case.pass{border-color:#28513d}.case-top{display:flex;justify-content:space-between;gap:16px;align-items:center}.method{display:inline-block;margin-right:8px;color:#7f90a0;font-size:10px;font-weight:900}.pill{padding:6px 9px;border-radius:999px;background:#1b252e;color:#a9b5bf;font-size:9px;font-weight:900;letter-spacing:.1em}.fail .pill{background:#47242c;color:#ef8998}.pass .pill{background:#1f392d;color:#80d7a6}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:13px}.grid div{padding:10px;border-radius:10px;background:#0c1218}.grid strong{display:block;margin-top:3px;font-size:12px}p{margin:12px 0 0;color:#9eabb6;font-size:12px;line-height:1.55}.muted{color:#70808e}.error{color:#ef8998}footer{margin-top:25px;color:#61707d;font-size:10px}@media(max-width:650px){body{padding:16px}.stats,.grid{grid-template-columns:1fr}}
</style></head><body><main>
<span class="eyebrow">HTTP REGRESSION REPLAY</span><h1>request-fossil</h1>
<p class="sub">${escapeHtml(report.fossilFile)} → ${escapeHtml(report.targetBaseUrl)}</p>
<section class="stats"><div class="stat"><span>TOTAL</span><strong>${report.total}</strong></div><div class="stat"><span>PASSED</span><strong>${report.passed}</strong></div><div class="stat"><span>DRIFT</span><strong>${report.failed}</strong></div></section>
<section class="cases">${cards || "<p>No fossils found.</p>"}</section>
<footer>Generated ${escapeHtml(report.generatedAt)} · request-fossil</footer>
</main></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
