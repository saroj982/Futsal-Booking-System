/**
 * Booking Service - Core business logic for race-condition-safe booking
 * 
 * This service orchestrates the booking flow:
 * 1. Reserve -> Lock slot atomically
 * 2. Payment Init -> Validate & create payment intent
 * 3. Payment Confirm -> Transaction-safe booking confirmation
 * 4. Expiry -> Scheduled cleanup of stale reservations
 * 5. Cancel -> User-initiated cancellation
 */

const crypto = require("crypto");
const { Reservation, ReservationStatus } = require("../models/Reservation");
const { Slot, SlotStatus } = require("../models/Slot");
const { PaymentTransaction, PaymentStatus } = require("../models/PaymentTransaction");
const Futsal = require("../models/Futsal");

// Configuration
const RESERVATION_EXPIRY_MINUTES = parseInt(process.env.SLOT_EXPIRE_TIME) || 5;
const PAYMENT_EXPIRY_EXTENSION_MINUTES = 5;

/**
 * Reserve a seat/slot atomically
 * 
 * GUARANTEES:
 * - Only ONE user can reserve a slot at a time
 * - Uses database-level unique partial index
 * - Server generates expiry time (never trust client)
 * - Idempotent: same idempotencyKey returns same result
 * 
 * @param {string} userId - User making the reservation
 * @param {string} futsalId - Futsal venue ID
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {number[]} hours - Array of hours to reserve
 * @param {string} idempotencyKey - Optional key for idempotent requests
 * @returns {Promise<{success: boolean, reservation?: object, error?: string}>}
 */
async function reserveSeat(userId, futsalId, date, hours, idempotencyKey = null) {
  try {
    // 1. Validate futsal exists and get pricing
    const futsal = await Futsal.findById(futsalId);
    if (!futsal) {
      return { success: false, error: "FUTSAL_NOT_FOUND", message: "Futsal venue not found" };
    }
    
    // 2. Validate date is not in the past
    const bookingDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (bookingDate < today) {
      return { success: false, error: "INVALID_DATE", message: "Cannot book dates in the past" };
    }
    
    // 3. Validate hours are within futsal operating hours
    const invalidHours = hours.filter(h => h < futsal.openTime || h >= futsal.closeTime);
    if (invalidHours.length > 0) {
      return { 
        success: false, 
        error: "INVALID_HOURS", 
        message: `Hours ${invalidHours.join(", ")} are outside operating hours (${futsal.openTime}:00 - ${futsal.closeTime}:00)` 
      };
    }
    
    // 4. Check if day is open
    const dayOfWeek = bookingDate.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    if (!futsal.openDays.includes(dayOfWeek)) {
      return { success: false, error: "CLOSED_DAY", message: `Futsal is closed on ${dayOfWeek}` };
    }
    
    // 5. If booking today, check if hours haven't passed
    const isToday = date === today.toISOString().split("T")[0];
    if (isToday) {
      const currentHour = new Date().getHours();
      const passedHours = hours.filter(h => h <= currentHour);
      if (passedHours.length > 0) {
        return { success: false, error: "HOURS_PASSED", message: "Cannot book hours that have already passed" };
      }
    }
    
    // 6. Ensure slots exist (create if needed)
    for (const hour of hours) {
      await Slot.getOrCreate(futsalId, date, hour, futsal.pricePerHour);
    }
    
    // 7. Calculate total price
    const totalPrice = hours.length * futsal.pricePerHour;
    
    // 8. Generate idempotency key if not provided
    const finalIdempotencyKey = idempotencyKey || 
      `reserve_${userId}_${futsalId}_${date}_${hours.join("-")}_${Date.now()}`;
    
    // 9. Create reservation with atomic slot locking
    const result = await Reservation.createWithLock(
      userId,
      futsalId,
      date,
      hours,
      totalPrice,
      RESERVATION_EXPIRY_MINUTES,
      finalIdempotencyKey
    );
    
    return result;
    
  } catch (error) {
    console.error("reserveSeat error:", error);
    return { 
      success: false, 
      error: "INTERNAL_ERROR", 
      message: error.message 
    };
  }
}

