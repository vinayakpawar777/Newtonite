import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { AppError } from '../utils/errors';
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

type RegisterDTO = z.infer<typeof registerSchema>;
type LoginDTO = z.infer<typeof loginSchema>;

export async function register(data: RegisterDTO) {
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, data.email),
  });

  if (existingUser) {
    throw new AppError('Email already in use', 400, 'EMAIL_IN_USE');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(data.password, salt);

  const id = uuidv4();
  const [user] = await db
    .insert(users)
    .values({
      id,
      email: data.email,
      name: data.name,
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: users.id, email: users.email, name: users.name });

  return { user, ...generateTokens(user.id) };
}

export async function login(data: LoginDTO) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, data.email),
  });

  if (!user) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  const isValid = await bcrypt.compare(data.password, user.passwordHash);
  if (!isValid) {
    throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
  }

  return {
    user: { id: user.id, email: user.email, name: user.name },
    ...generateTokens(user.id),
  };
}

function generateTokens(userId: string) {
  const accessToken = jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
  
  const refreshToken = jwt.sign({ userId }, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });

  return { accessToken, refreshToken };
}
