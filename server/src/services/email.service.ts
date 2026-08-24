import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

export const getTransporter = async (): Promise<nodemailer.Transporter> => {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    // 1. If custom SMTP is provided in .env (e.g. Gmail, SendGrid, Mailgun, Amazon SES)
    if (config.smtpHost && config.smtpUser) {
      console.log(`📡 Using configured SMTP server: ${config.smtpHost}:${config.smtpPort}`);
      return nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPass,
        },
      });
    }

    // 2. Fallback: Create ephemeral Ethereal test inbox for instant live visual preview
    try {
      console.log('ℹ️ No external SMTP configured. Generating instant Ethereal live test inbox...');
      const testAccount = await nodemailer.createTestAccount();
      console.log(`📧 Ephemeral Test Inbox: ${testAccount.user}`);
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    } catch {
      // 3. Fallback: In-memory stream transporter (offline)
      return nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      });
    }
  })();

  return transporterPromise;
};

export interface BookingEmailPayload {
  toEmail: string;
  toName: string;
  bookingReference: string;
  eventTitle: string;
  showTime: string;
  venueName: string;
  seatNumbers: string[];
  totalAmount: number;
  qrCodeDataUrl: string;
}

/**
 * Sends a booking confirmation email with embedded QR code ticket.
 * Uses CID inline attachment for 100% email client compatibility (Gmail, Outlook, Apple Mail).
 */
