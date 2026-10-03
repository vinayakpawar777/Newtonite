import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getAuthToken } from '../api';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, CheckCircle, Inbox, ArrowUpRight, Users } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', under_review: 'Under Review',
  blocked: 'Blocked', resolved: 'Resolved', closed: 'Closed',
};

const PRIO_LABELS: Record<string, string> = {
  critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low',
};

function relativeTime(date: string | Date | number) {
  const d = new Date(typeof date === 'number' ? date * 1000 : date);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function DashboardPage({ user }: { user: any }) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: api.getTeams });

  useEffect(() => {
    if (teams?.length && !selectedTeamId) setSelectedTeamId(teams[0].id);
  }, [teams, selectedTeamId]);

  const { data: workItemsData, isLoading } = useQuery({
    queryKey: ['workItems', selectedTeamId],
    queryFn: () => api.getWorkItems(selectedTeamId!),
    enabled: !!selectedTeamId,
  });

  // SSE for real-time
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    const es = new EventSource(`http://localhost:3000/api/events/stream?token=${token}`);
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === 'ping') return;
        if (event.teamId) queryClient.invalidateQueries({ queryKey: ['workItems', event.teamId] });
      } catch {}
    };
    return () => es.close();
  }, [queryClient]);

  const items = workItemsData?.items || [];
  const myItems = items.filter((i: any) => i.assignees?.some((a: any) => a.user.id === user.id));
  const unassigned = items.filter((i: any) => (!i.assignees || i.assignees.length === 0) && i.status !== 'closed');
  const critical = items.filter((i: any) => i.priority === 'critical' && i.status !== 'closed' && i.status !== 'resolved');
  const overdue = items.filter((i: any) => i.dueDate && new Date(typeof i.dueDate === 'number' ? i.dueDate * 1000 : i.dueDate) < new Date() && i.status !== 'closed' && i.status !== 'resolved');
  const openCount = items.filter((i: any) => i.status === 'open').length;
  const inProgressCount = items.filter((i: any) => i.status === 'in_progress').length;
  const blockedCount = items.filter((i: any) => i.status === 'blocked').length;
  const resolvedCount = items.filter((i: any) => i.status === 'resolved' || i.status === 'closed').length;

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user.name.split(' ')[0]}</p>
        </div>
        <select className="select" style={{ width: 200 }} value={selectedTeamId || ''} onChange={e => setSelectedTeamId(e.target.value)}>
          {teams?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card card-interactive" onClick={() => navigate('/items?status=open')}>
          <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>{openCount}</div>
          <div className="stat-label"><Inbox size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Open</div>
        </div>
        <div className="stat-card card-interactive" onClick={() => navigate('/items?status=in_progress')}>
          <div className="stat-value" style={{ color: 'var(--accent-amber)' }}>{inProgressCount}</div>
          <div className="stat-label"><Clock size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />In Progress</div>
        </div>
        <div className="stat-card card-interactive" onClick={() => navigate('/items?status=blocked')}>
          <div className="stat-value" style={{ color: 'var(--accent-red)' }}>{blockedCount}</div>
          <div className="stat-label"><AlertTriangle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Blocked</div>
        </div>
        <div className="stat-card card-interactive" onClick={() => navigate('/items?status=resolved')}>
          <div className="stat-value" style={{ color: 'var(--accent-green)' }}>{resolvedCount}</div>
          <div className="stat-label"><CheckCircle size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />Resolved / Closed</div>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-spinner"><div className="spinner" /><span>Loading items...</span></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* My Assigned Items */}
          <div className="card">
            <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
              <h3 className="font-semibold text-sm"><Users size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />My Items ({myItems.length})</h3>
            </div>
            {myItems.length === 0 ? (
              <div className="text-sm text-muted" style={{ padding: '1rem 0' }}>No items assigned to you</div>
            ) : (
              <div className="flex flex-col gap-xs">
                {myItems.slice(0, 8).map((item: any) => (
                  <div key={item.id} className="item-row" style={{ gridTemplateColumns: '1fr auto' }} onClick={() => navigate(`/items/${item.id}`)}>
                    <div className="item-row-info">
                      <span className="item-row-title">{item.title}</span>
                      <div className="item-row-meta">
                        <span className={`badge badge-prio-${item.priority}`}>{PRIO_LABELS[item.priority]}</span>
                        <span className="dot" />
                        <span>{relativeTime(item.updatedAt)}</span>
                      </div>
                    </div>
                    <span className={`badge badge-status-${item.status}`}>{STATUS_LABELS[item.status]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unassigned Items */}
          <div className="card">
            <div className="flex items-center justify-between" style={{ marginBottom: '1rem' }}>
              <h3 className="font-semibold text-sm"><Inbox size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Unassigned ({unassigned.length})</h3>
              {unassigned.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => navigate('/items')}>
                  View all <ArrowUpRight size={12} />
                </button>
              )}
            </div>
            {unassigned.length === 0 ? (
              <div className="text-sm text-muted" style={{ padding: '1rem 0' }}>All items are assigned 🎉</div>
            ) : (
              <div className="flex flex-col gap-xs">
                {unassigned.slice(0, 8).map((item: any) => (
                  <div key={item.id} className="item-row" style={{ gridTemplateColumns: '1fr auto' }} onClick={() => navigate(`/items/${item.id}`)}>
                    <div className="item-row-info">
                      <span className="item-row-title">{item.title}</span>
                      <div className="item-row-meta">
                        <span className={`badge badge-prio-${item.priority}`}>{PRIO_LABELS[item.priority]}</span>
                        <span className="dot" />
                        <span>{item.type}</span>
                      </div>
                    </div>
                    <span className={`badge badge-status-${item.status}`}>{STATUS_LABELS[item.status]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Critical & Overdue */}
          {(critical.length > 0 || overdue.length > 0) && (
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <h3 className="font-semibold text-sm" style={{ marginBottom: '1rem', color: 'var(--accent-red)' }}>
                <AlertTriangle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                Needs Attention ({critical.length + overdue.length})
              </h3>
              <div className="flex flex-col gap-xs">
                {[...new Map([...overdue, ...critical].map(i => [i.id, i])).values()].slice(0, 8).map((item: any) => {
                  const isOverdue = item.dueDate && new Date(typeof item.dueDate === 'number' ? item.dueDate * 1000 : item.dueDate) < new Date();
                  return (
                    <div key={item.id} className={`item-row ${isOverdue ? 'overdue' : ''}`} style={{ gridTemplateColumns: '1fr auto auto', position: 'relative' }} onClick={() => navigate(`/items/${item.id}`)}>
                      <div className="item-row-info">
                        <span className="item-row-title">{item.title}</span>
                        <div className="item-row-meta">
                          <span className={`badge badge-prio-${item.priority}`}>{PRIO_LABELS[item.priority]}</span>
                          <span className="dot" />
                          <span className="truncate" style={{ maxWidth: 100 }}>{item.assignees?.length > 0 ? item.assignees.map((a: any) => a.user.name).join(', ') : 'Unassigned'}</span>
                        </div>
                      </div>
                      <span className={`badge badge-status-${item.status}`}>{STATUS_LABELS[item.status]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
