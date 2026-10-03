import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { db } from '../db';
import { idempotencyKeys } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';

/**
 * Idempotency middleware.
 * 
 * When a client sends an `Idempotency-Key` header, this middleware:
 * 1. Checks if a response was already stored for that key
 * 2. If yes → returns the cached response (preventing duplicate operations)
 * 3. If no → intercepts res.json() to store the response for future duplicates
 * 
 * Keys expire after 24 hours.
 * This prevents double-creates when users click "Submit" twice or network retries.
 */
export function idempotent() {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const key = req.headers['idempotency-key'] as string | undefined;

    if (!key) {
      // No idempotency key — proceed normally
      return next();
    }

    if (!req.userId) {
      return next();
    }

    try {
      // Check for existing response
      const existing = await db.query.idempotencyKeys.findFirst({
        where: and(
          eq(idempotencyKeys.key, key),
          eq(idempotencyKeys.userId, req.userId),
          gt(idempotencyKeys.expiresAt, new Date())
        ),
      });

      if (existing) {
        // Return cached response — operation already completed
        res.status(existing.statusCode).json(existing.response);
        return;
      }

      // Intercept res.json to capture and store the response
      const originalJson = res.json.bind(res);
      res.json = function (body: any): Response {
        // Only cache successful responses (2xx)
        if (res.statusCode >= 200 && res.statusCode < 300) {
          db.insert(idempotencyKeys)
            .values({
              key,
              userId: req.userId!,
              method: req.method,
              path: req.originalUrl,
              statusCode: res.statusCode,
              response: body,
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            })
            .onConflictDoNothing()
            .execute()
            .catch((err) => {
              console.error('Failed to store idempotency key:', err);
            });
        }

        return originalJson(body);
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}
