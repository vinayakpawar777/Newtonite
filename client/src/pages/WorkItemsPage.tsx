import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Plus, Filter, X } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

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

function relativeTime(date: string | Date | number) {
  const d = new Date(typeof date === 'number' ? date * 1000 : date);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function WorkItemsPage({ user }: { user: any }) {
  const [searchParams] = useSearchParams();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || '');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    // If the URL changes, update the status filter
    const statusParam = searchParams.get('status');
    if (statusParam !== null) {
      setStatusFilter(statusParam);
    }
  }, [searchParams]);

  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: api.getTeams });

  useEffect(() => {
    if (teams?.length && !selectedTeamId) setSelectedTeamId(teams[0].id);
  }, [teams, selectedTeamId]);

  const filters = useMemo(() => ({
    status: statusFilter,
    priority: priorityFilter,
    type: typeFilter,
    search: searchQuery,
  }), [statusFilter, priorityFilter, typeFilter, searchQuery]);

  const { data: workItemsData, isLoading } = useQuery({
    queryKey: ['workItems', selectedTeamId, filters],
    queryFn: () => api.getWorkItems(selectedTeamId!, filters),
    enabled: !!selectedTeamId,
  });

  const items = workItemsData?.items || [];
  const hasActiveFilters = statusFilter || priorityFilter || typeFilter || searchQuery;

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Work Items</h1>
          <p className="page-subtitle">{items.length} items in {teams?.find((t: any) => t.id === selectedTeamId)?.name || '...'}</p>
        </div>
        <div className="flex gap-sm">
          <select className="select" style={{ width: 180 }} value={selectedTeamId || ''} onChange={e => setSelectedTeamId(e.target.value)}>
            {teams?.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={15} /> New Item
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-box">
          <Search size={15} className="search-icon" />
          <input className="input" placeholder="Search by title or description..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>

        <select className="select" style={{ width: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select className="select" style={{ width: 130 }} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
          <option value="">All Priority</option>
          {Object.entries(PRIO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        <select className="select" style={{ width: 140 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        {hasActiveFilters && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setStatusFilter(''); setPriorityFilter(''); setTypeFilter(''); setSearchQuery(''); }}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Item List */}
      {isLoading ? (
        <div className="loading-spinner"><div className="spinner" /><span>Loading...</span></div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">{hasActiveFilters ? 'No matching items' : 'No work items yet'}</div>
          <div className="empty-state-text">{hasActiveFilters ? 'Try adjusting your filters' : 'Create your first work item to get started'}</div>
        </div>
      ) : (
        <div className="item-list">
          {items.map((item: any) => (
            <div key={item.id} className="item-row" onClick={() => navigate(`/items/${item.id}`)}>
              <div className="item-row-info">
                <span className="item-row-title">{item.title}</span>
                <div className="item-row-meta">
                  <span className={`badge badge-prio-${item.priority}`}>{PRIO_LABELS[item.priority]}</span>
                  <span className="dot" />
                  <span className="badge badge-type">{TYPE_LABELS[item.type] || item.type}</span>
                  <span className="dot" />
                  <span>{relativeTime(item.updatedAt)}</span>
                </div>
              </div>
              <div className="item-row-assignee">
                {item.assignees && item.assignees.length > 0 ? (
                  item.assignees.map((a: any) => (
                    <div key={a.user.id} className="user-avatar" title={a.user.name} style={{ width: 22, height: 22, fontSize: '0.5625rem', marginLeft: -4 }}>
                      {a.user.name.split(' ').map((p: string) => p[0]).join('').slice(0, 2)}
                    </div>
                  ))
                ) : (
                  <span className="text-dimmed">Unassigned</span>
                )}
              </div>
              <span className={`badge badge-status-${item.status}`}>{STATUS_LABELS[item.status]}</span>
              <span className="version-badge">v{item.version}</span>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && selectedTeamId && (
        <CreateWorkItemModal teamId={selectedTeamId} onClose={() => setShowCreateModal(false)} onCreated={() => {
          setShowCreateModal(false);
          queryClient.invalidateQueries({ queryKey: ['workItems', selectedTeamId] });
        }} />
      )}
    </div>
  );
}

function CreateWorkItemModal({ teamId, onClose, onCreated }: { teamId: string; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('task');
  const [priority, setPriority] = useState('medium');

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createWorkItem(data, uuidv4()),
    onSuccess: onCreated,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ title, description, type, priority, teamId });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Create Work Item</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief description of the issue" required />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="textarea" value={description} onChange={e => setDescription(e.target.value)} placeholder="Detailed description, context, and impact..." />
          </div>
          <div className="flex gap-md">
            <div className="form-group flex-1">
              <label className="form-label">Type</label>
              <select className="select" value={type} onChange={e => setType(e.target.value)}>
                <option value="task">Task</option>
                <option value="bug">Bug</option>
                <option value="incident">Incident</option>
                <option value="investigation">Investigation</option>
                <option value="approval">Approval</option>
                <option value="compliance">Compliance</option>
              </select>
            </div>
            <div className="form-group flex-1">
              <label className="form-label">Priority</label>
              <select className="select" value={priority} onChange={e => setPriority(e.target.value)}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {createMutation.isError && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--accent-red)' }}>{(createMutation.error as Error).message}</div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
