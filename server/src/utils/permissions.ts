import type { TeamRole } from '../db/schema';

/**
 * Permission-based authorization model.
 * Permissions are scoped to a team — a user may have different roles in different teams.
 */
export type Permission =
  | 'work_item:read'
  | 'work_item:create'
  | 'work_item:update_own'
  | 'work_item:update_any'
  | 'work_item:assign_self'
  | 'work_item:assign_any'
  | 'work_item:comment'
  | 'work_item:change_priority'
  | 'work_item:transition'
  | 'work_item:close'
  | 'work_item:delete'
  | 'team:read'
  | 'team:manage_members';

const ROLE_PERMISSIONS: Record<TeamRole, Permission[]> = {
  viewer: [
    'work_item:read',
    'team:read',
  ],
  member: [
    'work_item:read',
    'work_item:create',
    'work_item:update_own',
    'work_item:assign_self',
    'work_item:comment',
    'work_item:transition',
    'team:read',
  ],
  manager: [
    'work_item:read',
    'work_item:create',
    'work_item:update_own',
    'work_item:update_any',
    'work_item:assign_self',
    'work_item:assign_any',
    'work_item:comment',
    'work_item:change_priority',
    'work_item:transition',
    'work_item:close',
    'team:read',
  ],
  admin: [
    'work_item:read',
    'work_item:create',
    'work_item:update_own',
    'work_item:update_any',
    'work_item:assign_self',
    'work_item:assign_any',
    'work_item:comment',
    'work_item:change_priority',
    'work_item:transition',
    'work_item:close',
    'work_item:delete',
    'team:read',
    'team:manage_members',
  ],
};

/** Role hierarchy for comparison — higher index = more powerful */
const ROLE_HIERARCHY: TeamRole[] = ['viewer', 'member', 'manager', 'admin'];

export function hasPermission(role: TeamRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.includes(permission) : false;
}

export function hasAnyPermission(role: TeamRole, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function isRoleAtLeast(role: TeamRole, minimumRole: TeamRole): boolean {
  return ROLE_HIERARCHY.indexOf(role) >= ROLE_HIERARCHY.indexOf(minimumRole);
}

export function getPermissionsForRole(role: TeamRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}
