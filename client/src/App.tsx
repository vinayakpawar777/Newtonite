import { useEffect } from 'react';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { queryClient, api, getAuthToken, clearAuthToken } from './api';
import { LayoutDashboard, ListTodo, LogOut } from 'lucide-react';
import DashboardPage from './pages/DashboardPage';
import WorkItemsPage from './pages/WorkItemsPage';
import WorkItemDetailPage from './pages/WorkItemDetailPage';
import LoginPage from './pages/LoginPage';

import { useSSE } from './hooks/useSSE';

function getInitials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = getAuthToken();
  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    enabled: !!token,
    retry: false
  });

  useSSE();

  useEffect(() => {
    if (!token || isError) {
      clearAuthToken();
      navigate('/login');
    }
  }, [token, isError, navigate]);

  if (isLoading) {
    return (
      <div className="loading-spinner" style={{ height: '100vh' }}>
        <div className="spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = () => {
    clearAuthToken();
    queryClient.clear();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <nav className="navbar">
        <div className="flex items-center gap-lg">
          <div className="navbar-brand">
            <div className="brand-icon">N</div>
            <span>OpsBoard</span>
          </div>
          <div className="navbar-links">
            <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <LayoutDashboard size={15} />
              Dashboard
            </NavLink>
            <NavLink to="/items" className={({ isActive }) => `nav-link ${isActive || location.pathname.startsWith('/items') ? 'active' : ''}`}>
              <ListTodo size={15} />
              Work Items
            </NavLink>
          </div>
        </div>
        <div className="navbar-right">
          <div className="user-pill">
            <div className="user-avatar">{getInitials(user.name)}</div>
            <span>{user.name}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            <LogOut size={14} />
          </button>
        </div>
      </nav>
      <div className="main-content">
        <Routes>
          <Route path="/" element={<DashboardPage user={user} />} />
          <Route path="/items" element={<WorkItemsPage user={user} />} />
          <Route path="/items/:id" element={<WorkItemDetailPage user={user} />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<AppLayout />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
