import { Router } from 'express';
import { 
    createWorkItemSchema, 
    updateWorkItemSchema, 
    createWorkItem, 
    updateWorkItem, 
    assignWorkItem, 
    transitionWorkItem,
    listWorkItems,
    getWorkItem,
    getWorkItemEvents,
    addComment,
} from '../services/workItem.service';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { authorize, loadWorkItem, AuthorizedRequest } from '../middleware/authorize';
import { idempotent } from '../middleware/idempotency';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/errors';
import { z } from 'zod';

export const workItemsRouter = Router();

// All routes require authentication
workItemsRouter.use(authenticate);

// List items (requires teamId in query)
workItemsRouter.get(
    '/',
    asyncHandler(async (req, res) => {
        const teamId = req.query.teamId as string;
        if (!teamId) throw new AppError('teamId query parameter is required', 400, 'MISSING_TEAM_ID');
        
        // Manual auth check for list
        req.body.teamId = teamId;
        await new Promise((resolve, reject) => {
            authorize('work_item:read')(req as AuthorizedRequest, res, (err) => {
                if (err) reject(err);
                else resolve(true);
            });
        });

        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;
        
        const items = await listWorkItems(teamId, limit, offset, {
            status: req.query.status as string,
            priority: req.query.priority as string,
            type: req.query.type as string,
            assigneeId: req.query.assigneeId as string,
            search: req.query.search as string,
        });
        res.json({ items, limit, offset });
    })
);

// Get single item
workItemsRouter.get(
    '/:id',
    asyncHandler(async (req, res) => {
        const item = await getWorkItem(req.params.id);
        
        // Check team membership
        req.body.teamId = item.teamId;
        await new Promise((resolve, reject) => {
            authorize('work_item:read')(req as AuthorizedRequest, res, (err) => {
                if (err) reject(err);
                else resolve(true);
            });
        });

        res.json(item);
    })
);

// Get events/history for a work item
workItemsRouter.get(
    '/:id/events',
    asyncHandler(async (req, res) => {
        const events = await getWorkItemEvents(req.params.id);
        res.json(events);
    })
);

// Create item
workItemsRouter.post(
    '/',
    idempotent(),
    validate(createWorkItemSchema),
    authorize('work_item:create'),
    asyncHandler(async (req: AuthorizedRequest, res) => {
        const item = await createWorkItem(req.body, req.userId!);
        res.status(201).json(item);
    })
);

// Add comment
const commentSchema = z.object({
    comment: z.string().min(1).max(5000),
});

workItemsRouter.post(
    '/:id/comments',
    idempotent(),
    validate(commentSchema),
    asyncHandler(async (req: AuthorizedRequest, res) => {
        const event = await addComment(req.params.id, req.userId!, req.body.comment);
        res.status(201).json(event);
    })
);

const ifMatchHeaderSchema = z.object({
    'if-match': z.string().regex(/^\d+$/, "If-Match must be a number (version)").transform(Number)
});

// Update item details
workItemsRouter.patch(
    '/:id',
    loadWorkItem(),
    authorize('work_item:update_own'), // Simplified. Should check if update_any or own.
    validate(ifMatchHeaderSchema, 'headers'),
    validate(updateWorkItemSchema),
    asyncHandler(async (req: AuthorizedRequest, res) => {
        const expectedVersion = req.headers['if-match'] as unknown as number;
        
        // Basic check for update_own vs update_any (needs to be adapted if req.workItem has assignees)
        const isCreator = req.workItem.createdBy === req.userId;
        const isAssignee = req.workItem.assignees?.some((a: any) => a.userId === req.userId);

        if (!isCreator && !isAssignee) {
             // they aren't the creator or assignee, they need update_any
             await new Promise((resolve, reject) => {
                authorize('work_item:update_any')(req, res, (err) => {
                    if (err) reject(err);
                    else resolve(true);
                });
             });
        }

        const item = await updateWorkItem(req.params.id, req.body, expectedVersion, req.userId!, req.teamRole!);
        res.json(item);
    })
);

const assignSchema = z.object({
    assigneeIds: z.array(z.string())
});

// Assign item
workItemsRouter.post(
    '/:id/assign',
    idempotent(),
    loadWorkItem(),
    authorize('work_item:assign_self'), // Simplified
    validate(ifMatchHeaderSchema, 'headers'),
    validate(assignSchema),
    asyncHandler(async (req: AuthorizedRequest, res) => {
        const expectedVersion = req.headers['if-match'] as unknown as number;
        const { assigneeIds } = req.body;
        
        // If they are assigning someone else, they need assign_any
        const assigningOthers = assigneeIds.some((id: string) => id !== req.userId);
        
        if (assigningOthers) {
            await new Promise((resolve, reject) => {
                authorize('work_item:assign_any')(req, res, (err) => {
                    if (err) reject(err);
                    else resolve(true);
                });
             });
        }

        const item = await assignWorkItem(req.params.id, assigneeIds, req.userId!, expectedVersion);
        res.json(item);
    })
);

const transitionSchema = z.object({
    status: z.enum(['open', 'in_progress', 'under_review', 'blocked', 'resolved', 'closed'])
});

// Transition status
workItemsRouter.post(
    '/:id/transition',
    loadWorkItem(),
    authorize('work_item:transition'),
    validate(ifMatchHeaderSchema, 'headers'),
    validate(transitionSchema),
    asyncHandler(async (req: AuthorizedRequest, res) => {
        const expectedVersion = req.headers['if-match'] as unknown as number;

        const isCreator = req.workItem.createdBy === req.userId;
        const isAssignee = req.workItem.assignees?.some((a: any) => a.userId === req.userId);
        
        // If not assigned (and not creator), they need elevated permissions to transition
        if (!isCreator && !isAssignee) {
            await new Promise((resolve, reject) => {
                authorize('work_item:update_any')(req, res, (err) => {
                    if (err) reject(err);
                    else resolve(true);
                });
            });
        }

        const item = await transitionWorkItem(
            req.params.id, 
            req.body.status, 
            expectedVersion, 
            req.userId!, 
            req.teamRole!
        );
        res.json(item);
    })
);
