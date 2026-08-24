import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, Calendar, MapPin, CheckCircle, AlertCircle, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { waitlistApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import TicketSuccessModal from '../components/booking/TicketSuccessModal';
import type { Booking } from '../types';

export const ClaimOfferPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  const { data: offerData, isLoading, error } = useQuery({
    queryKey: ['waitlist-offer', token],
    queryFn: () => waitlistApi.getOffer(token!).then((r) => r.data.data.offer),
    enabled: !!token,
  });

  useEffect(() => {
    if (!offerData?.expiresAt) return;
    const calculateSeconds = () => {
      const diff = Math.floor((new Date(offerData.expiresAt).getTime() - Date.now()) / 1000);
      if (diff <= 0) {
        setSecondsLeft(0);
      } else {
        setSecondsLeft(diff);
      }
    };
    calculateSeconds();
    const timer = setInterval(calculateSeconds, 1000);
    return () => clearInterval(timer);
  }, [offerData]);

  const handleClaim = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!token) return;

    setClaimError(null);
    setIsClaiming(true);

    try {
      const res = await waitlistApi.acceptOffer(token);
      setConfirmedBooking(res.data.data.booking);
    } catch (err: any) {
      setClaimError(err.response?.data?.error || err.message || 'Failed to claim offer');
    } finally {
      setIsClaiming(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 animate-pulse space-y-4">
        <div className="h-64 glass-card rounded-2xl" />
      </div>
    );
  }

  if (error || !offerData) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <AlertCircle size={48} className="mx-auto text-red-400" />
        <h2 className="font-display font-bold text-2xl text-white">Offer Not Found</h2>
        <p className="text-gray-400 text-xs">
          This waitlist offer link is invalid or has already been fulfilled.
        </p>
        <Link to="/events" className="btn-primary inline-flex mt-4">
          Browse Events
        </Link>
      </div>
    );
  }

  const isExpired = offerData.status === 'EXPIRED' || secondsLeft <= 0;
  const isAccepted = offerData.status === 'ACCEPTED';
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="max-w-xl mx-auto px-4 py-12 animate-fade-in">
      <div className="glass-card border-brand-500/40 shadow-2xl shadow-brand-950/80 overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-amber-600/20 via-brand-600/20 to-purple-600/20 border-b border-white/10 text-center relative">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
            <Sparkles size={12} /> Waitlist Auto-Allocation
          </div>
          <h1 className="font-display font-bold text-2xl text-white">Exclusive Ticket Offer</h1>
          <p className="text-gray-400 text-xs mt-1">
            A previously booked seat has opened up and been reserved exclusively for you!
          </p>
        </div>

        {/* Timer Banner */}
        {!isAccepted && (
          <div
            className={`flex items-center justify-between px-6 py-3 border-b text-xs font-semibold ${
              isExpired
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Clock size={13} className={isExpired ? '' : 'animate-pulse'} />
              {isExpired ? 'Offer Status' : 'Time Remaining to Claim:'}
            </span>
            <span className="font-mono text-sm tracking-wider font-bold">
              {isExpired ? 'EXPIRED' : timerFormatted}
            </span>
          </div>
        )}

        {/* Body */}
        <div className="p-6 space-y-6">
          {claimError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{claimError}</span>
            </div>
          )}

          {/* Event Card */}
          <div className="p-4 rounded-xl bg-surface-800 border border-white/5 space-y-3 text-xs">
            <div>
              <div className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">Event</div>
              <div className="font-display font-bold text-base text-white mt-0.5">
                {offerData.show.event.title}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5">
              <div>
                <div className="text-gray-500 flex items-center gap-1">
                  <Calendar size={11} className="text-brand-400" /> Show Time
                </div>
                <div className="text-gray-200 mt-0.5">
                  {new Date(offerData.show.startTime).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </div>
              </div>

              <div>
                <div className="text-gray-500 flex items-center gap-1">
                  <MapPin size={11} className="text-brand-400" /> Venue
                </div>
                <div className="text-gray-200 mt-0.5">
                  {offerData.show.venue.name}, {offerData.show.venue.city}
                </div>
              </div>
            </div>
          </div>

          {/* Allocated Seat Details */}
          <div className="p-4 rounded-xl bg-brand-950/40 border border-brand-500/20 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-brand-400 uppercase tracking-wider font-semibold">
                Offered Seat
              </div>
              <div className="font-display font-bold text-xl text-white mt-0.5">
                {offerData.seat.seatNumber}{' '}
                <span className="text-xs text-gray-400 font-normal">({offerData.seat.category})</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Price</div>
              <div className="font-mono text-xl font-bold text-green-400">
                ₹{Number(offerData.price).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Claim Action */}
          <div>
            {isAccepted ? (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-center text-xs">
                <CheckCircle size={20} className="mx-auto mb-1" />
                You have already claimed this offer and your tickets are confirmed.
              </div>
            ) : isExpired ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-center text-xs">
                <AlertCircle size={20} className="mx-auto mb-1" />
                This offer has expired and has been reallocated to the next person in line.
              </div>
            ) : (
              <button
                type="button"
                disabled={isClaiming}
                onClick={handleClaim}
                className="btn-primary w-full justify-center py-3.5 text-sm shadow-xl shadow-brand-950/60"
              >
                {isClaiming ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Claiming Ticket...
                  </span>
                ) : (
                  <span className="flex items-center gap-2 font-bold">
                    Claim &amp; Book Seat Now (₹{Number(offerData.price).toFixed(2)}) <ArrowRight size={15} />
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 text-[11px] text-gray-500">
            <ShieldCheck size={13} className="text-green-500" />
            <span>Instant booking confirmation with digital QR ticket</span>
          </div>
        </div>
      </div>

      {/* Ticket Success Modal */}
      {confirmedBooking && (
        <TicketSuccessModal
          booking={confirmedBooking}
          onClose={() => {
            setConfirmedBooking(null);
            navigate('/bookings');
          }}
        />
      )}
    </div>
  );
};

export default ClaimOfferPage;
