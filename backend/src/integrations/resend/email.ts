import { Resend } from "resend";
import { env } from "../../config/env.js";

const resend = new Resend(env.resendApiKey);

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  const { error } = await resend.emails.send({
    from: env.resendFromEmail,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
  if (error) {
    console.error("[resend] failed to send email:", error);
    throw new Error(`Email send failed: ${error.message}`);
  }
}

export function emailVerificationHtml(name: string, verifyUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2>Verify your email</h2>
      <p>Hi ${name},</p>
      <p>Click the link below to verify your DealApprover account:</p>
      <p><a href="${verifyUrl}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Verify Email</a></p>
      <p>This link expires in 24 hours.</p>
    </div>`;
}

export function passwordResetHtml(resetUrl: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2>Reset your password</h2>
      <p>Click the link below to reset your password:</p>
      <p><a href="${resetUrl}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Reset Password</a></p>
      <p>This link expires in 15 minutes. If you didn't request a reset, ignore this email.</p>
    </div>`;
}

export function certificateIssuedHtml(
  name: string,
  certUrl: string,
  itemTitle: string,
): string {
  return `
    <div style="font-family: 'Inter', sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color:#0F172A">Certificate issued</h2>
      <p>Hi ${name},</p>
      <p>Your DealApprover certificate for <strong>${itemTitle}</strong> has been issued.</p>
      <p><a href="${certUrl}" style="background:#22C55E;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">View Certificate</a></p>
      <p>Share this link with buyers so they can verify the item.</p>
    </div>`;
}

export function certificateRevokedHtml(name: string, itemTitle: string, reason: string): string {
  return `
    <div style="font-family: 'Inter', sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color:#0F172A">Certificate revoked</h2>
      <p>Hi ${name},</p>
      <p>Your certificate for <strong>${itemTitle}</strong> has been revoked.</p>
      <p style="color:#76777d"><strong>Reason:</strong> ${reason || "No reason given"}</p>
      <p>The trust page will now show a revoked banner. If anyone scans the QR, they'll see the item is no longer authenticated.</p>
    </div>`;
}

export function quotaWarningHtml(name: string, used: number, limit: number): string {
  const pct = Math.round((used / limit) * 100);
  return `
    <div style="font-family: 'Inter', sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color:#0F172A">Quota at ${pct}%</h2>
      <p>Hi ${name},</p>
      <p>You've used <strong>${used} of ${limit}</strong> free certificates this month.</p>
      <p>Upgrade to Pro for unlimited certificates and scan analytics:</p>
      <p><a href="https://dealapprover.com/app/billing" style="background:#22C55E;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:600;">Upgrade to Pro</a></p>
    </div>`;
}
