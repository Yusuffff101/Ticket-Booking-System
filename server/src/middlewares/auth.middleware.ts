import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { verifyAccessToken } from '../utils/token.js';
import { sendError } from '../utils/response.js';
import { HTTP_STATUS } from '../constants/index.js';
import prisma from '../config/prisma.js';

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'Authorization token missing or malformed', HTTP_STATUS.UNAUTHORIZED);
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      sendError(res, 'User no longer exists', HTTP_STATUS.UNAUTHORIZED);
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as any,
    };

    next();
  } catch (error) {
    sendError(res, 'Invalid or expired token', HTTP_STATUS.UNAUTHORIZED);
  }
};
