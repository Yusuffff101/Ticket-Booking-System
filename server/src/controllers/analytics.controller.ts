import { Response } from 'express';
import { AnalyticsService } from '../services/analytics.service.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { HTTP_STATUS, Role } from '../constants/index.js';

export class AnalyticsController {
  // GET /api/organiser/events/:id/summary
  static async getEventSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthenticated', HTTP_STATUS.UNAUTHORIZED);
        return;
      }
      const isAdmin = req.user.role === Role.ADMIN;
      const summary = await AnalyticsService.getEventSummary(req.params.id, req.user.id, isAdmin);
      sendSuccess(res, summary, 'Event summary analytics retrieved');
    } catch (error: any) {
      const status = error.statusCode || HTTP_STATUS.BAD_REQUEST;
      sendError(res, error.message, status);
    }
  }

  // GET /api/organiser/dashboard
  static async getDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthenticated', HTTP_STATUS.UNAUTHORIZED);
        return;
      }
      const isAdmin = req.user.role === Role.ADMIN;
      const dashboard = await AnalyticsService.getOrganiserDashboard(req.user.id, isAdmin);
      sendSuccess(res, dashboard, 'Organiser dashboard metrics retrieved');
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }
}
