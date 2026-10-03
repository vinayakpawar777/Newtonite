import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// ─── Tables ──────────────────────────────────────────────────────────────────

export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // We'll use uuid() in TS
  email: text('email').unique().notNull(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').unique().notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const teamMemberships = sqliteTable(
  'team_memberships',
  {
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    teamId: text('team_id')
      .references(() => teams.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').notNull().default('member'), // admin, manager, member, viewer
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.teamId] }),
  })
);

export const workItemAssignees = sqliteTable(
  'work_item_assignees',
  {
    workItemId: text('work_item_id')
      .references(() => workItems.id, { onDelete: 'cascade' })
      .notNull(),
    userId: text('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    assignedAt: integer('assigned_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workItemId, table.userId] }),
  })
);

export const workItems = sqliteTable(
  'work_items',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description'),
    type: text('type').notNull().default('task'),
    status: text('status').notNull().default('open'),
    priority: text('priority').notNull().default('medium'),
    teamId: text('team_id')
      .references(() => teams.id)
      .notNull(),
    createdBy: text('created_by')
      .references(() => users.id)
      .notNull(),
    version: integer('version').notNull().default(1),
    dueDate: integer('due_date', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    teamIdx: index('idx_work_items_team').on(table.teamId),
    statusIdx: index('idx_work_items_status').on(table.status),
    priorityIdx: index('idx_work_items_priority').on(table.priority),
    createdAtIdx: index('idx_work_items_created_at').on(table.createdAt),
  })
);

export const workItemEvents = sqliteTable(
  'work_item_events',
  {
    id: text('id').primaryKey(),
    workItemId: text('work_item_id')
      .references(() => workItems.id, { onDelete: 'cascade' })
      .notNull(),
    actorId: text('actor_id')
      .references(() => users.id)
      .notNull(),
    eventType: text('event_type').notNull(),
    fieldName: text('field_name'),
    oldValue: text('old_value'),
    newValue: text('new_value'),
    comment: text('comment'),
    metadata: text('metadata', { mode: 'json' }), // JSON stored as text
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => ({
    workItemIdx: index('idx_events_work_item').on(table.workItemId, table.createdAt),
    actorIdx: index('idx_events_actor').on(table.actorId),
  })
);

export const idempotencyKeys = sqliteTable('idempotency_keys', {
  key: text('key').primaryKey(),
  userId: text('user_id')
    .references(() => users.id)
    .notNull(),
  method: text('method').notNull(),
  path: text('path').notNull(),
  statusCode: integer('status_code').notNull(),
  response: text('response', { mode: 'json' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
});

// ─── Relations ───────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  teamMemberships: many(teamMemberships),
  assignedWorkItems: many(workItemAssignees),
  createdWorkItems: many(workItems, { relationName: 'creator' }),
  events: many(workItemEvents),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  memberships: many(teamMemberships),
  workItems: many(workItems),
}));

export const teamMembershipsRelations = relations(teamMemberships, ({ one }) => ({
  user: one(users, {
    fields: [teamMemberships.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMemberships.teamId],
    references: [teams.id],
  }),
}));

export const workItemsRelations = relations(workItems, ({ one, many }) => ({
  team: one(teams, {
    fields: [workItems.teamId],
    references: [teams.id],
  }),
  assignees: many(workItemAssignees),
  creator: one(users, {
    fields: [workItems.createdBy],
    references: [users.id],
    relationName: 'creator',
  }),
  events: many(workItemEvents),
}));

export const workItemAssigneesRelations = relations(workItemAssignees, ({ one }) => ({
  workItem: one(workItems, {
    fields: [workItemAssignees.workItemId],
    references: [workItems.id],
  }),
  user: one(users, {
    fields: [workItemAssignees.userId],
    references: [users.id],
  }),
}));

export const workItemEventsRelations = relations(workItemEvents, ({ one }) => ({
  workItem: one(workItems, {
    fields: [workItemEvents.workItemId],
    references: [workItems.id],
  }),
  actor: one(users, {
    fields: [workItemEvents.actorId],
    references: [users.id],
  }),
}));

// ─── Type Exports ────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type TeamMembership = typeof teamMemberships.$inferSelect;
export type WorkItem = typeof workItems.$inferSelect;
export type NewWorkItem = typeof workItems.$inferInsert;
export type WorkItemEvent = typeof workItemEvents.$inferSelect;
export type TeamRole = 'admin' | 'manager' | 'member' | 'viewer';
export type WorkItemStatus = 'open' | 'in_progress' | 'under_review' | 'blocked' | 'resolved' | 'closed';
export type WorkItemPriority = 'critical' | 'high' | 'medium' | 'low';
export type WorkItemType = 'incident' | 'task' | 'investigation' | 'approval' | 'bug' | 'compliance';
