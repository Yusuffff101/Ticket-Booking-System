import React, { useState, useEffect } from 'react';
import type { ShowSeat, SeatStatusUpdate } from '../../types';
import { useSocket } from '../../contexts/SocketContext';
import { Wifi, WifiOff } from 'lucide-react';

interface SeatMapProps {
  showId: string;
  initialSeats?: ShowSeat[];
  seatsByRow: Record<string, ShowSeat[]>;
  categoryPricing: Record<string, number>;
  selectedSeatIds: string[];
  onSeatClick: (showSeat: ShowSeat) => void;
  currentUserId?: string;
}

const CATEGORY_COLORS: Record<string, { dot: string; label: string; bg: string }> = {
  PREMIUM: { dot: 'bg-purple-500', label: 'Premium', bg: 'bg-purple-500/10 border-purple-500/30 text-purple-400' },
  STANDARD: { dot: 'bg-blue-500', label: 'Standard', bg: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
  ECONOMY: { dot: 'bg-emerald-500', label: 'Economy', bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
};

const SeatNode: React.FC<{
  showSeat: ShowSeat;
  isSelected: boolean;
  onClick: () => void;
  currentUserId?: string;
}> = ({ showSeat, isSelected, onClick, currentUserId }) => {
  const { status, seat, heldById } = showSeat;
  const isHeldByMe = heldById === currentUserId;

  let cls = 'seat-node w-8 h-6 ';
  let title = `${seat.seatNumber} — ${seat.category}`;

  if (isSelected) {
    cls += 'seat-selected';
    title += ' (Selected)';
  } else if (status === 'AVAILABLE') {
    cls += 'seat-available';
  } else if (status === 'HELD') {
    cls += isHeldByMe ? 'seat-selected' : 'seat-held';
    title += isHeldByMe ? ' (Held by you)' : ' (Held)';
  } else {
    cls += 'seat-booked';
    title += ' (Booked)';
  }

  const canClick = status === 'AVAILABLE' || isHeldByMe || isSelected;

  return (
    <button
      className={cls}
      title={title}
      disabled={!canClick}
      onClick={onClick}
      aria-label={title}
    >
      <span className="text-[9px] leading-none font-bold">{seat.col}</span>
    </button>
  );
};

const SeatMap: React.FC<SeatMapProps> = ({
  showId,
  seatsByRow: initialSeatsByRow,
  categoryPricing,
  selectedSeatIds,
  onSeatClick,
  currentUserId,
}) => {
  const { socket, isConnected, joinShowRoom, leaveShowRoom } = useSocket();
  const [seatsByRow, setSeatsByRow] = useState<Record<string, ShowSeat[]>>(initialSeatsByRow);
  const [updateCount, setUpdateCount] = useState(0);

  useEffect(() => {
    setSeatsByRow(initialSeatsByRow);
  }, [initialSeatsByRow]);

  // Join Socket.IO room for this show
  useEffect(() => {
    if (isConnected) {
      joinShowRoom(showId);
    }
    return () => {
      leaveShowRoom(showId);
    };
  }, [showId, isConnected]);

  // Listen for real-time seat status updates
  useEffect(() => {
    if (!socket) return;

    const handleSeatUpdate = (update: SeatStatusUpdate) => {
      setSeatsByRow((prev) => {
        const updated = { ...prev };
        for (const row of Object.keys(updated)) {
          updated[row] = updated[row].map((ss) =>
            ss.id === update.showSeatId
              ? {
                  ...ss,
                  status: update.status,
                  heldById: update.heldByUserId ?? null,
                  expiresAt: update.expiresAt ?? null,
                }
              : ss
          );
        }
        return updated;
      });
      setUpdateCount((c) => c + 1);
    };

    socket.on('SEAT_STATUS_UPDATED', handleSeatUpdate);
    socket.on('SHOW_SEAT_MAP_SYNC', (updates: SeatStatusUpdate[]) => {
      updates.forEach(handleSeatUpdate);
    });

    return () => {
      socket.off('SEAT_STATUS_UPDATED', handleSeatUpdate);
      socket.off('SHOW_SEAT_MAP_SYNC');
    };
  }, [socket]);

  const rows = Object.keys(seatsByRow).sort();

  // Count by status
  const allSeats = rows.flatMap((r) => seatsByRow[r]);
  const counts = {
    available: allSeats.filter((s) => s.status === 'AVAILABLE').length,
    held: allSeats.filter((s) => s.status === 'HELD').length,
    booked: allSeats.filter((s) => s.status === 'BOOKED').length,
  };

  return (
    <div className="space-y-5">
      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Seat state legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded seat-node seat-available block" />
            <span className="text-gray-400">Available ({counts.available})</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded seat-node seat-held block" />
            <span className="text-gray-400">Held ({counts.held})</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded seat-node seat-booked block" />
            <span className="text-gray-400">Booked ({counts.booked})</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-3 rounded seat-node seat-selected block" />
            <span className="text-gray-400">Selected</span>
          </span>
        </div>
        {/* Connection badge */}
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${isConnected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
          {isConnected ? <Wifi size={11} /> : <WifiOff size={11} />}
          {isConnected ? 'Live' : 'Offline'}
          {updateCount > 0 && (
            <span className="ml-1 bg-green-500/20 px-1.5 rounded-full animate-fade-in">
              {updateCount} updates
            </span>
          )}
        </div>
      </div>

      {/* Category pricing chips */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(categoryPricing).map(([cat, price]) => {
          const cfg = CATEGORY_COLORS[cat];
          if (!cfg) return null;
          return (
            <span key={cat} className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${cfg.bg}`}>
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {cfg.label} — ₹{price}
            </span>
          );
        })}
      </div>

      {/* Screen indicator */}
      <div className="relative flex items-center justify-center py-3">
        <div className="w-2/3 h-1.5 rounded-full bg-gradient-to-r from-transparent via-brand-400/60 to-transparent" />
        <span className="absolute text-[10px] text-gray-500 -bottom-1">SCREEN</span>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-full">
          <div className="space-y-2">
            {rows.map((row) => {
              const rowSeats = [...seatsByRow[row]].sort((a, b) => a.seat.col - b.seat.col);
              const category = rowSeats[0]?.seat?.category;
              const cfg = category ? CATEGORY_COLORS[category] : null;

              return (
                <div key={row} className="flex items-center gap-2">
                  {/* Row label */}
                  <div className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${cfg ? cfg.bg : 'text-gray-500'}`}>
                    {row}
                  </div>
                  {/* Category indicator */}
                  {cfg && <span className={`w-1 h-6 rounded-full ${cfg.dot} opacity-60 flex-shrink-0`} />}
                  {/* Seats */}
                  <div className="flex gap-1 flex-wrap">
                    {rowSeats.map((ss) => (
                      <SeatNode
                        key={ss.id}
                        showSeat={ss}
                        isSelected={selectedSeatIds.includes(ss.id)}
                        onClick={() => onSeatClick(ss)}
                        currentUserId={currentUserId}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeatMap;
