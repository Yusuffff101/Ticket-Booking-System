import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'fallback-access-secret-key-32-chars-long',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret-key-32-chars-long',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '1h',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  seatHoldTtlMinutes: parseInt(process.env.SEAT_HOLD_TTL_MINUTES || '10', 10),
  waitlistOfferTtlMinutes: parseInt(process.env.WAITLIST_OFFER_TTL_MINUTES || '15', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  // SMTP (production email)
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
};
