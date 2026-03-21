/**
 * Email Notification Service
 *
 * Uses Nodemailer with SMTP (Gmail) to send email notifications.
 * SMTP credentials are hardcoded for simplicity.
 *
 * Falls back gracefully when sending fails — logs a warning
 * and returns false so callers can continue without email.
 */

import nodemailer from "nodemailer";

// ── Configuration (hardcoded Gmail SMTP) ─────────────────────────────────

const SMTP_CONFIG = {
  host: "smtp.gmail.com",
  port: 587,
  user: "platfarmaitools@gmail.com",
  pass: "wxxckcocyqtusgkh",
  from: "platfarmaitools@gmail.com",
  secure: false, // port 587 uses STARTTLS, not implicit TLS
};

export function isSmtpConfigured(): boolean {
  return !!(SMTP_CONFIG.host && SMTP_CONFIG.user && SMTP_CONFIG.pass);
}

// ── Transporter (lazy singleton) ──────────────────────────────────────────

let _transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (_transporter) return _transporter;

  if (!SMTP_CONFIG.host || !SMTP_CONFIG.user || !SMTP_CONFIG.pass) {
    return null;
  }

  _transporter = nodemailer.createTransport({
    host: SMTP_CONFIG.host,
    port: SMTP_CONFIG.port,
    secure: SMTP_CONFIG.secure,
    auth: { user: SMTP_CONFIG.user, pass: SMTP_CONFIG.pass },
    tls: { rejectUnauthorized: false },
  });

  return _transporter;
}

/** Reset transporter (useful for testing) */
export function resetTransporter(): void {
  _transporter = null;
}

// ── Send Email ────────────────────────────────────────────────────────────

export type EmailPayload = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
};

/**
 * Send an email via SMTP.
 * Returns true on success, false if SMTP is not configured or sending fails.
 */
