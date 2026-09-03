type ContactSubmission = {
  name: string;
  email: string;
  phone: string;
  message: string;
};

type ResendSendResponse = {
  id?: unknown;
  message?: unknown;
};

const DEFAULT_FROM_EMAIL = "Reelect Naureen for Columbia School Board <onboarding@resend.dev>";
const DEFAULT_TO_EMAIL = "naureen@crossroads-realtygroup.com";
const DEFAULT_BCC_EMAIL = "wilsontech.consulting@gmail.com";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function getContactEmailStatus() {
  const missing = [!process.env.RESEND_API_KEY ? "RESEND_API_KEY" : ""].filter(Boolean);

  return {
    configured: missing.length === 0,
    missing,
    from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL,
    to: process.env.CONTACT_TO_EMAIL || DEFAULT_TO_EMAIL,
    bcc: process.env.CONTACT_BCC_EMAIL || DEFAULT_BCC_EMAIL,
  };
}

function buildContactEmail(input: ContactSubmission) {
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

export async function sendContactEmail(input: ContactSubmission) {
  const status = getContactEmailStatus();

  if (!status.configured) {
    throw new Error(`Resend is missing configuration: ${status.missing.join(", ")}`);
  }

  const email = buildContactEmail(input);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: status.from,
      to: [status.to],
      bcc: [status.bcc],
      reply_to: input.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as ResendSendResponse;

  if (!response.ok) {
    const message = typeof data.message === "string" ? data.message : "Resend rejected the email.";
    throw new Error(message);
  }

  if (typeof data.id !== "string") {
    throw new Error("Resend did not return an email ID.");
  }

  return data.id;
}
