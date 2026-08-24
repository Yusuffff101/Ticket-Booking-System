import { Request, Response } from 'express';
import { ShowService } from '../services/show.service.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { HTTP_STATUS, Role } from '../constants/index.js';

export class ShowController {
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) { sendError(res, 'Unauthenticated', HTTP_STATUS.UNAUTHORIZED); return; }
      const result = await ShowService.createShow(req.user.id, req.body);
      sendSuccess(res, result, 'Show created successfully with seat map', HTTP_STATUS.CREATED);
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async getByEvent(req: Request, res: Response): Promise<void> {
    try {
      const shows = await ShowService.getShowsByEvent(req.params.eventId);
      sendSuccess(res, shows, 'Shows retrieved successfully');
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.NOT_FOUND);
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const show = await ShowService.getShowById(req.params.id);
      sendSuccess(res, show, 'Show retrieved successfully');
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.NOT_FOUND);
    }
  }

  static async getSeatMap(req: Request, res: Response): Promise<void> {
    try {
      const seatMap = await ShowService.getSeatMap(req.params.id);
      sendSuccess(res, seatMap, 'Seat map retrieved successfully');
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.NOT_FOUND);
    }
  }

  static async remove(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) { sendError(res, 'Unauthenticated', HTTP_STATUS.UNAUTHORIZED); return; }
      const isAdmin = req.user.role === Role.ADMIN;
      const result = await ShowService.deleteShow(req.params.id, req.user.id, isAdmin);
      sendSuccess(res, result, 'Show deleted successfully');
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }
}
