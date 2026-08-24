export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'ORGANISER' | 'CUSTOMER';
  createdAt: string;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  totalRows: number;
  totalCols: number;
  layoutJson: any;
  createdAt: string;
}

export interface Seat {
  id: string;
  venueId: string;
  row: string;
  col: number;
  seatNumber: string;
  category: 'PREMIUM' | 'STANDARD' | 'ECONOMY';
}

export interface Event {
  id: string;
  organiserId: string;
  title: string;
  description: string;
  type: 'MOVIE' | 'CONCERT';
  durationMinutes: number;
  bannerUrl?: string | null;
  createdAt: string;
  organiser?: { id: string; name: string };
  shows?: Show[];
  _count?: { shows: number };
}

export interface Show {
  id: string;
  eventId: string;
  venueId: string;
  startTime: string;
  endTime: string;
  categoryPricingJson: Record<string, number>;
  event?: Event;
  venue?: Partial<Venue>;
  _count?: { showSeats: number; bookings: number };
}

export type SeatStatus = 'AVAILABLE' | 'HELD' | 'BOOKED';

export interface ShowSeat {
  id: string;
  showId: string;
  seatId: string;
  status: SeatStatus;
  price: string;
  version: number;
  heldById?: string | null;
  heldAt?: string | null;
  expiresAt?: string | null;
  bookingId?: string | null;
  offerId?: string | null;
  seat: Seat;
}

export interface SeatMap {
  show: {
    id: string;
    startTime: string;
    endTime: string;
    categoryPricingJson: Record<string, number>;
    event: { id: string; title: string; type: string };
    venue: Partial<Venue>;
  };
  summary: { total: number; available: number; held: number; booked: number };
  seatsByRow: Record<string, ShowSeat[]>;
  seats: ShowSeat[];
}

export interface SeatStatusUpdate {
  showId: string;
  seatId: string;
  showSeatId: string;
  status: SeatStatus;
  seatNumber: string;
  row: string;
  col: number;
  category: string;
  heldByUserId?: string | null;
  expiresAt?: string | null;
}

export interface Booking {
  id: string;
  bookingReference: string;
  customerId: string;
  showId: string;
  totalAmount: string | number;
  status: 'CONFIRMED' | 'CANCELLED';
  qrCodeUrl?: string | null;
  qrCodeData?: string;
  createdAt: string;
  show?: {
    startTime: string;
    endTime: string;
    event?: { title: string; type: string };
    venue?: { name: string; city: string };
  };
  showSeats?: Array<{
    id: string;
    price: string | number;
    seat: Seat;
  }>;
}


