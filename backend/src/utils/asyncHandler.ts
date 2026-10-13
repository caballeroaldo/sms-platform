import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../types/index.js';

/**
 * Wrapper for async route handlers that automatically handles errors
 * Eliminates repetitive try/catch blocks in every route handler
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      console.error('Route handler error:', error);
      // Pass to Express error handler or send generic error
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        } as ApiResponse);
      }
    }
  };