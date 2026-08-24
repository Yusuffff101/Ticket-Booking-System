# Product Requirements Document (PRD)
## Ticket Booking System — Movies & Concerts

**Version:** 1.0
**Author:** [Your Name]
**Date:** August 23, 2026

---

## 1. Overview

### 1.1 Problem Statement
High-demand movie and concert events sell out instantly, leaving many customers without a way to get tickets. At the same time, last-minute cancellations go to waste because there is no automated way to reallocate freed-up seats to interested customers.

### 1.2 Solution
A web-based ticket booking platform where customers book seats from a real-time, visual seat map. Seats a customer is checking out with are temporarily held and auto-released if abandoned. Sold-out events support a waitlist, and cancelled seats are automatically offered to the next customer in line with a time-limited window to complete the booking. Every confirmed booking triggers an emailed QR-code ticket.

### 1.3 Goals
- Prevent double-booking of the same seat under concurrent access.
- Maximize seat utilization via automated hold expiry and waitlist reallocation.
- Provide a smooth, transparent booking experience (real-time seat status).
- Give organisers visibility into sales and revenue.

### 1.4 Non-Goals
- Payment gateway integration (can be mocked/stubbed unless explicitly required).
- Mobile native apps (web-responsive is sufficient).
- Dynamic/surge pricing.

---

## 2. User Roles & Personas

| Role | Description | Key Actions |
|---|---|---|
| **Admin** | Platform owner/operator | Create & manage venues, seat layouts, seat categories |
| **Organiser** | Event owner (theatre chain, concert promoter) | Register/login, create event listings (movie/concert) tied to a venue, set date/time & per-category pricing, view booking summary & revenue |
| **Customer** | End user booking tickets | Register/login, browse/filter events, view seat map, hold & book seats, join waitlist, view booking history, cancel bookings |

Role-based access control (RBAC) governs what each role can see and do.

---

## 3. Functional Requirements

### 3.1 Venue & Seat Layout Management (Admin)
- Admin can create a venue with a name, address, and a seat layout (rows × columns or custom grid).
- Each seat belongs to a **category** (e.g., Premium, Standard, Economy).
- Seat layout is reusable across multiple events/shows hosted at that venue.

### 3.2 Event Management (Organiser)
- Organiser registration/login (JWT-based auth).
- Create an event (movie or concert) linked to a venue, with:
  - Date & time (a "show")
  - Per-category pricing for that show
- Edit/cancel a show (edge case: what happens to existing bookings — should be documented, e.g., blocked if bookings exist, or cascading cancellation with notification).
- View **booking summary & revenue** per event/show (tickets sold per category, total revenue, occupancy %).

### 3.3 Customer Browsing & Discovery
- Customer registration/login.
- Browse and filter events by type (movie/concert), date, venue, or category.
- View event detail page with show timings and a **visual seat map**:
  - Seat states rendered in real time: `available`, `held`, `booked`.
  - Color-coded, category-labeled grid.

### 3.4 Seat Selection & Hold Mechanism
- Customer selects one or more seats → system places a **hold** with a configurable TTL (default 10 minutes, configurable via env/admin setting).
- While held:
  - Seat is shown as `held` to all other customers in real time.
  - Only the holding customer can proceed to confirm booking on those seats.
- If the customer completes checkout before TTL expiry → seats move to `booked`.
- If TTL expires without confirmation (abandonment) → seats auto-release back to `available`, and this update is reflected on all connected clients' seat maps.

### 3.5 Concurrency Control
- Two customers must never be able to hold or book the same seat at the same time.
- Enforced via database-level locking / atomic operations (e.g., unique constraint + conditional update, or `SELECT ... FOR UPDATE`, or optimistic concurrency with version numbers).
- Concurrent hold attempts on the same seat: exactly one succeeds, the other receives an immediate "seat no longer available" response.

### 3.6 Booking Confirmation & Ticketing
- On successful booking:
  - Booking record created with a unique **booking reference**.
  - QR code generated encoding the booking reference (and optionally seat/show metadata).
  - Confirmation email sent to customer with QR code ticket attached/embedded.
- QR code should be scannable to verify booking authenticity (verification endpoint optional but recommended).

### 3.7 Waitlist Management
- When a show/category is sold out, customer can **join a waitlist** for a specific seat category.
- Waitlist is a **per-category FIFO queue** (first-come, first-served).
- On booking cancellation:
  - The freed seat(s) are automatically offered to the next customer on the waitlist for that category.
  - That customer receives an email with a **time-limited link** (configurable TTL, e.g., 15–30 minutes) to complete the booking.
  - If they don't act within the time limit → offer expires, seat is offered to the next customer in the queue, and so on.
  - If the waitlist is empty, the seat simply returns to `available`.

### 3.8 Booking History & Cancellation (Customer)
- Customer can view all past and upcoming bookings.
- Customer can cancel an active booking (subject to any cancellation policy, e.g., cutoff time before show).
- Cancellation triggers the waitlist reallocation flow (3.7).

---

## 4. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Consistency** | Strong consistency required for seat state (no double-booking) |
| **Real-time updates** | Seat map should reflect status changes within a few seconds (WebSocket/polling) |
| **Scalability** | Should handle burst traffic at on-sale time for popular events |
| **Reliability** | Hold expiry and waitlist offer expiry must be reliably enforced even if the app restarts (persisted, not in-memory only) |
| **Security** | Role-based auth, password hashing, JWT/session expiry, input validation |
| **Auditability** | Booking, hold, cancellation, and waitlist events should be logged/traceable |

---

## 5. System Design Summary

