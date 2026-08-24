import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Film, Music, Search, MapPin, Calendar, Clock, ChevronRight, Sparkles } from 'lucide-react';
import { eventApi } from '../services/api';
import type { Event } from '../types';

const EventCard: React.FC<{ event: Event }> = ({ event }) => {
  const nextShow = event.shows?.[0];
  const isMovie = event.type === 'MOVIE';

  return (
    <Link to={`/events/${event.id}`} className="glass-card overflow-hidden group hover:border-brand-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-brand-900/20 block">
      {/* Banner */}
      <div className="relative h-44 overflow-hidden bg-gradient-to-br from-surface-700 to-surface-800">
        {event.bannerUrl ? (
          <img src={event.bannerUrl} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${isMovie ? 'bg-gradient-to-br from-blue-900/60 to-indigo-900/60' : 'bg-gradient-to-br from-purple-900/60 to-pink-900/60'}`}>
            {isMovie ? <Film size={48} className="text-white/20" /> : <Music size={48} className="text-white/20" />}
          </div>
        )}
        {/* Type badge */}
        <div className="absolute top-3 left-3">
          <span className={`badge ${isMovie ? 'badge-movie' : 'badge-concert'}`}>
            {isMovie ? <Film size={10} /> : <Music size={10} />}
            {event.type}
          </span>
        </div>
        {/* Duration */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1 text-xs text-white/70 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-lg">
          <Clock size={10} />
          {event.durationMinutes}m
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <h3 className="font-display font-semibold text-white text-sm leading-snug line-clamp-2 group-hover:text-brand-300 transition-colors">
          {event.title}
        </h3>

        {nextShow ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <MapPin size={11} className="text-brand-400" />
              {nextShow.venue?.name ?? 'Venue TBC'}, {nextShow.venue?.city}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Calendar size={11} className="text-brand-400" />
              {new Date(nextShow.startTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500">No upcoming shows</p>
        )}

        {/* Pricing pills */}
        {nextShow?.categoryPricingJson && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(nextShow.categoryPricingJson).map(([cat, price]) => (
              <span key={cat} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400">
                {cat.charAt(0)}{cat.slice(1).toLowerCase()} ₹{price}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-gray-500">by {event.organiser?.name}</span>
          <span className="flex items-center gap-1 text-xs text-brand-400 font-semibold">
            Book <ChevronRight size={12} />
          </span>
        </div>
      </div>
    </Link>
  );
};

const EventsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'ALL' | 'MOVIE' | 'CONCERT'>('ALL');

  const { data, isLoading } = useQuery({
    queryKey: ['events', { search, type }],
    queryFn: () =>
      eventApi.list({
        ...(search && { search }),
        ...(type !== 'ALL' && { type }),
      }).then((r) => r.data.data),
    placeholderData: (prev) => prev,
  });

  const events: Event[] = data?.events ?? [];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 space-y-8 animate-fade-in">
      {/* Hero header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-600/10 border border-brand-500/20 text-brand-400 text-xs font-semibold">
          <Sparkles size={12} />
          Discover Events
        </div>
        <h1 className="font-display font-bold text-4xl md:text-5xl gradient-text">
          Movies &amp; Concerts
        </h1>
        <p className="text-gray-400 text-base max-w-xl mx-auto">
          Find and book tickets for the best movies and live concerts near you, with real-time seat availability.
        </p>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            id="events-search"
            type="text"
            placeholder="Search events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9"
          />
        </div>
        {/* Type filter */}
        <div className="flex gap-2">
          {(['ALL', 'MOVIE', 'CONCERT'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-150 ${type === t ? 'bg-brand-600 border-brand-500 text-white' : 'border-white/10 text-gray-400 hover:text-white hover:border-brand-500/30'}`}
            >
              {t === 'ALL' ? 'All' : t === 'MOVIE' ? '🎬 Movies' : '🎵 Concerts'}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-card h-72 animate-pulse" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <Film size={48} className="mx-auto text-gray-600" />
          <p className="text-gray-400">No events found. Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
};

export default EventsPage;
