import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setAuthToken, queryClient } from '../api';
import { useMutation } from '@tanstack/react-query';
import { LogIn, Shield, User } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: (data) => {
      setAuthToken(data.accessToken);
      queryClient.setQueryData(['me'], data.user);
      navigate('/');
    },
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    loginMutation.mutate({ email, password });
  };

  const quickLogin = (userEmail: string) => {
    setEmail(userEmail);
    setPassword('password');
    loginMutation.mutate({ email: userEmail, password: 'password' });
  };

  return (
    <div className="login-container">
      <div className="login-bg-glow login-bg-glow-1" />
      <div className="login-bg-glow login-bg-glow-2" />
      
      <div className="login-card animate-in">
        <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
          <div className="brand-icon" style={{ width: 48, height: 48, fontSize: '1.25rem', margin: '0 auto 1rem', borderRadius: '0.75rem' }}>
            N
          </div>
        </div>
        <h1 className="login-title">OpsBoard</h1>
        <p className="login-subtitle">Sign in to your workspace</p>
        
        {error && (
          <div style={{ padding: '0.75rem', background: 'var(--accent-red-bg)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.8125rem', color: 'var(--accent-red)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input 
              type="email" 
              className="input" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              placeholder="you@newtonite.com"
              required 
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Password</label>
            <input 
              type="password" 
              className="input" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="••••••••"
              required 
            />
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.625rem 1rem', marginTop: '0.25rem' }} disabled={loginMutation.isPending}>
            {loginMutation.isPending ? (
              <><div className="spinner" style={{ width: 14, height: 14 }} /> Signing in...</>
            ) : (
              <><LogIn size={15} /> Sign In</>
            )}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.6875rem', marginBottom: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Quick Login</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button className="btn btn-ghost" onClick={() => quickLogin('admin@newtonite.com')}>
              <Shield size={13} /> Admin
            </button>
            <button className="btn btn-ghost" onClick={() => quickLogin('manager@newtonite.com')}>
              <Shield size={13} /> Manager
            </button>
            <button className="btn btn-ghost" onClick={() => quickLogin('user@newtonite.com')}>
              <User size={13} /> Thor
            </button>
            <button className="btn btn-ghost" onClick={() => quickLogin('newmember@newtonite.com')}>
              <User size={13} /> Loki
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
