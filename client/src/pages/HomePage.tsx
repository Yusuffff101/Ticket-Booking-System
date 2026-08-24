import React from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Film, Music, Zap, Shield, Users, ChevronRight, Star } from 'lucide-react';

const FEATURES = [
  { icon: Ticket, title: 'Instant Booking', desc: 'Reserve seats in seconds with real-time availability' },
  { icon: Zap, title: 'Live Seat Maps', desc: 'Visual interactive grids updated live via WebSockets' },
  { icon: Shield, title: 'Concurrency Safe', desc: 'Zero double-bookings with distributed Redis locks' },
  { icon: Users, title: 'Waitlist Queue', desc: 'Auto-assigned cancelled seats via FIFO waitlist' },
];

const HomePage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 animate-fade-in">
      {/* Hero */}
      <section className="py-20 md:py-28 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-600/10 border border-brand-500/20 text-brand-400 text-sm font-semibold">
          <Star size={13} className="fill-brand-400" />
          Real-time ticket booking platform
        </div>
        <h1 className="font-display font-extrabold text-5xl md:text-7xl text-white leading-tight">
          Book Your Perfect <br />
          <span className="gradient-text">Seat Live</span>
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto">
          Movies, concerts and events — with real-time interactive seat maps, instant hold confirmations, and QR-code tickets delivered to your inbox.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
          <Link to="/events" className="btn-primary text-base px-8 py-3">
            <Film size={18} />
            Browse Events
            <ChevronRight size={16} />
          </Link>
          <Link to="/events?type=CONCERT" className="btn-ghost text-base px-8 py-3">
            <Music size={18} />
            Concerts
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="pb-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass-card p-6 space-y-3 hover:border-brand-500/30 transition-all duration-300 hover:-translate-y-1">
              <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center">
                <Icon size={18} className="text-brand-400" />
              </div>
              <h3 className="font-semibold text-white text-sm">{title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