/**
 * Create payment intent/session after validating reservation
 * 
 * GUARANTEES:
 * - Only creates payment if reservation is still valid
 * - Extends reservation expiry when payment starts
 * - Uses idempotency to prevent duplicate payments
 * - Transitions reservation to PAYMENT_PENDING atomically
 * 
 * @param {string} reservationId - Reservation ID
 * @param {string} userId - User ID (for validation)
 * @param {string} idempotencyKey - Idempotency key for payment
 * @returns {Promise<{success: boolean, paymentData?: object, error?: string}>}
 */
async function createPaymentIntent(reservationId, userId, idempotencyKey = null) {
  try {
    // 1. Find reservation and validate ownership
    const reservation = await Reservation.findById(reservationId).populate("futsal");
    
    if (!reservation) {
      return { success: false, error: "RESERVATION_NOT_FOUND" };
    }
    
    if (reservation.user.toString() !== userId.toString()) {
      return { success: false, error: "UNAUTHORIZED", message: "Reservation belongs to another user" };
    }
    
    // 2. Check if already booked
    if (reservation.status === ReservationStatus.BOOKED) {
      return { success: true, alreadyBooked: true, reservation };
    }
    
    // 3. Check if reservation is still active
    if (!reservation.isActive()) {
      return { 
        success: false, 
        error: "RESERVATION_NOT_ACTIVE", 
        message: `Reservation is ${reservation.status}` 
      };
    }
    
    // 4. Check if reservation expired
    if (new Date() > reservation.expiresAt) {
      return { success: false, error: "RESERVATION_EXPIRED", message: "Reservation has expired" };
    }
    
    // 5. Check if slots are still held by this reservation
    for (const hour of reservation.hours) {
      const slot = await Slot.findOne({
        futsal: reservation.futsal._id || reservation.futsal,
        date: reservation.date,
        hour,
        activeReservationId: reservation._id,
      });
      
      if (!slot) {
        return { 
          success: false, 
          error: "SLOT_LOST", 
          message: "Slot is no longer reserved. Please create a new reservation." 
        };
      }
    }
    
    // 6. Generate payment identifiers
    const finalIdempotencyKey = idempotencyKey || 
      `payment_${reservationId}_${Date.now()}`;
    const transactionUuid = `${reservationId}-${Date.now()}`;
    
    // 7. Create payment transaction record (idempotent)
    const { transaction, duplicate } = await PaymentTransaction.createWithIdempotency(
      reservationId,
      userId,
      reservation.totalPrice,
      "ESEWA",
      finalIdempotencyKey,
      transactionUuid
    );
    
    if (duplicate && transaction.status === PaymentStatus.COMPLETED) {
      return { success: true, alreadyPaid: true, transaction };
    }
    
    // 8. Atomically transition reservation to PAYMENT_PENDING
    const updatedReservation = await Reservation.atomicStartPayment(
      reservationId,
      userId,
      transactionUuid,
      PAYMENT_EXPIRY_EXTENSION_MINUTES
    );
    
    if (!updatedReservation && !duplicate) {
      // Reservation was modified by another process
      return { 
        success: false, 
        error: "RESERVATION_CHANGED", 
        message: "Reservation status changed. Please try again." 
      };
    }
    
    // 9. Update slots to PAYMENT_PENDING
    for (const hour of reservation.hours) {
      await Slot.atomicStartPayment(
        reservation.futsal._id || reservation.futsal,
        reservation.date,
        hour,
        reservation._id
      );
    }
    
    // 10. Generate eSewa payment data
    const paymentData = generateEsewaPaymentData(
      transactionUuid,
      reservation.totalPrice,
      process.env.ESEWA_PRODUCT_CODE || "EPAYTEST"
    );
    
    // 11. Mark transaction as pending
    await PaymentTransaction.markPending(transaction._id, paymentData);
    
    return {
      success: true,
      paymentUrl: process.env.ESEWA_PAYMENT_URL || "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
      paymentData,
      transactionId: transaction.transactionId,
      transactionUuid,
      expiresAt: updatedReservation?.expiresAt || reservation.expiresAt,
    };
    
  } catch (error) {
    console.error("createPaymentIntent error:", error);
    return { success: false, error: "INTERNAL_ERROR", message: error.message };
  }
}

