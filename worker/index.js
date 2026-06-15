/**
 * Cloudflare Worker — RetailCode Corporate API Test Report Notifier
 *
 * Triggered via HTTP POST (or a Cron Trigger) to send the latest
 * Newman HTML test report to the configured recipients via Mailgun.
 *
 * Required Worker Secrets (set via Wrangler or the Cloudflare dashboard):
 *   MAILGUN_API_KEY   — Mailgun private API key
 *   MAILGUN_DOMAIN    — Mailgun sending domain  (e.g. mg.yourdomain.com)
 *   FROM_EMAIL        — Sender address           (e.g. qa-bot@mg.yourdomain.com)
 *
 * Required KV Namespace binding: REPORT_KV
 *   The Newman HTML report is expected to be stored under the key "latest-report"
 *   before this Worker is invoked (e.g. uploaded by the CI pipeline using:
 *     wrangler kv:key put --binding=REPORT_KV "latest-report" --path reports/RetailCode-Corporate-Test-Report.html
 *   )
 *
 * Trigger options:
 *   • HTTP POST  https://<worker-url>/notify   — sends the report immediately
 *   • Cron       configured in wrangler.toml    — sends on schedule
 */

const RECIPIENTS = [
  { name: "Oladimeji Ajayi [FBISTech - PIL]", email: "oladimeji.ajayi@fbistech.com" },
  { name: "Osayuki Aganmwonyi",               email: "osayuki.aganmwonyi@fbistech.com" },
  { name: "Stanislaus Odili [FBISTech - BD]", email: "stanislaus.odili@fbistech.com" },
  { name: "Gift Alabo [RetailCode - IT]",      email: "gift.alabo@fbistech.com" },
];

export default {
  // ── HTTP handler ──────────────────────────────────────────────────────────
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/notify") {
      return handleNotify(env);
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  },

  // ── Cron handler ──────────────────────────────────────────────────────────
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(handleNotify(env));
  },
};

// ── Core notification logic ────────────────────────────────────────────────

async function handleNotify(env) {
  // 1. Fetch the HTML report from KV (stored by CI after Newman run)
  const reportHtml = await env.REPORT_KV.get("latest-report");
  const reportMeta = await env.REPORT_KV.get("latest-meta", { type: "json" }).catch(() => null);

  // 2. Build summary line from stored metadata (if available)
  const now        = new Date().toUTCString();
  const runDate    = reportMeta?.runDate   ?? now;
  const passed     = reportMeta?.passed    ?? "N/A";
  const failed     = reportMeta?.failed    ?? "N/A";
  const total      = reportMeta?.total     ?? "N/A";
  const duration   = reportMeta?.duration  ?? "N/A";
  const reportUrl  = reportMeta?.reportUrl ?? "https://github.com/Eyitemicode/Retailcode-Corporate-Newman-Run";

  const subject = `RetailCode Corporate API Test Report — ${runDate}`;

  const textBody = [
    "RetailCode Corporate API — Newman Test Run Summary",
    "=".repeat(52),
    "",
    `Run date : ${runDate}`,
    `Duration : ${duration}`,
    `Requests : ${total} total`,
    `Passed   : ${passed}`,
    `Failed   : ${failed}`,
    "",
    `Full HTML report: ${reportUrl}`,
    "",
    "---",
    "This email was sent automatically by the RetailCode QA pipeline.",
  ].join("\n");

  const htmlBody = buildHtmlEmail({ runDate, passed, failed, total, duration, reportUrl, reportHtml });

  // 3. Send to every recipient via Mailgun
  const results = await Promise.allSettled(
    RECIPIENTS.map((r) =>
      sendMailgun(env, {
        to:      `"${r.name}" <${r.email}>`,
        subject,
        text:    textBody,
        html:    htmlBody,
      })
    )
  );

  const summary = results.map((r, i) => ({
    recipient: RECIPIENTS[i].email,
    status:    r.status,
    reason:    r.status === "rejected" ? String(r.reason) : undefined,
  }));

  const allOk = results.every((r) => r.status === "fulfilled");

  return new Response(JSON.stringify({ success: allOk, summary }), {
    status:  allOk ? 200 : 207,
    headers: { "Content-Type": "application/json" },
  });
}

// ── Mailgun API call ──────────────────────────────────────────────────────

async function sendMailgun(env, { to, subject, text, html }) {
  const domain  = env.MAILGUN_DOMAIN;
  const apiKey  = env.MAILGUN_API_KEY;
  const from    = env.FROM_EMAIL ?? `RetailCode QA <qa-bot@${domain}>`;

  const formData = new FormData();
  formData.append("from",    from);
  formData.append("to",      to);
  formData.append("subject", subject);
  formData.append("text",    text);
  formData.append("html",    html);

  const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method:  "POST",
    headers: { Authorization: `Basic ${btoa("api:" + apiKey)}` },
    body:    formData,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mailgun error ${response.status}: ${body}`);
  }

  return response.json();
}

// ── HTML email builder ─────────────────────────────────────────────────────

function buildHtmlEmail({ runDate, passed, failed, total, duration, reportUrl, reportHtml }) {
  const statusColor  = Number(failed) === 0 ? "#22c55e" : "#ef4444";
  const statusLabel  = Number(failed) === 0 ? "ALL PASSING" : `${failed} FAILED`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>RetailCode Corporate API Test Report</title>
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f6f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1e3a5f;padding:28px 36px;">
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">
              RetailCode Corporate — API Test Report
            </h1>
            <p style="margin:6px 0 0;color:#93c5fd;font-size:13px;">${runDate}</p>
          </td>
        </tr>

        <!-- Status banner -->
        <tr>
          <td style="background:${statusColor};padding:12px 36px;">
            <p style="margin:0;color:#ffffff;font-size:15px;font-weight:700;letter-spacing:1px;">
              ${statusLabel}
            </p>
          </td>
        </tr>

        <!-- Stats -->
        <tr>
          <td style="padding:28px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="padding:12px;background:#f0fdf4;border-radius:6px;width:30%;">
                  <p style="margin:0;font-size:28px;font-weight:700;color:#16a34a;">${passed}</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Passed</p>
                </td>
                <td width="16"></td>
                <td align="center" style="padding:12px;background:#fef2f2;border-radius:6px;width:30%;">
                  <p style="margin:0;font-size:28px;font-weight:700;color:#dc2626;">${failed}</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Failed</p>
                </td>
                <td width="16"></td>
                <td align="center" style="padding:12px;background:#f0f9ff;border-radius:6px;width:30%;">
                  <p style="margin:0;font-size:28px;font-weight:700;color:#0369a1;">${total}</p>
                  <p style="margin:4px 0 0;font-size:12px;color:#6b7280;text-transform:uppercase;">Assertions</p>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
              <tr>
                <td style="font-size:13px;color:#6b7280;">Duration</td>
                <td align="right" style="font-size:13px;font-weight:600;color:#111827;">${duration}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:0 36px 32px;">
            <a href="${reportUrl}"
               style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">
              View Full HTML Report →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:16px 36px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              Automated by the RetailCode QA Pipeline · Newman 6.2.1
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
