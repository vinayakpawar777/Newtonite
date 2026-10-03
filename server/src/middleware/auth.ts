import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from '../utils/errors';

export interface AuthRequest extends Request {
  userId?: string;
}

/**
 * JWT authentication middleware.
 * Extracts and verifies the Bearer token from the Authorization header.
 * Attaches userId to the request object for downstream handlers.
 */
export function authenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  let token = '';
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret) as {
      userId: string;
    };
    req.userId = payload.userId;
    next();
  } catch {
    throw new AppError('Invalid or expired token', 401, 'INVALID_TOKEN');
  }
}
