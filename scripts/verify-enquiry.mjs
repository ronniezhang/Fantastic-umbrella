#!/usr/bin/env node
/**
 * One-command health check for the live enquiry pipeline.
 *
 *   npm run verify:enquiry
 *   npm run verify:enquiry -- --url https://your-domain.com
 *   npm run verify:enquiry -- --no-send        # skip the real test enquiry
 *
 * Exit code 1 only when the endpoint is broken. HTTP 503 not_configured is
 * a normal pre-launch state (delivery keys not set yet), not a failure.
 * Without --no-send, the last probe submits ONE real test enquiry, so once
 * Resend is configured this doubles as the final acceptance test.
 */

const DEFAULT_URL = 'https://fantastic-umbrella-e13.pages.dev';
const args = process.argv.slice(2);
const urlAt = args.indexOf('--url');
const base = (urlAt >= 0 && args[urlAt + 1] ? args[urlAt + 1] : DEFAULT_URL).replace(/\/+$/, '');
const noSend = args.includes('--no-send');

const sample = {
  full_name: 'Pipeline QA',
  company: 'Internal Check',
  email: 'qa@example.com',
  country: 'DE',
  product_interest: 'Golf umbrella',
  estimated_quantity: '500 pcs',
  message: 'Automated endpoint check - not a real enquiry, please do not quote.',
  _form_time: 0,
  _page: `${base}/contact/`,
};

let broken = false;
const log = (s) => console.log(s);

async function post(body, extraHeaders = {}) {
  const res = await fetch(`${base}/api/enquiry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...extraHeaders },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) { /* HTML fallback / proxy page */ }
  return { status: res.status, json, text: text.slice(0, 300) };
}

async function run() {
  log(`Enquiry pipeline check -> ${base}\n`);

  for (const path of ['/', '/contact/']) {
    try {
      const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(20000) });
      log(`  [${res.status === 200 ? 'OK  ' : 'WARN'}] GET ${path} -> HTTP ${res.status}`);
      if (path === '/contact/' && res.ok) {
        const html = await res.text();
        const wired = html.includes('data-endpoint="/api/enquiry"');
        log(`  [${wired ? 'OK  ' : 'FAIL'}] Contact form is wired to /api/enquiry`);
        if (!wired) broken = true;
      }
    } catch (err) {
      log(`  [FAIL] GET ${path} -> ${err.message}`);
      broken = true;
    }
  }

  try {
    const r = await post({ _form_time: 0 });
    const live = Boolean(r.json && typeof r.json.ok === 'boolean');
    log(`  [${live ? 'OK  ' : 'FAIL'}] Endpoint returns JSON -> HTTP ${r.status} ${r.json ? JSON.stringify(r.json) : r.text}`);
    if (!live) broken = true;
  } catch (err) {
    log(`  [FAIL] Endpoint unreachable -> ${err.message}`);
    broken = true;
  }

  try {
    const r = await post({ _form_time: 0 }, { Origin: 'https://evil.example' });
    log(`  [${r.status === 403 ? 'OK  ' : 'WARN'}] Cross-origin guard -> HTTP ${r.status}`);
  } catch (err) {
    log(`  [WARN] Cross-origin probe failed -> ${err.message}`);
  }

  if (noSend) {
    log('  [SKIP] Real test enquiry skipped (--no-send)');
  } else {
    try {
      const r = await post(sample, { Origin: base });
      if (r.status === 200 && r.json && r.json.ok) {
        log(`  [OK  ] Delivery channel is LIVE -> HTTP 200 ${JSON.stringify(r.json)}`);
        log('         One real test enquiry was sent. Check the inbox (not spam) and verify Reply-To is the customer address.');
      } else if (r.status === 503 && r.json && r.json.error === 'not_configured') {
        log('  [WAIT] No delivery channel configured -> HTTP 503 not_configured');
        log('         Set RESEND_API_KEY + ENQUIRY_TO + ENQUIRY_FROM in Pages env vars (Production + Preview), then redeploy.');
      } else if (r.status === 502) {
        log('  [FAIL] Channels are configured but ALL deliveries failed -> HTTP 502');
        broken = true;
      } else {
        log(`  [WARN] Unexpected response -> HTTP ${r.status} ${r.text}`);
      }
    } catch (err) {
      log(`  [FAIL] Delivery probe failed -> ${err.message}`);
      broken = true;
    }
  }

  log('');
  if (broken) {
    log('RESULT: BROKEN - the form would lose submissions. Do not point the main domain at this build.');
    process.exitCode = 1;
  } else {
    log('RESULT: endpoint healthy. 503 = waiting for delivery keys; 200 = fully live.');
  }
}

run().catch((err) => {
  console.error('Verification crashed:', err);
  process.exitCode = 1;
});
