import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ticket, Calendar, MapPin, QrCode, XCircle, ChevronRight, Sparkles } from 'lucide-react';
import { bookingApi } from '../services/api';
import type { Booking } from '../types';
import TicketSuccessModal from '../components/booking/TicketSuccessModal';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

export const MyBookingsPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { data: bookings, isLoading } = useQuery<Booking[]>({
    queryKey: ['my-bookings'],
    queryFn: () => bookingApi.getMyBookings().then((r) => r.data.data),
    enabled: isAuthenticated,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => bookingApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      setCancellingId(null);
    },
  });

  const handleCancelBooking = (bookingId: string) => {
    if (window.confirm('Are you sure you want to cancel this booking? Held seats will be released immediately.')) {
      setCancellingId(bookingId);
      cancelMutation.mutate(bookingId);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <Ticket size={48} className="mx-auto text-gray-600" />
        <h2 className="font-display font-bold text-2xl text-white">Sign In to View Bookings</h2>
        <p className="text-gray-400 text-sm">Please log in to your account to view your tickets.</p>
        <Link to="/login" className="btn-primary inline-flex">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="badge badge-movie mb-2">
            <Sparkles size={11} /> Customer Dashboard
          </span>
          <h1 className="font-display font-bold text-3xl text-white">My Bookings &amp; Tickets</h1>
          <p className="text-gray-400 text-sm mt-1">
            View your confirmed event tickets, access scannable QR codes, or manage reservations.
          </p>
        </div>
      </div>

      {/* Bookings List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card h-32 animate-pulse" />
          ))}
        </div>
      ) : !bookings || bookings.length === 0 ? (
        <div className="glass-card p-12 text-center space-y-4">
          <Ticket size={48} className="mx-auto text-gray-600 opacity-60" />
          <h3 className="font-display font-semibold text-lg text-white">No Bookings Yet</h3>
          <p className="text-gray-400 text-xs max-w-sm mx-auto">
            You have not booked any tickets yet. Explore trending movies and concerts now!
          </p>
          <Link to="/events" className="btn-primary inline-flex mt-2">
            Explore Events <ChevronRight size={14} />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => {
            const isCancelled = booking.status === 'CANCELLED';
            const seatList = booking.showSeats?.map((s) => s.seat.seatNumber).join(', ') || 'N/A';

            return (
              <div
                key={booking.id}
                className={`glass-card p-5 transition-all duration-300 border ${
                  isCancelled
                    ? 'opacity-60 border-red-500/20 bg-red-950/10'
                    : 'hover:border-brand-500/40 hover:shadow-xl hover:shadow-brand-950/50'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-sm text-brand-300">
                        {booking.bookingReference}
                      </span>
                      <span
                        className={`badge ${
                          isCancelled ? 'badge-booked' : 'badge-available'
                        }`}
                      >
                        {booking.status}
                      </span>
                    </div>

                    <h3 className="font-display font-semibold text-lg text-white">
                      {booking.show?.event?.title || 'Event Booking'}
                    </h3>

                    <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                      {booking.show?.venue && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} className="text-brand-400" />
                          {booking.show.venue.name}, {booking.show.venue.city}
                        </span>
                      )}

                      {booking.show?.startTime && (
                        <span className="flex items-center gap-1">
                          <Calendar size={12} className="text-brand-400" />
                          {new Date(booking.show.startTime).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      )}

                      <span className="flex items-center gap-1">
                        <Ticket size={12} className="text-brand-400" />
                        Seats: <span className="font-semibold text-gray-200">{seatList}</span>
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions & Price */}
                  <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-white/5">
                    <div className="text-right">
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total Paid</div>
                      <div className="font-mono text-base font-bold text-green-400">
                        ₹{Number(booking.totalAmount).toFixed(2)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isCancelled && (
                        <>
                          <button
                            type="button"
                            onClick={() => setSelectedBooking(booking)}
                            className="btn-primary py-1.5 px-3 text-xs"
                          >
                            <QrCode size={13} />
                            View QR Ticket
                          </button>
                          <button
                            type="button"
                            disabled={cancellingId === booking.id}
                            onClick={() => handleCancelBooking(booking.id)}
                            className="btn-ghost py-1.5 px-2.5 text-xs text-red-400 hover:text-red-300 hover:border-red-500/40"
                            title="Cancel Booking"
                          >
                            <XCircle size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ticket Modal */}
      {selectedBooking && (
        <TicketSuccessModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </div>
  );
};

export default MyBookingsPage;
