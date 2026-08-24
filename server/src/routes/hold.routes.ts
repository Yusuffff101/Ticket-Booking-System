import { Router } from 'express';
import { BookingController } from '../controllers/booking.controller.js';
import { WaitlistController } from '../controllers/waitlist.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/rbac.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { holdSeatsSchema, releaseSeatsSchema } from '../validations/booking.validation.js';
import { joinWaitlistSchema } from '../validations/waitlist.validation.js';
import { Role } from '../constants/index.js';

const router = Router();

// Seat hold/release actions keyed to a show
// POST /api/shows/:id/seats/hold
router.post(
  '/:id/seats/hold',
  authenticate,
  authorizeRoles(Role.CUSTOMER, Role.ADMIN),
  validate(holdSeatsSchema),
  BookingController.holdSeats
);

// POST /api/shows/:id/seats/release
router.post(
  '/:id/seats/release',
  authenticate,
  authorizeRoles(Role.CUSTOMER, Role.ADMIN),
  validate(releaseSeatsSchema),
  BookingController.releaseSeats
);

// POST /api/shows/:id/waitlist/join
router.post(
  '/:id/waitlist/join',
  authenticate,
  authorizeRoles(Role.CUSTOMER, Role.ADMIN),
  validate(joinWaitlistSchema),
  WaitlistController.join
);

export default router;