export const sendBookingConfirmationEmail = async (
  payload: BookingEmailPayload
): Promise<{ success: boolean; previewUrl?: string | false; messageId?: string }> => {
  const {
    toEmail,
    toName,
    bookingReference,
    eventTitle,
    showTime,
    venueName,
    seatNumbers,
    totalAmount,
    qrCodeDataUrl,
  } = payload;

  const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
  const qrBuffer = Buffer.from(base64Data, 'base64');

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0d1a; color: #e5e7eb; margin: 0; padding: 20px; }
    .container { max-width: 580px; margin: 0 auto; background: #111827; border-radius: 16px; overflow: hidden; border: 1px solid #374151; }
    .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 32px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { color: #c7d2fe; margin: 8px 0 0; font-size: 14px; }
    .body { padding: 28px 24px; }
    .ref-box { background: #1f2937; border: 1px dashed #6366f1; border-radius: 12px; padding: 16px; margin: 0 0 24px; text-align: center; }
    .ref-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #9ca3af; font-weight: 600; }
    .ref-code { font-size: 24px; font-weight: 800; color: #818cf8; letter-spacing: 3px; margin-top: 4px; font-family: monospace; }
    .details-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .details-table td { padding: 10px 0; border-bottom: 1px solid #1f2937; font-size: 14px; }
    .detail-label { color: #9ca3af; }
    .detail-value { color: #f9fafb; font-weight: 600; text-align: right; }
    .qr-container { text-align: center; background: #ffffff; padding: 20px; border-radius: 12px; margin: 24px 0 16px; }
    .qr-container img { width: 200px; height: 200px; display: inline-block; }
    .qr-caption { text-align: center; color: #9ca3af; font-size: 12px; margin: 8px 0 0; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; padding: 16px 24px 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎟 Your Tickets are Confirmed!</h1>
      <p>Get ready for an unforgettable experience, ${toName}</p>
    </div>
    <div class="body">
      <div class="ref-box">
        <div class="ref-label">Booking Reference</div>
        <div class="ref-code">${bookingReference}</div>
      </div>

      <table class="details-table">
        <tr>
          <td class="detail-label">Event</td>
          <td class="detail-value">${eventTitle}</td>
        </tr>
        <tr>
          <td class="detail-label">Show Time</td>
          <td class="detail-value">${showTime}</td>
        </tr>
        <tr>
          <td class="detail-label">Venue</td>
          <td class="detail-value">${venueName}</td>
        </tr>
        <tr>
          <td class="detail-label">Seats</td>
          <td class="detail-value" style="color: #a5b4fc;">${seatNumbers.join(', ')}</td>
        </tr>
        <tr>
          <td class="detail-label">Amount Paid</td>
          <td class="detail-value" style="color: #4ade80;">₹${totalAmount.toFixed(2)}</td>
        </tr>
      </table>

      <div class="qr-container">
        <img src="cid:ticketqr" alt="Digital QR Ticket" />
      </div>
      <div class="qr-caption">Scan this digital pass at the entrance gate for quick verification</div>
    </div>
    <div class="footer">
      TicketVerse Platform • Support: support@ticketverse.app
    </div>
  </div>
</body>
</html>
  `.trim();

  const mailOptions = {
    from: `"TicketVerse" <${config.smtpUser || 'noreply@ticketverse.app'}>`,
    to: `${toName} <${toEmail}>`,
    subject: `✅ Ticket Confirmed: ${bookingReference} — ${eventTitle}`,
    html: htmlBody,
    attachments: [
      {
        filename: `${bookingReference}-qr.png`,
        content: qrBuffer,
        cid: 'ticketqr',
      },
    ],
  };

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);

    console.log(`📧 [EMAIL SENT] To: ${toEmail} | Message ID: ${info.messageId}`);
    if (previewUrl) {
      console.log(`🔗 [LIVE PREVIEW URL]: ${previewUrl}`);
    }

    return { success: true, previewUrl, messageId: info.messageId };
  } catch (err: any) {
    console.error(`[Email Error] Failed to send to ${toEmail}:`, err.message);
    return { success: false };
  }
};

export interface WaitlistOfferEmailPayload {
  toEmail: string;
  toName: string;
  eventTitle: string;
  showTime: string;
  venueName: string;
  category: string;
  seatNumber: string;
  price: number;
  token: string;
  offerExpiresAt: Date;
}

export const sendWaitlistOfferEmail = async (
  payload: WaitlistOfferEmailPayload
): Promise<{ success: boolean; previewUrl?: string | false }> => {
  const {
    toEmail,
    toName,
    eventTitle,
    showTime,
    venueName,
    category,
    seatNumber,
    price,
    token,
    offerExpiresAt,
  } = payload;

  const claimUrl = `${config.clientUrl}/waitlist/offer/${token}`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; background: #0b0d1a; color: #e5e7eb; margin: 0; padding: 20px; }
    .container { max-width: 560px; margin: 0 auto; background: #111827; border-radius: 16px; overflow: hidden; border: 1px solid #374151; }
    .header { background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 16px 16px 0 0; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; color: #fff; }
    .body { padding: 32px; }
    .btn { display: inline-block; background: #6366f1; color: #fff; font-weight: bold; padding: 14px 28px; border-radius: 12px; text-decoration: none; margin: 20px 0; }
    .details { margin: 20px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1f2937; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 A Seat Just Opened Up for You!</h1>
      <p>Waitlist Auto-Allocation</p>
    </div>
    <div class="body">
      <p>Hello ${toName},</p>
      <p>A <strong>${category}</strong> seat (<strong>${seatNumber}</strong>) has become available for <strong>${eventTitle}</strong>!</p>
      <div class="details">
        <div class="detail-row"><span>Show Time</span><span>${showTime}</span></div>
        <div class="detail-row"><span>Venue</span><span>${venueName}</span></div>
        <div class="detail-row"><span>Price</span><span>₹${price.toFixed(2)}</span></div>
        <div class="detail-row"><span>Offer Valid Until</span><span style="color:#f59e0b;">${offerExpiresAt.toLocaleTimeString('en-IN')}</span></div>
      </div>
      <div style="text-align: center;">
        <a href="${claimUrl}" class="btn">Claim &amp; Book Seat Now</a>
      </div>
      <p style="font-size: 12px; color: #9ca3af;">Note: This offer is time-limited (15 minutes). If not claimed, the seat will automatically cascade to the next person in line.</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const mailOptions = {
    from: `"TicketVerse" <${config.smtpUser || 'noreply@ticketverse.app'}>`,
    to: `${toName} <${toEmail}>`,
    subject: `⚡ Seat Available: Claim your ticket for ${eventTitle}!`,
    html: htmlBody,
  };

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);

    console.log(`📧 [WAITLIST OFFER SENT] To: ${toEmail}`);
    if (previewUrl) {
      console.log(`🔗 [OFFER EMAIL PREVIEW URL]: ${previewUrl}`);
    }

    return { success: true, previewUrl };
  } catch (err: any) {
    console.error(`[Email Error] Failed to send waitlist offer to ${toEmail}:`, err.message);
    return { success: false };
  }
};
