import { Request, Response } from 'express';
import { EventService } from '../services/event.service.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { HTTP_STATUS, Role } from '../constants/index.js';
import { listEventsSchema } from '../validations/event.validation.js';

export class EventController {
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) { sendError(res, 'Unauthenticated', HTTP_STATUS.UNAUTHORIZED); return; }
      const event = await EventService.createEvent(req.user.id, req.body);
      sendSuccess(res, event, 'Event created successfully', HTTP_STATUS.CREATED);
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async list(req: Request, res: Response): Promise<void> {
    try {
      const parsed = listEventsSchema.safeParse(req.query);
      if (!parsed.success) {
        sendError(res, 'Invalid query parameters', HTTP_STATUS.BAD_REQUEST, parsed.error.errors);
        return;
      }
      const result = await EventService.listEvents(parsed.data);
      sendSuccess(res, result, 'Events retrieved successfully');
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const event = await EventService.getEventById(req.params.id);
      sendSuccess(res, event, 'Event retrieved successfully');
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.NOT_FOUND);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) { sendError(res, 'Unauthenticated', HTTP_STATUS.UNAUTHORIZED); return; }
      const event = await EventService.updateEvent(req.params.id, req.user.id, req.body);
      sendSuccess(res, event, 'Event updated successfully');
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async remove(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) { sendError(res, 'Unauthenticated', HTTP_STATUS.UNAUTHORIZED); return; }
      const isAdmin = req.user.role === Role.ADMIN;
      const result = await EventService.deleteEvent(req.params.id, req.user.id, isAdmin);
      sendSuccess(res, result, 'Event deleted successfully');
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }
}
