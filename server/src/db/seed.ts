import { db } from './index';
import { users, teams, teamMemberships, workItems, workItemEvents, idempotencyKeys, workItemAssignees } from './schema';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  console.log('🌱 Seeding database...');
  
  // Clear existing data to avoid conflicts
  console.log('🗑️ Clearing existing data...');
  await db.delete(workItemEvents);
  await db.delete(workItemAssignees);
  await db.delete(workItems);
  await db.delete(teamMemberships);
  await db.delete(teams);
  await db.delete(idempotencyKeys);
  await db.delete(users);

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password', salt);

  // ── Users ──
  const adminId = uuidv4();
  const managerId = uuidv4();
  const member1Id = uuidv4();
  const member2Id = uuidv4();
  const member3Id = uuidv4();
  const member4Id = uuidv4();
  const viewerId = uuidv4();

  const allUsers = [
    { id: adminId, email: 'admin@newtonite.com', name: 'Alice Admin', passwordHash, createdAt: new Date(), updatedAt: new Date() },
    { id: managerId, email: 'manager@newtonite.com', name: 'Marcus Manager', passwordHash, createdAt: new Date(), updatedAt: new Date() },
    { id: member1Id, email: 'user@newtonite.com', name: 'Thor Odinson', passwordHash, createdAt: new Date(), updatedAt: new Date() },
    { id: member2Id, email: 'jane@newtonite.com', name: 'Jane Developer', passwordHash, createdAt: new Date(), updatedAt: new Date() },
    { id: member3Id, email: 'bob@newtonite.com', name: 'Bob Ops', passwordHash, createdAt: new Date(), updatedAt: new Date() },
    { id: member4Id, email: 'newmember@newtonite.com', name: 'Loki Laufeyson', passwordHash, createdAt: new Date(), updatedAt: new Date() },
    { id: viewerId, email: 'viewer@newtonite.com', name: 'Val Viewer', passwordHash, createdAt: new Date(), updatedAt: new Date() },
  ];

  await db.insert(users).values(allUsers);

  // ── Teams ──
  const engTeamId = uuidv4();
  const opsTeamId = uuidv4();
  const compTeamId = uuidv4();

  await db.insert(teams).values([
    { id: engTeamId, name: 'Engineering', description: 'Core product engineering team', createdAt: new Date() },
    { id: opsTeamId, name: 'Operations', description: 'DevOps and infrastructure', createdAt: new Date() },
    { id: compTeamId, name: 'Compliance', description: 'Regulatory and compliance', createdAt: new Date() },
  ]);

  // ── Team Memberships ──
  await db.insert(teamMemberships).values([
    // Engineering team
    { userId: adminId, teamId: engTeamId, role: 'admin' },
    { userId: managerId, teamId: engTeamId, role: 'manager' },
    { userId: member1Id, teamId: engTeamId, role: 'member' },
    { userId: member2Id, teamId: engTeamId, role: 'member' },
    { userId: member4Id, teamId: engTeamId, role: 'member' },
    { userId: viewerId, teamId: engTeamId, role: 'viewer' },
    // Operations team
    { userId: adminId, teamId: opsTeamId, role: 'admin' },
    { userId: member3Id, teamId: opsTeamId, role: 'member' },
    { userId: managerId, teamId: opsTeamId, role: 'manager' },
    // Compliance team
    { userId: adminId, teamId: compTeamId, role: 'admin' },
    { userId: managerId, teamId: compTeamId, role: 'manager' },
  ]);

  // ── Work Items ──
  const now = Date.now();
  const DAY = 86400000;

  const workItemData = [
    // Engineering — varied statuses and priorities
    { id: uuidv4(), title: 'API response times exceeding SLA thresholds', description: 'P95 latency on /api/orders is 3.2s, SLA requires < 500ms. Suspect N+1 queries in the order lookup path.', type: 'incident', status: 'open', priority: 'critical', teamId: engTeamId, assignees: [], createdBy: member1Id, dueDate: new Date(now + 1 * DAY) },
    { id: uuidv4(), title: 'Implement cursor-based pagination for work items list', description: 'Replace offset pagination with cursor-based approach for better performance with large datasets.', type: 'task', status: 'in_progress', priority: 'high', teamId: engTeamId, assignees: [member2Id, member3Id], createdBy: managerId, dueDate: new Date(now + 3 * DAY) },
    { id: uuidv4(), title: 'Database connection pool exhaustion during peak hours', description: 'Connection pool hits max (20) during 9-11am. Need to investigate connection leaks and potentially increase pool size.', type: 'bug', status: 'under_review', priority: 'high', teamId: engTeamId, assignees: [member1Id], createdBy: adminId, dueDate: new Date(now + 2 * DAY) },
    { id: uuidv4(), title: 'Add rate limiting to public API endpoints', description: 'Implement token bucket rate limiting: 100 req/min for authenticated, 20 req/min for anonymous.', type: 'task', status: 'open', priority: 'medium', teamId: engTeamId, assignees: [], createdBy: managerId, dueDate: new Date(now + 7 * DAY) },
    { id: uuidv4(), title: 'Memory leak in WebSocket connection handler', description: 'Server memory grows ~50MB/hour. Heap snapshots suggest event listeners not being cleaned up on disconnect.', type: 'bug', status: 'blocked', priority: 'critical', teamId: engTeamId, assignees: [member1Id], createdBy: member2Id, dueDate: new Date(now - 1 * DAY) },
    { id: uuidv4(), title: 'Migrate auth tokens from JWT to opaque + introspection', description: 'Current JWT approach makes token revocation impossible. Proposal: switch to opaque tokens with Redis-backed introspection.', type: 'investigation', status: 'open', priority: 'medium', teamId: engTeamId, assignees: [], createdBy: adminId, dueDate: new Date(now + 14 * DAY) },
    { id: uuidv4(), title: 'Upgrade Node.js from v18 to v22 LTS', description: 'Node 18 EOL approaching. Need to test compatibility with all dependencies before migration.', type: 'task', status: 'resolved', priority: 'low', teamId: engTeamId, assignees: [member2Id], createdBy: managerId, dueDate: null },
    { id: uuidv4(), title: 'Fix CORS preflight failures on Safari 17', description: 'Safari 17 sends unexpected Origin header on redirected requests, causing CORS preflight to fail.', type: 'bug', status: 'in_progress', priority: 'high', teamId: engTeamId, assignees: [member2Id, member1Id], createdBy: member1Id, dueDate: new Date(now + 2 * DAY) },
    { id: uuidv4(), title: 'Set up CI/CD pipeline for staging environment', description: 'Configure GitHub Actions: lint → test → build → deploy to staging on merge to main.', type: 'task', status: 'closed', priority: 'medium', teamId: engTeamId, assignees: [member1Id], createdBy: adminId, dueDate: null },

    // Operations
    { id: uuidv4(), title: 'Kubernetes pod OOMKilled in production', description: 'payment-service pods being OOMKilled every 4-6 hours. Current limit: 512Mi. Need to profile memory usage.', type: 'incident', status: 'open', priority: 'critical', teamId: opsTeamId, assignees: [], createdBy: member3Id, dueDate: new Date(now + 0.5 * DAY) },
    { id: uuidv4(), title: 'SSL certificate expiring in 14 days', description: 'Wildcard cert for *.newtonite.com expires Oct 18. Auto-renewal via cert-manager appears broken.', type: 'task', status: 'in_progress', priority: 'high', teamId: opsTeamId, assignees: [member3Id, managerId], createdBy: managerId, dueDate: new Date(now + 10 * DAY) },
    { id: uuidv4(), title: 'Set up centralized logging with ELK stack', description: 'Aggregate logs from all services into Elasticsearch. Configure Kibana dashboards for key metrics.', type: 'task', status: 'open', priority: 'medium', teamId: opsTeamId, assignees: [], createdBy: adminId, dueDate: new Date(now + 21 * DAY) },
    { id: uuidv4(), title: 'Investigate spike in 502 errors from load balancer', description: 'CloudFront returning 502 for ~2% of requests to /api/checkout since last deploy.', type: 'investigation', status: 'open', priority: 'high', teamId: opsTeamId, assignees: [], createdBy: member3Id, dueDate: new Date(now + 1 * DAY) },
    { id: uuidv4(), title: 'Database backup verification failed', description: 'Monthly backup restore test showed corrupted snapshot from Sept 28. Need to investigate backup pipeline.', type: 'incident', status: 'under_review', priority: 'high', teamId: opsTeamId, assignees: [member3Id], createdBy: managerId, dueDate: new Date(now + 2 * DAY) },
    { id: uuidv4(), title: 'Reduce AWS bill by optimizing EC2 instance types', description: 'Current spend: $12k/mo. Analysis suggests we can save 30% by moving to Graviton instances and right-sizing.', type: 'task', status: 'open', priority: 'low', teamId: opsTeamId, assignees: [], createdBy: adminId, dueDate: new Date(now + 30 * DAY) },

    // Compliance
    { id: uuidv4(), title: 'Complete SOC2 Type II audit documentation', description: 'Auditors need evidence of access controls, change management, and incident response for the last 12 months.', type: 'compliance', status: 'in_progress', priority: 'critical', teamId: compTeamId, assignees: [managerId, adminId], createdBy: adminId, dueDate: new Date(now + 5 * DAY) },
    { id: uuidv4(), title: 'Review and update data retention policy', description: 'Current policy allows indefinite PII storage. GDPR requires defined retention periods with automated deletion.', type: 'compliance', status: 'open', priority: 'high', teamId: compTeamId, assignees: [], createdBy: managerId, dueDate: new Date(now + 14 * DAY) },
    { id: uuidv4(), title: 'Approve vendor security assessment for Stripe integration', description: 'Legal requires security review before upgrading to Stripe API v2024-10. Assessment form attached.', type: 'approval', status: 'open', priority: 'medium', teamId: compTeamId, assignees: [], createdBy: adminId, dueDate: new Date(now + 7 * DAY) },
    { id: uuidv4(), title: 'Implement audit log export for regulatory review', description: 'Compliance needs ability to export full audit trail as CSV for external auditor review.', type: 'task', status: 'blocked', priority: 'medium', teamId: compTeamId, assignees: [managerId], createdBy: adminId, dueDate: new Date(now + 10 * DAY) },
    
    // Additional Engineering Tasks
    { id: uuidv4(), title: 'Refactor order processing state machine', description: 'The current order state machine is brittle and missing several edge cases.', type: 'task', status: 'open', priority: 'medium', teamId: engTeamId, assignees: [], createdBy: managerId, dueDate: new Date(now + 8 * DAY) },
    { id: uuidv4(), title: 'Investigate intermittent timeout in CI/CD pipeline', description: 'Integration tests are failing with timeout errors around 5% of the time on main.', type: 'investigation', status: 'in_progress', priority: 'high', teamId: engTeamId, assignees: [member1Id], createdBy: member2Id, dueDate: new Date(now + 2 * DAY) },
    { id: uuidv4(), title: 'Add feature flags for new dashboard launch', description: 'Wrap new dashboard components in feature flags to enable a gradual rollout.', type: 'task', status: 'under_review', priority: 'medium', teamId: engTeamId, assignees: [member2Id], createdBy: adminId, dueDate: new Date(now + 1 * DAY) },
    { id: uuidv4(), title: 'Critical vulnerability in left-pad dependency', description: 'Dependabot flagged a critical CVE in left-pad. Update to latest patched version.', type: 'bug', status: 'resolved', priority: 'critical', teamId: engTeamId, assignees: [member1Id, member2Id], createdBy: adminId, dueDate: null },
    { id: uuidv4(), title: 'Create reusable button components', description: 'Migrate standard buttons to the new design system components.', type: 'task', status: 'closed', priority: 'low', teamId: engTeamId, assignees: [member2Id], createdBy: member2Id, dueDate: null },

    // Additional Operations Tasks
    { id: uuidv4(), title: 'Provision read-replica for reporting database', description: 'Reporting queries are impacting primary DB performance. Need a dedicated read-replica.', type: 'task', status: 'in_progress', priority: 'high', teamId: opsTeamId, assignees: [member3Id], createdBy: managerId, dueDate: new Date(now + 5 * DAY) },
    { id: uuidv4(), title: 'Update IAM policies for contractor access', description: 'Review and rotate credentials for external engineering contractors.', type: 'task', status: 'open', priority: 'medium', teamId: opsTeamId, assignees: [], createdBy: adminId, dueDate: new Date(now + 4 * DAY) },
    { id: uuidv4(), title: 'Redis cluster failover test', description: 'Perform planned failover of primary Redis cluster to ensure HA setup works.', type: 'incident', status: 'blocked', priority: 'high', teamId: opsTeamId, assignees: [managerId, member3Id], createdBy: managerId, dueDate: new Date(now + 15 * DAY) },
    
    // Additional Compliance Tasks
    { id: uuidv4(), title: 'Quarterly access review for engineering systems', description: 'Ensure all terminated employees have had access revoked from GitHub, AWS, and Slack.', type: 'compliance', status: 'open', priority: 'high', teamId: compTeamId, assignees: [], createdBy: adminId, dueDate: new Date(now + 2 * DAY) },
    { id: uuidv4(), title: 'Approve new marketing analytics tool', description: 'Review data processing agreement for new analytics vendor.', type: 'approval', status: 'under_review', priority: 'medium', teamId: compTeamId, assignees: [managerId], createdBy: adminId, dueDate: new Date(now + 3 * DAY) },
  ];

  for (const item of workItemData) {
    const { assignees, ...rest } = item;
    const createdAt = new Date(now - Math.random() * 7 * DAY);
    
    await db.insert(workItems).values({
      ...rest,
      version: 1,
      createdAt,
      updatedAt: new Date(now - Math.random() * 2 * DAY),
    });

    if (assignees.length > 0) {
      await db.insert(workItemAssignees).values(
        assignees.map(userId => ({
          workItemId: item.id,
          userId,
          assignedAt: createdAt,
        }))
      );
    }

    // Create 'created' event for each work item
    await db.insert(workItemEvents).values({
      id: uuidv4(),
      workItemId: item.id,
      actorId: item.createdBy,
      eventType: 'created',
      createdAt,
      metadata: { title: item.title },
    });
  }

  // Add some extra events to items for realistic history
  const engItems = workItemData.filter(i => i.teamId === engTeamId);
  if (engItems.length >= 3) {
    // Status change events
    await db.insert(workItemEvents).values([
      { id: uuidv4(), workItemId: engItems[1].id, actorId: member2Id, eventType: 'status_changed', oldValue: 'open', newValue: 'in_progress', createdAt: new Date(now - 2 * DAY) },
      { id: uuidv4(), workItemId: engItems[2].id, actorId: member1Id, eventType: 'status_changed', oldValue: 'open', newValue: 'in_progress', createdAt: new Date(now - 3 * DAY) },
      { id: uuidv4(), workItemId: engItems[2].id, actorId: member1Id, eventType: 'status_changed', oldValue: 'in_progress', newValue: 'under_review', createdAt: new Date(now - 1 * DAY) },
      { id: uuidv4(), workItemId: engItems[6].id, actorId: member2Id, eventType: 'status_changed', oldValue: 'in_progress', newValue: 'resolved', createdAt: new Date(now - 1 * DAY) },
    ]);

    // Assignment events
    await db.insert(workItemEvents).values([
      { id: uuidv4(), workItemId: engItems[1].id, actorId: managerId, eventType: 'assigned', newValue: member2Id, createdAt: new Date(now - 2.5 * DAY) },
      { id: uuidv4(), workItemId: engItems[4].id, actorId: member1Id, eventType: 'assigned', newValue: member1Id, createdAt: new Date(now - 4 * DAY) },
    ]);

    // Comment events
    await db.insert(workItemEvents).values([
      { id: uuidv4(), workItemId: engItems[0].id, actorId: member1Id, eventType: 'commented', comment: 'Profiled the query — confirmed N+1 issue. Each order triggers 3 additional queries for line items.', createdAt: new Date(now - 0.5 * DAY) },
      { id: uuidv4(), workItemId: engItems[4].id, actorId: member2Id, eventType: 'commented', comment: 'Blocked on upstream fix in the websocket library. Opened issue: ws#2847', createdAt: new Date(now - 1 * DAY) },
      { id: uuidv4(), workItemId: engItems[2].id, actorId: adminId, eventType: 'commented', comment: 'Looks good. Please add connection pool metrics to the monitoring dashboard before we merge.', createdAt: new Date(now - 0.25 * DAY) },
    ]);
  }

  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('Demo Accounts (all passwords: "password"):');
  console.log('  Admin:   admin@newtonite.com   (admin in all teams)');
  console.log('  Manager: manager@newtonite.com (manager in all teams)');
  console.log('  Thor:    user@newtonite.com    (member in Engineering)');
  console.log('  Loki:    newmember@newtonite.com (member in Engineering)');
  console.log('  Viewer:  viewer@newtonite.com  (viewer in Engineering)');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
