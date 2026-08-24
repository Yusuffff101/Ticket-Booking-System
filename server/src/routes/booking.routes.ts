import { Router } from 'express';
import { BookingController } from '../controllers/booking.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/rbac.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createBookingSchema } from '../validations/booking.validation.js';
import { Role } from '../constants/index.js';

const router = Router();

// Create booking (confirm held seats)
router.post(
  '/',
  authenticate,
  authorizeRoles(Role.CUSTOMER, Role.ADMIN),
  validate(createBookingSchema),
  BookingController.createBooking
);

// Get own booking history
router.get(
  '/my',
  authenticate,
  BookingController.getMyBookings
);

// Get booking by reference
router.get(
  '/:ref',
  authenticate,
  BookingController.getBookingByRef
);

// Cancel a booking
router.post(
  '/:id/cancel',
  authenticate,
  authorizeRoles(Role.CUSTOMER, Role.ADMIN),
  BookingController.cancelBooking
);

export default router;