export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[Email] SMTP not configured — skipping email send.");
    return false;
  }

  const recipients = Array.isArray(payload.to) ? payload.to.join(", ") : payload.to;

  try {
    const info = await transporter.sendMail({
      from: `"Platfarm Trade Ops" <${SMTP_CONFIG.from}>`,
      to: recipients,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    console.log(`[Email] Sent to ${recipients} — messageId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error("[Email] Failed to send:", err);
    return false;
  }
}

// ── Document Alert Email Builder ──────────────────────────────────────────

export type FlaggedShipment = {
  name: string;
  type: string;
  missingDocs: string[];
};

/**
 * Build and send the daily document alert email.
 * Returns true if email was sent successfully.
 */
export async function sendDocumentAlertEmail(
  recipients: string[],
  flaggedShipments: FlaggedShipment[],
  alertDate: string
): Promise<boolean> {
  if (recipients.length === 0) {
    console.warn("[Email] No recipients configured for document alerts.");
    return false;
  }

  if (flaggedShipments.length === 0) {
    return false;
  }

  const subject = `⚠️ ${flaggedShipments.length} In-Transit Shipment(s) Missing Critical Documents — ${alertDate}`;

  // Plain text version
  const textLines = flaggedShipments.map(
    (s) => `• ${s.name} (${s.type}): Missing ${s.missingDocs.join(", ")}`
  );
  const text = [
    `Daily Document Alert — ${alertDate}`,
    "",
    `${flaggedShipments.length} in-transit shipment(s) are missing critical shipping documents:`,
    "",
    ...textLines,
    "",
    "Please upload the missing documents as soon as possible.",
    "",
    "— Platfarm Trade Operations Portal",
  ].join("\n");

  // HTML version (Platfarm branded)
  const shipmentRows = flaggedShipments
    .map(
      (s) => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #E8E5E0;font-size:14px;color:#2C3E50;font-weight:600;">
          ${escapeHtml(s.name)}
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #E8E5E0;font-size:13px;color:#666;">
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;
            background:${s.type === "Purchase" ? "#EEF5EE" : "#FEF9F5"};
            color:${s.type === "Purchase" ? "#2D5A3D" : "#C0714A"};">
            ${s.type}
          </span>
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #E8E5E0;font-size:13px;color:#C0714A;">
          ${s.missingDocs.map((d) => escapeHtml(d)).join(", ")}
        </td>
      </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;padding:20px;">
    <!-- Accent bar -->
    <div style="height:3px;background:linear-gradient(90deg,#2D5A3D,#C0714A);border-radius:2px 2px 0 0;"></div>

    <!-- Header -->
    <div style="background:#FFFFFF;padding:24px 28px;border:1px solid #E8E5E0;border-top:none;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-size:18px;font-weight:700;color:#2D5A3D;">Platfarm Trade Operations</div>
            <div style="font-size:12px;color:#999;margin-top:2px;">Daily Document Alert</div>
          </td>
          <td align="right">
            <div style="font-size:13px;color:#666;">${escapeHtml(alertDate)}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Alert Banner -->
    <div style="background:#FEF9F5;border:1px solid #F0D5C4;border-top:none;padding:16px 28px;">
      <div style="font-size:15px;font-weight:600;color:#C0714A;">
        ⚠️ ${flaggedShipments.length} shipment${flaggedShipments.length > 1 ? "s" : ""} missing critical documents
      </div>
      <div style="font-size:13px;color:#666;margin-top:4px;">
        The following in-transit shipments are missing required shipping documents.
      </div>
    </div>

    <!-- Table -->
    <div style="background:#FFFFFF;border:1px solid #E8E5E0;border-top:none;padding:0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead>
          <tr style="background:#2D5A3D;">
            <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.5px;">
              Shipment
            </th>
            <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.5px;">
              Type
            </th>
            <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.5px;">
              Missing Documents
            </th>
          </tr>
        </thead>
        <tbody>
          ${shipmentRows}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:20px 28px;text-align:center;">
      <div style="font-size:12px;color:#999;">
        Please upload the missing documents as soon as possible.
      </div>
      <div style="font-size:11px;color:#AAA;margin-top:8px;">
        Platfarm for Agritech and Agribusiness Ltd — Abu Dhabi Global Market
      </div>
    </div>
  </div>
</body>
</html>`;

  return sendEmail({
    to: recipients,
    subject,
    text,
    html,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Invitation Email ──────────────────────────────────────────────────────────

/**
 * Send a user invitation email with a branded Platfarm template.
 * Returns true on success, false if SMTP is not configured or sending fails.
 */
export async function sendInvitationEmail(params: {
  to: string;
  invitedBy: string;
  role: string;
  inviteUrl: string;
  expiresAt: Date;
}): Promise<boolean> {
  const { to, invitedBy, role, inviteUrl, expiresAt } = params;

  const expiryStr = expiresAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const roleLabel = role === "admin" ? "Administrator" : "Team Member";

  const subject = `You're invited to join Platfarm`;

  const text = `
You have been invited to join Platfarm by ${invitedBy}.

Your role: ${roleLabel}

Click the link below to accept your invitation and set up your account:
${inviteUrl}

This invitation expires on ${expiryStr}.

If you did not expect this invitation, you can safely ignore this email.

— Platfarm for Agritech and Agribusiness Ltd
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to Platfarm</title>
</head>
<body style="margin:0;padding:0;background:#F5F3EE;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:580px;margin:40px auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#1B3A2D;padding:32px 40px;text-align:center;">
      <div style="display:inline-flex;align-items:center;gap:10px;">
        <div style="width:36px;height:36px;background:#D4845F;border-radius:8px;display:inline-block;"></div>
        <span style="font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.5px;">PLATFARM</span>
      </div>
      <div style="font-size:12px;color:#A8C4B0;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Agritech &amp; Agribusiness Platform</div>
    </div>

    <!-- Body -->
    <div style="padding:40px 40px 32px;">
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1B3A2D;">You've been invited!</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">
        <strong>${escapeHtml(invitedBy)}</strong> has invited you to join the Platfarm platform as a
        <strong style="color:#2D5A3D;">${escapeHtml(roleLabel)}</strong>.
      </p>

      <!-- Role Badge -->
      <div style="background:#F0F7F2;border:1px solid #C8DFD0;border-radius:8px;padding:14px 18px;margin-bottom:28px;display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;background:#2D5A3D;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span style="font-size:18px;color:#FFFFFF;">${role === "admin" ? "⚙" : "👤"}</span>
        </div>
        <div>
          <div style="font-size:13px;font-weight:700;color:#1B3A2D;">${escapeHtml(roleLabel)}</div>
          <div style="font-size:12px;color:#666;margin-top:2px;">
            ${role === "admin"
              ? "Full administrative access to all modules and user management."
              : "Access to modules configured by your administrator."}
          </div>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align:center;margin:32px 0;">
        <a href="${inviteUrl}"
           style="display:inline-block;background:#D4845F;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
          Accept Invitation &amp; Get Started →
        </a>
      </div>

      <!-- Expiry Notice -->
      <div style="background:#FEF9F5;border:1px solid #F0D5C4;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
        <p style="margin:0;font-size:12px;color:#C0714A;">
          ⏰ This invitation expires on <strong>${escapeHtml(expiryStr)}</strong>. Please accept it before then.
        </p>
      </div>

      <!-- Instructions -->
      <p style="margin:0 0 8px;font-size:13px;color:#888;line-height:1.6;">
        If the button above doesn't work, copy and paste this link into your browser:
      </p>
      <p style="margin:0 0 24px;font-size:12px;color:#2D5A3D;word-break:break-all;">
        <a href="${inviteUrl}" style="color:#2D5A3D;">${inviteUrl}</a>
      </p>

      <p style="margin:0;font-size:12px;color:#AAA;line-height:1.5;">
        If you did not expect this invitation, you can safely ignore this email.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#F5F3EE;padding:20px 40px;text-align:center;border-top:1px solid #E8E5E0;">
      <p style="margin:0;font-size:11px;color:#AAA;">
        Platfarm for Agritech and Agribusiness Ltd &mdash; Abu Dhabi Global Market
      </p>
    </div>
  </div>
</body>
</html>`;

  return sendEmail({ to, subject, text, html });
}

// ── Password Reset Email ────────────────────────────────────────────────
export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
  expiresAt: Date;
}): Promise<boolean> {
  const { to, name, resetUrl, expiresAt } = params;
  const expiryStr = expiresAt.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const subject = `Reset your Platfarm password`;
  const text = `Hi ${name},\n\nYou requested a password reset for your Platfarm account.\n\nClick the link below to set a new password:\n${resetUrl}\n\nThis link expires at ${expiryStr} (1 hour from now).\n\nIf you did not request this, you can safely ignore this email.\n\n\u2014 Platfarm for Agritech and Agribusiness Ltd`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Reset your Platfarm password</title></head>
<body style="margin:0;padding:0;background:#F5F3EE;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:580px;margin:40px auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:#1B3A2D;padding:32px 40px;text-align:center;">
      <div style="display:inline-flex;align-items:center;gap:10px;">
        <div style="width:36px;height:36px;background:#D4845F;border-radius:8px;display:inline-block;"></div>
        <span style="font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:-0.5px;">PLATFARM</span>
      </div>
      <div style="font-size:12px;color:#A8C4B0;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Agritech &amp; Agribusiness Platform</div>
    </div>
    <div style="padding:40px 40px 32px;">
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1B3A2D;">Reset your password</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#555;line-height:1.6;">Hi <strong>${escapeHtml(name)}</strong>, we received a request to reset the password for your Platfarm account.</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#D4845F;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;">Set New Password &rarr;</a>
      </div>
      <div style="background:#FEF9F5;border:1px solid #F0D5C4;border-radius:6px;padding:12px 16px;margin-bottom:24px;">
        <p style="margin:0;font-size:12px;color:#C0714A;">&#9200; This link expires at <strong>${escapeHtml(expiryStr)}</strong> (1 hour from now).</p>
      </div>
      <p style="margin:0 0 8px;font-size:13px;color:#888;">If the button above doesn't work, copy and paste this link into your browser:</p>
      <p style="margin:0 0 24px;font-size:12px;color:#2D5A3D;word-break:break-all;"><a href="${resetUrl}" style="color:#2D5A3D;">${resetUrl}</a></p>
      <p style="margin:0;font-size:12px;color:#AAA;">If you did not request a password reset, you can safely ignore this email.</p>
    </div>
    <div style="background:#F5F3EE;padding:20px 40px;text-align:center;border-top:1px solid #E8E5E0;">
      <p style="margin:0;font-size:11px;color:#AAA;">Platfarm for Agritech and Agribusiness Ltd &mdash; Abu Dhabi Global Market</p>
    </div>
  </div>
</body>
</html>`;
  return sendEmail({ to, subject, text, html });
}

// ── Company Document Expiry Alert Email ─────────────────────────────────

export type ExpiringDocumentEmail = {
  companyName: string;
  documentLabel: string;
  expiryDate: string; // YYYY-MM-DD
  daysToExpire: number; // negative = already expired
};

/**
 * Build and send the daily company document expiry alert email.
 * Lists all documents expiring within 30 days (or already expired)
 * in a professional table with company name, document name, expiry date, and days remaining.
 * Returns true if email was sent successfully.
 */
export async function sendCompanyDocExpiryEmail(
  recipients: string[],
  documents: ExpiringDocumentEmail[],
  alertDate: string
): Promise<boolean> {
  if (recipients.length === 0) {
    console.warn("[Email] No recipients configured for company doc expiry alerts.");
    return false;
  }

  if (documents.length === 0) {
    return false;
  }

  const expiredCount = documents.filter((d) => d.daysToExpire <= 0).length;
  const expiringCount = documents.filter((d) => d.daysToExpire > 0).length;

  const subject = `📋 Company Document Expiry Alert — ${expiredCount > 0 ? `${expiredCount} Expired, ` : ""}${expiringCount} Expiring Soon — ${alertDate}`;

  // Plain text version
  const textLines = documents.map((d) => {
    const status =
      d.daysToExpire <= 0
        ? `EXPIRED (${Math.abs(d.daysToExpire)} days ago)`
        : `${d.daysToExpire} day(s) remaining`;
    return `• ${d.companyName} | ${d.documentLabel} | Expires: ${d.expiryDate} | ${status}`;
  });

  const text = [
    `Daily Company Document Expiry Report — ${alertDate}`,
    "",
    `${documents.length} document(s) require attention:`,
    `  - ${expiredCount} already expired`,
    `  - ${expiringCount} expiring within 30 days`,
    "",
    ...textLines,
    "",
    "Please renew the expired/expiring documents as soon as possible.",
    "",
    "— Platfarm Trade Operations Portal",
  ].join("\n");

  // HTML version (Platfarm branded)
  const documentRows = documents
    .map((d) => {
      let statusBg: string;
      let statusColor: string;
      let statusText: string;

      if (d.daysToExpire <= 0) {
        // Already expired
        statusBg = "#FDE8E8";
        statusColor = "#C53030";
        statusText = d.daysToExpire === 0 ? "Expires Today" : `Expired ${Math.abs(d.daysToExpire)}d ago`;
      } else if (d.daysToExpire <= 7) {
        // Critical: 7 days or less
        statusBg = "#FEF3CD";
        statusColor = "#C05621";
        statusText = `${d.daysToExpire} day(s)`;
      } else if (d.daysToExpire <= 14) {
        // Warning: 14 days or less
        statusBg = "#FEF9F5";
        statusColor = "#C0714A";
        statusText = `${d.daysToExpire} days`;
      } else {
        // Notice: 15-30 days
        statusBg = "#EEF5EE";
        statusColor = "#2D5A3D";
        statusText = `${d.daysToExpire} days`;
      }

      return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #E8E5E0;font-size:13px;color:#2C3E50;font-weight:600;">
          ${escapeHtml(d.companyName)}
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #E8E5E0;font-size:13px;color:#444;">
          ${escapeHtml(d.documentLabel)}
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #E8E5E0;font-size:13px;color:#666;">
          ${escapeHtml(d.expiryDate)}
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #E8E5E0;text-align:center;">
          <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;
            background:${statusBg};color:${statusColor};">
            ${statusText}
          </span>
        </td>
      </tr>`;
    })
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#FAF8F5;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <div style="max-width:700px;margin:0 auto;padding:20px;">
    <!-- Accent bar -->
    <div style="height:3px;background:linear-gradient(90deg,#2D5A3D,#C0714A);border-radius:2px 2px 0 0;"></div>

    <!-- Header -->
    <div style="background:#FFFFFF;padding:24px 28px;border:1px solid #E8E5E0;border-top:none;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <div style="font-size:18px;font-weight:700;color:#2D5A3D;">Platfarm Trade Operations</div>
            <div style="font-size:12px;color:#999;margin-top:2px;">Daily Company Document Expiry Report</div>
          </td>
          <td align="right">
            <div style="font-size:13px;color:#666;">${escapeHtml(alertDate)}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Alert Banner -->
    <div style="background:#FEF9F5;border:1px solid #F0D5C4;border-top:none;padding:16px 28px;">
      <div style="font-size:15px;font-weight:600;color:#C0714A;">
        📋 ${documents.length} document${documents.length > 1 ? "s" : ""} require${documents.length === 1 ? "s" : ""} attention
      </div>
      <div style="font-size:13px;color:#666;margin-top:4px;">
        ${expiredCount > 0 ? `<span style="color:#C53030;font-weight:600;">${expiredCount} expired</span> · ` : ""}${expiringCount} expiring within 30 days.
        Please renew these documents as soon as possible.
      </div>
    </div>

    <!-- Table -->
    <div style="background:#FFFFFF;border:1px solid #E8E5E0;border-top:none;padding:0;overflow-x:auto;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;min-width:500px;">
        <thead>
          <tr style="background:#2D5A3D;">
            <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.5px;">
              Company
            </th>
            <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.5px;">
              Document
            </th>
            <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:600;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.5px;">
              Expiry Date
            </th>
            <th style="padding:10px 14px;text-align:center;font-size:12px;font-weight:600;color:#FFFFFF;text-transform:uppercase;letter-spacing:0.5px;">
              Days Left
            </th>
          </tr>
        </thead>
        <tbody>
          ${documentRows}
        </tbody>
      </table>
    </div>

    <!-- Summary -->
    <div style="background:#FFFFFF;border:1px solid #E8E5E0;border-top:none;padding:16px 28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          ${expiredCount > 0 ? `
          <td style="text-align:center;padding:8px;">
            <div style="font-size:24px;font-weight:700;color:#C53030;">${expiredCount}</div>
            <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Expired</div>
          </td>` : ""}
          <td style="text-align:center;padding:8px;">
            <div style="font-size:24px;font-weight:700;color:#C0714A;">${expiringCount}</div>
            <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Expiring Soon</div>
          </td>
          <td style="text-align:center;padding:8px;">
            <div style="font-size:24px;font-weight:700;color:#2D5A3D;">${documents.length}</div>
            <div style="font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Total Alerts</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div style="padding:20px 28px;text-align:center;">
      <div style="font-size:12px;color:#999;">
        This is an automated daily report. Please renew documents before they expire.
      </div>
      <div style="font-size:11px;color:#AAA;margin-top:8px;">
        Platfarm for Agritech and Agribusiness Ltd — Abu Dhabi Global Market
      </div>
    </div>
  </div>
</body>
</html>`;

  return sendEmail({
    to: recipients,
    subject,
    text,
    html,
  });
}
