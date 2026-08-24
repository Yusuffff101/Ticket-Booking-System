import React, { useState, useEffect } from 'react';
import { CreditCard, ShieldCheck, Clock, X, AlertCircle, Sparkles } from 'lucide-react';
import type { ShowSeat, Show, Booking } from '../../types';
import { bookingApi } from '../../services/api';

interface BookingCheckoutModalProps {
  show: Show;
  heldSeats: ShowSeat[];
  expiresAt: string | null;
  onClose: () => void;
  onSuccess: (booking: Booking) => void;
  onHoldExpired: () => void;
}

export const BookingCheckoutModal: React.FC<BookingCheckoutModalProps> = ({
  show,
  heldSeats,
  expiresAt,
  onClose,
  onSuccess,
  onHoldExpired,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'UPI' | 'NETBANKING'>('UPI');
  const [upiId, setUpiId] = useState('customer@okhdfcbank');
  const [cardNumber, setCardNumber] = useState('4242 •••• •••• 4242');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(600);

  useEffect(() => {
    if (!expiresAt) return;
    const calculateSeconds = () => {
      const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
      if (diff <= 0) {
        setSecondsLeft(0);
        onHoldExpired();
      } else {
        setSecondsLeft(diff);
      }
    };
    calculateSeconds();
    const interval = setInterval(calculateSeconds, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onHoldExpired]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerDisplay = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const totalAmount = heldSeats.reduce((sum, s) => sum + Number(s.price), 0);
  const convenienceFee = Math.round(totalAmount * 0.05);
  const grandTotal = totalAmount + convenienceFee;

  const handleConfirmPayment = async () => {
    setError(null);
    setIsProcessing(true);

    try {
      // Simulate 1s mock payment gateway latency
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const res = await bookingApi.create({
        showId: show.id,
        showSeatIds: heldSeats.map((s) => s.id),
      });

      const confirmedBooking: Booking = res.data.data.booking;
      onSuccess(confirmedBooking);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Payment confirmation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg glass-card border-brand-500/30 shadow-2xl shadow-brand-950/80 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
          <div className="space-y-1">
            <span className="badge badge-movie">
              <Sparkles size={11} /> Checkout &amp; Pay
            </span>
            <h2 className="font-display font-bold text-xl text-white">Confirm Booking</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Hold Expiry Countdown Banner */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-xs font-semibold">
          <span className="flex items-center gap-1.5">
            <Clock size={13} className="animate-pulse" />
            Seats reserved for:
          </span>
          <span className="font-mono text-sm tracking-wider font-bold">{timerDisplay}</span>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Show summary */}
          <div className="p-4 rounded-xl bg-surface-800 border border-white/5 space-y-2 text-xs">
            <div className="text-gray-400">Event</div>
            <div className="font-semibold text-white text-sm">{show.event?.title}</div>
            <div className="text-gray-400 pt-1">Venue &amp; Time</div>
            <div className="text-gray-300">
              {show.venue?.name}, {show.venue?.city} •{' '}
              {new Date(show.startTime).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </div>
          </div>

          {/* Seat breakdown */}
          <div className="space-y-2">
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
              Selected Seats ({heldSeats.length})
            </div>
            <div className="space-y-1.5">
              {heldSeats.map((hs) => (
                <div
                  key={hs.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-brand-300">{hs.seat.seatNumber}</span>
                    <span className="text-gray-500">({hs.seat.category})</span>
                  </div>
                  <span className="font-mono text-gray-200">₹{Number(hs.price).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <div className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
              Select Payment Method (Mock)
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'UPI', label: 'UPI / QR', icon: '📱' },
                { id: 'CARD', label: 'Card', icon: '💳' },
                { id: 'NETBANKING', label: 'NetBanking', icon: '🏦' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setPaymentMethod(m.id as any)}
                  className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                    paymentMethod === m.id
                      ? 'border-brand-500 bg-brand-600/20 text-white shadow-lg shadow-brand-900/30'
                      : 'border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="text-base">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>

            {paymentMethod === 'UPI' && (
              <div className="pt-2">
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="name@upi"
                  className="input text-xs"
                />
              </div>
            )}
            {paymentMethod === 'CARD' && (
              <div className="pt-2">
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="Card number"
                  className="input text-xs font-mono"
                />
              </div>
            )}
          </div>

          {/* Price Breakdown */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2 text-xs">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal</span>
              <span className="font-mono text-gray-200">₹{totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Convenience Fee &amp; Taxes (5%)</span>
              <span className="font-mono text-gray-200">₹{convenienceFee.toFixed(2)}</span>
            </div>
            <div className="border-t border-white/10 pt-2 flex justify-between text-sm font-bold text-white">
              <span>Total Payable</span>
              <span className="font-mono text-brand-400">₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-white/5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <ShieldCheck size={14} className="text-green-400" />
            <span>256-bit Secure</span>
          </div>

          <button
            type="button"
            disabled={isProcessing || secondsLeft <= 0}
            onClick={handleConfirmPayment}
            className="btn-primary flex-1 justify-center py-3 text-sm"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing Payment...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CreditCard size={15} />
                Pay ₹{grandTotal.toFixed(2)}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingCheckoutModal;
