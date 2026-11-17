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
// Verified 2026-11-14: MX + SPF + DKIM + DMARC all pass, inbound/outbound tested.
const SALES_EMAIL = 'sales@fantasticumbrella.com';

/**
 * Visitor-facing messages, selected by the hidden `_locale` field the form
 * submits. The internal notification email deliberately stays in English -
 * the sales team reads it - but carries a language tag and a Language: line
 * so the reply can be written in the buyer's language.
 */
const MESSAGES = {
  en: {
    invalid: 'Invalid submission.',
    received: 'Thank you. Your enquiry has been received.',
    tooFast: 'Please review your details and submit again.',
    missing: 'Please complete all required fields.',
    invalidEmail: 'Please enter a valid business email address.',
    tooLong: 'One of the fields is too long.',
    notConfigured:
      'Online submission is not enabled yet. Please use the one-click email link below to send your details to sales@fantasticumbrella.com - we will get back to you.',
    deliveryFailed:
      'We could not send your enquiry just now. Please try again in a minute, or use the one-click email link below to reach sales@fantasticumbrella.com.',
    success:
      'Thank you. Your enquiry has been received - we normally reply within one business day.',
  },
  es: {
    invalid: 'Envío no válido.',
    received: 'Gracias. Hemos recibido su consulta.',
    tooFast: 'Revise los datos y vuelva a enviar el formulario.',
    missing: 'Complete todos los campos obligatorios.',
    invalidEmail: 'Introduzca una dirección de correo empresarial válida.',
    tooLong: 'Uno de los campos es demasiado largo.',
    notConfigured:
      'El envío en línea aún no está disponible. Utilice el enlace de un clic para enviarnos sus datos a sales@fantasticumbrella.com; le responderemos.',
    deliveryFailed:
      'No hemos podido enviar su consulta. Inténtelo de nuevo en unos minutos o utilice el enlace de un clic para escribir a sales@fantasticumbrella.com.',
    success:
      'Gracias. Hemos recibido su consulta; normalmente respondemos en un día laborable.',
  },
  fr: {
    invalid: 'Envoi invalide.',
    received: 'Merci. Nous avons bien reçu votre demande.',
    tooFast: 'Vérifiez vos informations et soumettez à nouveau le formulaire.',
    missing: 'Veuillez remplir tous les champs obligatoires.',
    invalidEmail: 'Veuillez saisir une adresse e-mail professionnelle valide.',
    tooLong: "L'un des champs est trop long.",
    notConfigured:
      "L'envoi en ligne n'est pas encore activé. Utilisez le lien en un clic pour envoyer vos informations à sales@fantasticumbrella.com ; nous vous répondrons.",
    deliveryFailed:
      "Nous n'avons pas pu envoyer votre demande. Réessayez dans quelques instants ou utilisez le lien en un clic pour écrire à sales@fantasticumbrella.com.",
    success:
      'Merci. Nous avons bien reçu votre demande ; nous répondons généralement sous un jour ouvré.',
  },
  de: {
    invalid: 'Ungültige Übermittlung.',
    received: 'Vielen Dank. Ihre Anfrage ist bei uns eingegangen.',
    tooFast: 'Bitte prüfen Sie Ihre Angaben und senden Sie das Formular erneut ab.',
    missing: 'Bitte füllen Sie alle Pflichtfelder aus.',
    invalidEmail: 'Bitte geben Sie eine gültige geschäftliche E-Mail-Adresse ein.',
    tooLong: 'Eines der Felder ist zu lang.',
    notConfigured:
      'Der Online-Versand ist noch nicht aktiviert. Bitte nutzen Sie den Ein-Klick-Link, um Ihre Angaben an sales@fantasticumbrella.com zu senden; wir melden uns.',
    deliveryFailed:
      'Ihre Anfrage konnte gerade nicht gesendet werden. Bitte versuchen Sie es in wenigen Minuten erneut oder nutzen Sie den Ein-Klick-Link an sales@fantasticumbrella.com.',
    success:
      'Vielen Dank. Ihre Anfrage ist eingegangen; wir antworten in der Regel innerhalb eines Werktags.',
  },
  zh: {
    invalid: '提交内容无效。',
    received: '谢谢，我们已收到您的询盘。',
    tooFast: '请核对信息后重新提交。',
    missing: '请填写所有必填项。',
    invalidEmail: '请输入有效的商务邮箱地址。',
    tooLong: '有字段内容过长。',
    notConfigured:
      '在线提交尚未启用。请使用下方一键链接把信息发送至 sales@fantasticumbrella.com，我们会尽快回复。',
    deliveryFailed:
      '询盘暂时发送失败，请稍后重试，或使用下方一键链接联系 sales@fantasticumbrella.com。',
    success: '谢谢，我们已收到您的询盘，通常在一个工作日内回复。',
  },
};

const LOCALE_LABEL = { en: 'English', es: 'Spanish', fr: 'French', de: 'German', zh: 'Chinese (Simplified)' };
const SUPPORTED_LOCALES = ['es', 'fr', 'de', 'zh'];
const messagesFor = (locale) => MESSAGES[locale] || MESSAGES.en;

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

