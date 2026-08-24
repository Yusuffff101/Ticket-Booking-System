import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Ticket, Film, Map, User, LogOut, Zap } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const Navbar: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className="sticky top-0 z-50 glass-card border-x-0 border-t-0 rounded-none px-4 md:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="p-1.5 rounded-lg bg-brand-600/20 border border-brand-500/30 group-hover:bg-brand-600/30 transition-all">
            <Ticket size={18} className="text-brand-400" />
          </div>
          <span className="font-display font-bold text-lg gradient-text">TicketVerse</span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1">
          <Link to="/events" className={`nav-link ${isActive('/events') ? 'active' : ''}`}>
            <Film size={15} />
            Events
          </Link>
          <Link to="/venues" className={`nav-link ${isActive('/venues') ? 'active' : ''}`}>
            <Map size={15} />
            Venues
          </Link>
          {isAuthenticated && (
            <Link to="/bookings" className={`nav-link ${isActive('/bookings') ? 'active' : ''}`}>
              <Ticket size={15} />
              My Bookings
            </Link>
          )}
          {user?.role === 'ORGANISER' && (
            <Link to="/organiser" className={`nav-link ${isActive('/organiser') ? 'active' : ''}`}>
              <Zap size={15} />
              Organiser
            </Link>
          )}
          {user?.role === 'ADMIN' && (
            <Link to="/admin" className={`nav-link ${isActive('/admin') ? 'active' : ''}`}>
              <Zap size={15} />
              Admin
            </Link>
          )}
        </div>

        {/* Auth */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10">
                <div className="w-6 h-6 rounded-full bg-brand-600/40 border border-brand-500/50 flex items-center justify-center">
                  <User size={12} className="text-brand-300" />
                </div>
                <span className="text-sm text-gray-300">{user?.name}</span>
                <span className="text-xs text-gray-500 ml-1 bg-surface-700 px-1.5 py-0.5 rounded-md">{user?.role}</span>
              </div>
              <button onClick={logout} className="btn-ghost py-2 px-3">
                <LogOut size={14} />
                <span className="hidden md:block">Logout</span>
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-primary py-2">
              <User size={14} />
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
