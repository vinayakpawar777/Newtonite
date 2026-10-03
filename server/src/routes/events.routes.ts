import { Router } from 'express';
import { eventBus } from '../services/event.service';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { teamMemberships } from '../db/schema';
import { eq } from 'drizzle-orm';

export const eventsRouter = Router();

eventsRouter.get('/stream', authenticate, async (req, res) => {
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Send an initial heartbeat
  res.write('data: {"type":"ping"}\n\n');

  // Load user's teams so we only send relevant events
  const memberships = await db.query.teamMemberships.findMany({
      where: eq(teamMemberships.userId, req.userId!)
  });
  
  const userTeamIds = new Set(memberships.map(m => m.teamId));

  // The event listener
  const onUpdate = (event: any) => {
    // Only send if the user is in the team the event belongs to
    if (userTeamIds.has(event.teamId)) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  };

  eventBus.on('work-item-update', onUpdate);

  // Keep connection alive
  const intervalId = setInterval(() => {
    res.write('data: {"type":"ping"}\n\n');
  }, 30000);

  // Cleanup on client disconnect
  req.on('close', () => {
    eventBus.off('work-item-update', onUpdate);
    clearInterval(intervalId);
  });
});
