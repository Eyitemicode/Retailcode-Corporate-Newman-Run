"use strict";
const fs = require("fs");

// ── Parse Newman JSON results ────────────────────────────────────────────────
const raw      = JSON.parse(fs.readFileSync("./reports/summary.json", "utf8"));
const stats    = raw.run.stats;
const execs    = raw.run.executions;
const failures = raw.run.failures || [];

const totalAssertions  = stats.assertions.total;
const failedAssertions = stats.assertions.failed;
const passedAssertions = totalAssertions - failedAssertions;
const totalRequests    = stats.requests.total;
const failedRequests   = stats.requests.failed;
const passedRequests   = totalRequests - failedRequests;
const durationMs       = raw.run.timings.completed - raw.run.timings.started;
const duration         = (durationMs / 1000).toFixed(1) + "s";
const runDate          = new Date().toUTCString();
const reportUrl        = (process.env.GITHUB_SERVER_URL || "https://github.com")
                         + "/" + (process.env.GITHUB_REPOSITORY || "")
                         + "/actions/runs/" + (process.env.GITHUB_RUN_ID || "");
const overallPass      = failedAssertions === 0;

// ── Group failure messages by request name ───────────────────────────────────
const failMap = {};
for (const f of failures) {
  const name = (f.source && f.source.name) ? f.source.name : "Unknown";
  if (!failMap[name]) failMap[name] = [];
  if (f.error && f.error.message) failMap[name].push(f.error.message);
}

// ── Build per-request table rows ─────────────────────────────────────────────
let requestRows = "";
for (const exec of execs) {
  const reqName    = exec.item.name;
  const method     = (exec.request && exec.request.method) ? exec.request.method : "";
  const urlRaw     = (exec.request && exec.request.url && exec.request.url.raw)
                     ? exec.request.url.raw.replace(/\{\{BASE_URL\}\}/g, "[BASE_URL]")
                     : "";
  const assertions = exec.assertions || [];
  const reqFailed  = assertions.some(function(a) { return a.error; });
  const passed     = assertions.filter(function(a) { return !a.error; }).length;
  const failed     = assertions.filter(function(a) { return  a.error; }).length;

  const rowBg = reqFailed ? "#fff5f5" : "#f0fdf4";
  const badge = reqFailed
    ? '<span style="background:#ef4444;color:#fff;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:700;">FAIL</span>'
    : '<span style="background:#22c55e;color:#fff;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:700;">PASS</span>';

  const failDetails = (reqFailed && failMap[reqName])
    ? failMap[reqName].map(function(msg) {
        return '<div style="color:#b91c1c;font-size:11px;margin-top:4px;padding-left:8px;border-left:3px solid #ef4444;">&#10007; '
               + msg + '</div>';
      }).join("")
    : "";

  const chips = assertions.map(function(a) {
    const ok  = !a.error;
    const bg  = ok ? "#dcfce7" : "#fee2e2";
    const col = ok ? "#16a34a" : "#dc2626";
    return '<span style="background:' + bg + ';color:' + col
           + ';padding:1px 7px;border-radius:10px;font-size:10px;margin:2px;display:inline-block;">'
           + a.assertion + '</span>';
  }).join(" ");

  requestRows +=
    '<tr style="background:' + rowBg + ';border-bottom:1px solid #e5e7eb;">'
    + '<td style="padding:10px 12px;vertical-align:top;">'
    +   '<div style="font-weight:600;font-size:13px;color:#111827;">' + reqName + '</div>'
    +   '<div style="font-size:11px;color:#6b7280;margin-top:2px;">'
    +     '<code style="background:#f3f4f6;padding:1px 5px;border-radius:3px;">' + method + '</code>'
    +     '<span style="margin-left:4px;word-break:break-all;">' + urlRaw + '</span>'
    +   '</div>'
    +   '<div style="margin-top:6px;">' + chips + '</div>'
    +   failDetails
    + '</td>'
    + '<td style="padding:10px 12px;text-align:center;vertical-align:top;white-space:nowrap;">'
    +   badge
    +   '<br><span style="font-size:11px;color:#6b7280;margin-top:4px;display:block;">'
    +     passed + "&#10003;" + (failed > 0 ? " " + failed + "&#10007;" : "")
    +   '</span>'
    + '</td>'
    + '</tr>';
}

// ── Assemble full HTML email ──────────────────────────────────────────────────
const statusColor = overallPass ? "#22c55e" : "#ef4444";
const statusLabel = overallPass ? "ALL TESTS PASSING" : (failedAssertions + " ASSERTION(S) FAILED");

const html = '<!DOCTYPE html>'
+ '<html lang="en"><head><meta charset="UTF-8">'
+ '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
+ '<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">'
+ '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">'
+ '<tr><td align="center">'
+ '<table width="680" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">'

// Header
+ '<tr><td style="background:#1e3a5f;padding:24px 32px;">'
+   '<h1 style="margin:0;color:#fff;font-size:20px;">RetailCode Corporate &mdash; API Test Report</h1>'
+   '<p style="margin:6px 0 0;color:#93c5fd;font-size:12px;">' + runDate + '</p>'
+ '</td></tr>'

