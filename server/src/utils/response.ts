import { Response } from 'express';
import { HTTP_STATUS } from '../constants/index.js';
import { ApiResponse } from '../types/index.js';

export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode: number = HTTP_STATUS.OK
): Response => {
  const responsePayload: ApiResponse<T> = {
    success: true,
    ...(message && { message }),
    ...(data !== undefined && { data }),
  };
  return res.status(statusCode).json(responsePayload);
};

export const sendError = (
  res: Response,
  error: string,
  statusCode: number = HTTP_STATUS.BAD_REQUEST,
  errors?: any[]
): Response => {
  const responsePayload: ApiResponse = {
    success: false,
    error,
    ...(errors && { errors }),
  };
  return res.status(statusCode).json(responsePayload);
};