/**
 * Confirm payment after webhook/callback
 * 
 * GUARANTEES:
 * - Uses MongoDB transaction for atomicity
 * - Re-validates reservation inside transaction
 * - Checks reservation hasn't expired
 * - Checks payment hasn't already been processed (idempotent)
 * - If reservation invalid, marks for refund
 * 
 * @param {string} transactionUuid - Transaction UUID from eSewa
 * @param {object} webhookPayload - Raw webhook data
 * @param {boolean} isSuccess - Whether payment was successful
 * @param {string} gatewayRefId - Gateway reference ID
 * @param {object} io - Socket.io instance for real-time updates
 * @returns {Promise<{success: boolean, booking?: object, error?: string, refundRequired?: boolean}>}
 */
async function confirmPayment(transactionUuid, webhookPayload, isSuccess, gatewayRefId, io = null) {
  try {
    // 1. Process webhook atomically (idempotent)
    const webhookResult = await PaymentTransaction.processWebhook(
      transactionUuid,
      webhookPayload,
      isSuccess,
      gatewayRefId
    );
    
    if (!webhookResult.success) {
      return { success: false, error: webhookResult.error };
    }
    
    if (webhookResult.duplicate) {
      // Already processed - return current state
      const reservation = await Reservation.findById(webhookResult.transaction.reservation);
      return { 
        success: reservation?.status === ReservationStatus.BOOKED,
        duplicate: true,
        reservation,
      };
    }
    
    const transaction = webhookResult.transaction;
    
    // 2. If payment failed, update reservation and return
    if (!isSuccess) {
      const reservation = await Reservation.findById(transaction.reservation);
      if (reservation?.isActive()) {
        // Don't expire - let user retry
        // But if they want, they can cancel
      }
      return { success: false, error: "PAYMENT_FAILED", message: "Payment was not successful" };
    }
    
    // 3. Payment succeeded - confirm booking atomically
    const confirmResult = await Reservation.atomicConfirmBooking(
      transaction.reservation,
      transaction.user,
      transactionUuid,
      gatewayRefId
    );
    
    // 4. Handle result
    if (confirmResult.success) {
      // Emit socket event for real-time updates
      if (io && confirmResult.reservation) {
        io.emit("bookingUpdated", {
          futsalId: confirmResult.reservation.futsal.toString(),
          date: confirmResult.reservation.date,
        });
        io.emit("bookingConfirmed", {
          reservationId: confirmResult.reservation._id,
          userId: confirmResult.reservation.user.toString(),
        });
      }
      
      return {
        success: true,
        reservation: confirmResult.reservation,
        duplicate: confirmResult.duplicate,
      };
    }
    
    // 5. Confirmation failed - mark transaction as stale and handle refund
    await PaymentTransaction.markStale(transaction._id, confirmResult.message || confirmResult.error);
    
    return {
      success: false,
      error: confirmResult.error,
      message: confirmResult.message,
      refundRequired: confirmResult.refundRequired,
      refundAmount: confirmResult.refundAmount,
    };
    
  } catch (error) {
    console.error("confirmPayment error:", error);
    return { success: false, error: "INTERNAL_ERROR", message: error.message };
  }
}

/**
 * Expire stale reservations (called by scheduled job)
 * 
 * GUARANTEES:
 * - Only queries expired ACTIVE reservations (efficient)
 * - Processes in batches to avoid overwhelming database
 * - Handles refunds for payments in progress
 * - Uses transactions for consistency
 * 
 * @param {object} io - Socket.io instance
 * @returns {Promise<{expired: number, refundPending: number, errors: array}>}
 */
