import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Film,
  Music,
  Clock,
  MapPin,
  Calendar,
  ArrowLeft,
  Ticket,
  AlertCircle,
  Lock,
  Unlock,
  CreditCard,
} from 'lucide-react';
import { eventApi, showApi } from '../services/api';
import type { Show, ShowSeat, SeatMap as SeatMapData, Booking } from '../types';
import SeatMap from '../components/seatmap/SeatMap';
import BookingCheckoutModal from '../components/booking/BookingCheckoutModal';
import TicketSuccessModal from '../components/booking/TicketSuccessModal';
import WaitlistModal from '../components/waitlist/WaitlistModal';
import { useAuth } from '../contexts/AuthContext';

const EventDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const [selectedShowId, setSelectedShowId] = useState<string | null>(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [isHolding, setIsHolding] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [waitlistSuccessMsg, setWaitlistSuccessMsg] = useState<string | null>(null);

  // Active Hold State
  const [heldSeats, setHeldSeats] = useState<ShowSeat[]>([]);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [holdSecondsLeft, setHoldSecondsLeft] = useState<number>(0);

  // Modals
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventApi.getById(id!).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: seatMapData, isLoading: seatMapLoading } = useQuery({
    queryKey: ['seatmap', selectedShowId],
    queryFn: () => showApi.getSeatMap(selectedShowId!).then((r) => r.data.data as SeatMapData),
    enabled: !!selectedShowId,
  });

  // Hold Timer countdown
  useEffect(() => {
    if (!holdExpiresAt) {
      setHoldSecondsLeft(0);
      return;
    }
    const updateTimer = () => {
      const remaining = Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000);
      if (remaining <= 0) {
        setHoldSecondsLeft(0);
        handleHoldExpired();
      } else {
        setHoldSecondsLeft(remaining);
      }
    };
    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [holdExpiresAt]);

  const handleHoldExpired = () => {
    setHeldSeats([]);
    setHoldExpiresAt(null);
    setSelectedSeatIds([]);
    setShowCheckoutModal(false);
    setHoldError('Seat hold expired. Please re-select your seats.');
    queryClient.invalidateQueries({ queryKey: ['seatmap', selectedShowId] });
  };

  const handleSeatClick = (ss: ShowSeat) => {
    setHoldError(null);
    if (ss.status === 'AVAILABLE') {
      setSelectedSeatIds((prev) =>
        prev.includes(ss.id) ? prev.filter((id) => id !== ss.id) : [...prev, ss.id]
      );
    }
  };

  // ── Hold Selected Seats ──────────────────────────────────────────────────
  const handleHoldSeats = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!selectedShowId || selectedSeatIds.length === 0) return;

    setHoldError(null);
    setIsHolding(true);

    try {
      const res = await showApi.holdSeats(selectedShowId, selectedSeatIds);
      const { heldSeats: newlyHeld, expiresAt } = res.data.data;

      // Find full ShowSeat objects from seatMapData
      const allSeats = seatMapData?.seats || [];
      const matchedSeats = allSeats.filter((s) => selectedSeatIds.includes(s.id));

      setHeldSeats(matchedSeats.length > 0 ? matchedSeats : (newlyHeld as ShowSeat[]));
      setHoldExpiresAt(expiresAt);
      queryClient.invalidateQueries({ queryKey: ['seatmap', selectedShowId] });
    } catch (err: any) {
      setHoldError(err.response?.data?.error || err.message || 'Failed to hold seats. They may have just been taken.');
      queryClient.invalidateQueries({ queryKey: ['seatmap', selectedShowId] });
    } finally {
      setIsHolding(false);
    }
  };

  // ── Release Held Seats ────────────────────────────────────────────────────
  const handleReleaseSeats = async () => {
    if (!selectedShowId || heldSeats.length === 0) return;
    setIsReleasing(true);
    try {
      await showApi.releaseSeats(
        selectedShowId,
        heldSeats.map((s) => s.id)
      );
      setHeldSeats([]);
      setHoldExpiresAt(null);
      setSelectedSeatIds([]);
      queryClient.invalidateQueries({ queryKey: ['seatmap', selectedShowId] });
    } catch (err: any) {
      console.error('Release failed:', err);
    } finally {
      setIsReleasing(false);
    }
  };

  // ── Booking Success ───────────────────────────────────────────────────────
  const handleBookingSuccess = (booking: Booking) => {
    setShowCheckoutModal(false);
    setHeldSeats([]);
    setHoldExpiresAt(null);
    setSelectedSeatIds([]);
    setConfirmedBooking(booking);
    queryClient.invalidateQueries({ queryKey: ['seatmap', selectedShowId] });
    queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
  };

  if (eventLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 space-y-6 animate-pulse">
        <div className="h-64 glass-card rounded-2xl" />
        <div className="h-10 glass-card rounded-xl w-2/3" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <AlertCircle size={48} className="mx-auto text-red-400 mb-3" />
        <p className="text-gray-400">Event not found.</p>
        <Link to="/events" className="btn-primary mt-6 inline-flex">
          Back to Events
        </Link>
      </div>
    );
  }

  const isMovie = event.type === 'MOVIE';
  const shows: Show[] = event.shows ?? [];
  const activeShow = shows.find((s) => s.id === selectedShowId);

  // Selected seats price calculation
  const selectedSeatsList = (seatMapData?.seats || []).filter((s) =>
    selectedSeatIds.includes(s.id)
  );
  const selectedTotal = selectedSeatsList.reduce((sum, s) => sum + Number(s.price), 0);

  const minutesLeft = Math.floor(holdSecondsLeft / 60);
  const secondsRemainder = holdSecondsLeft % 60;
  const holdTimerFormatted = `${minutesLeft.toString().padStart(2, '0')}:${secondsRemainder
    .toString()
    .padStart(2, '0')}`;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 space-y-8 animate-fade-in">
      {/* Back button */}
      <Link to="/events" className="btn-ghost inline-flex w-auto">
        <ArrowLeft size={15} /> Back to Events
      </Link>

      {/* Hero section */}
      <div className="glass-card overflow-hidden">
        <div className="relative h-56 md:h-72 bg-gradient-to-br from-surface-700 to-surface-800">
          {event.bannerUrl ? (
            <img
              src={event.bannerUrl}
              alt={event.title}
              className="w-full h-full object-cover opacity-50"
            />
          ) : (
            <div
              className={`w-full h-full flex items-center justify-center ${
                isMovie
                  ? 'bg-gradient-to-br from-blue-900/60 to-indigo-900/40'
                  : 'bg-gradient-to-br from-purple-900/60 to-pink-900/40'
              }`}
            >
              {isMovie ? (
                <Film size={80} className="text-white/10" />
              ) : (
                <Music size={80} className="text-white/10" />
              )}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface-900 via-surface-900/60 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 space-y-2">
            <span className={`badge ${isMovie ? 'badge-movie' : 'badge-concert'}`}>
              {isMovie ? <Film size={10} /> : <Music size={10} />} {event.type}
            </span>
            <h1 className="font-display font-bold text-2xl md:text-3xl text-white text-shadow">
              {event.title}
            </h1>
            <div className="flex flex-wrap gap-4 text-sm text-gray-300">
              <span className="flex items-center gap-1.5">
                <Clock size={13} className="text-brand-400" /> {event.durationMinutes} min
              </span>
              <span className="flex items-center gap-1.5">by {event.organiser?.name}</span>
            </div>
          </div>
        </div>
        <div className="p-6">
          <p className="text-gray-400 text-sm leading-relaxed">{event.description}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Shows list */}
        <div className="space-y-4">
          <h2 className="font-display font-semibold text-lg text-white">Select a Show</h2>
          {shows.length === 0 ? (
            <div className="glass-card p-6 text-center text-gray-500 text-sm">
              No shows scheduled.
            </div>
          ) : (
            <div className="space-y-3">
              {shows.map((show) => {
                const isSelected = selectedShowId === show.id;
                return (
                  <button
                    key={show.id}
                    onClick={() => {
                      if (heldSeats.length > 0) {
                        if (
                          !window.confirm(
                            'Switching shows will release your currently held seats. Continue?'
                          )
                        ) {
                          return;
                        }
                        handleReleaseSeats();
                      }
                      setSelectedShowId(show.id);
                      setSelectedSeatIds([]);
                      setHoldError(null);
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                      isSelected
                        ? 'border-brand-500/60 bg-brand-600/10 shadow-lg shadow-brand-900/20'
                        : 'glass-card hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin size={12} className="text-brand-400" />
                      <span className="text-sm font-medium text-gray-200">
                        {show.venue?.name}
                      </span>
                      <span className="text-xs text-gray-500">{show.venue?.city}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-brand-400" />
                      <span className="text-xs text-gray-400">
                        {new Date(show.startTime).toLocaleString('en-IN', {
                          dateStyle: 'long',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    {show.categoryPricingJson && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {Object.entries(show.categoryPricingJson).map(([cat, price]) => (
                          <span
                            key={cat}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400"
                          >
                            {cat} ₹{price}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Seat Map panel */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-lg text-white">Live Seat Map</h2>

            <div className="flex items-center gap-2">
              {/* Join Waitlist button */}
              {selectedShowId && activeShow && (
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) {
                      navigate('/login');
                      return;
                    }
                    setShowWaitlistModal(true);
                  }}
                  className="btn-ghost py-1.5 px-3 text-xs text-amber-400 hover:text-amber-300 hover:border-amber-500/40"
                >
                  Join Waitlist
                </button>
              )}

              {/* Selection actions */}
              {selectedSeatIds.length > 0 && heldSeats.length === 0 && (
                <div className="flex items-center gap-3 animate-fade-in">
                  <span className="text-xs text-brand-300 font-mono">
                    {selectedSeatIds.length} seat(s) • ₹{selectedTotal}
                  </span>
                  <button
                    type="button"
                    disabled={isHolding}
                    onClick={handleHoldSeats}
                    className="btn-primary py-2 px-3 text-xs"
                  >
                    <Lock size={12} />
                    {isHolding ? 'Locking...' : 'Hold Seats (10m)'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Waitlist Success Banner */}
          {waitlistSuccessMsg && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between animate-fade-in">
              <span>{waitlistSuccessMsg}</span>
              <button
                type="button"
                onClick={() => setWaitlistSuccessMsg(null)}
                className="text-amber-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {/* Active Hold Status Banner */}
          {heldSeats.length > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-brand-500/10 to-green-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 animate-slide-up">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Lock size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Seats Held ({heldSeats.length}):</span>
                    <span className="text-brand-300 font-mono">
                      {heldSeats.map((s) => s.seat.seatNumber).join(', ')}
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-400/90 flex items-center gap-1 mt-0.5">
                    <Clock size={11} className="animate-pulse" />
                    Expires in <span className="font-mono font-bold">{holdTimerFormatted}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={isReleasing}
                  onClick={handleReleaseSeats}
                  className="btn-ghost py-2 px-3 text-xs text-gray-400 hover:text-white"
                >
                  <Unlock size={12} />
                  Release
                </button>
                <button
                  type="button"
                  onClick={() => setShowCheckoutModal(true)}
                  className="btn-primary py-2 px-4 text-xs shadow-lg shadow-brand-900/50"
                >
                  <CreditCard size={13} />
                  Checkout &amp; Pay (₹{selectedTotal})
                </button>
              </div>
            </div>
          )}

          {/* Hold / Selection Error */}
          {holdError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs animate-fade-in">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{holdError}</span>
            </div>
          )}

          {!selectedShowId ? (
            <div className="glass-card p-10 text-center text-gray-500 space-y-3">
              <Ticket size={40} className="mx-auto opacity-30" />
              <p className="text-sm">Select a show from the left to view the real-time seat map.</p>
            </div>
          ) : seatMapLoading ? (
            <div className="glass-card p-6 animate-pulse h-64" />
          ) : seatMapData ? (
            <div className="glass-card p-5">
              <SeatMap
                showId={selectedShowId}
                initialSeats={seatMapData.seats}
                seatsByRow={seatMapData.seatsByRow}
                categoryPricing={seatMapData.show.categoryPricingJson}
                selectedSeatIds={selectedSeatIds}
                onSeatClick={handleSeatClick}
                currentUserId={user?.id}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && activeShow && (
        <BookingCheckoutModal
          show={activeShow}
          heldSeats={heldSeats}
          expiresAt={holdExpiresAt}
          onClose={() => setShowCheckoutModal(false)}
          onSuccess={handleBookingSuccess}
          onHoldExpired={handleHoldExpired}
        />
      )}

      {/* Waitlist Modal */}
      {showWaitlistModal && activeShow && (
        <WaitlistModal
          show={activeShow}
          onClose={() => setShowWaitlistModal(false)}
          onSuccess={(position, category) => {
            setShowWaitlistModal(false);
            setWaitlistSuccessMsg(
              `You joined the ${category} waitlist at queue position #${position}! We will email you automatically if a seat opens up.`
            );
          }}
        />
      )}

      {/* Ticket Confirmation Modal */}
      {confirmedBooking && (
        <TicketSuccessModal
          booking={confirmedBooking}
          onClose={() => setConfirmedBooking(null)}
        />
      )}
    </div>
  );
};

export default EventDetailPage;
