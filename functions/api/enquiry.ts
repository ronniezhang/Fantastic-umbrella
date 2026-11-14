/**
 * Cloudflare Pages Function: POST /api/enquiry
 *
 * The Astro site is 100% static, so it cannot receive a POST by itself.
 * This function is the missing "receiving end". It runs on the same
 * Cloudflare Pages project / domain as the site, so there is no CMS,
 * no WordPress, no PHP and no cross-origin call.
 *
 * Delivery is entirely driven by environment variables (set in the Pages
 * project settings, encrypted for secrets). Any ONE of the following turns
 * the form on; several can be enabled at once for redundancy:
 *
 *   RESEND_API_KEY + ENQUIRY_TO   -> send the enquiry as an email (Resend)
 *   ENQUIRY_WEBHOOK_URL           -> push to WeCom / Feishu / Slack / own API
 *   ENQUIRY_FORWARD_URL           -> forward raw JSON (or form data) to a
 *                                   third-party form service such as Formspree
 *
 * If none is configured the endpoint answers 503 with a clear message.
 * It never pretends to have accepted an enquiry it could not deliver.
 */

const REQUIRED = [
  'full_name',
  'company',
  'email',
  'country',
  'product_interest',
  'estimated_quantity',
  'message',
];

const LABELS = {
  full_name: 'Full name',
  company: 'Company',
  email: 'Business email',
  country: 'Country / region',
  product_interest: 'Product interest',
  estimated_quantity: 'Estimated quantity',
  target_market: 'Target market',
  annual_volume: 'Annual purchase volume',
  preferred_incoterm: 'Preferred trade term',
  message: 'Your requirements',
};

const MAX_LEN = 500;
const MAX_MESSAGE = 5000;

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function clean(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_MESSAGE) : '';
}

function esc(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildMail(data, submittedAt, source) {
  const rows = Object.keys(LABELS).map((key) => [LABELS[key], clean(data[key]) || '-']);
  const subject = `New B2B enquiry - ${clean(data.full_name)} (${clean(data.company)})`;

  const text = [
    subject,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    '---',
    `Submitted: ${submittedAt}`,
    `Source page: ${source}`,
  ].join('\n');

  const html = [
    `<h2>${esc(subject)}</h2>`,
    '<table cellpadding="6" cellspacing="0" border="0" style="font-family:Arial,sans-serif;font-size:14px">',
    ...rows.map(
      ([label, value]) =>
        `<tr><td valign="top"><strong>${esc(label)}</strong></td><td valign="top" style="white-space:pre-wrap">${esc(value)}</td></tr>`,
    ),
    '</table>',
    `<p style="color:#6b7c8d;font-size:12px">Submitted: ${esc(submittedAt)}<br>Source page: ${esc(source)}</p>`,
  ].join('');

  return { subject, text, html };
}

async function sendByEmail(env, mail, replyTo) {
  if (!env.RESEND_API_KEY || !env.ENQUIRY_TO) return null;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.ENQUIRY_FROM || 'Fantastic Umbrella <onboarding@resend.dev>',
        to: env.ENQUIRY_TO.split(',').map((s) => s.trim()).filter(Boolean),
        reply_to: replyTo,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      }),
    });
    if (!res.ok) console.error('Resend failed', res.status, await res.text());
    return { channel: 'email', ok: res.ok };
  } catch (err) {
    console.error('Resend error', err);
    return { channel: 'email', ok: false };
  }
}

async function sendByWebhook(env, data, mail, submittedAt) {
  if (!env.ENQUIRY_WEBHOOK_URL) return null;
  const url = env.ENQUIRY_WEBHOOK_URL;
  const shortText = [
    `New B2B enquiry: ${clean(data.full_name)} (${clean(data.company)})`,
    `Email: ${clean(data.email)}`,
    `Country: ${clean(data.country)}`,
    `Product: ${clean(data.product_interest)}`,
    `Qty: ${clean(data.estimated_quantity)}`,
    `Message: ${clean(data.message).slice(0, 400)}`,
    `Time: ${submittedAt}`,
  ].join('\n').slice(0, 1800);

  let body;
  if (url.includes('qyapi.weixin.qq.com')) {
    body = { msgtype: 'text', text: { content: shortText } };
  } else if (url.includes('open.feishu.cn')) {
    body = { msg_type: 'text', content: { text: shortText } };
  } else if (url.includes('hooks.slack.com')) {
    body = { text: shortText };
  } else {
    body = { ...data, _subject: mail.subject, _submitted_at: submittedAt };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error('Webhook failed', res.status, await res.text());
    return { channel: 'webhook', ok: res.ok };
  } catch (err) {
    console.error('Webhook error', err);
    return { channel: 'webhook', ok: false };
  }
}

