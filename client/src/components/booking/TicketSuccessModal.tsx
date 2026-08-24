import React from 'react';
import { CheckCircle, Download, X, Calendar, MapPin, Ticket } from 'lucide-react';
import type { Booking } from '../../types';

interface TicketSuccessModalProps {
  booking: Booking;
  onClose: () => void;
}

export const TicketSuccessModal: React.FC<TicketSuccessModalProps> = ({ booking, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md glass-card border-brand-500/40 shadow-2xl shadow-brand-900/60 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-green-600/20 via-brand-600/20 to-purple-600/20 border-b border-white/10 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={18} />
          </button>
          <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={24} className="text-green-400" />
          </div>
          <h2 className="font-display font-bold text-2xl text-white">Booking Confirmed!</h2>
          <p className="text-gray-400 text-xs mt-1">Your digital ticket is generated and ready.</p>
        </div>

        {/* Ticket Body */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Reference Badge */}
          <div className="text-center p-3 rounded-xl bg-surface-800 border border-white/10 space-y-1">
            <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
              Booking Reference
            </div>
            <div className="font-mono text-xl font-bold tracking-wider text-brand-300">
              {booking.bookingReference}
            </div>
          </div>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white text-gray-900 shadow-inner">
            {booking.qrCodeUrl ? (
              <img
                src={booking.qrCodeUrl}
                alt="Ticket QR Code"
                className="w-48 h-48 rounded-lg object-contain"
              />
            ) : (
              <div className="w-48 h-48 bg-gray-200 flex items-center justify-center rounded-lg text-xs text-gray-500">
                QR Ticket
              </div>
            )}
            <span className="text-[10px] text-gray-500 mt-2 font-medium tracking-wide">
              SCAN AT ENTRANCE GATE
            </span>
          </div>

          {/* Details */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-2.5 text-xs">
            {booking.show?.event && (
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-gray-400">Event</span>
                <span className="font-semibold text-white">{booking.show.event.title}</span>
              </div>
            )}

            {booking.show?.startTime && (
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-gray-400 flex items-center gap-1">
                  <Calendar size={12} className="text-brand-400" /> Show Time
                </span>
                <span className="text-gray-200">
                  {new Date(booking.show.startTime).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
            )}

            {booking.show?.venue && (
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-gray-400 flex items-center gap-1">
                  <MapPin size={12} className="text-brand-400" /> Venue
                </span>
                <span className="text-gray-200">
                  {booking.show.venue.name}, {booking.show.venue.city}
                </span>
              </div>
            )}

            {booking.showSeats && booking.showSeats.length > 0 && (
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-gray-400 flex items-center gap-1">
                  <Ticket size={12} className="text-brand-400" /> Seats
                </span>
                <span className="font-bold text-brand-300">
                  {booking.showSeats.map((s) => s.seat.seatNumber).join(', ')}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1 text-sm font-bold">
              <span className="text-gray-300">Total Paid</span>
              <span className="text-green-400 font-mono">₹{Number(booking.totalAmount).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="p-6 border-t border-white/10 bg-white/5 flex gap-3">
          <button
            onClick={handlePrint}
            className="btn-ghost flex-1 justify-center py-2.5 text-xs"
          >
            <Download size={14} /> Print / Save
          </button>
          <button
            onClick={onClose}
            className="btn-primary flex-1 justify-center py-2.5 text-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketSuccessModal;
