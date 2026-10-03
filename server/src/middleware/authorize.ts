import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { db } from '../db';
import { teamMemberships, workItems } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { Permission, hasPermission } from '../utils/permissions';
import { AppError, ForbiddenError } from '../utils/errors';
import type { TeamRole } from '../db/schema';

export interface AuthorizedRequest extends AuthRequest {
  teamRole?: TeamRole;
  workItem?: any;
}

/**
 * Authorization middleware factory.
 * Checks if the authenticated user has the required permission in the relevant team.
 * 
 * The team ID is resolved from (in priority order):
 * 1. The loaded workItem on the request (set by loadWorkItem middleware)
 * 2. req.body.teamId
 * 3. req.params.teamId
 */
export function authorize(permission: Permission) {
  return async (req: AuthorizedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.userId) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      // Resolve team ID from available sources
      const teamId =
        req.workItem?.teamId ||
        req.body?.teamId ||
        req.params?.teamId;

      if (!teamId) {
        throw new AppError('Team context required for authorization', 400, 'TEAM_REQUIRED');
      }

      const membership = await db.query.teamMemberships.findFirst({
        where: and(
          eq(teamMemberships.userId, req.userId),
          eq(teamMemberships.teamId, teamId)
        ),
      });

      if (!membership) {
        throw new ForbiddenError('Not a member of this team');
      }

      if (!hasPermission(membership.role as TeamRole, permission)) {
        throw new ForbiddenError(`Insufficient permissions: requires '${permission}'`);
      }

      // Attach role to request for downstream handlers
      req.teamRole = membership.role as TeamRole;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware to pre-load a work item by :id param and attach it to the request.
 * Used before authorize() so that team context is available for permission checks.
 */
export function loadWorkItem() {
  return async (req: AuthorizedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) {
        throw new AppError('Work item ID required', 400, 'MISSING_ID');
      }

      const item = await db.query.workItems.findFirst({
        where: eq(workItems.id, id),
        with: {
          assignees: true
        }
      });

      if (!item) {
        throw new AppError('Work item not found', 404, 'NOT_FOUND');
      }

      req.workItem = item;
      next();
    } catch (err) {
      next(err);
    }
  };
}
