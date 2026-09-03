import type { APIRoute } from "astro";
import { getContactEmailStatus, sendContactEmail } from "../../lib/contact-email";

type ContactPayload = {
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  website?: string;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

export const GET: APIRoute = async () => {
  const resend = getContactEmailStatus();

  return jsonResponse({
    ok: resend.configured,
    mode: resend.configured ? "resend" : "not_configured",
    missing: resend.missing,
  }, resend.configured ? 200 : 503);
};

export const POST: APIRoute = async ({ request }) => {
  let body: ContactPayload;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, message: "Invalid form submission." }, 400);
  }

  if (body.website) {
    return jsonResponse({ ok: true, id: null });
  }

  const name = cleanText(body.name, 120);
  const email = cleanText(body.email, 160).toLowerCase();
  const phone = cleanText(body.phone, 40);
  const message = cleanText(body.message, 1800);

  if (!name || !email || !message) {
    return jsonResponse({ ok: false, message: "Name, email, and message are required." }, 400);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, message: "Please enter a valid email address." }, 400);
  }

  const resend = getContactEmailStatus();

  if (!resend.configured) {
    return jsonResponse({
      ok: false,
      mode: "not_configured",
      message: "Campaign form notifications are not configured yet.",
      missing: resend.missing,
    }, 503);
  }

  try {
    const emailId = await sendContactEmail({ name, email, phone, message });

    return jsonResponse({
      ok: true,
      id: crypto.randomUUID(),
      emailId,
    });
  } catch (err) {
    console.error("Could not send contact notification", err);
    return jsonResponse({ ok: false, message: "We could not send your message right now." }, 502);
  }
};
