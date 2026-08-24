import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, Mail, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'CUSTOMER' });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register(form.name, form.email, form.password, form.role);
      }
      navigate('/events');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 animate-slide-up">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-600/20 border border-brand-500/30">
            <Ticket size={24} className="text-brand-400" />
          </div>
          <h1 className="font-display font-bold text-2xl gradient-text">TicketVerse</h1>
          <p className="text-gray-500 text-sm">
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        {/* Toggle */}
        <div className="glass-card p-1 flex">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${mode === m ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {mode === 'register' && (
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium" htmlFor="auth-name">Full Name</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input id="auth-name" type="text" required className="input pl-9" placeholder="Your name"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium" htmlFor="auth-email">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input id="auth-email" type="email" required className="input pl-9" placeholder="you@example.com"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-gray-400 font-medium" htmlFor="auth-password">Password</label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input id="auth-password" type={showPwd ? 'text' : 'password'} required className="input pl-9 pr-9"
                placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium" htmlFor="auth-role">Account Type</label>
              <select id="auth-role" className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="CUSTOMER">Customer</option>
                <option value="ORGANISER">Organiser</option>
              </select>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
            {loading ? <span className="animate-spin">⚙</span> : null}
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-brand-400 hover:text-brand-300 font-semibold">
            {mode === 'login' ? 'Register' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