// Status banner
+ '<tr><td style="background:' + statusColor + ';padding:10px 32px;">'
+   '<p style="margin:0;color:#fff;font-size:14px;font-weight:700;">' + statusLabel + '</p>'
+ '</td></tr>'

// Stats cards
+ '<tr><td style="padding:24px 32px;">'
+   '<table width="100%" cellpadding="0" cellspacing="0"><tr>'
+     '<td align="center" style="padding:14px 6px;background:#f0fdf4;border-radius:6px;">'
+       '<p style="margin:0;font-size:26px;font-weight:700;color:#16a34a;">' + passedAssertions + '</p>'
+       '<p style="margin:4px 0 0;font-size:10px;color:#6b7280;text-transform:uppercase;">Assertions Passed</p>'
+     '</td>'
+     '<td width="10"></td>'
+     '<td align="center" style="padding:14px 6px;background:#fef2f2;border-radius:6px;">'
+       '<p style="margin:0;font-size:26px;font-weight:700;color:#dc2626;">' + failedAssertions + '</p>'
+       '<p style="margin:4px 0 0;font-size:10px;color:#6b7280;text-transform:uppercase;">Assertions Failed</p>'
+     '</td>'
+     '<td width="10"></td>'
+     '<td align="center" style="padding:14px 6px;background:#f0f9ff;border-radius:6px;">'
+       '<p style="margin:0;font-size:26px;font-weight:700;color:#0369a1;">' + passedRequests + '/' + totalRequests + '</p>'
+       '<p style="margin:4px 0 0;font-size:10px;color:#6b7280;text-transform:uppercase;">Requests</p>'
+     '</td>'
+     '<td width="10"></td>'
+     '<td align="center" style="padding:14px 6px;background:#fafaf9;border-radius:6px;">'
+       '<p style="margin:0;font-size:26px;font-weight:700;color:#374151;">' + totalAssertions + '</p>'
+       '<p style="margin:4px 0 0;font-size:10px;color:#6b7280;text-transform:uppercase;">Total Assertions</p>'
+     '</td>'
+     '<td width="10"></td>'
+     '<td align="center" style="padding:14px 6px;background:#fdf4ff;border-radius:6px;">'
+       '<p style="margin:0;font-size:26px;font-weight:700;color:#7c3aed;">' + duration + '</p>'
+       '<p style="margin:4px 0 0;font-size:10px;color:#6b7280;text-transform:uppercase;">Duration</p>'
+     '</td>'
+   '</tr></table>'
+ '</td></tr>'

// Per-request breakdown table
+ '<tr><td style="padding:0 32px 8px;">'
+   '<h2 style="margin:0 0 12px;font-size:13px;color:#374151;text-transform:uppercase;letter-spacing:.5px;">'
+     'Test Breakdown (' + totalRequests + ' Requests)'
+   '</h2>'
+   '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">'
+     '<thead><tr style="background:#f9fafb;">'
+       '<th style="padding:9px 12px;text-align:left;font-size:11px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;">Request / Assertions</th>'
+       '<th style="padding:9px 12px;text-align:center;font-size:11px;color:#6b7280;font-weight:600;border-bottom:1px solid #e5e7eb;width:80px;">Result</th>'
+     '</tr></thead>'
+     '<tbody>' + requestRows + '</tbody>'
+   '</table>'
+ '</td></tr>'

// CTA button
+ '<tr><td style="padding:24px 32px;">'
+   '<a href="' + reportUrl + '" style="background:#1e3a5f;color:#fff;text-decoration:none;padding:11px 22px;border-radius:6px;font-size:13px;font-weight:600;display:inline-block;">'
+     'View Full Run on GitHub Actions &rarr;'
+   '</a>'
+ '</td></tr>'

// Footer
+ '<tr><td style="background:#f9fafb;padding:14px 32px;border-top:1px solid #e5e7eb;">'
+   '<p style="margin:0;font-size:11px;color:#9ca3af;">'
+     'RetailCode QA Pipeline &middot; Newman 6.2.1 &middot; Every Monday 12:00 PM UTC'
+   '</p>'
+ '</td></tr>'

+ '</table></td></tr></table></body></html>';

// ── Write output files ────────────────────────────────────────────────────────
fs.writeFileSync("/tmp/email-body.html", html);

const subjectTag = overallPass ? "PASS" : "FAIL";
const subject    = "[" + subjectTag + "] RetailCode Corporate API Report - "
                   + new Date().toDateString()
                   + " | " + passedAssertions + "/" + totalAssertions + " assertions passed";
fs.writeFileSync("/tmp/email-subject.txt", subject);

const failLines = Object.keys(failMap)
  .map(function(k) { return "  FAIL [" + k + "]: " + failMap[k].join(" | "); })
  .join("\n");
const plainText = "Passed: " + passedAssertions
  + " | Failed: " + failedAssertions
  + " | Total: " + totalAssertions
  + " | Requests: " + passedRequests + "/" + totalRequests
  + " | Duration: " + duration
  + (failLines ? "\n\nFailed tests:\n" + failLines : "\n\nAll tests passed.");
fs.writeFileSync("/tmp/email-body.txt", plainText);

console.log("Email files written.");
console.log(plainText);
