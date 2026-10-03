import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getAuthToken } from '../api';

export function useSSE() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;

    const eventSource = new EventSource(`http://localhost:3000/api/events/stream?token=${token}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'ping') return;

        // Invalidate relevant queries based on the event
        if (data.workItemId) {
          queryClient.invalidateQueries({ queryKey: ['workItem', data.workItemId] });
          queryClient.invalidateQueries({ queryKey: ['workItemEvents', data.workItemId] });
        }
        
        if (data.teamId) {
          queryClient.invalidateQueries({ queryKey: ['workItems', data.teamId] });
        }
      } catch (err) {
        console.error('Failed to parse SSE event', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE Error:', error);
      eventSource.close();
      
      // Basic reconnect logic
      setTimeout(() => {
        // Just invalidate auth to trigger re-render and re-connect if needed
        queryClient.invalidateQueries({ queryKey: ['me'] });
      }, 5000);
    };

    return () => {
      eventSource.close();
    };
  }, [queryClient]);
}
