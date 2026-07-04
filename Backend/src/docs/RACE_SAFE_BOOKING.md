# Race-Condition-Safe Booking System Architecture

## Table of Contents
1. [Problem Statement](#problem-statement)
2. [Architecture Overview](#architecture-overview)
3. [MongoDB Schema Design](#mongodb-schema-design)
4. [Transaction Strategy](#transaction-strategy)
5. [Locking Strategy](#locking-strategy)
6. [Idempotency Strategy](#idempotency-strategy)
7. [Webhook Safety Strategy](#webhook-safety-strategy)
8. [Why This Prevents Double Booking](#why-this-prevents-double-booking)
9. [Error Handling](#error-handling)
10. [API Reference](#api-reference)

---

## Problem Statement

**Scenario**: User A reserves a slot and goes to payment. Before payment completes, the reservation expires. User B then reserves the same slot and also goes to payment. Both payments succeed → **Double Booking**.

**Goal**: Only ONE successful booking can exist per slot, even with:
- Concurrent requests
- Delayed payments
- Network retries
- Webhook callbacks

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           STATE MACHINE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│    AVAILABLE ──reserve()──► RESERVED ──initPay()──► PAYMENT_PENDING     │
│        ▲                        │                        │               │
│        │                        │                        │               │
│        │              expire/   │              expire/   │    confirm()  │
│        │              cancel    │              cancel    │       │       │
│        │                        ▼                        ▼       ▼       │
│        └──────────────── EXPIRED/CANCELLED ◄──────── BOOKED             │
│                                 │                                        │
│                                 └──► REFUND_PENDING (if paid)            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Database Correctness Over Application Logic**
   - Use unique indexes to enforce constraints
   - Use atomic operations for state transitions
   - Use transactions for multi-document updates

2. **Never Trust Client**
   - Server generates all timestamps
   - Server validates all state transitions
   - Re-validate inside transactions

3. **Idempotency Everywhere**
   - Same request → same result
   - Safe to retry any operation
   - Duplicate webhooks handled gracefully

---

## MongoDB Schema Design

### Slot Collection
```javascript
{
  _id: ObjectId,
  futsal: ObjectId,           // Venue reference
  date: "2024-03-29",         // YYYY-MM-DD
  hour: 14,                   // 0-23
  status: "AVAILABLE",        // AVAILABLE | RESERVED | PAYMENT_PENDING | BOOKED
  activeReservationId: null,  // The "lock" - only one reservation can hold this
  bookedBy: null,             // User ID when BOOKED
  bookedAt: null,             // Timestamp when booked
  price: 1500,
  version: 0                  // Optimistic locking
}

// CRITICAL INDEX: Only one slot per (futsal, date, hour)
db.slots.createIndex(
  { futsal: 1, date: 1, hour: 1 },
  { unique: true }
)
```

### Reservation Collection
```javascript
{
  _id: ObjectId,
  reservationId: "RES-1711234567-ABCD1234",
  user: ObjectId,
  futsal: ObjectId,
  date: "2024-03-29",
  hours: [14, 15],            // Multi-hour support
  slotKey: "abc123_2024-03-29_14-15",  // For unique index
  status: "RESERVED",         // RESERVED | PAYMENT_PENDING | BOOKED | EXPIRED | CANCELLED | REFUND_PENDING
  expiresAt: ISODate,         // SERVER-GENERATED
  totalPrice: 3000,
  paymentIntentId: "...",
  paymentStatus: "UNPAID",
  idempotencyKey: "...",      // Prevents duplicate reservations
  transactionRef: "...",
  version: 0
}

// CRITICAL INDEX: Only ONE active reservation per slot
db.reservations.createIndex(
  { slotKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["RESERVED", "PAYMENT_PENDING"] }
    }
  }
)
```

### PaymentTransaction Collection
```javascript
{
  _id: ObjectId,
  transactionId: "TXN-1711234567-EFGH5678",
  reservation: ObjectId,
  user: ObjectId,
  amount: 3000,
  status: "INITIATED",        // INITIATED | PENDING | COMPLETED | FAILED | STALE | REFUNDED
  idempotencyKey: "...",      // Prevents duplicate payments
  transactionUuid: "...",     // Unique per payment attempt
  webhookProcessed: false,    // Ensures single processing
  webhookPayload: {},         // Raw gateway response
  version: 0
}

// Prevent duplicate payment processing
db.paymentTransactions.createIndex(
  { idempotencyKey: 1 },
  { unique: true, sparse: true }
)

db.paymentTransactions.createIndex(
  { transactionUuid: 1 },
  { unique: true, sparse: true }
)
```

---

## Transaction Strategy

### When to Use Transactions

1. **Creating a reservation** (multi-slot)
   - Create Reservation document
   - Update all Slot documents
   - All succeed or all fail

2. **Confirming a booking**
   - Verify reservation still valid
   - Update all Slot statuses to BOOKED
   - Update Reservation to BOOKED
   - All succeed or all fail

3. **Expiring/Cancelling**
   - Update Reservation status
   - Release all Slots
   - All succeed or all fail

### Transaction Example
```javascript
const session = await mongoose.startSession();
session.startTransaction();

try {
  // 1. Update reservation
  await Reservation.findByIdAndUpdate(id, {...}, { session });
  
  // 2. Update all slots
  for (const hour of hours) {
    const result = await Slot.findOneAndUpdate(
      { futsal, date, hour, activeReservationId: reservationId },
      { $set: { status: "BOOKED" } },
      { session }
    );
    if (!result) throw new Error("Slot lost");
  }
  
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

---

## Locking Strategy

### Database-Level Locks (Preferred)

1. **Unique Partial Index on Reservation**
   ```javascript
   // Only ONE document can have status=RESERVED or PAYMENT_PENDING for a slotKey
   { slotKey: 1 }, { unique: true, partialFilterExpression: { status: { $in: [...] } } }
   ```

2. **Atomic findOneAndUpdate**
   ```javascript
   // Only succeeds if conditions are met - atomic operation
   Slot.findOneAndUpdate(
     {
       futsal, date, hour,
       status: "AVAILABLE",           // Must be available
       activeReservationId: null      // Must not be held
     },
     {
       $set: {
         status: "RESERVED",
         activeReservationId: newReservationId
       }
     }
   )
   // Returns null if conditions not met → slot taken
   ```

### Optimistic Locking with Version

```javascript
// Read
const doc = await Model.findById(id);
const currentVersion = doc.version;

// Update only if version unchanged
const result = await Model.findOneAndUpdate(
  { _id: id, version: currentVersion },
  { $set: {...}, $inc: { version: 1 } }
);

if (!result) {
  // Document was modified by another process
  throw new Error("Concurrent modification");
}
```

---

## Idempotency Strategy

### Request Idempotency

Every mutating operation accepts an `idempotencyKey`:

```javascript
// Client sends same key on retries
POST /api/v2/bookings/reserve
{
  "futsalId": "...",
  "date": "2024-03-29",
  "hours": [14, 15],
  "idempotencyKey": "user123_reserve_2024-03-29_14-15"
}

// Server checks for existing operation with same key
const existing = await Reservation.findOne({ idempotencyKey });
if (existing) {
  return { success: true, reservation: existing, duplicate: true };
}
```

### Webhook Idempotency

```javascript
// Process webhook only once
const result = await PaymentTransaction.findOneAndUpdate(
  {
    transactionUuid: webhookData.transaction_uuid,
    webhookProcessed: false  // Only if not already processed
  },
  {
    $set: {
      webhookProcessed: true,
      webhookPayload: webhookData,
      // ... other updates
    }
  }
);

if (!result) {
  // Either doesn't exist or already processed
  const existing = await PaymentTransaction.findOne({ transactionUuid });
  if (existing?.webhookProcessed) {
    return { duplicate: true }; // Idempotent response
  }
}
```

---

## Webhook Safety Strategy

### The Problem
Payment gateway webhooks can:
- Arrive multiple times (retries)
- Arrive out of order
- Arrive after user-initiated callback
- Fail silently

### The Solution

1. **Unique Transaction ID per Payment Attempt**
   ```javascript
   transactionUuid: `${reservationId}-${Date.now()}`
   ```

2. **Atomic Webhook Processing**
   ```javascript
   // Only one process can mark webhookProcessed = true
   findOneAndUpdate({ webhookProcessed: false }, { webhookProcessed: true })
   ```

3. **Re-validate Inside Transaction**
   ```javascript
   // Even if webhook says "paid", verify reservation is still valid
   if (reservation.status !== "PAYMENT_PENDING") {
     return { error: "RESERVATION_NOT_ACTIVE", refundRequired: true };
   }
   if (new Date() > reservation.expiresAt) {
     return { error: "RESERVATION_EXPIRED", refundRequired: true };
   }
   ```

4. **Handle Stale Payments**
   ```javascript
   // Payment succeeded but reservation invalid → mark for refund
   if (!confirmResult.success && confirmResult.refundRequired) {
     await PaymentTransaction.markStale(transactionId, "Reservation expired");
     // Trigger refund workflow
   }
   ```

---

## Why This Prevents Double Booking

### Scenario: Two Users Reserve Same Slot

```
User A: reserve(slot=14:00)
User B: reserve(slot=14:00)
```

**Protection**: Unique partial index on `slotKey` with status filter

```javascript
// User A's insert succeeds → creates document with slotKey + status=RESERVED
// User B's insert fails → E11000 duplicate key error
```

**Result**: Only ONE reservation can exist. B gets "SLOT_ALREADY_RESERVED" error.

### Scenario: Reservation Expires During Payment

```
User A: reserve() → expiresAt = now + 5min
[4 minutes pass]
User A: initiatePayment() → expiresAt extended to now + 5min
[User A on eSewa payment page]
[Original 5 min expires, but extended]
User A: payment completes → webhook received
```

**Protection**: 
1. `initiatePayment()` extends expiry
2. `confirmPayment()` re-checks expiry inside transaction

```javascript
// Inside transaction:
if (new Date() > reservation.expiresAt) {
  return { error: "RESERVATION_EXPIRED", refundRequired: true };
}
```

### Scenario: Two Payments for Same Slot

```
User A: reserve(), pay() → payment pending
[A's reservation expires before payment completes]
User B: reserve(), pay() → payment pending
[Both payments complete via webhook]
```

**Protection**: Atomic confirmation with slot ownership check

```javascript
// User A's confirmation:
Slot.findOneAndUpdate({
  activeReservationId: A_reservationId,  // FAILS - slot now belongs to B
  status: "PAYMENT_PENDING"
})
// Returns null → A gets refund

// User B's confirmation:
Slot.findOneAndUpdate({
  activeReservationId: B_reservationId,  // SUCCEEDS
  status: "PAYMENT_PENDING"
})
// Returns slot → B's booking confirmed
```

---

## Error Handling

| Error Code | HTTP | Description | User Action |
|------------|------|-------------|-------------|
| SLOT_ALREADY_RESERVED | 409 | Slot taken by another user | Select different slot |
| SLOT_ALREADY_BOOKED | 409 | Slot permanently booked | Select different slot |
| SLOT_RACE_CONDITION | 409 | Concurrent reserve attempt | Retry immediately |
| RESERVATION_NOT_FOUND | 404 | Invalid reservation ID | Start over |
| RESERVATION_EXPIRED | 400 | Time limit exceeded | Create new reservation |
| RESERVATION_NOT_ACTIVE | 400 | Already cancelled/expired | Create new reservation |
| SLOT_LOST | 400 | Slot released during process | Create new reservation |
| UNAUTHORIZED | 403 | Wrong user | N/A |
| PAYMENT_FAILED | 400 | Gateway rejected payment | Retry payment |
| INVALID_SIGNATURE | 400 | Webhook signature mismatch | Contact support |
| DUPLICATE_WEBHOOK | 200 | Already processed | None (idempotent) |

---

## API Reference

### POST /api/v2/bookings/reserve
Reserve slots atomically.

**Request:**
```json
{
  "futsalId": "abc123",
  "date": "2024-03-29",
  "hours": [14, 15],
  "idempotencyKey": "optional-key"
}
```

**Response (201):**
```json
{
  "success": true,
  "reservation": {
    "_id": "...",
    "reservationId": "RES-...",
    "status": "RESERVED",
    "expiresAt": "2024-03-29T10:05:00Z",
    "totalPrice": 3000
  }
}
```

### POST /api/v2/bookings/pay/init
Initiate payment for reservation.

**Request:**
```json
{
  "reservationId": "...",
  "idempotencyKey": "optional-key"
}
```

**Response (200):**
```json
{
  "success": true,
  "paymentUrl": "https://rc-epay.esewa.com.np/...",
  "paymentData": {
    "amount": "3000",
    "transaction_uuid": "...",
    "signature": "..."
  },
  "expiresAt": "2024-03-29T10:10:00Z"
}
```

### POST /api/v2/bookings/pay/verify
Verify payment (webhook callback).

**Request:**
```json
{
  "data": "base64-encoded-esewa-response"
}
```

**Response (200):**
```json
{
  "success": true,
  "reservation": {
    "status": "BOOKED"
  }
}
```

**Response (Refund Required):**
```json
{
  "success": false,
  "error": "RESERVATION_EXPIRED",
  "refundRequired": true,
  "refundAmount": 3000
}
```

---

## Files Created

### Backend
- `models/Slot.js` - Slot schema with atomic operations
- `models/Reservation.js` - Reservation schema with unique partial index
- `models/PaymentTransaction.js` - Payment tracking with idempotency
- `services/bookingService.js` - Core business logic
- `routes/bookingV2.js` - API endpoints

### Frontend
- `hooks/useBooking.js` - React hook for booking flow
- `components/booking/SlotBookingV2.jsx` - Booking UI component

---

## Summary

This architecture prevents double booking through:

1. **Database-level uniqueness** - Unique partial indexes make concurrent reservations impossible
2. **Atomic operations** - findOneAndUpdate with conditions ensures only one winner
3. **Transactions** - Multi-document updates are all-or-nothing
4. **Idempotency** - Safe to retry any operation
5. **Re-validation** - Always check state inside transactions
6. **Proper expiry handling** - Server-controlled timestamps with grace periods
7. **Refund workflow** - Handle edge cases where payment succeeds but booking fails
