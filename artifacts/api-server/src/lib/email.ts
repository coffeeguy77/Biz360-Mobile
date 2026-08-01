import { logger } from "./logger";

/**
 * Minimal email sender built on Resend's HTTP API.
 * Configure with env:
 *   RESEND_API_KEY  — from https://resend.com
 *   EMAIL_FROM      — a verified sender, e.g. "EXIT360 <noreply@exit360.com.au>"
 *   PUBLIC_WEB_URL  — base URL for links (defaults to https://exit360.com.au)
 * No-ops safely (returns false) when the key isn't set, so message flows never break.
 */
export const PUBLIC_WEB_URL = process.env.PUBLIC_WEB_URL || "https://exit360.com.au";

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

/** Build the JSON payload Resend expects — pure, so it can be unit-tested. */
export function buildResendPayload(from: string, input: SendEmailInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    from,
    to: [input.to],
    subject: input.subject,
    html: input.html,
  };
  if (input.replyTo) payload.reply_to = input.replyTo;
  return payload;
}

/** Basic RFC-ish email validation — good enough to avoid obviously bad sends. */
export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    logger.info({ to: input.to, subject: input.subject }, "Email not configured — skipping send");
    return false;
  }
  if (!isValidEmail(input.to)) {
    logger.warn({ to: input.to }, "Refusing to send to invalid email");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildResendPayload(from, input)),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      logger.warn({ status: res.status, detail }, "Resend send failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err }, "Resend send threw");
    return false;
  }
}

/** Shared dark-themed wrapper so all EXIT360 emails look consistent. */
export function emailShell(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  const button = cta
    ? `<tr><td style="padding:8px 0 4px 0;">
         <a href="${cta.url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px;">${cta.label}</a>
       </td></tr>`
    : "";
  return `<!DOCTYPE html><html><body style="margin:0;background:#0a1120;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#0f1c33;border:1px solid #1e3a5c;border-radius:16px;overflow:hidden;">
    <tr><td style="padding:20px 28px;border-bottom:1px solid #1e3a5c;">
      <span style="color:#3b82f6;font-weight:800;letter-spacing:1px;font-size:14px;">EXIT360</span>
    </td></tr>
    <tr><td style="padding:28px;">
      <h1 style="color:#ffffff;font-size:20px;margin:0 0 12px 0;">${title}</h1>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="color:#c7d2e0;font-size:15px;line-height:1.6;">${bodyHtml}</td></tr>
        ${button}
      </table>
    </td></tr>
    <tr><td style="padding:18px 28px;border-top:1px solid #1e3a5c;color:#5b7089;font-size:12px;">
      EXIT360 · exit360.com.au — Buy &amp; sell businesses with 360° tours
    </td></tr>
  </table></body></html>`;
}