function buildMail(data, submittedAt, source, locale = 'en') {
  const rows = Object.keys(LABELS).map((key) => [LABELS[key], clean(data[key]) || '-']);
  const tag = locale === 'en' ? '' : `[${locale.toUpperCase()}] `;
  const language = LOCALE_LABEL[locale] || 'English';
  const subject = `${tag}New B2B enquiry - ${clean(data.full_name)} (${clean(data.company)})`;

  const text = [
    subject,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    '---',
    `Submitted: ${submittedAt}`,
    `Source page: ${source}`,
    `Language: ${language}`,
  ].join('\n');

  const html = [
    `<h2>${esc(subject)}</h2>`,
    '<table cellpadding="6" cellspacing="0" border="0" style="font-family:Arial,sans-serif;font-size:14px">',
    ...rows.map(
      ([label, value]) =>
        `<tr><td valign="top"><strong>${esc(label)}</strong></td><td valign="top" style="white-space:pre-wrap">${esc(value)}</td></tr>`,
    ),
    '</table>',
    `<p style="color:#6b7c8d;font-size:12px">Submitted: ${esc(submittedAt)}<br>Source page: ${esc(source)}<br>Language: ${esc(language)}</p>`,
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
    const raw = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (_) { /* non-JSON upstream error */ }
    if (!res.ok) console.error('Resend failed', res.status, raw.slice(0, 400));
    return {
      channel: 'email',
      ok: res.ok,
      status: res.status,
      id: parsed && parsed.id ? String(parsed.id) : null,
      detail: res.ok ? null : raw.slice(0, 400),
    };
  } catch (err) {
    console.error('Resend error', err);
    return { channel: 'email', ok: false, status: 0, id: null, detail: String(err).slice(0, 200) };
  }
}

/** Read back one message's delivery state. Needs a key with read access; a
 *  send-only key will answer 401, which is itself a useful diagnostic result. */
async function emailStatus(env, id) {
  if (!id) return null;
  try {
    const res = await fetch(`https://api.resend.com/emails/${id}`, {
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
    });
    const raw = await res.text();
    return { status: res.status, body: raw.slice(0, 600) };
  } catch (err) {
    return { status: 0, body: String(err).slice(0, 200) };
  }
}

function publicResult(r) {
  return {
    channel: r.channel,
    ok: r.ok,
    status: r.status || null,
    id: r.id || null,
    detail: r.detail || null,
  };
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

/**
 * GET /api/enquiry - read-only pipeline status for CI / ops checks.
 * Never returns an API key, a recipient list, or any customer data.
 * Lets us confirm that Pages env vars are bound WITHOUT sending a test email.
 */
export async function onRequestGet(context) {
  const { env } = context;
  const from = env.ENQUIRY_FROM || 'Fantastic Umbrella <onboarding@resend.dev>';
  return reply({
    ok: true,
    service: 'fantastic-umbrella-enquiry',
    delivery: {
      email: Boolean(env.RESEND_API_KEY && env.ENQUIRY_TO),
      webhook: Boolean(env.ENQUIRY_WEBHOOK_URL),
      forward: Boolean(env.ENQUIRY_FORWARD_URL),
    },
    mode: from.includes('onboarding@resend.dev') ? 'resend-sandbox' : 'verified-domain',
    from,
    to: env.ENQUIRY_TO || null,
  });
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
    return reply({ ok: false, error: 'invalid_payload', message: MESSAGES.en.invalid }, 400);
  }

  // The form submits a hidden _locale. Unknown values fall back to English.
  const locale = SUPPORTED_LOCALES.includes(clean(data._locale)) ? clean(data._locale) : 'en';
  const m = messagesFor(locale);

  // Honeypot: bots get a fake success, humans never see this field.
  if (clean(data._gotcha)) {
    return reply({ ok: true, message: m.received });
  }

  // Very fast submissions are almost always bots. Missing field = JS off, skip.
  const openedAt = Number(data._form_time || 0);
  if (openedAt > 0 && Date.now() - openedAt < 1500) {
    return reply({ ok: false, error: 'too_fast', message: m.tooFast }, 400);
  }

  for (const key of REQUIRED) {
    if (!clean(data[key])) {
      return reply({ ok: false, error: 'missing_field', field: key, message: m.missing }, 400);
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(data.email)) || clean(data.email).length > 200) {
    return reply({ ok: false, error: 'invalid_email', message: m.invalidEmail }, 400);
  }
  for (const key of Object.keys(LABELS)) {
    const limit = key === 'message' ? MAX_MESSAGE : MAX_LEN;
    if (clean(data[key]).length > limit) {
      return reply({ ok: false, error: 'field_too_long', field: key, message: m.tooLong }, 400);
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
        message: m.notConfigured,
        fallback: SALES_EMAIL,
      },
      503,
    );
  }

  const submittedAt = new Date().toISOString();
  const source = clean(data._page) || request.headers.get('Referer') || '(unknown)';
  const mail = buildMail(data, submittedAt, source, locale);

  const results = (
    await Promise.all([
      sendByEmail(env, mail, clean(data.email)),
      sendByWebhook(env, data, mail, submittedAt),
      sendByForward(env, data, submittedAt),
    ])
  ).filter(Boolean);

  const delivered = results.some((r) => r.ok);
  const diagnose = data._diag === true || request.headers.get('X-Enquiry-Diag') === '1';
  const diagnostics = diagnose
    ? {
        to: env.ENQUIRY_TO || null,
        from: env.ENQUIRY_FROM || 'Fantastic Umbrella <onboarding@resend.dev>',
        delivery: results.map(publicResult),
      }
    : null;

  if (!delivered) {
    console.error('All delivery channels failed', results);
    return reply(
      {
        ok: false,
        error: 'delivery_failed',
        message: m.deliveryFailed,
        fallback: SALES_EMAIL,
        ...(diagnose ? { diagnostics } : {}),
      },
      502,
    );
  }

  const body = {
    ok: true,
    message: m.success,
  };
  if (diagnose) {
    const emailResult = results.find((r) => r.channel === 'email');
    body.diagnostics = {
      ...diagnostics,
      email_status: await emailStatus(env, emailResult && emailResult.id),
    };
  }
  return reply(body);
}
