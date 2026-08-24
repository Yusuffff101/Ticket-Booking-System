import { Response } from 'express';
import { HoldService, BookingService } from '../services/booking.service.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/index.js';

export class BookingController {
  // POST /shows/:id/seats/hold
  static async holdSeats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) { sendError(res, 'Unauthenticated', HTTP_STATUS.UNAUTHORIZED); return; }
      const result = await HoldService.holdSeats(req.params.id, req.user.id, req.body);
      sendSuccess(res, result, 'Seats held successfully', HTTP_STATUS.CREATED);
    } catch (error: any) {
      const status = error.statusCode || HTTP_STATUS.BAD_REQUEST;
      sendError(res, error.message, status);
    }
  }

  // POST /shows/:id/seats/release
  static async releaseSeats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) { sendError(res, 'Unauthenticated', HTTP_STATUS.UNAUTHORIZED); return; }
      const { seatIds } = req.body as { seatIds: string[] };
      const result = await HoldService.releaseSeats(req.params.id, req.user.id, seatIds);
      sendSuccess(res, result, 'Seats released successfully');
    } catch (error: any) {
      const status = error.statusCode || HTTP_STATUS.BAD_REQUEST;
      sendError(res, error.message, status);
    }
  }

  // POST /bookings
  static async createBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) { sendError(res, 'Unauthenticated', HTTP_STATUS.UNAUTHORIZED); return; }
      const result = await BookingService.createBooking(req.user.id, req.body);
      sendSuccess(res, result, 'Booking confirmed!', HTTP_STATUS.CREATED);
    } catch (error: any) {
      const status = error.statusCode || HTTP_STATUS.BAD_REQUEST;
      sendError(res, error.message, status);
    }
  }

  // GET /bookings/my
  static async getMyBookings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) { sendError(res, 'Unauthenticated', HTTP_STATUS.UNAUTHORIZED); return; }
      const bookings = await BookingService.getMyBookings(req.user.id);
      sendSuccess(res, bookings, 'Bookings retrieved');
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  // GET /bookings/:ref
  static async getBookingByRef(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) { sendError(res, 'Unauthenticated', HTTP_STATUS.UNAUTHORIZED); return; }
      const booking = await BookingService.getBookingByRef(req.params.ref, req.user.id);
      sendSuccess(res, booking, 'Booking retrieved');
    } catch (error: any) {
      const status = error.statusCode || HTTP_STATUS.BAD_REQUEST;
      sendError(res, error.message, status);
    }
  }

  // POST /bookings/:id/cancel
  static async cancelBooking(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) { sendError(res, 'Unauthenticated', HTTP_STATUS.UNAUTHORIZED); return; }
      const result = await BookingService.cancelBooking(req.params.id, req.user.id);
      sendSuccess(res, result, 'Booking cancelled successfully');
    } catch (error: any) {
      const status = error.statusCode || HTTP_STATUS.BAD_REQUEST;
      sendError(res, error.message, status);
    }
  }
}
