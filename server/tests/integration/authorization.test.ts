import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { users, teams, workItems, teamMemberships } from '../../src/db/schema';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config';

describe('Authorization API', () => {
  let viewerToken: string;
  let managerToken: string;
  let otherTeamToken: string;
  
  let teamId: string;
  let otherTeamId: string;
  let workItemId: string;

  beforeAll(async () => {
    const viewerId = uuidv4();
    const managerId = uuidv4();
    const otherUserId = uuidv4();
    teamId = uuidv4();
    otherTeamId = uuidv4();

    await db.insert(users).values([
      { id: viewerId, email: `viewer-${viewerId}@test.com`, name: 'Viewer', passwordHash: 'x', createdAt: new Date(), updatedAt: new Date() },
      { id: managerId, email: `manager-${managerId}@test.com`, name: 'Manager', passwordHash: 'x', createdAt: new Date(), updatedAt: new Date() },
      { id: otherUserId, email: `other-${otherUserId}@test.com`, name: 'Other', passwordHash: 'x', createdAt: new Date(), updatedAt: new Date() }
    ]);

    await db.insert(teams).values([
      { id: teamId, name: `Team A ${teamId}`, createdAt: new Date() },
      { id: otherTeamId, name: `Team B ${otherTeamId}`, createdAt: new Date() }
    ]);
    
    await db.insert(teamMemberships).values([
      { userId: viewerId, teamId, role: 'viewer' },
      { userId: managerId, teamId, role: 'manager' },
      { userId: otherUserId, teamId: otherTeamId, role: 'member' }
    ]);

    viewerToken = jwt.sign({ userId: viewerId }, config.jwt.secret);
    managerToken = jwt.sign({ userId: managerId }, config.jwt.secret);
    otherTeamToken = jwt.sign({ userId: otherUserId }, config.jwt.secret);

    // Create a work item in Team A
    workItemId = uuidv4();
    await db.insert(workItems).values({
      id: workItemId,
      title: 'Auth Test Item',
      teamId: teamId,
      type: 'task',
      priority: 'low',
      status: 'open',
      version: 1,
      createdBy: managerId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  afterAll(async () => {
    // Cleanup if necessary
  });

  it('should allow manager to update any work item', async () => {
    const res = await request(app)
      .patch(`/api/work-items/${workItemId}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .set('If-Match', '1')
      .send({ title: 'Updated Title' });
    
    expect(res.status).toBe(200);
  });

  it('should prevent viewer from updating work item', async () => {
    const res = await request(app)
      .patch(`/api/work-items/${workItemId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('If-Match', '2') // current version is 2
      .send({ title: 'Viewer Update' });
    
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Insufficient permissions: requires 'work_item:update_own'");
  });

  it('should prevent cross-team access for read', async () => {
    const res = await request(app)
      .get(`/api/work-items/${workItemId}`)
      .set('Authorization', `Bearer ${otherTeamToken}`);
    
    expect(res.status).toBe(403); // Since they are not in Team A
  });

  it('should prevent cross-team access for write', async () => {
    const res = await request(app)
      .post(`/api/work-items`)
      .set('Authorization', `Bearer ${otherTeamToken}`)
      .set('Idempotency-Key', uuidv4())
      .send({ title: 'Bad item', teamId: teamId, type: 'task', priority: 'medium' });
    
    expect(res.status).toBe(403);
  });
});
