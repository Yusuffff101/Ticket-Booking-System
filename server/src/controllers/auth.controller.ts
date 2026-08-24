import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/index.js';
import { AuthenticatedRequest } from '../types/index.js';

export class AuthController {
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.register(req.body);
      sendSuccess(res, result, 'User registered successfully', HTTP_STATUS.CREATED);
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const result = await AuthService.login(req.body);
      sendSuccess(res, result, 'Login successful', HTTP_STATUS.OK);
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.UNAUTHORIZED);
    }
  }

  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const result = await AuthService.refreshTokens(refreshToken);
      sendSuccess(res, result, 'Tokens refreshed successfully', HTTP_STATUS.OK);
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.UNAUTHORIZED);
    }
  }

  static async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthenticated', HTTP_STATUS.UNAUTHORIZED);
        return;
      }
      const profile = await AuthService.getProfile(req.user.id);
      sendSuccess(res, profile, 'User profile fetched successfully');
    } catch (error: any) {
      sendError(res, error.message, HTTP_STATUS.NOT_FOUND);
    }
  }

  static async testAdminOnly(req: AuthenticatedRequest, res: Response): Promise<void> {
    sendSuccess(res, { user: req.user }, 'Access granted to Admin-only route');
  }

  static async testOrganiserOnly(req: AuthenticatedRequest, res: Response): Promise<void> {
    sendSuccess(res, { user: req.user }, 'Access granted to Organiser/Admin route');
  }
}
