/**
 * Slot Model - Represents a bookable time slot
 * 
 * Key Design Decisions:
 * 1. Unique compound index on (futsal, date, hour) ensures slot uniqueness
 * 2. activeReservationId acts as a "lock" - only one reservation can hold a slot
 * 3. Status field tracks availability without relying on reservation lookups
 * 4. version field enables optimistic locking for concurrent updates
 */

const mongoose = require("mongoose");

const SlotStatus = {
  AVAILABLE: "AVAILABLE",
  RESERVED: "RESERVED",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  BOOKED: "BOOKED",
};

const slotSchema = new mongoose.Schema({
  // Reference to the futsal venue
  futsal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Futsal",
    required: true,
    index: true,
  },
  
  // Date in YYYY-MM-DD format
  date: {
    type: String,
    required: true,
    validate: {
      validator: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
      message: "Date must be in YYYY-MM-DD format",
    },
  },
  
  // Hour of the slot (0-23)
  hour: {
    type: Number,
    required: true,
    min: 0,
    max: 23,
  },
  
  // Current status of the slot
  status: {
    type: String,
    enum: Object.values(SlotStatus),
    default: SlotStatus.AVAILABLE,
    index: true,
  },
  
  // The reservation currently holding this slot (null if available)
  // This is the "lock" - only one reservation can be here at a time
  activeReservationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Reservation",
    default: null,
    sparse: true,
  },
  
  // User who has this slot booked (only set when BOOKED)
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  
  // When the booking was confirmed
  bookedAt: {
    type: Date,
    default: null,
  },
  
  // Optimistic locking version
  version: {
    type: Number,
    default: 0,
  },
  
  // Price for this specific slot (can vary by time)
  price: {
    type: Number,
    required: true,
    min: 0,
  },
}, {
  timestamps: true,
});

// ============================================
// INDEXES - Database-level guarantees
// ============================================

// Unique compound index: Only one slot per (futsal, date, hour)
slotSchema.index(
  { futsal: 1, date: 1, hour: 1 },
  { unique: true, name: "unique_slot" }
);

// Index for finding available slots quickly
slotSchema.index(
  { futsal: 1, date: 1, status: 1 },
  { name: "slots_by_status" }
);

// ============================================
// STATIC METHODS
// ============================================

/**
 * Atomically reserve a slot for a user
 * Returns the updated slot if successful, null if slot not available
 * 
 * This is the KEY to preventing double booking:
 * - Uses findOneAndUpdate with status: AVAILABLE condition
 * - Only ONE request can win the atomic update
 * - Losers get null (slot already taken)
 */
slotSchema.statics.atomicReserve = async function(futsalId, date, hour, reservationId) {
  const slot = await this.findOneAndUpdate(
    {
      futsal: futsalId,
      date: date,
      hour: hour,
      status: SlotStatus.AVAILABLE,
      activeReservationId: null, // Double-check no reservation holds it
    },
    {
      $set: {
        status: SlotStatus.RESERVED,
        activeReservationId: reservationId,
      },
      $inc: { version: 1 },
    },
    {
      new: true,
      runValidators: true,
    }
  );
  
  return slot; // null if conditions not met (slot taken)
};

/**
 * Atomically transition slot to PAYMENT_PENDING
 * Only succeeds if slot is RESERVED by the same reservation
 */
slotSchema.statics.atomicStartPayment = async function(futsalId, date, hour, reservationId) {
  const slot = await this.findOneAndUpdate(
    {
      futsal: futsalId,
      date: date,
      hour: hour,
      status: SlotStatus.RESERVED,
      activeReservationId: reservationId, // Must be held by this reservation
    },
    {
      $set: { status: SlotStatus.PAYMENT_PENDING },
      $inc: { version: 1 },
    },
    { new: true }
  );
  
  return slot;
};

/**
 * Atomically confirm booking
 * Only succeeds if slot is in PAYMENT_PENDING and held by correct reservation
 */
slotSchema.statics.atomicConfirmBooking = async function(
  futsalId, 
  date, 
  hour, 
  reservationId, 
  userId,
  session = null
) {
  const updateOptions = { new: true };
  if (session) updateOptions.session = session;
  
  const slot = await this.findOneAndUpdate(
    {
      futsal: futsalId,
      date: date,
      hour: hour,
      status: { $in: [SlotStatus.RESERVED, SlotStatus.PAYMENT_PENDING] },
      activeReservationId: reservationId,
    },
    {
      $set: {
        status: SlotStatus.BOOKED,
        bookedBy: userId,
        bookedAt: new Date(),
      },
      $inc: { version: 1 },
    },
    updateOptions
  );
  
  return slot;
};

/**
 * Atomically release a slot back to AVAILABLE
 * Only releases if held by the specified reservation
 */
slotSchema.statics.atomicRelease = async function(futsalId, date, hour, reservationId, session = null) {
  const updateOptions = { new: true };
  if (session) updateOptions.session = session;
  
  const slot = await this.findOneAndUpdate(
    {
      futsal: futsalId,
      date: date,
      hour: hour,
      activeReservationId: reservationId,
      status: { $in: [SlotStatus.RESERVED, SlotStatus.PAYMENT_PENDING] }, // Can't release BOOKED
    },
    {
      $set: {
        status: SlotStatus.AVAILABLE,
        activeReservationId: null,
      },
      $inc: { version: 1 },
    },
    updateOptions
  );
  
  return slot;
};

/**
 * Get or create a slot (used when slots are dynamically created)
 */
slotSchema.statics.getOrCreate = async function(futsalId, date, hour, price) {
  let slot = await this.findOne({ futsal: futsalId, date, hour });
  
  if (!slot) {
    try {
      slot = await this.create({
        futsal: futsalId,
        date,
        hour,
        price,
        status: SlotStatus.AVAILABLE,
      });
    } catch (error) {
      // Handle race condition where another request created it
      if (error.code === 11000) {
        slot = await this.findOne({ futsal: futsalId, date, hour });
      } else {
        throw error;
      }
    }
  }
  
  return slot;
};

// Virtual for slot key (used for references)
slotSchema.virtual("slotKey").get(function() {
  return `${this.futsal}_${this.date}_${this.hour}`;
});

// Pre-save to increment version on modifications
slotSchema.pre("save", function(next) {
  if (this.isModified("status")) {
    this.version += 1;
  }
  next();
});

const Slot = mongoose.model("Slot", slotSchema);

module.exports = { Slot, SlotStatus };
