import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { users, teams, workItems, teamMemberships } from '../../src/db/schema';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config';

describe('Assignment API', () => {
  let u1Token: string;
  let u2Token: string;
  let u1Id: string;
  let u2Id: string;
  let teamId: string;
  let workItemId: string;

  beforeAll(async () => {
    u1Id = uuidv4();
    u2Id = uuidv4();
    teamId = uuidv4();

    await db.insert(users).values([
      { id: u1Id, email: `a1-${u1Id}@test.com`, name: 'A1', passwordHash: 'x', createdAt: new Date(), updatedAt: new Date() },
      { id: u2Id, email: `a2-${u2Id}@test.com`, name: 'A2', passwordHash: 'x', createdAt: new Date(), updatedAt: new Date() }
    ]);

    await db.insert(teams).values([{ id: teamId, name: `Assign Team ${teamId}`, createdAt: new Date() }]);
    
    await db.insert(teamMemberships).values([
      { userId: u1Id, teamId, role: 'member' },
      { userId: u2Id, teamId, role: 'member' }
    ]);

    u1Token = jwt.sign({ userId: u1Id }, config.jwt.secret);
    u2Token = jwt.sign({ userId: u2Id }, config.jwt.secret);

    workItemId = uuidv4();
    await db.insert(workItems).values({
      id: workItemId,
      title: 'Assign Test Item',
      teamId: teamId,
      type: 'task',
      priority: 'low',
      status: 'open',
      version: 1,
      createdBy: u1Id,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  it('should enforce atomicity on assignment (prevent race condition)', async () => {
    // Both users try to assign themselves concurrently at version 1
    const req1 = request(app)
      .post(`/api/work-items/${workItemId}/assign`)
      .set('Authorization', `Bearer ${u1Token}`)
      .set('If-Match', '1')
      .set('Idempotency-Key', uuidv4())
      .send({ assigneeIds: [u1Id] });

    const req2 = request(app)
      .post(`/api/work-items/${workItemId}/assign`)
      .set('Authorization', `Bearer ${u2Token}`)
      .set('If-Match', '1')
      .set('Idempotency-Key', uuidv4())
      .send({ assigneeIds: [u2Id] });

    const [res1, res2] = await Promise.all([req1, req2]);

    // One should succeed (200) and the other should fail with Conflict (409)
    const statuses = [res1.status, res2.status];
    
    expect(statuses).toContain(200);
    expect(statuses).toContain(409);
    
    // The successful one should increment version to 2
    const successRes = res1.status === 200 ? res1 : res2;
    expect(successRes.body.version).toBe(2);
  });
});
