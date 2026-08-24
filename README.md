# TicketVerse — High-Concurrency Ticket Booking System

A production-grade, distributed Ticket Booking System engineered for extreme traffic spikes, instant seat reservation with 10-minute hold TTLs, real-time WebSocket seat map synchronization, FIFO waitlist cascading reallocation, digital QR ticketing, and comprehensive organiser analytics.

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │          React 18 + Vite (Tailwind)    │
                      └───────────────────┬────────────────────┘
                                          │ HTTP / WebSockets
                                          ▼
                      ┌────────────────────────────────────────┐
                      │        Node.js + Express (TypeScript)  │
                      └──────────────┬──────────────────┬──────┘
                                     │                  │
               Distributed Locks /   │                  │ ACID Transactions
               Cache / Socket Rooms  ▼                  ▼
                      ┌──────────────────┐    ┌────────────────────┐
                      │     Redis 7      │    │   PostgreSQL 15    │
                      │ (ioredis engine) │    │    (Prisma ORM)    │
                      └──────────────────┘    └────────────────────┘
```

---

## Tech Stack

* **Backend**: Node.js, Express, TypeScript, Prisma ORM, Socket.IO, ioredis, Nodemailer, QRCode, Zod.
* **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, TanStack Query (React Query), React Router 6, Lucide Icons.
* **Database & Cache**: PostgreSQL 15, Redis 7 (with transparent in-memory dev fallback).

---

## Quickstart & Local Setup

### 1. Prerequisites
* Node.js v20+
* Docker & Docker Compose (or local PostgreSQL & Redis instances)

### 2. Start PostgreSQL & Redis via Docker
```bash
docker-compose up -d
```

### 3. Backend Setup
```bash
cd server
npm install
cp ../.env.example .env

# Generate Prisma client and migrate database
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed

# Run dev server
npm run dev
```

### 4. Frontend Setup
```bash
cd client
npm install
npm run dev
```
Client will be live at `http://localhost:5173`. Backend API runs at `http://localhost:5000`.

---

## Environment Variables Configuration

Copy `.env.example` to `.env` in the `server/` directory:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Server HTTP port |
| `NODE_ENV` | `development` | Environment mode (`development` / `production`) |
| `DATABASE_URL` | `postgresql://postgres:123456@localhost:5432/ticket_booking_db?schema=public` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `JWT_ACCESS_SECRET` | `32+ character secret` | Access token signing secret |
| `JWT_REFRESH_SECRET` | `32+ character secret` | Refresh token signing secret |
| `SEAT_HOLD_TTL_MINUTES` | `10` | Hold expiry window in minutes |
| `WAITLIST_OFFER_TTL_MINUTES` | `15` | Waitlist offer acceptance window |
| `CLIENT_URL` | `http://localhost:5173` | Allowed CORS origin |

---

## REST API Reference

### 🔐 Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Register customer or organiser account |
| `POST` | `/api/auth/login` | Public | Authenticate with email/password; returns JWT pair |
| `POST` | `/api/auth/refresh` | Public | Refresh expired access token using refresh token |
| `GET` | `/api/auth/me` | Authenticated | Retrieve current user profile |

### 🏛️ Venue Management (`/api/venues`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/venues` | Public | List all venues with layout details |
| `GET` | `/api/venues/:id` | Public | Get venue details and seat configuration |
| `POST` | `/api/venues` | Admin | Create venue with custom seat grid layout |
| `PATCH` | `/api/venues/:id` | Admin | Update venue properties |

### 🎬 Event & Show Management (`/api/events`, `/api/shows`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/events` | Public | Browse events with type/search filters |
| `GET` | `/api/events/:id` | Public | Get event detail with all scheduled shows |
| `POST` | `/api/events` | Organiser/Admin | Create movie or concert event |
| `POST` | `/api/shows` | Organiser/Admin | Schedule show & auto-generate priced ShowSeats |
| `GET` | `/api/shows/:id/seatmap` | Public | Real-time seat map occupancy grid & summary |
| `DELETE` | `/api/shows/:id` | Organiser/Admin | Delete scheduled show |

### 🔒 Concurrency Seat Holds (`/api/shows`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/shows/:id/seats/hold` | Customer/Admin | Atomically hold seats with 10m TTL (`NX` lock) |
| `POST` | `/api/shows/:id/seats/release` | Customer/Admin | Release active held seats |

### 🎟️ Bookings & Digital QR Ticketing (`/api/bookings`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/bookings` | Customer/Admin | Confirm booking for held seats + generate QR |
| `GET` | `/api/bookings/my` | Customer | Retrieve customer's active & past bookings |
| `GET` | `/api/bookings/:ref` | Customer | Get booking details by reference |
| `POST` | `/api/bookings/:id/cancel` | Customer/Admin | Cancel booking & trigger waitlist reallocation |

### ⏳ Waitlist FIFO Queue (`/api/waitlist`, `/api/shows`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/shows/:id/waitlist/join` | Customer/Admin | Join FIFO queue for a sold-out category |
| `GET` | `/api/waitlist/offer/:token` | Public | View details of a time-limited seat offer |
| `POST` | `/api/waitlist/offer/:token/accept` | Customer | Claim offered seat & confirm booking |
| `GET` | `/api/waitlist/my` | Customer | View customer's active waitlist positions |

### 📊 Organiser Analytics (`/api/organiser`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/organiser/dashboard` | Organiser/Admin | Revenue, occupancy, and event overview |
| `GET` | `/api/organiser/events/:id/summary` | Organiser/Admin | Deep metrics, tier sales, and waitlist depth |

---

## Real-Time WebSocket Events (Socket.IO)

Clients connect to `ws://localhost:5000` and join partitioned rooms per show (`show:<showId>`):

| Event Name | Direction | Payload Description |
| :--- | :--- | :--- |
| `JOIN_SHOW_ROOM` | Client $\rightarrow$ Server | `{ showId: string }` |
| `LEAVE_SHOW_ROOM` | Client $\rightarrow$ Server | `{ showId: string }` |
| `SEAT_STATUS_UPDATED` | Server $\rightarrow$ Client | Broadcasts seat status change (`AVAILABLE`, `HELD`, `BOOKED`) |
| `SHOW_SEAT_MAP_SYNC` | Server $\rightarrow$ Client | Bulk seat status array sync on initial connect or batch release |

---

## Automated Verification Suite

Run all automated integration and concurrency tests:

```bash
cd server

# Phase 1: Authentication & RBAC Test
npx tsx src/tests/auth.test.ts

# Phase 2: Venue, Show & Real-Time SeatMap Test
npx tsx src/tests/phase2.test.ts

# Phase 3: High-Concurrency Seat Hold Stress Test (5 Simultaneous Contenders)
npx tsx src/tests/concurrency.test.ts

# Phase 4: Waitlist FIFO Cascading Reallocation & Analytics Test
npx tsx src/tests/waitlist.test.ts
```

All 4 test suites execute against the live database and Socket.IO engine with 100% isolation.
