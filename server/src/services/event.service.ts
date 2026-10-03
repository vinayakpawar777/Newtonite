import { EventEmitter } from 'events';

/**
 * In-process event bus for broadcasting work item changes.
 * SSE connections subscribe to this emitter to push real-time updates to clients.
 * 
 * In a multi-process deployment, this would be replaced with Redis Pub/Sub.
 * For this single-process server, EventEmitter is simpler and sufficient.
 */
class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(1000); // Support many simultaneous SSE connections
  }
}

export const eventBus = new EventBus();

export interface WorkItemUpdateEvent {
  type: string;
  workItemId: string;
  teamId: string;
  actorId: string;
  actorName?: string;
  data: any;
  timestamp: string;
}

export function broadcastWorkItemUpdate(event: WorkItemUpdateEvent): void {
  eventBus.emit('work-item-update', event);
}
