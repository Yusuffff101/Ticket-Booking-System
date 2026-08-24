# Distributed Ticket Booking Engine: System Design & Architecture

## 1. High-Concurrency Seat Hold & TTL Locking Coordination

When thousands of users contest high-demand seats simultaneously, two-phase distributed coordination guarantees zero race conditions with low latency.

```
 [Client Request]
        │
        ▼
 [Redis NX Lock] ──(Key: lock:show:<id>:seat:<id> PX 5000)
   ├── Failed (Key Exists) ────────► [HTTP 409 Conflict]
   │
   └── Acquired (Winner)
        │
        ▼
 [PostgreSQL Atomic Transaction]
   UPDATE show_seats
   SET status = 'HELD', held_by_id = :userId, expires_at = NOW() + 10m, version = version + 1
   WHERE id = :seatId AND status = 'AVAILABLE' AND held_by_id IS NULL;
        │
        ├── count == 0 ────────────► [HTTP 409 Conflict] (DB Version Mismatch)
        │
        └── count == 1 (Success) ──► [Broadcast Socket.IO: HELD] ──► [HTTP 201 Created]
```

### Locking Strategy & Invariants
1. **First-Line Defence (Redis Distributed Locks)**: Fast memory-level exclusion via `SET lock:show:<showId>:seat:<seatId> <userId> NX PX 5000`. If any request fails to acquire the key, it is rejected immediately with `HTTP 409 Conflict` in sub-millisecond time.
2. **Second-Line Invariant (Conditional DB Row Lock)**: Inside an atomic Prisma transaction, a conditional update checks `status = 'AVAILABLE'` and `held_by_id IS NULL`. If a competing transaction commits earlier, `count === 0` rolls back the transaction.
3. **Hold TTL Expiry Reconciliation**:
   - `HoldExpiryWorker` polls every 30s (or listens to BullMQ delayed jobs) for `status = 'HELD' AND expires_at < NOW()`.
   - Expired seats are transactionally reset to `AVAILABLE` with `held_by_id = null`.
   - A `SEAT_STATUS_UPDATED` event is broadcasted over the Socket.IO room `show:<showId>`.

---

## 2. Concurrency Prevention & Zero Double-Booking Proof

```
Timeline: Concurrent Requests for Seat A-1
User 1 ──► Redis Lock Acquired ──► DB Update (Rows: 1) ──► HELD (HTTP 201)
User 2 ──► Redis Lock Rejected ─────────────────────────► 409 Conflict
User 3 ──► Redis Lock Rejected ─────────────────────────► 409 Conflict
User 4 ──► Redis Lock Rejected ─────────────────────────► 409 Conflict
User 5 ──► Redis Lock Rejected ─────────────────────────► 409 Conflict
```

* **Mutual Exclusion**: Guaranteed by Redis single-threaded atomic operations (`NX`).
* **Optimistic Versioning**: Each `ShowSeat` maintains a monotonically incrementing `version` field.
* **Idempotent State Transitions**: Seats strictly follow a state machine:
  $$\text{AVAILABLE} \xrightarrow{\text{Hold}} \text{HELD} \xrightarrow{\text{Book}} \text{BOOKED}$$
  $$\text{HELD} \xrightarrow{\text{Expire/Release}} \text{AVAILABLE}$$
  $$\text{BOOKED} \xrightarrow{\text{Cancel}} \text{AVAILABLE / WAITLIST REALLOCATE}$$

---

## 3. Waitlist FIFO Auto-Reallocation & Offer State Machine

When high-demand seat categories sell out, customers queue in a strict First-In, First-Out (FIFO) waitlist partitioned by `(showId, category, joinedAt ASC)`.

```
                    ┌─────────────────────────┐
                    │ Booking Cancelled /     │
                    │ Unclaimed Offer Expired │
                    └────────────┬────────────┘
                                 │
                                 ▼
                     [Waitlist Reallocation]
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
        [Queue Empty]                   [Next Customer Found]
                 │                               │
                 ▼                               ▼
       [Set Status: AVAILABLE]         [Create Time-Limited Offer]
       [Broadcast Socket.IO]           [Token + 15m Expiry]
                                       [Set Seat: HELD for Customer]
                                       [Dispatch Notification Email]
                                                 │
                                 ┌───────────────┴───────────────┐
                                 │                               │
                      [Customer Accepts Offer]          [Offer Expires (15m)]
                                 │                               │
                                 ▼                               ▼
                      [Create Booking + QR]             [Mark Offer EXPIRED]
                      [Set Status: BOOKED]              [Recursive Reallocate]
                      [Waitlist: FULFILLED]             (Cascade to Next in Queue)
```

### Offer State Transitions
* **PENDING**: Offer is active; seat is held exclusively for recipient during the 15-minute window (`offerExpiresAt`).
* **ACCEPTED**: Customer completes checkout; seat transitions to `BOOKED`, `Waitlist` transitions to `FULFILLED`.
* **EXPIRED**: `OfferExpiryWorker` detects `offerExpiresAt < NOW()`; marks `Offer` and `Waitlist` as `EXPIRED`, and recursively invokes `reallocateSeat` for the next person in line.

---

## 4. Key Performance & Scalability Characteristics

| Component | Technology | Role | SLA / Concurrency Target |
| :--- | :--- | :--- | :--- |
| **API Gateway & App** | Express / TypeScript | Request handling & RBAC validation | Horizontal clustering behind Nginx |
| **Database** | PostgreSQL 15 + Prisma | ACID persistence & row-level transactions | Serialized isolation for checkouts |
| **Distributed Locks** | Redis 7 | Sub-ms seat contention lock & cache | 10,000+ RPS burst protection |
| **Real-Time Sync** | Socket.IO (Redis Adapter) | Partitioned rooms (`show:<id>`) | Real-time seat updates (<50ms) |
| **Ticketing** | QRCode + Nodemailer | Cryptographic scannable tickets | High-density PNG data URLs |
