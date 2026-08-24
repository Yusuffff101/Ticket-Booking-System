export enum Role {
  ADMIN = 'ADMIN',
  ORGANISER = 'ORGANISER',
  CUSTOMER = 'CUSTOMER',
}

export enum EventType {
  MOVIE = 'MOVIE',
  CONCERT = 'CONCERT',
}

export enum SeatCategory {
  PREMIUM = 'PREMIUM',
  STANDARD = 'STANDARD',
  ECONOMY = 'ECONOMY',
}

export enum SeatStatus {
  AVAILABLE = 'AVAILABLE',
  HELD = 'HELD',
  BOOKED = 'BOOKED',
}

export enum BookingStatus {
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export enum WaitlistStatus {
  PENDING = 'PENDING',
  OFFERED = 'OFFERED',
  FULFILLED = 'FULFILLED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum OfferStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  EXPIRED = 'EXPIRED',
  REJECTED = 'REJECTED',
}

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const;
