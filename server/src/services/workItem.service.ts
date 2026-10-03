import { db } from '../db';
import { workItems, workItemEvents, users, workItemAssignees } from '../db/schema';
import { eq, and, desc, sql, like, or } from 'drizzle-orm';
import { AppError, ConflictError, ValidationError } from '../utils/errors';
import { isValidTransition, requiresManagerRole } from '../utils/stateMachine';
import { broadcastWorkItemUpdate } from './event.service';
import { isRoleAtLeast } from '../utils/permissions';
import type { TeamRole, WorkItemPriority, WorkItemStatus, WorkItemType } from '../db/schema';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export const createWorkItemSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  type: z.enum(['incident', 'task', 'investigation', 'approval', 'bug', 'compliance']),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  teamId: z.string(),
});

export const updateWorkItemSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  type: z.enum(['incident', 'task', 'investigation', 'approval', 'bug', 'compliance']).optional(),
});

type CreateWorkItemDTO = z.infer<typeof createWorkItemSchema>;
type UpdateWorkItemDTO = z.infer<typeof updateWorkItemSchema>;

export async function createWorkItem(data: CreateWorkItemDTO, userId: string) {
  return await db.transaction(async (tx) => {
    const id = uuidv4();
    const [item] = await tx
      .insert(workItems)
      .values({
        id,
        ...data,
        createdBy: userId,
        version: 1,
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await tx.insert(workItemEvents).values({
      id: uuidv4(),
      workItemId: item.id,
      actorId: userId,
      eventType: 'created',
      createdAt: new Date(),
      metadata: { initial_state: item },
    });

    broadcastWorkItemUpdate({
      type: 'created',
      workItemId: item.id,
      teamId: item.teamId,
      actorId: userId,
      data: item,
      timestamp: new Date().toISOString(),
    });

    return item;
  });
}

export async function getWorkItem(id: string) {
  const item = await db.query.workItems.findFirst({
    where: eq(workItems.id, id),
    with: {
      assignees: { with: { user: { columns: { id: true, name: true, email: true } } } },
      creator: { columns: { id: true, name: true, email: true } },
      team: true,
    },
  });
  if (!item) throw new AppError('Work item not found', 404, 'NOT_FOUND');
  return item;
}

export async function getWorkItemEvents(workItemId: string) {
  return await db.query.workItemEvents.findMany({
    where: eq(workItemEvents.workItemId, workItemId),
    orderBy: [desc(workItemEvents.createdAt)],
    with: {
      actor: { columns: { id: true, name: true, email: true } },
    },
  });
}

export async function addComment(workItemId: string, userId: string, comment: string) {
  const item = await db.query.workItems.findFirst({ where: eq(workItems.id, workItemId) });
  if (!item) throw new AppError('Work item not found', 404, 'NOT_FOUND');

  const event = {
    id: uuidv4(),
    workItemId,
    actorId: userId,
    eventType: 'commented' as const,
    comment,
    createdAt: new Date(),
  };

  await db.insert(workItemEvents).values(event);

  broadcastWorkItemUpdate({
    type: 'commented',
    workItemId,
    teamId: item.teamId,
    actorId: userId,
    data: { comment },
    timestamp: new Date().toISOString(),
  });

  return event;
}

export async function updateWorkItem(
  id: string,
  data: UpdateWorkItemDTO,
  expectedVersion: number,
  userId: string,
  userRole: TeamRole
) {
  return await db.transaction(async (tx) => {
    // 1. Optimistic Concurrency Check
    // If the version doesn't match, this UPDATE will affect 0 rows.
    const [updated] = await tx
      .update(workItems)
      .set({
        ...data,
        version: sql`${workItems.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(workItems.id, id), eq(workItems.version, expectedVersion)))
      .returning();

    if (!updated) {
      // It either doesn't exist or version mismatch. Let's find out which.
      const current = await tx.query.workItems.findFirst({ where: eq(workItems.id, id) });
      if (!current) throw new AppError('Work item not found', 404, 'NOT_FOUND');
      throw new ConflictError('Work item was updated by someone else', { current });
    }

    // Record events for changed fields
    if (data.title || data.description || data.priority || data.type) {
        await tx.insert(workItemEvents).values({
      id: uuidv4(),
      workItemId: id,
      actorId: userId,
      eventType: 'updated',
      createdAt: new Date(),
            metadata: { updates: data }
        });
    }

    broadcastWorkItemUpdate({
      type: 'updated',
      workItemId: id,
      teamId: updated.teamId,
      actorId: userId,
      data: updated,
      timestamp: new Date().toISOString(),
    });

    return updated;
  });
}

export async function assignWorkItem(id: string, assigneeIds: string[], userId: string, expectedVersion: number) {
  return await db.transaction(async (tx) => {
    // 1. Optimistic Concurrency Check
    const [updated] = await tx
      .update(workItems)
      .set({
        version: sql`${workItems.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(workItems.id, id), eq(workItems.version, expectedVersion)))
      .returning();

    if (!updated) {
      const current = await tx.query.workItems.findFirst({ where: eq(workItems.id, id) });
      if (!current) throw new AppError('Work item not found', 404, 'NOT_FOUND');
      throw new ConflictError('Work item was updated by someone else', { current });
    }

    // Update assignees
    await tx.delete(workItemAssignees).where(eq(workItemAssignees.workItemId, id));
    if (assigneeIds.length > 0) {
      await tx.insert(workItemAssignees).values(
        assigneeIds.map(aId => ({
          workItemId: id,
          userId: aId,
          assignedAt: new Date(),
        }))
      );
    }

    const eventType = assigneeIds.length > 0 ? 'assigned' : 'unassigned';

    await tx.insert(workItemEvents).values({
      id: uuidv4(),
      workItemId: id,
      actorId: userId,
      eventType,
      oldValue: '', // simplified
      newValue: assigneeIds.join(','),
      createdAt: new Date(),
    });

    broadcastWorkItemUpdate({
      type: eventType,
      workItemId: id,
      teamId: updated.teamId,
      actorId: userId,
      data: updated,
      timestamp: new Date().toISOString(),
    });

    return updated;
  });
}

export async function transitionWorkItem(
  id: string,
  newStatus: WorkItemStatus,
  expectedVersion: number,
  userId: string,
  userRole: TeamRole
) {
  return await db.transaction(async (tx) => {
    const current = await tx.query.workItems.findFirst({
      where: eq(workItems.id, id),
    });

    if (!current) throw new AppError('Work item not found', 404, 'NOT_FOUND');
    
    if (current.version !== expectedVersion) {
      throw new ConflictError('Work item was updated by someone else', { current });
    }

    if (current.status === newStatus) {
        return current; // No-op
    }

    // Enforce state machine rules
    if (!isValidTransition(current.status, newStatus)) {
      throw new ValidationError(`Cannot transition from ${current.status} to ${newStatus}`);
    }

    // Enforce role-based transition rules
    if (requiresManagerRole(current.status, newStatus) && !isRoleAtLeast(userRole, 'manager')) {
      throw new AppError('Manager role required for this transition', 403, 'FORBIDDEN');
    }

    const [updated] = await tx
      .update(workItems)
      .set({
        status: newStatus,
        version: sql`${workItems.version} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(workItems.id, id), eq(workItems.version, expectedVersion)))
      .returning();

    if (!updated) {
       throw new ConflictError('Work item was updated by someone else during transition', { current });
    }

    await tx.insert(workItemEvents).values({
      id: uuidv4(),
      workItemId: id,
      actorId: userId,
      eventType: 'status_changed',
      oldValue: current.status,
      newValue: newStatus,
      createdAt: new Date(),
    });

    broadcastWorkItemUpdate({
      type: 'status_changed',
      workItemId: id,
      teamId: updated.teamId,
      actorId: userId,
      data: updated,
      timestamp: new Date().toISOString(),
    });

    return updated;
  });
}

// Listing with filtering and search
export async function listWorkItems(teamId: string, limit = 50, offset = 0, filters?: {
  status?: string;
  priority?: string;
  type?: string;
  assigneeId?: string;
  search?: string;
}) {
  const conditions = [eq(workItems.teamId, teamId)];

  if (filters?.status) {
    const statuses = filters.status.split(',');
    if (statuses.length === 1) {
      conditions.push(eq(workItems.status, statuses[0]));
    } else {
      conditions.push(or(...statuses.map(s => eq(workItems.status, s)))!);
    }
  }

  if (filters?.priority) {
    const priorities = filters.priority.split(',');
    if (priorities.length === 1) {
      conditions.push(eq(workItems.priority, priorities[0]));
    } else {
      conditions.push(or(...priorities.map(p => eq(workItems.priority, p)))!);
    }
  }

  if (filters?.type) {
    conditions.push(eq(workItems.type, filters.type));
  }

  if (filters?.assigneeId) {
    if (filters.assigneeId === 'unassigned') {
      conditions.push(sql`${workItems.id} NOT IN (SELECT work_item_id FROM work_item_assignees)`);
    } else {
      conditions.push(sql`${workItems.id} IN (SELECT work_item_id FROM work_item_assignees WHERE user_id = ${filters.assigneeId})`);
    }
  }

  if (filters?.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        like(workItems.title, term),
        like(workItems.description, term)
      )!
    );
  }

  const items = await db.query.workItems.findMany({
    where: and(...conditions),
    orderBy: [desc(workItems.createdAt)],
    limit,
    offset,
    with: {
      assignees: { with: { user: { columns: { id: true, name: true } } } },
      creator: { columns: { id: true, name: true } },
    },
  });

  return items;
}
