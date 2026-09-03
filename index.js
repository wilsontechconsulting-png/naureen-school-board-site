const DEFAULT_FROM_EMAIL = "Reelect Naureen for Columbia School Board <onboarding@resend.dev>";
const DEFAULT_TO_EMAIL = "naureen@crossroads-realtygroup.com";
const DEFAULT_BCC_EMAIL = "wilsontech.consulting@gmail.com";
const ALLOWED_ORIGINS = new Set([
  "https://wilsontechconsulting-png.github.io",
  "https://reelectnaureen.com",
  "https://www.reelectnaureen.com",
  "https://naureen-school-board-site.astute-ox-8061.chatgpt.site",
  "https://naureen-school-board-site.mavenpro.chatgpt.site",
]);

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function corsHeaders(request) {
  const origin = request.headers.get("Origin");

  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function jsonResponse(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(request),
    },
  });
}

function getResendStatus(env) {
  const missing = [!env.RESEND_API_KEY ? "RESEND_API_KEY" : ""].filter(Boolean);

  return {
    configured: missing.length === 0,
    missing,
    from: env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL,
    to: env.CONTACT_TO_EMAIL || DEFAULT_TO_EMAIL,
    bcc: env.CONTACT_BCC_EMAIL || DEFAULT_BCC_EMAIL,
  };
}

function buildContactEmail(input) {
  const submittedAt = new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const rows = [
    ["Name", input.name],
    ["Email", input.email],
    ["Phone", input.phone || "Not provided"],
    ["Submitted", `${submittedAt} CT`],
  ];

  const htmlRows = rows
    .map(([label, value]) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #d9e2ee;font-weight:700;color:#061d3f;width:130px;">${escapeHtml(label)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #d9e2ee;color:#10233f;">${escapeHtml(value)}</td>
      </tr>
    `)
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f7f9fc;padding:24px;color:#10233f;">
      <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #d9e2ee;border-radius:8px;overflow:hidden;">
        <div style="background:#0057b8;color:#ffffff;padding:20px 24px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#d8e9ff;">Website question</p>
          <h1 style="margin:0;font-size:24px;line-height:1.25;">${escapeHtml(input.name)}</h1>
        </div>
        <table role="presentation" style="border-collapse:collapse;width:100%;">
          <tbody>${htmlRows}</tbody>
        </table>
        <div style="padding:18px 24px;">
          <p style="margin:0 0 8px;font-weight:700;color:#061d3f;">Message</p>
          <p style="margin:0;white-space:pre-wrap;line-height:1.6;color:#526176;">${escapeHtml(input.message)}</p>
        </div>
      </div>
    </div>
  `;

  const text = [
    `Website question from ${input.name}`,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Message:",
    input.message,
  ].join("\n");

  return {
    subject: `Website question from ${input.name}`,
    html,
    text,
  };
}

async function handleContact(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  }

  if (request.method === "GET") {
    const resend = getResendStatus(env);

    return jsonResponse(request, {
      ok: resend.configured,
      mode: resend.configured ? "resend" : "not_configured",
      missing: resend.missing,
    }, resend.configured ? 200 : 503);
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { ok: false, message: "Method not allowed." }, 405);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { ok: false, message: "Invalid form submission." }, 400);
  }

  if (body.website) {
    return jsonResponse(request, { ok: true, id: null });
  }

  const name = cleanText(body.name, 120);
  const email = cleanText(body.email, 160).toLowerCase();
  const phone = cleanText(body.phone, 40);
  const message = cleanText(body.message, 1800);

  if (!name || !email || !message) {
    return jsonResponse(request, { ok: false, message: "Name, email, and message are required." }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse(request, { ok: false, message: "Please enter a valid email address." }, 400);
  }

  const resend = getResendStatus(env);

  if (!resend.configured) {
    return jsonResponse(request, {
      ok: false,
      mode: "not_configured",
      message: "Campaign form notifications are not configured yet.",
      missing: resend.missing,
    }, 503);
  }

  const emailContent = buildContactEmail({ name, email, phone, message });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resend.from,
      to: [resend.to],
      bcc: [resend.bcc],
      reply_to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return jsonResponse(request, {
      ok: false,
      message: typeof data.message === "string" ? data.message : "We could not send your message right now.",
    }, 502);
  }

  return jsonResponse(request, { ok: true, id: crypto.randomUUID(), emailId: data.id || null });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/contact" || url.pathname === "/api/contact/") {
      return handleContact(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
