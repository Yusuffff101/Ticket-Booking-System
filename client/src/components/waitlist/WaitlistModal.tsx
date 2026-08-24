import React, { useState } from 'react';
import { Users, X, AlertCircle, Sparkles } from 'lucide-react';
import { waitlistApi } from '../../services/api';
import type { Show } from '../../types';

interface WaitlistModalProps {
  show: Show;
  onClose: () => void;
  onSuccess: (position: number, category: string) => void;
}

export const WaitlistModal: React.FC<WaitlistModalProps> = ({ show, onClose, onSuccess }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('PREMIUM');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = Object.keys(show.categoryPricingJson || { PREMIUM: 0, STANDARD: 0, ECONOMY: 0 });

  const handleJoin = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await waitlistApi.join(show.id, selectedCategory);
      onSuccess(res.data.data.position, selectedCategory);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to join waitlist');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md glass-card border-brand-500/30 shadow-2xl shadow-brand-950/80 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
          <div className="space-y-1">
            <span className="badge badge-concert">
              <Sparkles size={11} /> FIFO Queue
            </span>
            <h2 className="font-display font-bold text-xl text-white">Join Waitlist</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
              <AlertCircle size={14} className="flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-xs text-gray-400 leading-relaxed">
            When booked tickets in your selected tier are cancelled, our FIFO engine will automatically reserve the freed seat for you and email a time-limited claim link.
          </div>

          {/* Show info */}
          <div className="p-3.5 rounded-xl bg-surface-800 border border-white/5 space-y-1 text-xs">
            <div className="font-semibold text-white">{show.event?.title}</div>
            <div className="text-gray-400">
              {show.venue?.name}, {show.venue?.city} •{' '}
              {new Date(show.startTime).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </div>
          </div>

          {/* Category selection */}
          <div className="space-y-2">
            <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
              Select Seat Tier
            </label>
            <div className="grid grid-cols-3 gap-2">
              {categories.map((cat) => {
                const price = show.categoryPricingJson?.[cat] || 0;
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-600/20 text-white shadow-lg shadow-brand-900/30'
                        : 'border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="capitalize">{cat.toLowerCase()}</span>
                    <span className="font-mono text-gray-300">₹{price}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-white/5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost flex-1 justify-center py-2.5 text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleJoin}
            className="btn-primary flex-1 justify-center py-2.5 text-xs"
          >
            {isSubmitting ? (
              'Joining Queue...'
            ) : (
              <span className="flex items-center gap-1.5">
                <Users size={14} /> Join Queue
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WaitlistModal;
