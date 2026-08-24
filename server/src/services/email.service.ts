import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

// Create a development mail transport — uses Ethereal.email (test SMTP)
// In production, swap for Resend/SendGrid/SES transporter
const createTransporter = () => {
  if (config.nodeEnv === 'production' && config.smtpHost) {
    return nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    });
  }

  // Development: log-only mock transporter
  return nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true,
  });
};

const transporter = createTransporter();

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
 * In development, the email is printed to the console (no real sending).
 */
export const sendBookingConfirmationEmail = async (payload: BookingEmailPayload): Promise<void> => {
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

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; background: #0b0d1a; color: #e5e7eb; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 0 auto; padding: 32px 24px; }
    .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); border-radius: 16px 16px 0 0; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; color: #fff; letter-spacing: -0.5px; }
    .header p { color: #c7d2fe; margin: 8px 0 0; }
    .body { background: #111827; border-radius: 0 0 16px 16px; padding: 32px; }
    .ref { background: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: center; }
    .ref-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; }
    .ref-code { font-size: 24px; font-weight: bold; color: #818cf8; letter-spacing: 4px; margin-top: 4px; }
    .details { margin: 24px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #1f2937; font-size: 14px; }
    .detail-label { color: #9ca3af; }
    .detail-value { color: #f3f4f6; font-weight: 500; }
    .qr-section { text-align: center; margin: 28px 0; }
    .qr-section img { width: 180px; height: 180px; border: 4px solid #374151; border-radius: 12px; }
    .qr-section p { color: #6b7280; font-size: 12px; margin-top: 8px; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎟 Booking Confirmed!</h1>
      <p>Your tickets are ready, ${toName}</p>
    </div>
    <div class="body">
      <div class="ref">
        <div class="ref-label">Booking Reference</div>
        <div class="ref-code">${bookingReference}</div>
      </div>
      <div class="details">
        <div class="detail-row">
          <span class="detail-label">Event</span>
          <span class="detail-value">${eventTitle}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Show Time</span>
          <span class="detail-value">${showTime}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Venue</span>
          <span class="detail-value">${venueName}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Seats</span>
          <span class="detail-value">${seatNumbers.join(', ')}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Amount Paid</span>
          <span class="detail-value" style="color:#4ade80;">₹${totalAmount.toFixed(2)}</span>
        </div>
      </div>
      <div class="qr-section">
        <img src="${qrCodeDataUrl}" alt="QR Code Ticket" />
        <p>Scan this QR code at the entrance for quick entry</p>
      </div>
    </div>
    <div class="footer">TicketVerse — Your Booking Reference is your ticket. Keep it safe.</div>
  </div>
</body>
</html>
  `.trim();

  const mailOptions = {
    from: `"TicketVerse" <noreply@ticketverse.app>`,
    to: `${toName} <${toEmail}>`,
    subject: `✅ Booking Confirmed: ${bookingReference} — ${eventTitle}`,
    html: htmlBody,
  };

  try {
    if (config.nodeEnv !== 'production') {
      // Dev mode: log details to console
      console.log(`\n📧 [EMAIL MOCK] Booking Confirmation`);
      console.log(`   To: ${toEmail}`);
      console.log(`   Subject: ${mailOptions.subject}`);
      console.log(`   Booking Ref: ${bookingReference}`);
      console.log(`   Seats: ${seatNumbers.join(', ')}`);
      console.log(`   QR Code: [${qrCodeDataUrl.length} char data URL — would be embedded in email]\n`);
      return;
    }
    await transporter.sendMail(mailOptions);
    console.log(`📧 Booking confirmation email sent to ${toEmail}`);
  } catch (err) {
    // Non-fatal: log and continue — booking is already confirmed
    console.error(`[Email] Failed to send confirmation to ${toEmail}:`, err);
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

export const sendWaitlistOfferEmail = async (payload: WaitlistOfferEmailPayload): Promise<void> => {
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
    body { font-family: Arial, sans-serif; background: #0b0d1a; color: #e5e7eb; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 0 auto; padding: 32px 24px; }
    .header { background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 16px 16px 0 0; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; color: #fff; }
    .body { background: #111827; border-radius: 0 0 16px 16px; padding: 32px; }
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
    from: `"TicketVerse" <noreply@ticketverse.app>`,
    to: `${toName} <${toEmail}>`,
    subject: `⚡ Seat Available: Claim your ticket for ${eventTitle}!`,
    html: htmlBody,
  };

  try {
    if (config.nodeEnv !== 'production') {
      console.log(`\n📧 [EMAIL MOCK] Waitlist Seat Offer`);
      console.log(`   To: ${toEmail}`);
      console.log(`   Event: ${eventTitle} (${seatNumber} - ${category})`);
      console.log(`   Claim URL: ${claimUrl}`);
      console.log(`   Offer Expires: ${offerExpiresAt.toISOString()}\n`);
      return;
    }
    await transporter.sendMail(mailOptions);
    console.log(`📧 Waitlist offer email sent to ${toEmail}`);
  } catch (err) {
    console.error(`[Email] Failed to send waitlist offer to ${toEmail}:`, err);
  }
};

