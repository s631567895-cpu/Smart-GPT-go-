// Server-only helper for sending admin -> user emails.
// Real delivery goes through the project's transactional email route, which
// only exists once a sender domain + email infrastructure are set up.
import { getRequest } from "@tanstack/react-start/server";

export type AdminEmailResult = { status: string; error?: string };

export async function sendAdminEmail(input: {
  to: string;
  subject: string;
  body: string;
}): Promise<AdminEmailResult> {
  try {
    const req = getRequest();
    const origin = new URL(req.url).origin;
    const res = await fetch(`${origin}/lovable/email/transactional/send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env['LOVABLE_API_KEY'] ?? ""}`,
      },
      body: JSON.stringify({
        templateName: "admin-message",
        recipientEmail: input.to,
        idempotencyKey: `admin-${input.to}-${Date.now()}`,
        templateData: { subject: input.subject, body: input.body },
      }),
    });

    if (res.ok) return { status: "sent" };
    if (res.status === 404) {
      return {
        status: "pending_email_setup",
        error: "Email sending is not set up yet — add a sender domain to deliver this message.",
      };
    }
    return { status: "failed", error: `${res.status}: ${(await res.text()).slice(0, 300)}` };
  } catch (e) {
    return {
      status: "pending_email_setup",
      error: e instanceof Error ? e.message : "Email delivery unavailable",
    };
  }
}
