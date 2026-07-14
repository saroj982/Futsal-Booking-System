/**
 * Reservation Model - Tracks user's intent to book a slot
 * 
 * Key Design Decisions:
 * 1. Unique partial index on (slotKey, status) WHERE status IN [RESERVED, PAYMENT_PENDING]
 *    This GUARANTEES only ONE active reservation per slot at database level
 * 2. expiresAt is SERVER-GENERATED - never trust client timestamps
 * 3. version field for optimistic locking during concurrent updates
 * 4. idempotencyKey prevents duplicate reservations from same request
 * 5. State machine with strict transition rules
 */

import mongoose from "mongoose";
import crypto from "crypto";

const ReservationStatus = {
  RESERVED: "RESERVED",           // Slot locked, awaiting payment initiation
  PAYMENT_PENDING: "PAYMENT_PENDING", // Payment initiated, awaiting confirmation
  BOOKED: "BOOKED",               // Payment confirmed, booking complete
  EXPIRED: "EXPIRED",             // Reservation timed out
  CANCELLED: "CANCELLED",         // User cancelled
  REFUND_PENDING: "REFUND_PENDING", // Payment received but slot was lost, needs refund
};

// Valid state transitions
const VALID_TRANSITIONS = {
  [ReservationStatus.RESERVED]: [
    ReservationStatus.PAYMENT_PENDING,
    ReservationStatus.EXPIRED,
    ReservationStatus.CANCELLED,
  ],
  [ReservationStatus.PAYMENT_PENDING]: [
    ReservationStatus.BOOKED,
    ReservationStatus.EXPIRED,
    ReservationStatus.CANCELLED,
    ReservationStatus.REFUND_PENDING,
  ],
  [ReservationStatus.BOOKED]: [
    ReservationStatus.REFUND_PENDING, // In case of disputes
  ],
  [ReservationStatus.EXPIRED]: [], // Terminal state
  [ReservationStatus.CANCELLED]: [], // Terminal state
  [ReservationStatus.REFUND_PENDING]: [
    ReservationStatus.CANCELLED, // After refund processed
  ],
};

