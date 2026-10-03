import { Router } from 'express';
import { db } from '../db';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { eq } from 'drizzle-orm';
import { teams, teamMemberships } from '../db/schema';

export const teamsRouter = Router();

teamsRouter.use(authenticate);

// Basic list of all teams the user belongs to
teamsRouter.get(
    '/',
    asyncHandler(async (req, res) => {
        const memberships = await db.query.teamMemberships.findMany({
            where: eq(teamMemberships.userId, req.userId!),
            with: {
                team: true
            }
        });
        
        res.json(memberships.map(m => m.team));
    })
);

teamsRouter.get(
    '/:id/members',
    asyncHandler(async (req, res) => {
        const memberships = await db.query.teamMemberships.findMany({
            where: eq(teamMemberships.teamId, req.params.id),
            with: {
                user: {
                    columns: { id: true, name: true, email: true }
                }
            }
        });
        
        res.json(memberships);
    })
);