async function sendByForward(env, data, submittedAt) {
  if (!env.ENQUIRY_FORWARD_URL) return null;
  const payload = { ...data, _submitted_at: submittedAt };
  const asForm = env.ENQUIRY_FORWARD_FORMAT === 'form';
  try {
    const res = await fetch(env.ENQUIRY_FORWARD_URL, {
      method: 'POST',
      headers: {
        'Content-Type': asForm ? 'application/x-www-form-urlencoded' : 'application/json',
        Accept: 'application/json',
      },
      body: asForm ? new URLSearchParams(payload).toString() : JSON.stringify(payload),
    });
    if (!res.ok) console.error('Forward failed', res.status, await res.text());
    return { channel: 'forward', ok: res.ok };
  } catch (err) {
    console.error('Forward error', err);
    return { channel: 'forward', ok: false };
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const origin = request.headers.get('Origin');
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) {
        return reply({ ok: false, error: 'bad_origin' }, 403);
      }
    } catch (_) {
      return reply({ ok: false, error: 'bad_origin' }, 403);
    }
  }

  let data;
  try {
    data = await request.json();
  } catch (_) {
    return reply({ ok: false, error: 'invalid_json', message: 'Invalid submission.' }, 400);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return reply({ ok: false, error: 'invalid_payload', message: 'Invalid submission.' }, 400);
  }

  // Honeypot: bots get a fake success, humans never see this field.
  if (clean(data._gotcha)) {
    return reply({ ok: true, message: 'Thank you. Your enquiry has been received.' });
  }

  // Very fast submissions are almost always bots. Missing field = JS off, skip.
  const openedAt = Number(data._form_time || 0);
  if (openedAt > 0 && Date.now() - openedAt < 1500) {
    return reply({ ok: false, error: 'too_fast', message: 'Please review your details and submit again.' }, 400);
  }

  for (const key of REQUIRED) {
    if (!clean(data[key])) {
      return reply({ ok: false, error: 'missing_field', field: key, message: 'Please complete all required fields.' }, 400);
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(data.email)) || clean(data.email).length > 200) {
    return reply({ ok: false, error: 'invalid_email', message: 'Please enter a valid business email address.' }, 400);
  }
  for (const key of Object.keys(LABELS)) {
    const limit = key === 'message' ? MAX_MESSAGE : MAX_LEN;
    if (clean(data[key]).length > limit) {
      return reply({ ok: false, error: 'field_too_long', field: key, message: 'One of the fields is too long.' }, 400);
    }
  }

  const configured =
    (env.RESEND_API_KEY && env.ENQUIRY_TO) ||
    env.ENQUIRY_WEBHOOK_URL ||
    env.ENQUIRY_FORWARD_URL;

  if (!configured) {
    console.error('Enquiry received but NO delivery channel is configured');
    return reply(
      {
        ok: false,
        error: 'not_configured',
        message:
          'The enquiry form is not enabled yet. Please contact us by email and we will get back to you.',
      },
      503,
    );
  }

  const submittedAt = new Date().toISOString();
  const source = clean(data._page) || request.headers.get('Referer') || '(unknown)';
  const mail = buildMail(data, submittedAt, source);

  const results = (
    await Promise.all([
      sendByEmail(env, mail, clean(data.email)),
      sendByWebhook(env, data, mail, submittedAt),
      sendByForward(env, data, submittedAt),
    ])
  ).filter(Boolean);

  const delivered = results.some((r) => r.ok);
  if (!delivered) {
    console.error('All delivery channels failed', results);
    return reply(
      {
        ok: false,
        error: 'delivery_failed',
        message:
          'We could not send your enquiry just now. Please try again in a minute, or contact us by email.',
      },
      502,
    );
  }

  return reply({
    ok: true,
    message: 'Thank you. Your enquiry has been received - we normally reply within one business day.',
  });
}
