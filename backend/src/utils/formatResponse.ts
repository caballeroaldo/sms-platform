import { Request, Response } from 'express';
import { ApiResponse } from '../types/index.js';

/**
 * Helper for consistent response formatting
 * Eliminates repetitive res.json() calls
 */
export const formatResponse = {
  success: <T>(res: Response, data: T, statusCode = 200): Response => {
    return res.status(statusCode).json({
      success: true,
      data
    } as ApiResponse);
  },

  error: (res: Response, message: string, statusCode = 500): Response => {
    return res.status(statusCode).json({
      success: false,
      error: message
    } as ApiResponse);
  },

  validationError: (res: Response, errors: any): Response => {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      data: errors
    } as ApiResponse);
  },

  notFound: (res: Response, message = 'Resource not found'): Response => {
    return formatResponse.error(res, message, 404);
  },

  conflict: (res: Response, message = 'Resource conflict', data?: any): Response => {
    return res.status(409).json({
      success: false,
      error: message,
      data
    } as ApiResponse);
  }
};