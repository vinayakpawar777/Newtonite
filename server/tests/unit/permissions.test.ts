import { describe, it, expect } from 'vitest';
import { hasPermission, hasAnyPermission, isRoleAtLeast, getPermissionsForRole } from '../../src/utils/permissions';

describe('Permissions Model', () => {
  it('should grant permissions based on role', () => {
    // Viewer
    expect(hasPermission('viewer', 'work_item:read')).toBe(true);
    expect(hasPermission('viewer', 'work_item:create')).toBe(false);

    // Member
    expect(hasPermission('member', 'work_item:create')).toBe(true);
    expect(hasPermission('member', 'work_item:update_any')).toBe(false);

    // Manager
    expect(hasPermission('manager', 'work_item:update_any')).toBe(true);
    expect(hasPermission('manager', 'team:manage_members')).toBe(false);

    // Admin
    expect(hasPermission('admin', 'team:manage_members')).toBe(true);
    expect(hasPermission('admin', 'work_item:delete')).toBe(true);
  });

  it('should correctly identify if user has any of a set of permissions', () => {
    expect(hasAnyPermission('viewer', ['work_item:create', 'work_item:read'])).toBe(true);
    expect(hasAnyPermission('viewer', ['work_item:create', 'work_item:update_own'])).toBe(false);
  });

  it('should correctly compare roles in hierarchy', () => {
    expect(isRoleAtLeast('manager', 'member')).toBe(true);
    expect(isRoleAtLeast('admin', 'manager')).toBe(true);
    expect(isRoleAtLeast('member', 'member')).toBe(true);
    
    expect(isRoleAtLeast('viewer', 'member')).toBe(false);
    expect(isRoleAtLeast('member', 'admin')).toBe(false);
  });

  it('should retrieve all permissions for a role', () => {
    const viewerPerms = getPermissionsForRole('viewer');
    expect(viewerPerms).toContain('work_item:read');
    expect(viewerPerms).toContain('team:read');
    expect(viewerPerms.length).toBe(2);
  });
});
