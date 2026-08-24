import { Router } from 'express';
import authRoutes from './auth.routes.js';
import venueRoutes from './venue.routes.js';
import eventRoutes from './event.routes.js';
import showRoutes from './show.routes.js';
import holdRoutes from './hold.routes.js';
import bookingRoutes from './booking.routes.js';
import waitlistRoutes from './waitlist.routes.js';
import analyticsRoutes from './analytics.routes.js';

const router = Router();

// Health Check
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Auth
router.use('/auth', authRoutes);
// Venue Management (Admin)
router.use('/venues', venueRoutes);
// Event Management (Organiser)
router.use('/events', eventRoutes);
// Show + Seat Map + Hold/Release + Waitlist Join (Organiser + Public + Customer)
router.use('/shows', showRoutes);
router.use('/shows', holdRoutes);
// Bookings (Customer)
router.use('/bookings', bookingRoutes);
// Waitlist & Claim Offers (Customer + Public)
router.use('/waitlist', waitlistRoutes);
// Organiser & Admin Analytics Dashboard
router.use('/organiser', analyticsRoutes);

export default router;