### 5.1 Seat Hold & TTL Mechanism
- Each seat-show combination has a `status` field: `available | held | booked`.
- On hold: store `held_by`, `held_at`, `expires_at`.
- TTL enforcement options (pick one, document choice):
  - **Scheduler/cron job** that periodically scans for expired holds and releases them.
  - **DB-native expiry** (e.g., Redis key with TTL mirroring the hold, with a keyspace-expiry event listener to update the DB).
- Recommended approach: Redis for fast hold locks (with TTL) + periodic reconciliation job against the primary DB for durability.

### 5.2 Concurrency Prevention
- Use atomic conditional updates, e.g.:
  ```sql
  UPDATE seats SET status='held', held_by=?, expires_at=?
  WHERE id=? AND status='available';
  ```
  If affected rows = 0 → seat was already taken; return conflict error.
- Alternatively, use Redis `SETNX`/distributed lock per seat as a fast first line of defense before DB write.

### 5.3 Waitlist Auto-Assignment Flow
1. Cancellation event fires → freed seat(s) identified by category.
2. Query waitlist queue (ordered by join time) for that category.
3. Pop next customer → create a time-limited **offer** record (seat reserved for them, status `offered`, `offer_expires_at`).
4. Send email with unique offer link.
5. On click + confirm within window → convert to booking (same concurrency-safe flow as normal booking).
6. On expiry → mark offer expired, seat returns to pool, recurse to next customer in queue.

### 5.4 Data Model (high-level)
- `users` (id, name, email, password_hash, role)
- `venues` (id, name, address, layout_json)
- `seats` (id, venue_id, row, col, category)
- `events` (id, organiser_id, title, type[movie/concert])
- `shows` (id, event_id, venue_id, datetime, category_pricing_json)
- `show_seats` (id, show_id, seat_id, status, held_by, expires_at)
- `bookings` (id, customer_id, show_id, seat_ids[], booking_ref, qr_code, status, created_at)
- `waitlist` (id, show_id, category, customer_id, joined_at, status)
- `offers` (id, waitlist_id, seat_id, offer_expires_at, status)

---

## 6. Tech Stack (Suggested)
- **Backend:** Node.js (Express/NestJS) or Django/FastAPI
- **Frontend:** React (with a canvas/grid-based seat map component)
- **Database:** PostgreSQL (relational integrity for bookings) + Redis (holds/locks, TTL, pub-sub for real-time updates)
- **Real-time:** WebSockets (Socket.IO) or Server-Sent Events for seat map updates
- **Email:** Any free-tier transactional email service (e.g., SendGrid, Mailtrap, Resend)
- **QR Code:** `qrcode` (Node) / `qrcode` (Python) library
- **Hosting:** Vercel (frontend) + Render/Railway (backend + DB)

---

## 7. API Surface (High-Level)

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/auth/register`, `/auth/login` | POST | All | Auth |
| `/venues` | POST/GET | Admin | Create/list venues |
| `/events` | POST/GET | Organiser | Create/list events |
| `/shows/:id/seatmap` | GET | Customer | Real-time seat map |
| `/shows/:id/seats/hold` | POST | Customer | Hold selected seats |
| `/shows/:id/seats/release` | POST | Customer/System | Release held seats |
| `/bookings` | POST | Customer | Confirm booking |
| `/bookings/:id/cancel` | POST | Customer | Cancel booking |
| `/bookings/history` | GET | Customer | Booking history |
| `/waitlist/join` | POST | Customer | Join waitlist |
| `/waitlist/offer/:id/accept` | POST | Customer | Accept time-limited offer |
| `/organiser/events/:id/summary` | GET | Organiser | Revenue/booking summary |

*(Exact routes to be finalized during implementation; document in README API docs.)*

---

## 8. Deliverables (per assignment brief)
1. ZIP file with complete source code
2. README with: setup guide, `.env.example`, API docs, DB schema, seat hold & waitlist logic explanation
3. Hosted application URL (Vercel/Render/Railway/similar)
4. System design write-up (≤800 words): seat hold/TTL mechanism, concurrency prevention, waitlist auto-assignment flow, time-limited offer handling

> **Note:** Per the coordinator's email, final submission must be a **GitHub repository link only** — no ZIP/Drive/PDF. Confirm with the coordinator whether the "ZIP file" deliverable listed in the original brief is superseded by this instruction; if so, ensure the repo contains the source code, README, and design write-up, with the ZIP requirement satisfied by the repo itself.

---

## 9. Evaluation Focus (from brief)
- Seat hold TTL and auto-release mechanism
- Concurrency protection for simultaneous seat selection
- Waitlist auto-assignment and time-limited offer flow
- Seat map data model and real-time status updates
- QR code generation and email delivery
- API design, code structure, and documentation

---

## 10. Milestones (Suggested, adjust to your deadline)

| Phase | Tasks |
|---|---|
| 1. Setup | Repo scaffold, DB schema, auth (all 3 roles) |
| 2. Admin/Organiser flows | Venue + seat layout CRUD, event/show creation, pricing |
| 3. Customer browsing | Event listing, filters, seat map UI (read-only) |
| 4. Hold & booking | Seat hold with TTL, concurrency-safe booking, QR + email |
| 5. Waitlist | Join waitlist, cancellation → auto-offer → accept/expire chain |
| 6. Polish | Booking history/cancel, organiser revenue dashboard, real-time updates |
| 7. Docs & deploy | README, API docs, system design write-up, hosting, final GitHub push |

---

## 11. Open Questions / Assumptions
- Payment is assumed mocked (confirm booking = "paid") unless a real gateway is required.
- Cancellation policy cutoff (e.g., no cancellation within X hours of show) — assumption: allowed any time before show start unless stated otherwise.
- Whether one waitlist entry can claim multiple seats or only one seat per offer — assumption: one seat per offer, customer can join multiple times for multiple seats.