async function expireReservations(io = null) {
  const result = await Reservation.expireReservations(io);
  
  if (result.expired > 0 || result.refundPending > 0) {
    console.log(`Expiry job: ${result.expired} expired, ${result.refundPending} need refunds`);
  }
  
  if (result.errors.length > 0) {
    console.error("Expiry job errors:", result.errors);
  }
  
  return result;
}

/**
 * Cancel a reservation
 * 
 * @param {string} reservationId - Reservation to cancel
 * @param {string} userId - User requesting cancellation
 * @param {string} reason - Cancellation reason
 * @returns {Promise<{success: boolean, error?: string, refundRequired?: boolean}>}
 */
async function cancelReservation(reservationId, userId, reason = null) {
  return Reservation.cancelReservation(reservationId, userId, reason);
}

/**
 * Get user's reservations
 */
async function getUserReservations(userId, includeExpired = false) {
  const query = { user: userId };
  
  if (!includeExpired) {
    query.status = { $in: [ReservationStatus.RESERVED, ReservationStatus.PAYMENT_PENDING, ReservationStatus.BOOKED] };
  }
  
  return Reservation.find(query)
    .populate("futsal")
    .sort({ createdAt: -1 });
}

/**
 * Get available slots for a futsal on a date
 */
async function getAvailableSlots(futsalId, date) {
  const futsal = await Futsal.findById(futsalId);
  if (!futsal) return [];
  
  const allHours = [];
  for (let h = futsal.openTime; h < futsal.closeTime; h++) {
    allHours.push(h);
  }
  
  // Get all slots with reservations
  const slots = await Slot.find({
    futsal: futsalId,
    date,
    status: { $ne: SlotStatus.AVAILABLE },
  });
  
  const unavailableHours = new Set(slots.map(s => s.hour));
  
  // Also check for active reservations (belt and suspenders)
  const activeReservations = await Reservation.find({
    futsal: futsalId,
    date,
    status: { $in: [ReservationStatus.RESERVED, ReservationStatus.PAYMENT_PENDING, ReservationStatus.BOOKED] },
  });
  
  activeReservations.forEach(r => {
    r.hours.forEach(h => unavailableHours.add(h));
  });
  
  return allHours.filter(h => !unavailableHours.has(h)).map(hour => ({
    hour,
    price: futsal.pricePerHour,
    available: true,
  }));
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate eSewa HMAC signature
 */
function generateEsewaSignature(message) {
  const secret = process.env.ESEWA_SECRET_KEY || "8gBm/:&EnhH.1/q";
  return crypto.createHmac("sha256", secret).update(message).digest("base64");
}

/**
 * Generate eSewa payment form data
 */
function generateEsewaPaymentData(transactionUuid, amount, productCode) {
  const totalAmount = amount;
  const signatureMessage = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
  const signature = generateEsewaSignature(signatureMessage);
  
  return {
    amount: amount.toString(),
    tax_amount: "0",
    total_amount: totalAmount.toString(),
    transaction_uuid: transactionUuid,
    product_code: productCode,
    product_service_charge: "0",
    product_delivery_charge: "0",
    success_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment/success`,
    failure_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/payment/failure`,
    signed_field_names: "total_amount,transaction_uuid,product_code",
    signature,
  };
}

/**
 * Verify eSewa signature
 */
function verifyEsewaSignature(data) {
  const { 
    transaction_code, 
    status, 
    total_amount, 
    transaction_uuid, 
    product_code, 
    signed_field_names,
    signature 
  } = data;
  
  const message = `transaction_code=${transaction_code},status=${status},total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${product_code},signed_field_names=${signed_field_names}`;
  const expectedSignature = generateEsewaSignature(message);
  
  return signature === expectedSignature;
}

module.exports = {
  reserveSeat,
  createPaymentIntent,
  confirmPayment,
  expireReservations,
  cancelReservation,
  getUserReservations,
  getAvailableSlots,
  generateEsewaPaymentData,
  verifyEsewaSignature,
  generateEsewaSignature,
  RESERVATION_EXPIRY_MINUTES,
};