const reservationSchema = new mongoose.Schema({
  // Unique identifier for this reservation
  reservationId: {
    type: String,
    unique: true,
    required: true,
    default: () => `RES-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
  },
  
  // References
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  
  futsal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Futsal",
    required: true,
  },
  
  // Slot identification
  date: {
    type: String,
    required: true,
  },
  
  // Array of hours being reserved (supports multi-hour bookings)
  hours: {
    type: [Number],
    required: true,
    validate: {
      validator: (v) => v.length > 0 && v.every(h => h >= 0 && h <= 23),
      message: "Hours must be between 0-23",
    },
  },
  
  // Composite key for slot identification (used in unique index)
  // Format: "futsalId_date_hours" e.g., "abc123_2024-03-29_8-9-10"
  slotKey: {
    type: String,
    required: true,
    index: true,
  },
  
  // Current status
  status: {
    type: String,
    enum: Object.values(ReservationStatus),
    default: ReservationStatus.RESERVED,
    index: true,
  },
  
  // SERVER-GENERATED expiry time - NEVER trust client
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
  
  // Pricing
  totalPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  
  // Payment tracking
  paymentIntentId: {
    type: String,
    sparse: true,
  },
  
  paymentStatus: {
    type: String,
    enum: ["UNPAID", "PENDING", "PAID", "FAILED", "REFUNDED", "REFUND_PENDING"],
    default: "UNPAID",
  },
  
  // Idempotency key for this reservation request
  // Prevents duplicate reservations from retried requests
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
  },
  
  // Transaction reference from payment gateway
  transactionRef: {
    type: String,
    sparse: true,
  },
  
  esewaRefId: {
    type: String,
    sparse: true,
  },
  
  // Optimistic locking
  version: {
    type: Number,
    default: 0,
  },
  
  // Audit fields
  paymentInitiatedAt: {
    type: Date,
  },
  
  paymentCompletedAt: {
    type: Date,
  },
  
  expiredAt: {
    type: Date,
  },
  
  cancelledAt: {
    type: Date,
  },
  
  cancelReason: {
    type: String,
  },
  
  refundReason: {
    type: String,
  },
  
  refundAmount: {
    type: Number,
  },
}, {
  timestamps: true,
});

// ============================================
// INDEXES - The secret sauce for preventing double booking
// ============================================

/**
 * CRITICAL INDEX: Unique partial index
 * Ensures only ONE reservation with status RESERVED or PAYMENT_PENDING 
 * can exist for any given slotKey.
 * 
 * This is enforced at DATABASE LEVEL - impossible to bypass in application code.
 */
reservationSchema.index(
  { slotKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: [ReservationStatus.RESERVED, ReservationStatus.PAYMENT_PENDING] },
    },
    name: "unique_active_reservation_per_slot",
  }
);

// Index for finding user's reservations
reservationSchema.index(
  { user: 1, status: 1, createdAt: -1 },
  { name: "user_reservations" }
);

// Index for expiry job - find expired active reservations efficiently
reservationSchema.index(
  { status: 1, expiresAt: 1 },
  {
    partialFilterExpression: {
      status: { $in: [ReservationStatus.RESERVED, ReservationStatus.PAYMENT_PENDING] },
    },
    name: "expirable_reservations",
  }
);

// ============================================
// METHODS
// ============================================

/**
 * Check if reservation can transition to target status
 */
reservationSchema.methods.canTransitionTo = function(targetStatus) {
  const allowed = VALID_TRANSITIONS[this.status] || [];
  return allowed.includes(targetStatus);
};

/**
 * Check if reservation is still valid (not expired)
 */
reservationSchema.methods.isValid = function() {
  return (
    [ReservationStatus.RESERVED, ReservationStatus.PAYMENT_PENDING].includes(this.status) &&
    new Date() < this.expiresAt
  );
};

/**
 * Check if reservation is active (reserved or payment pending)
 */
reservationSchema.methods.isActive = function() {
  return [ReservationStatus.RESERVED, ReservationStatus.PAYMENT_PENDING].includes(this.status);
};

// ============================================
// STATIC METHODS
// ============================================

/**
 * Generate slot key from components
 */
reservationSchema.statics.generateSlotKey = function(futsalId, date, hours) {
  const sortedHours = [...hours].sort((a, b) => a - b);
  return `${futsalId}_${date}_${sortedHours.join("-")}`;
};

/**
 * Atomically create a reservation with slot locking
 * Returns { success: true, reservation } or { success: false, error }
 */
reservationSchema.statics.createWithLock = async function(
  userId,
  futsalId,
  date,
  hours,
  totalPrice,
  expirationMinutes,
  idempotencyKey = null
) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const Slot = mongoose.model("Slot");
    const slotKey = this.generateSlotKey(futsalId, date, hours);
    
    // Check idempotency - return existing reservation if same request
    if (idempotencyKey) {
      const existing = await this.findOne({ idempotencyKey }).session(session);
      if (existing) {
        await session.abortTransaction();
        return { success: true, reservation: existing, duplicate: true };
      }
    }
    
    // Check for existing active reservation on this slot
    const existingActive = await this.findOne({
      slotKey,
      status: { $in: [ReservationStatus.RESERVED, ReservationStatus.PAYMENT_PENDING] },
    }).session(session);
    
    if (existingActive) {
      await session.abortTransaction();
      return { 
        success: false, 
        error: "SLOT_ALREADY_RESERVED",
        message: "This slot is already reserved by another user",
      };
    }
    
    // Check if slot is already booked
    const bookedReservation = await this.findOne({
      slotKey,
      status: ReservationStatus.BOOKED,
    }).session(session);
    
    if (bookedReservation) {
      await session.abortTransaction();
      return {
        success: false,
        error: "SLOT_ALREADY_BOOKED",
        message: "This slot has already been booked",
      };
    }
    
    // Create reservation with server-generated expiry
    const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
    
    const [reservation] = await this.create([{
      user: userId,
      futsal: futsalId,
      date,
      hours,
      slotKey,
      totalPrice,
      expiresAt,
      idempotencyKey,
      status: ReservationStatus.RESERVED,
    }], { session });
    
    // Lock all slots atomically
    for (const hour of hours) {
      const slot = await Slot.atomicReserve(futsalId, date, hour, reservation._id);
      
      if (!slot) {
        // Slot was taken between our check and update - rollback
        await session.abortTransaction();
        return {
          success: false,
          error: "SLOT_RACE_CONDITION",
          message: "Slot was taken by another user. Please try again.",
        };
      }
    }
    
    await session.commitTransaction();
    return { success: true, reservation };
    
  } catch (error) {
    await session.abortTransaction();
    
    // Handle duplicate key error (unique partial index violation)
    if (error.code === 11000) {
      return {
        success: false,
        error: "SLOT_ALREADY_RESERVED",
        message: "This slot was just reserved by another user",
      };
    }
    
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Atomically transition to PAYMENT_PENDING and extend expiry
 */
reservationSchema.statics.atomicStartPayment = async function(
  reservationId,
  userId,
  paymentIntentId,
  extensionMinutes = 5
) {
  const now = new Date();
  const newExpiry = new Date(now.getTime() + extensionMinutes * 60 * 1000);
  
  const reservation = await this.findOneAndUpdate(
    {
      _id: reservationId,
      user: userId,
      status: ReservationStatus.RESERVED,
      expiresAt: { $gt: now }, // Must not be expired
    },
    {
      $set: {
        status: ReservationStatus.PAYMENT_PENDING,
        paymentIntentId,
        paymentStatus: "PENDING",
        paymentInitiatedAt: now,
        expiresAt: newExpiry, // Extend for payment
      },
      $inc: { version: 1 },
    },
    { new: true }
  );
  
  return reservation;
};

/**
 * Atomically confirm booking after successful payment
 * This is the FINAL gate - uses transaction for consistency
 */
reservationSchema.statics.atomicConfirmBooking = async function(
  reservationId,
  userId,
  transactionRef,
  esewaRefId = null
) {
  return runWithRetry(async () => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const now = new Date();
      const Slot = mongoose.model("Slot");

      // 1. Find and validate reservation
      const reservation = await this.findOne({
        _id: reservationId,
        user: userId,
      }).session(session);

      if (!reservation) {
        await session.abortTransaction();
        return { success: false, error: "RESERVATION_NOT_FOUND" };
      }

      // 2. Check if already booked (idempotent)
      if (reservation.status === ReservationStatus.BOOKED) {
        await session.abortTransaction();
        return { success: true, reservation, duplicate: true };
      }

      // 3. Check if reservation is still active
      if (!reservation.isActive()) {
        await session.abortTransaction();
        return {
          success: false,
          error: "RESERVATION_NOT_ACTIVE",
          message: `Reservation is ${reservation.status}`,
          refundRequired: reservation.paymentStatus === "PAID" || reservation.paymentStatus === "PENDING",
        };
      }

      // 4. Check if reservation expired
      if (now > reservation.expiresAt) {
        // Mark as expired and trigger refund
        await this.findByIdAndUpdate(
          reservationId,
          {
            $set: {
              status: ReservationStatus.REFUND_PENDING,
              paymentStatus: "REFUND_PENDING",
              refundReason: "Reservation expired before payment confirmation",
              refundAmount: reservation.totalPrice,
              expiredAt: now,
            },
            $inc: { version: 1 },
          },
          { session }
        );

        // Release slots
        for (const hour of reservation.hours) {
          await Slot.atomicRelease(
            reservation.futsal,
            reservation.date,
            hour,
            reservation._id,
            session
          );
        }

        await session.commitTransaction();
        return {
          success: false,
          error: "RESERVATION_EXPIRED",
          message: "Reservation expired. Refund will be processed.",
          refundRequired: true,
          refundAmount: reservation.totalPrice,
        };
      }

      // 5. Confirm all slots atomically
      for (const hour of reservation.hours) {
        const slot = await Slot.atomicConfirmBooking(
          reservation.futsal,
          reservation.date,
          hour,
          reservation._id,
          userId,
          session
        );

        if (!slot) {
          // Slot was released/taken - should not happen if logic is correct
          await session.abortTransaction();
          return {
            success: false,
            error: "SLOT_LOST",
            message: "Slot was released during payment. Refund will be processed.",
            refundRequired: true,
            refundAmount: reservation.totalPrice,
          };
        }
      }

      // 6. Update reservation to BOOKED
      const updatedReservation = await this.findByIdAndUpdate(
        reservationId,
        {
          $set: {
            status: ReservationStatus.BOOKED,
            paymentStatus: "PAID",
            transactionRef,
            esewaRefId,
            paymentCompletedAt: now,
          },
          $inc: { version: 1 },
        },
        { new: true, session }
      );

      await session.commitTransaction();
      return { success: true, reservation: updatedReservation };
    } catch (error) {
      if (session && session.inTransaction()) {
        await session.abortTransaction().catch(() => {});
      }
      throw error;
    } finally {
      session.endSession();
    }
  });
};

/**
 * Expire active reservations that have passed their expiresAt time
 * Called by scheduled job
 */
reservationSchema.statics.expireReservations = async function(io = null) {
  const session = await mongoose.startSession();
  const Slot = mongoose.model("Slot");
  const now = new Date();
  
  // Find expired active reservations (limit batch size)
  const expiredReservations = await this.find({
    status: { $in: [ReservationStatus.RESERVED, ReservationStatus.PAYMENT_PENDING] },
    expiresAt: { $lt: now },
  }).limit(100);
  
  const results = { expired: 0, refundPending: 0, errors: [] };
  
  for (const reservation of expiredReservations) {
    session.startTransaction();
    
    try {
      // Determine if refund is needed
      const needsRefund = reservation.paymentStatus === "PENDING" || 
                         reservation.paymentStatus === "PAID";
      
      const newStatus = needsRefund 
        ? ReservationStatus.REFUND_PENDING 
        : ReservationStatus.EXPIRED;
      
      // Update reservation
      await this.findByIdAndUpdate(
        reservation._id,
        {
          $set: {
            status: newStatus,
            expiredAt: now,
            ...(needsRefund && {
              paymentStatus: "REFUND_PENDING",
              refundReason: "Reservation expired",
              refundAmount: reservation.totalPrice,
            }),
          },
          $inc: { version: 1 },
        },
        { session }
      );
      
      // Release slots
      for (const hour of reservation.hours) {
        await Slot.atomicRelease(
          reservation.futsal,
          reservation.date,
          hour,
          reservation._id,
          session
        );
      }
      
      await session.commitTransaction();
      
      if (needsRefund) {
        results.refundPending++;
      } else {
        results.expired++;
      }
      
      // Emit socket event
      if (io) {
        io.emit("bookingUpdated", {
          futsalId: reservation.futsal.toString(),
          date: reservation.date,
        });
      }
      
    } catch (error) {
      await session.abortTransaction();
      results.errors.push({
        reservationId: reservation._id,
        error: error.message,
      });
    }
  }
  
  session.endSession();
  return results;
};

/**
 * Cancel a reservation
 */
reservationSchema.statics.cancelReservation = async function(reservationId, userId, reason = null) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const Slot = mongoose.model("Slot");
    const now = new Date();
    
    const reservation = await this.findOne({
      _id: reservationId,
      user: userId,
    }).session(session);
    
    if (!reservation) {
      await session.abortTransaction();
      return { success: false, error: "RESERVATION_NOT_FOUND" };
    }
    
    if (!reservation.isActive()) {
      await session.abortTransaction();
      return { 
        success: false, 
        error: "CANNOT_CANCEL",
        message: `Cannot cancel reservation with status ${reservation.status}`,
      };
    }
    
    // Check if refund needed
    const needsRefund = ["PENDING", "PAID"].includes(reservation.paymentStatus);
    const newStatus = needsRefund 
      ? ReservationStatus.REFUND_PENDING 
      : ReservationStatus.CANCELLED;
    
    // Update reservation
    await this.findByIdAndUpdate(
      reservationId,
      {
        $set: {
          status: newStatus,
          cancelledAt: now,
          cancelReason: reason,
          ...(needsRefund && {
            paymentStatus: "REFUND_PENDING",
            refundReason: reason || "User cancelled",
            refundAmount: reservation.totalPrice,
          }),
        },
        $inc: { version: 1 },
      },
      { session }
    );
    
    // Release slots
    for (const hour of reservation.hours) {
      await Slot.atomicRelease(
        reservation.futsal,
        reservation.date,
        hour,
        reservation._id,
        session
      );
    }
    
    await session.commitTransaction();
    return { 
      success: true, 
      refundRequired: needsRefund,
      refundAmount: needsRefund ? reservation.totalPrice : 0,
    };
    
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// Pre-save version increment
reservationSchema.pre("save", function(next) {
  if (this.isModified("status") || this.isModified("paymentStatus")) {
    this.version += 1;
  }
  next();
});

const Reservation = mongoose.model("Reservation", reservationSchema);

export { Reservation, ReservationStatus, VALID_TRANSITIONS };
