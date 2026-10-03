import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const API_URL = 'http://localhost:3000/api';

export function getAuthToken() {
  return localStorage.getItem('token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearAuthToken() {
  localStorage.removeItem('token');
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'An error occurred';
    let errorData: any = null;
    try {
      errorData = await response.json();
      errorDetail = errorData.error || errorDetail;
      if (response.status === 409) {
        const err = new Error('CONFLICT:' + JSON.stringify(errorData.details?.current || {})) as any;
        err.status = 409;
        err.current = errorData.details?.current;
        throw err;
      }
      if (response.status === 422) {
        const err = new Error(errorDetail) as any;
        err.status = 422;
        throw err;
      }
    } catch (e) {
      if (e instanceof Error && (e.message.startsWith('CONFLICT:') || (e as any).status)) throw e;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  // Auth
  login: (data: any) => fetchWithAuth('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => fetchWithAuth('/auth/me'),

  // Teams
  getTeams: () => fetchWithAuth('/teams'),
  getTeamMembers: (teamId: string) => fetchWithAuth(`/teams/${teamId}/members`),

  // Work Items
  getWorkItems: (teamId: string, filters?: Record<string, string>) => {
    const params = new URLSearchParams({ teamId });
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val) params.set(key, val);
      });
    }
    return fetchWithAuth(`/work-items?${params.toString()}`);
  },
  getWorkItem: (id: string) => fetchWithAuth(`/work-items/${id}`),
  getWorkItemEvents: (id: string) => fetchWithAuth(`/work-items/${id}/events`),
  createWorkItem: (data: any, idempotencyKey: string) => fetchWithAuth('/work-items', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(data)
  }),
  updateWorkItem: (id: string, data: any, version: number) => fetchWithAuth(`/work-items/${id}`, {
    method: 'PATCH',
    headers: { 'If-Match': version.toString() },
    body: JSON.stringify(data)
  }),
  assignWorkItem: (id: string, assigneeIds: string[], version: number, idempotencyKey: string) => fetchWithAuth(`/work-items/${id}/assign`, {
    method: 'POST',
    headers: { 'If-Match': version.toString(), 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ assigneeIds })
  }),
  transitionWorkItem: (id: string, status: string, version: number) => fetchWithAuth(`/work-items/${id}/transition`, {
    method: 'POST',
    headers: { 'If-Match': version.toString() },
    body: JSON.stringify({ status })
  }),
  addComment: (id: string, comment: string, idempotencyKey: string) => fetchWithAuth(`/work-items/${id}/comments`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ comment })
  }),
};
