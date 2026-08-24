/**
 * Live QR Code Email Delivery Verification Script
 * Usage:
 *   npx tsx src/tests/test-email.ts [recipient-email]
 *
 * Example:
 *   npx tsx src/tests/test-email.ts myinbox@gmail.com
 */
import { generateQRCode, generateBookingReference } from '../utils/qr.js';
import { sendBookingConfirmationEmail } from '../services/email.service.js';

async function runEmailTest() {
  const recipientEmail = process.argv[2] || 'customer@example.com';
  const recipientName = recipientEmail.split('@')[0];

  console.log('===============================================================');
  console.log('📧 TicketVerse — Live QR Email Delivery Verification');
  console.log('===============================================================');
  console.log(`Target Recipient: ${recipientEmail}`);

  // 1. Generate unique booking reference & QR payload
  const bookingReference = generateBookingReference();
  const eventTitle = 'Oppenheimer — 70mm IMAX Special';
  const venueName = 'IMAX Grand Theater, Forum Mall, Bengaluru';
  const showTime = new Date(Date.now() + 4 * 3600 * 1000).toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
  const seatNumbers = ['A-5 (PREMIUM)', 'A-6 (PREMIUM)'];
  const totalAmount = 1200.0;

  const qrPayload = {
    bookingRef: bookingReference,
    event: eventTitle,
    venue: venueName,
    showTime,
    seats: ['A-5', 'A-6'],
    customer: recipientName,
  };

  console.log('\n1. Generating cryptographic QR code ticket...');
  const qrCodeDataUrl = await generateQRCode(qrPayload);
  console.log(`   ✅ QR Code Data URL generated (${qrCodeDataUrl.length} bytes)`);

  // 2. Dispatch the formatted HTML email with CID attachment
  console.log('\n2. Rendering HTML template and dispatching email...');
  const result = await sendBookingConfirmationEmail({
    toEmail: recipientEmail,
    toName: recipientName.charAt(0).toUpperCase() + recipientName.slice(1),
    bookingReference,
    eventTitle,
    showTime,
    venueName,
    seatNumbers,
    totalAmount,
    qrCodeDataUrl,
  });

  console.log('\n===============================================================');
  if (result.success) {
    console.log('🎉 EMAIL DISPATCH COMPLETED SUCCESSFULLY!');
    if (result.previewUrl) {
      console.log('\n🔗 VIEW FULLY RENDERED HTML EMAIL IN BROWSER:');
      console.log(`   👉 ${result.previewUrl}`);
    } else {
      console.log(`\n📬 Delivered directly to: ${recipientEmail}`);
      console.log('   (Check your inbox / spam folder)');
    }
  } else {
    console.log('❌ Failed to send email. Check SMTP settings in server/.env');
  }
  console.log('===============================================================\n');
}

runEmailTest().catch((err) => {
  console.error('Fatal error in email test:', err);
  process.exit(1);
});
