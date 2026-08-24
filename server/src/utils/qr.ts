import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import QRCode from 'qrcode';

export const generateBookingReference = (): string => {
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  return `BK-${ts}-${random}`;
};

/**
 * Generates a QR code as a base64 data URL encoding booking reference + metadata.
 */
export const generateQRCode = async (payload: object): Promise<string> => {
  const data = JSON.stringify(payload);
  return QRCode.toDataURL(data, {
    errorCorrectionLevel: 'H',
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
    width: 300,
  });
};

/**
 * Saves a QR code PNG to disk (optional, for email attachment).
 * Returns the file path.
 */
export const saveQRCodeFile = async (
  bookingRef: string,
  qrDataUrl: string
): Promise<string> => {
  const dir = path.join(process.cwd(), 'uploads', 'qrcodes');
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${bookingRef}.png`);

  // Strip data URL prefix and write buffer
  const base64 = qrDataUrl.replace(/^data:image\/png;base64,/, '');
  await fs.writeFile(filePath, Buffer.from(base64, 'base64'));
  return filePath;
};
