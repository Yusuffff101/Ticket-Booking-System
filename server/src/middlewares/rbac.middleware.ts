import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { Role, HTTP_STATUS } from '../constants/index.js';
import { sendError } from '../utils/response.js';

export const authorizeRoles = (...allowedRoles: (Role | string)[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Unauthenticated', HTTP_STATUS.UNAUTHORIZED);
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendError(
        res,
        `Access denied. Requires one of roles: [${allowedRoles.join(', ')}]. Current role: ${req.user.role}`,
        HTTP_STATUS.FORBIDDEN
      );
      return;
    }

    next();
  };
};
