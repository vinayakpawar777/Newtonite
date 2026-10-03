import { Router } from 'express';
import { register, login, registerSchema, loginSchema } from '../services/auth.service';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';

export const authRouter = Router();

authRouter.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const result = await register(req.body);
    res.status(201).json(result);
  })
);

authRouter.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await login(req.body);
    res.json(result);
  })
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
      with: {
        teamMemberships: {
          with: {
            team: true,
          }
        }
      }
    });
    
    if (!user) {
       res.status(404).json({ error: 'User not found' });
       return;
    }
    
    // Omit password hash
    const { passwordHash, ...safeUser } = user;
    res.json(safeUser);
  })
);
