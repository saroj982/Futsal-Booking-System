/**
 * PaymentTransaction Model - Tracks all payment attempts
 * 
 * Key Design Decisions:
 * 1. Unique index on idempotencyKey prevents duplicate payment processing
 * 2. Unique index on transactionRef prevents processing same webhook twice
 * 3. Stores full payment lifecycle for audit trail
 * 4. Links to reservation for validation during confirmation
 */

const mongoose = require("mongoose");
const crypto = require("crypto");

const PaymentStatus = {
  INITIATED: "INITIATED",     // Payment request created
  PENDING: "PENDING",         // Sent to payment gateway
  COMPLETED: "COMPLETED",     // Payment successful
  FAILED: "FAILED",           // Payment failed
  CANCELLED: "CANCELLED",     // Payment cancelled
  REFUND_PENDING: "REFUND_PENDING",
  REFUNDED: "REFUNDED",
  STALE: "STALE",            // Payment completed but reservation invalid
};

const paymentTransactionSchema = new mongoose.Schema({
  // Unique transaction ID
  transactionId: {
    type: String,
    unique: true,
    required: true,
    default: () => `TXN-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
  },
  
  // References
  reservation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Reservation",
    required: true,
    index: true,
  },
  
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  
  // Payment details
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  
  currency: {
    type: String,
    default: "NPR",
  },
  
  // Payment gateway details
  paymentMethod: {
    type: String,
    enum: ["ESEWA", "KHALTI", "BANK_TRANSFER", "CASH"],
    default: "ESEWA",
  },
  
  // Gateway-specific IDs
  paymentIntentId: {
    type: String,
    sparse: true,
  },
  
  gatewayTransactionId: {
    type: String,
    sparse: true,
  },
  
  // eSewa specific
  esewaRefId: {
    type: String,
    sparse: true,
  },
  
  transactionUuid: {
    type: String,
    unique: true,
    sparse: true,
  },
  
  // Status
  status: {
    type: String,
    enum: Object.values(PaymentStatus),
    default: PaymentStatus.INITIATED,
    index: true,
  },
  
  // Idempotency key for this payment request
  // Prevents duplicate payments from retried requests
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
  },
  
  // Webhook tracking
  webhookReceived: {
    type: Boolean,
    default: false,
  },
  
  webhookReceivedAt: {
    type: Date,
  },
  
  webhookProcessed: {
    type: Boolean,
    default: false,
  },
  
  webhookProcessedAt: {
    type: Date,
  },
  
  // Raw data from gateway (for debugging)
  gatewayRequest: {
    type: mongoose.Schema.Types.Mixed,
  },
  
  gatewayResponse: {
    type: mongoose.Schema.Types.Mixed,
  },
  
  webhookPayload: {
    type: mongoose.Schema.Types.Mixed,
  },
  
  // Error tracking
  errorCode: {
    type: String,
  },
  
  errorMessage: {
    type: String,
  },
  
  // Refund tracking
  refundReason: {
    type: String,
  },
  
  refundedAt: {
    type: Date,
  },
  
  refundAmount: {
    type: Number,
  },
  
  refundTransactionId: {
    type: String,
  },
  
  // Timestamps
  initiatedAt: {
    type: Date,
    default: Date.now,
  },
  
  completedAt: {
    type: Date,
  },
  
  failedAt: {
    type: Date,
  },
  
  // Version for optimistic locking
  version: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// ============================================
// INDEXES
// ============================================

// Prevent duplicate payments from same request
paymentTransactionSchema.index(
  { idempotencyKey: 1 },
  { unique: true, sparse: true, name: "unique_idempotency_key" }
);

// Prevent processing same webhook twice
paymentTransactionSchema.index(
  { transactionUuid: 1 },
  { unique: true, sparse: true, name: "unique_transaction_uuid" }
);

// Find payments by reservation
paymentTransactionSchema.index(
  { reservation: 1, status: 1 },
  { name: "reservation_payments" }
);

// Find payments by user
paymentTransactionSchema.index(
  { user: 1, createdAt: -1 },
  { name: "user_payments" }
);

// ============================================
// STATIC METHODS
// ============================================

/**
 * Create payment transaction with idempotency
 * Returns existing transaction if idempotencyKey matches
 */
paymentTransactionSchema.statics.createWithIdempotency = async function(
  reservationId,
  userId,
  amount,
  paymentMethod,
  idempotencyKey,
  transactionUuid
) {
  try {
    // Check for existing transaction with same idempotency key
    if (idempotencyKey) {
      const existing = await this.findOne({ idempotencyKey });
      if (existing) {
        return { transaction: existing, duplicate: true };
      }
    }
    
    const transaction = await this.create({
      reservation: reservationId,
      user: userId,
      amount,
      paymentMethod,
      idempotencyKey,
      transactionUuid,
      status: PaymentStatus.INITIATED,
    });
    
    return { transaction, duplicate: false };
    
  } catch (error) {
    // Handle duplicate key error (race condition)
    if (error.code === 11000) {
      const existing = await this.findOne({
        $or: [
          { idempotencyKey },
          { transactionUuid },
        ],
      });
      if (existing) {
        return { transaction: existing, duplicate: true };
      }
    }
    throw error;
  }
};

/**
 * Process webhook callback atomically
 * Ensures webhook is processed exactly once
 */
paymentTransactionSchema.statics.processWebhook = async function(
  transactionUuid,
  webhookPayload,
  isSuccess,
  gatewayRefId
) {
  const now = new Date();
  
  // Atomic update: only process if not already processed
  const transaction = await this.findOneAndUpdate(
    {
      transactionUuid,
      webhookProcessed: false, // Only process once
    },
    {
      $set: {
        webhookReceived: true,
        webhookReceivedAt: now,
        webhookProcessed: true,
        webhookProcessedAt: now,
        webhookPayload,
        status: isSuccess ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
        gatewayTransactionId: gatewayRefId,
        esewaRefId: gatewayRefId,
        ...(isSuccess ? { completedAt: now } : { failedAt: now }),
      },
      $inc: { version: 1 },
    },
    { new: true }
  );
  
  if (!transaction) {
    // Either doesn't exist or already processed
    const existing = await this.findOne({ transactionUuid });
    if (existing?.webhookProcessed) {
      return { success: true, transaction: existing, duplicate: true };
    }
    return { success: false, error: "TRANSACTION_NOT_FOUND" };
  }
  
  return { success: true, transaction, duplicate: false };
};

/**
 * Mark transaction as pending (sent to gateway)
 */
paymentTransactionSchema.statics.markPending = async function(transactionId, gatewayRequest) {
  return this.findByIdAndUpdate(
    transactionId,
    {
      $set: {
        status: PaymentStatus.PENDING,
        gatewayRequest,
      },
      $inc: { version: 1 },
    },
    { new: true }
  );
};

/**
 * Mark transaction as stale (payment succeeded but reservation invalid)
 */
paymentTransactionSchema.statics.markStale = async function(transactionId, reason) {
  return this.findByIdAndUpdate(
    transactionId,
    {
      $set: {
        status: PaymentStatus.STALE,
        errorMessage: reason,
        refundReason: reason,
      },
      $inc: { version: 1 },
    },
    { new: true }
  );
};

/**
 * Find pending payments for a reservation
 */
paymentTransactionSchema.statics.findPendingForReservation = async function(reservationId) {
  return this.find({
    reservation: reservationId,
    status: { $in: [PaymentStatus.INITIATED, PaymentStatus.PENDING] },
  });
};

// Version increment
paymentTransactionSchema.pre("save", function(next) {
  if (this.isModified("status")) {
    this.version += 1;
  }
  next();
});

const PaymentTransaction = mongoose.model("PaymentTransaction", paymentTransactionSchema);

module.exports = { PaymentTransaction, PaymentStatus };
