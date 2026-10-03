import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app';
import { db } from '../../src/db';
import { users, teams, workItems, teamMemberships } from '../../src/db/schema';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config';

describe('Work Items API', () => {
  let token1: string;
  let token2: string;
  let teamId: string;
  let workItemId: string;

  beforeAll(async () => {
    // Setup test users and team
    const u1 = uuidv4();
    const u2 = uuidv4();
    teamId = uuidv4();

    await db.insert(users).values([
      { id: u1, email: `t1-${u1}@test.com`, name: 'T1', passwordHash: 'x', createdAt: new Date(), updatedAt: new Date() },
      { id: u2, email: `t2-${u2}@test.com`, name: 'T2', passwordHash: 'x', createdAt: new Date(), updatedAt: new Date() }
    ]);

    await db.insert(teams).values([{ id: teamId, name: `Test Team ${teamId}`, createdAt: new Date() }]);
    
    await db.insert(teamMemberships).values([
      { userId: u1, teamId, role: 'member' },
      { userId: u2, teamId, role: 'member' },
    ]);

    token1 = jwt.sign({ userId: u1 }, config.jwt.secret);
    token2 = jwt.sign({ userId: u2 }, config.jwt.secret);
  });

  afterAll(async () => {
    // Cleanup handled by in-memory db resetting, but we can delete if needed
  });

  it('should be idempotent on creation', async () => {
    const key = uuidv4();
    
    const res1 = await request(app)
      .post('/api/work-items')
      .set('Authorization', `Bearer ${token1}`)
      .set('Idempotency-Key', key)
      .send({ title: 'Test Task', teamId, type: 'task', priority: 'medium' });

    expect(res1.status).toBe(201);
    workItemId = res1.body.id;

    const res2 = await request(app)
      .post('/api/work-items')
      .set('Authorization', `Bearer ${token1}`)
      .set('Idempotency-Key', key)
      .send({ title: 'Test Task', teamId, type: 'task', priority: 'medium' });

    // Should return same item, not 201 created again
    expect(res2.status).toBe(201);
    expect(res2.body.id).toBe(res1.body.id);
  });

  it('should prevent stale updates (optimistic concurrency)', async () => {
    // User 1 updates with version 1
    const res1 = await request(app)
      .patch(`/api/work-items/${workItemId}`)
      .set('Authorization', `Bearer ${token1}`)
      .set('If-Match', '1')
      .send({ title: 'Updated Title' });
    
    expect(res1.status).toBe(200);
    expect(res1.body.version).toBe(2);

    // User 1 tries to update again with stale version 1
    const res2 = await request(app)
      .patch(`/api/work-items/${workItemId}`)
      .set('Authorization', `Bearer ${token1}`)
      .set('If-Match', '1') // Stale
      .send({ title: 'Conflict Title' });

    expect(res2.status).toBe(409);
    expect(res2.body.code).toBe('VERSION_CONFLICT');
  });

  it('should enforce state machine transitions', async () => {
    // Current status is 'open'. Trying to go to 'resolved' directly is invalid
    const res = await request(app)
      .post(`/api/work-items/${workItemId}/transition`)
      .set('Authorization', `Bearer ${token1}`)
      .set('If-Match', '2') // current version is 2
      .send({ status: 'resolved' });

    expect(res.status).toBe(422); // Validation Error
  });
});
