import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Zod validation middleware factory.
 * Validates the specified request property (body, query, params) against a Zod schema.
 * Replaces the raw value with the parsed/coerced value on success.
 */
export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[source]);
      (req as any)[source] = parsed;
      next();
    } catch (err) {
      next(err);
    }
  };
}
