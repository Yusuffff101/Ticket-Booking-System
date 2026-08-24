import { Request, Response } from 'express';
import { WaitlistService } from '../services/waitlist.service.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/index.js';
import { SeatCategory } from '../constants/index.js';

export class WaitlistController {
  // POST /api/shows/:id/waitlist/join
  static async join(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthenticated', HTTP_STATUS.UNAUTHORIZED);
        return;
      }
      const { category } = req.body as { category: SeatCategory };
      const result = await WaitlistService.joinWaitlist(req.params.id, req.user.id, category);
      sendSuccess(res, result, 'Joined waitlist successfully', HTTP_STATUS.CREATED);
    } catch (error: any) {
      const status = error.statusCode || HTTP_STATUS.BAD_REQUEST;
      sendError(res, error.message, status);
    }
  }

  // GET /api/waitlist/offer/:token
  static async getOffer(req: Request, res: Response): Promise<void> {
    try {
      const result = await WaitlistService.getOfferByToken(req.params.token);
      sendSuccess(res, result, 'Offer details retrieved');
    } catch (error: any) {
      const status = error.statusCode || HTTP_STATUS.NOT_FOUND;
      sendError(res, error.message, status);
    }
  }

  // POST /api/waitlist/offer/:token/accept
  static async acceptOffer(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthenticated', HTTP_STATUS.UNAUTHORIZED);
        return;
      }
      const result = await WaitlistService.acceptOffer(req.params.token, req.user.id);
      sendSuccess(res, result, 'Offer accepted and booking confirmed!', HTTP_STATUS.CREATED);
    } catch (error: any) {
      const status = error.statusCode || HTTP_STATUS.BAD_REQUEST;
      sendError(res, error.message, status);
    }
  }

  // GET /api/waitlist/my
  static async getMyWaitlists(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthenticated', HTTP_STATUS.UNAUTHORIZED);
        return;
      }
      const waitlists = await WaitlistService.getMyWaitlists(req.user.id);
      sendSuccess(res, waitlists, 'Waitlists retrieved');
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }
}
