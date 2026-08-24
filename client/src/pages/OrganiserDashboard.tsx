import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Ticket,
  Users,
  DollarSign,
  Calendar,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  BarChart3,
} from 'lucide-react';
import { analyticsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

export const OrganiserDashboard: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['organiser-dashboard'],
    queryFn: () => analyticsApi.getDashboard().then((r) => r.data.data),
    enabled: isAuthenticated && (user?.role === 'ORGANISER' || user?.role === 'ADMIN'),
  });

  const { data: eventSummary, isLoading: isEventSummaryLoading } = useQuery({
    queryKey: ['event-summary', selectedEventId],
    queryFn: () => analyticsApi.getEventSummary(selectedEventId!).then((r) => r.data.data),
    enabled: !!selectedEventId,
  });

  if (!isAuthenticated || (user?.role !== 'ORGANISER' && user?.role !== 'ADMIN')) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <ShieldAlert size={48} className="mx-auto text-amber-400" />
        <h2 className="font-display font-bold text-2xl text-white">Organiser Access Required</h2>
        <p className="text-gray-400 text-xs">
          You must be logged in with an Organiser or Admin account to view the analytics dashboard.
        </p>
        <Link to="/login" className="btn-primary inline-flex">
          Sign In as Organiser
        </Link>
      </div>
    );
  }

  const overview = dashboardData?.overview;
  const events = dashboardData?.events || [];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="badge badge-movie mb-2">
            <Sparkles size={11} /> Real-Time Analytics
          </span>
          <h1 className="font-display font-bold text-3xl text-white">Organiser Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">
            Real-time occupancy tracking, category revenue breakdown, and FIFO waitlist depth.
          </p>
        </div>
      </div>

      {/* Top Level Metric Cards */}
      {isDashboardLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card h-28 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-5 space-y-2 border-brand-500/30">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Total Revenue</span>
              <div className="p-2 rounded-lg bg-green-500/10 text-green-400">
                <DollarSign size={16} />
              </div>
            </div>
            <div className="font-display font-bold text-2xl text-white">
              ₹{overview?.totalRevenue?.toLocaleString('en-IN') || 0}
            </div>
            <div className="text-[11px] text-green-400 flex items-center gap-1">
              <TrendingUp size={11} /> Confirmed bookings
            </div>
          </div>

          <div className="glass-card p-5 space-y-2">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Tickets Sold</span>
              <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400">
                <Ticket size={16} />
              </div>
            </div>
            <div className="font-display font-bold text-2xl text-white">
              {overview?.totalTicketsSold || 0}
              <span className="text-xs text-gray-500 font-normal ml-1">
                / {overview?.totalCapacity || 0} seats
              </span>
            </div>
            <div className="text-[11px] text-brand-300">
              Overall Occupancy: {overview?.overallOccupancyRate || 0}%
            </div>
          </div>

          <div className="glass-card p-5 space-y-2">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Active Holds</span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <BarChart3 size={16} />
              </div>
            </div>
            <div className="font-display font-bold text-2xl text-white">
              {overview?.activeHolds || 0}
            </div>
            <div className="text-[11px] text-amber-400">In checkout process</div>
          </div>

          <div className="glass-card p-5 space-y-2">
            <div className="flex items-center justify-between text-gray-400 text-xs">
              <span>Active Events</span>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <Users size={16} />
              </div>
            </div>
            <div className="font-display font-bold text-2xl text-white">
              {overview?.totalEvents || 0}
            </div>
            <div className="text-[11px] text-purple-400">Under management</div>
          </div>
        </div>
      )}

      {/* Events Breakdown Table */}
      <div className="space-y-4">
        <h2 className="font-display font-semibold text-xl text-white">Events Overview</h2>

        {events.length === 0 ? (
          <div className="glass-card p-8 text-center text-gray-500 text-xs">
            No events found under your account.
          </div>
        ) : (
          <div className="grid gap-4">
            {events.map((event: any) => {
              const isSelected = selectedEventId === event.id;
              return (
                <div
                  key={event.id}
                  className={`glass-card p-5 transition-all duration-200 border ${
                    isSelected
                      ? 'border-brand-500/60 bg-brand-950/20'
                      : 'hover:border-white/20'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`badge ${
                            event.type === 'MOVIE' ? 'badge-movie' : 'badge-concert'
                          }`}
                        >
                          {event.type}
                        </span>
                        <h3 className="font-display font-bold text-lg text-white">
                          {event.title}
                        </h3>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} className="text-brand-400" />
                          {event.showCount} Show(s)
                        </span>
                        <span>
                          Sold:{' '}
                          <strong className="text-white font-mono">
                            {event.ticketsSold} / {event.totalCapacity}
                          </strong>
                        </span>
                        <span>
                          Waitlist:{' '}
                          <strong className="text-amber-400 font-mono">
                            {event.waitlistDepth} in queue
                          </strong>
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full max-w-md bg-surface-700 h-2 rounded-full overflow-hidden mt-2">
                        <div
                          className="bg-gradient-to-r from-brand-500 to-green-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(event.occupancyRate, 100)}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {event.occupancyRate}% Occupied
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-end justify-between gap-3 border-t lg:border-t-0 pt-3 lg:pt-0 border-white/5">
                      <div className="text-right">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">
                          Revenue
                        </div>
                        <div className="font-mono text-lg font-bold text-green-400">
                          ₹{Number(event.revenue).toLocaleString('en-IN')}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setSelectedEventId(isSelected ? null : event.id)
                        }
                        className="btn-ghost py-1.5 px-3 text-xs"
                      >
                        {isSelected ? 'Hide Analytics' : 'View Deep Metrics'}
                        <ChevronRight size={13} className={isSelected ? 'rotate-90' : ''} />
                      </button>
                    </div>
                  </div>

                  {/* Deep Event Summary Dropdown */}
                  {isSelected && (
                    <div className="mt-6 pt-6 border-t border-white/10 space-y-6 animate-slide-up">
                      {isEventSummaryLoading ? (
                        <div className="h-32 glass-card animate-pulse" />
                      ) : eventSummary ? (
                        <div className="space-y-6">
                          {/* Category Revenue Breakdown */}
                          <div>
                            <h4 className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">
                              Tier Breakdown (Pricing &amp; Sales)
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {Object.entries(eventSummary.categoryBreakdown || {}).map(
                                ([cat, data]: [string, any]) => (
                                  <div
                                    key={cat}
                                    className="p-3.5 rounded-xl bg-surface-800 border border-white/5 space-y-2 text-xs"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="font-bold text-white uppercase">{cat}</span>
                                      <span className="font-mono text-green-400 font-bold">
                                        ₹{data.revenue?.toLocaleString('en-IN') || 0}
                                      </span>
                                    </div>
                                    <div className="text-gray-400 text-[11px] space-y-0.5">
                                      <div>Booked: {data.booked} / {data.total}</div>
                                      <div>Held: {data.held}</div>
                                      <div>Available: {data.available}</div>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </div>

                          {/* Shows list */}
                          <div>
                            <h4 className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">
                              Scheduled Shows
                            </h4>
                            <div className="space-y-2">
                              {eventSummary.shows?.map((s: any) => (
                                <div
                                  key={s.id}
                                  className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 text-xs"
                                >
                                  <div>
                                    <span className="font-semibold text-white">
                                      {s.venue?.name} ({s.venue?.city})
                                    </span>
                                    <span className="text-gray-400 ml-2">
                                      {new Date(s.startTime).toLocaleString('en-IN', {
                                        dateStyle: 'medium',
                                        timeStyle: 'short',
                                      })}
                                    </span>
                                  </div>
                                  <div className="font-mono text-gray-200">
                                    {s.bookedSeats} / {s.totalSeats} seats (₹
                                    {Number(s.revenue).toLocaleString('en-IN')})
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganiserDashboard;
