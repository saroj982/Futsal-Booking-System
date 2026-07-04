import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  futsal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Futsal",
    required: true,
  },
  date: {
    type: String, // YYYY-MM-DD
    required: true,
  },
  timeSlots: {
    type: [Number], // Array of starting hours, e.g., [8, 9] for 8-9 and 9-10
    required: true,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled", "refund_pending"],
    default: "pending",
  },
  expiresAt: {
    type: Date,
  },
  // eSewa Payment fields
  transactionUuid: {
    type: String,
    unique: true,
    sparse: true,
  },
  paymentStatus: {
    type: String,
    enum: ["unpaid", "paid", "failed", "refunded", "refund_pending"],
    default: "unpaid",
  },
  paymentMethod: {
    type: String,
    default: "esewa",
  },
  esewaRefId: {
    type: String,
  },
  // Payment initiation tracking for race condition handling
  paymentInitiatedAt: {
    type: Date,
  },
  // For tracking duplicate payments that need refund
  refundReason: {
    type: String,
  },
  refundAmount: {
    type: Number,
  },
  // Version for optimistic locking
  version: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-save middleware to increment version
bookingSchema.pre("save", function (next) {
  if (this.isModified("status") || this.isModified("paymentStatus")) {
    this.version += 1;
  }
  next();
});

// Static method to check for slot conflicts (confirmed bookings only)
bookingSchema.statics.hasConfirmedConflict = async function (futsalId, date, timeSlots) {
  const conflictingBooking = await this.findOne({
    futsal: futsalId,
    date: date,
    status: "confirmed",
    timeSlots: { $in: timeSlots },
  });
  return conflictingBooking;
};

// Static method to atomically confirm a booking (prevents race conditions)
bookingSchema.statics.atomicConfirm = async function (bookingId, expectedVersion) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const booking = await this.findById(bookingId).session(session);

    if (!booking) {
      await session.abortTransaction();
      return { success: false, error: "Booking not found" };
    }

    // Check version hasn't changed (optimistic locking)
    if (booking.version !== expectedVersion) {
      await session.abortTransaction();
      return { success: false, error: "Booking was modified, please retry" };
    }

    // Check if slots are already confirmed by another booking
    const conflict = await this.findOne({
      futsal: booking.futsal,
      date: booking.date,
      status: "confirmed",
      timeSlots: { $in: booking.timeSlots },
      _id: { $ne: bookingId },
    }).session(session);

    if (conflict) {
      // Another booking already confirmed these slots - mark for refund
      booking.status = "refund_pending";
      booking.paymentStatus = "refund_pending";
      booking.refundReason = "Slot already booked by another user";
      booking.refundAmount = booking.totalPrice;
      await booking.save({ session });
      await session.commitTransaction();
      return { 
        success: false, 
        error: "Slot already booked", 
        refundRequired: true,
        booking 
      };
    }

    // No conflict - confirm the booking
    booking.status = "confirmed";
    booking.paymentStatus = "paid";
    await booking.save({ session });
    await session.commitTransaction();

    return { success: true, booking };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export default mongoose.model("Booking", bookingSchema);
