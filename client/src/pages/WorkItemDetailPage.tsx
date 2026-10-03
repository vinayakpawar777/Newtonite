import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { v4 as uuidv4 } from 'uuid';
import { ArrowLeft, Send, UserPlus, ArrowRightCircle, AlertTriangle, Edit3, Save, X } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', under_review: 'Under Review',
  blocked: 'Blocked', resolved: 'Resolved', closed: 'Closed',
};
const PRIO_LABELS: Record<string, string> = {
  critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low',
};
const TYPE_LABELS: Record<string, string> = {
  incident: 'Incident', task: 'Task', investigation: 'Investigation',
  approval: 'Approval', bug: 'Bug', compliance: 'Compliance',
};

// State machine transitions (mirror server-side)
const TRANSITIONS: Record<string, string[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['under_review', 'blocked', 'open'],
  under_review: ['resolved', 'in_progress'],
  blocked: ['in_progress', 'open'],
  resolved: ['closed', 'in_progress'],
  closed: ['open'],
};

function relativeTime(date: string | Date | number) {
  const d = new Date(typeof date === 'number' ? date * 1000 : date);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

function formatDate(date: string | Date | number | null) {
  if (!date) return '—';
  const d = new Date(typeof date === 'number' ? date * 1000 : date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function eventDescription(event: any) {
  const actor = event.actor?.name || 'Someone';
  switch (event.eventType) {
    case 'created': return <><span className="timeline-actor">{actor}</span> <span className="timeline-action">created this item</span></>;
    case 'status_changed': return <><span className="timeline-actor">{actor}</span> <span className="timeline-action">changed status from</span> <span className={`badge badge-status-${event.oldValue}`}>{STATUS_LABELS[event.oldValue] || event.oldValue}</span> <span className="timeline-action">to</span> <span className={`badge badge-status-${event.newValue}`}>{STATUS_LABELS[event.newValue] || event.newValue}</span></>;
    case 'assigned': return <><span className="timeline-actor">{actor}</span> <span className="timeline-action">assigned this item</span></>;
    case 'unassigned': return <><span className="timeline-actor">{actor}</span> <span className="timeline-action">unassigned this item</span></>;
    case 'commented': return <><span className="timeline-actor">{actor}</span> <span className="timeline-action">commented</span></>;
    case 'updated': return <><span className="timeline-actor">{actor}</span> <span className="timeline-action">updated this item</span></>;
    default: return <><span className="timeline-actor">{actor}</span> <span className="timeline-action">{event.eventType.replace('_', ' ')}</span></>;
  }
}

export default function WorkItemDetailPage({ user }: { user: any }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [conflictData, setConflictData] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);

  const { data: item, isLoading, refetch } = useQuery({
    queryKey: ['workItem', id],
    queryFn: () => api.getWorkItem(id!),
    enabled: !!id,
  });

  const { data: events } = useQuery({
    queryKey: ['workItemEvents', id],
    queryFn: () => api.getWorkItemEvents(id!),
    enabled: !!id,
  });

  const { data: teamMembers } = useQuery({
    queryKey: ['teamMembers', item?.teamId],
    queryFn: () => api.getTeamMembers(item!.teamId),
    enabled: !!item?.teamId,
  });

  const transitionMutation = useMutation({
    mutationFn: ({ status }: { status: string }) => api.transitionWorkItem(id!, status, item.version),
    onSuccess: () => { refetch(); queryClient.invalidateQueries({ queryKey: ['workItemEvents', id] }); setConflictData(null); },
    onError: (err: any) => {
      if (err.status === 409 || err.message?.startsWith('CONFLICT:')) {
        setConflictData(err.current || JSON.parse(err.message.replace('CONFLICT:', '')));
      }
    }
  });

  const assignMutation = useMutation({
    mutationFn: ({ assigneeIds }: { assigneeIds: string[] }) => api.assignWorkItem(id!, assigneeIds, item.version, uuidv4()),
    onSuccess: () => { refetch(); queryClient.invalidateQueries({ queryKey: ['workItemEvents', id] }); setShowAssignModal(false); setConflictData(null); },
    onError: (err: any) => {
      if (err.status === 409 || err.message?.startsWith('CONFLICT:')) {
        setConflictData(err.current || JSON.parse(err.message.replace('CONFLICT:', '')));
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.updateWorkItem(id!, data, item.version),
    onSuccess: () => { setEditing(false); refetch(); queryClient.invalidateQueries({ queryKey: ['workItemEvents', id] }); setConflictData(null); },
    onError: (err: any) => {
      if (err.status === 409 || err.message?.startsWith('CONFLICT:')) {
        setConflictData(err.current || JSON.parse(err.message.replace('CONFLICT:', '')));
      }
    }
  });

  const commentMutation = useMutation({
    mutationFn: (text: string) => api.addComment(id!, text, uuidv4()),
    onSuccess: () => { setComment(''); queryClient.invalidateQueries({ queryKey: ['workItemEvents', id] }); },
  });

  if (isLoading) return <div className="loading-spinner" style={{ marginTop: '4rem' }}><div className="spinner" /><span>Loading...</span></div>;
  if (!item) return <div className="empty-state"><div className="empty-state-title">Item not found</div></div>;

  const transitions = TRANSITIONS[item.status] || [];

  const startEditing = () => {
    setEditTitle(item.title);
    setEditDescription(item.description || '');
    setEditPriority(item.priority);
    setEditing(true);
  };

  const saveEdits = () => {
    const changes: any = {};
    if (editTitle !== item.title) changes.title = editTitle;
    if (editDescription !== (item.description || '')) changes.description = editDescription;
    if (editPriority !== item.priority) changes.priority = editPriority;
    if (Object.keys(changes).length > 0) {
      updateMutation.mutate(changes);
    } else {
      setEditing(false);
    }
  };

  return (
    <div className="animate-in">
      {/* Back */}
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={14} /> Back
      </button>

      {/* Conflict banner */}
      {conflictData && (
        <div className="conflict-banner" style={{ marginBottom: '1.5rem' }}>
          <AlertTriangle size={18} className="conflict-banner-icon" />
          <div className="conflict-banner-content">
            <div className="conflict-banner-title">Concurrency Conflict</div>
            <div className="conflict-banner-text">This item was modified by someone else. The page has been refreshed with the latest data. Please try your action again.</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setConflictData(null); refetch(); }}>Refresh</button>
        </div>
      )}

      <div className="detail-layout">
        {/* Main content */}
        <div className="detail-main">
          {/* Header */}
          <div className="card">
            <div className="flex items-center gap-sm" style={{ marginBottom: '0.75rem' }}>
              <span className={`badge badge-status-${item.status}`}>{STATUS_LABELS[item.status]}</span>
              <span className={`badge badge-prio-${item.priority}`}>{PRIO_LABELS[item.priority]}</span>
              <span className="badge badge-type">{TYPE_LABELS[item.type] || item.type}</span>
              <span className="version-badge" style={{ marginLeft: 'auto' }}>v{item.version}</span>
            </div>

            {editing ? (
              <div className="flex flex-col gap-md">
                <input className="input" value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ fontSize: '1.125rem', fontWeight: 600 }} />
                <textarea className="textarea" value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={4} />
                <div className="form-group" style={{ maxWidth: 200 }}>
                  <label className="form-label">Priority</label>
                  <select className="select" value={editPriority} onChange={e => setEditPriority(e.target.value)}>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div className="flex gap-sm">
                  <button className="btn btn-primary btn-sm" onClick={saveEdits} disabled={updateMutation.isPending}>
                    <Save size={13} /> {updateMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}><X size={13} /> Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', letterSpacing: '-0.01em' }}>{item.title}</h1>
                {item.description && <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{item.description}</p>}
                <button className="btn btn-ghost btn-sm" style={{ marginTop: '0.75rem' }} onClick={startEditing}>
                  <Edit3 size={13} /> Edit
                </button>
              </>
            )}
          </div>

          {/* Transitions */}
          {transitions.length > 0 && (
            <div className="card">
              <div className="detail-section-title">Transition Status</div>
              <div className="btn-group">
                {transitions.map(t => (
                  <button key={t} className={`transition-btn`}
                    style={{
                      borderColor: `var(--status-${t})`,
                      color: `var(--status-${t})`,
                      background: `var(--status-${t}-bg)`,
                    }}
                    onClick={() => transitionMutation.mutate({ status: t })}
                    disabled={transitionMutation.isPending}
                  >
                    <ArrowRightCircle size={12} /> {STATUS_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="card">
            <div className="detail-section-title">Add Comment</div>
            <div className="flex gap-sm">
              <textarea className="textarea" value={comment} onChange={e => setComment(e.target.value)} placeholder="Write a comment..." rows={2} style={{ minHeight: 60 }} />
              <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => comment.trim() && commentMutation.mutate(comment.trim())} disabled={!comment.trim() || commentMutation.isPending}>
                <Send size={14} />
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="card">
            <div className="detail-section-title">Activity Timeline</div>
            {events && events.length > 0 ? (
              <div className="timeline">
                {events.map((ev: any) => (
                  <div key={ev.id} className="timeline-item">
                    <div className={`timeline-dot event-${ev.eventType}`} />
                    <div className="timeline-content">
                      <div>{eventDescription(ev)}</div>
                      <div className="timeline-time">{relativeTime(ev.createdAt)}</div>
                      {ev.comment && <div className="timeline-comment">{ev.comment}</div>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted">No events yet</div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="detail-sidebar">
          {/* Assignee */}
          <div className="detail-section">
            <div className="detail-section-title">Assignees</div>
            {item.assignees && item.assignees.length > 0 ? (
              <div className="flex flex-col gap-sm">
                {item.assignees.map((a: any) => (
                  <div key={a.user.id} className="flex items-center gap-sm">
                    <div className="user-avatar">{a.user.name.split(' ').map((p: string) => p[0]).join('').slice(0, 2)}</div>
                    <div>
                      <div className="text-sm font-medium">{a.user.name}</div>
                      <div className="text-xs text-dimmed">{a.user.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted">Unassigned</div>
            )}
            <div className="flex flex-col gap-sm" style={{ marginTop: '0.75rem' }}>
              {!item.assignees?.some((a: any) => a.user.id === user.id) ? (
                <button className="btn btn-ghost btn-sm w-full" onClick={() => assignMutation.mutate({ assigneeIds: [...(item.assignees?.map((a: any) => a.user.id) || []), user.id] })} disabled={assignMutation.isPending}>
                  <UserPlus size={13} /> Claim
                </button>
              ) : (
                <button className="btn btn-ghost btn-sm w-full" onClick={() => assignMutation.mutate({ assigneeIds: item.assignees.map((a: any) => a.user.id).filter((id: string) => id !== user.id) })} disabled={assignMutation.isPending}>
                  Unclaim
                </button>
              )}
              {item.assignees && item.assignees.length > 0 && (
                <button className="btn btn-ghost btn-sm w-full" onClick={() => assignMutation.mutate({ assigneeIds: [] })} disabled={assignMutation.isPending}>
                  Clear All
                </button>
              )}
            </div>
            
            {/* Manager Assignment Dropdown */}
            {(user.teamMemberships?.some((m: any) => m.teamId === item.teamId && (m.role === 'manager' || m.role === 'admin'))) && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <div className="detail-section-title" style={{ marginBottom: '0.5rem' }}>Assign Others</div>
                <select 
                  className="select" 
                  value=""
                  onChange={(e) => {
                    const userId = e.target.value;
                    if (!userId) return;
                    const currentAssigneeIds = item.assignees?.map((a: any) => a.user.id) || [];
                    if (!currentAssigneeIds.includes(userId)) {
                      assignMutation.mutate({ assigneeIds: [...currentAssigneeIds, userId] });
                    }
                  }}
                  disabled={assignMutation.isPending}
                >
                  <option value="">Select team member...</option>
                  {teamMembers?.map((m: any) => (
                     // Only show users who aren't already assigned
                    !item.assignees?.some((a: any) => a.user.id === m.user.id) && (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.name} ({m.role})
                      </option>
                    )
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="detail-section">
            <div className="detail-section-title">Details</div>
            <div className="detail-field">
              <div className="detail-field-label">Created By</div>
              <div className="detail-field-value">{item.creator?.name || '—'}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Team</div>
              <div className="detail-field-value">{item.team?.name || '—'}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Type</div>
              <div className="detail-field-value">{TYPE_LABELS[item.type] || item.type}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Priority</div>
              <div className="detail-field-value"><span className={`badge badge-prio-${item.priority}`}>{PRIO_LABELS[item.priority]}</span></div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Due Date</div>
              <div className="detail-field-value">{formatDate(item.dueDate)}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Created</div>
              <div className="detail-field-value">{formatDate(item.createdAt)}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Updated</div>
              <div className="detail-field-value">{relativeTime(item.updatedAt)}</div>
            </div>
            <div className="detail-field">
              <div className="detail-field-label">Version</div>
              <div className="detail-field-value"><span className="version-badge">v{item.version}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
