import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodType } from 'zod';
import { HTTP_STATUS } from '../constants/index.js';
import { sendError } from '../utils/response.js';

export const validate = (schema: ZodType<any>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        sendError(res, 'Validation failed', HTTP_STATUS.BAD_REQUEST, validationErrors);
        return;
      }
      sendError(res, 'Invalid request data', HTTP_STATUS.BAD_REQUEST);
    }
  };
};
