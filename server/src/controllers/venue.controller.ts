import { Request, Response } from 'express';
import { VenueService } from '../services/venue.service.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/index.js';

export class VenueController {
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const venue = await VenueService.createVenue(req.body);
      sendSuccess(res, venue, 'Venue created successfully', HTTP_STATUS.CREATED);
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await VenueService.getAllVenues(page, limit);
      sendSuccess(res, result, 'Venues retrieved successfully');
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const venue = await VenueService.getVenueById(req.params.id);
      sendSuccess(res, venue, 'Venue retrieved successfully');
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.NOT_FOUND);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const venue = await VenueService.updateVenue(req.params.id, req.body);
      sendSuccess(res, venue, 'Venue updated successfully');
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }
}
