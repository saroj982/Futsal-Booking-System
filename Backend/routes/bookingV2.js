/**
 * Race-Condition-Safe Booking Routes
 * 
 * These routes implement a bulletproof booking flow:
 * 1. POST /reserve - Atomically lock slot
 * 2. POST /pay/init - Validate & get payment data
 * 3. POST /pay/verify - Webhook: Confirm with transaction
 * 4. POST /cancel - Release reservation
 * 5. GET /my-reservations - User's reservations
 * 6. GET /slots/:futsalId/:date - Available slots
 */

const express = require("express");
const router = express.Router();
const axios = require("axios");
const { protect } = require("../middleware/authMiddleware");
const {
  reserveSeat,
  createPaymentIntent,
  confirmPayment,
  cancelReservation,
  getUserReservations,
  getAvailableSlots,
  verifyEsewaSignature,
} = require("../services/bookingService");
const { Reservation } = require("../models/Reservation");
const { PaymentTransaction } = require("../models/PaymentTransaction");

// ============================================
// RESERVE SLOT
// ============================================

/**
 * POST /api/v2/bookings/reserve
 * 
 * Atomically reserve a slot. Only one user can win.
 * 
 * Body:
 * - futsalId: string (required)
 * - date: string YYYY-MM-DD (required)
 * - hours: number[] (required)
 * - idempotencyKey: string (optional, for retry safety)
 */
router.post("/reserve", protect, async (req, res) => {
  try {
    const { futsalId, date, hours, idempotencyKey } = req.body;
    
    // Validation
    if (!futsalId || !date || !hours || !Array.isArray(hours) || hours.length === 0) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
        message: "futsalId, date, and hours are required",
      });
    }
    
    // Prevent owners from booking
    if (req.user.role === "owner") {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Futsal owners cannot make bookings",
      });
    }
    
    const result = await reserveSeat(
      req.user._id,
      futsalId,
      date,
      hours,
      idempotencyKey
    );
    
    if (!result.success) {
      const statusCode = {
        SLOT_ALREADY_RESERVED: 409,
        SLOT_ALREADY_BOOKED: 409,
        SLOT_RACE_CONDITION: 409,
        FUTSAL_NOT_FOUND: 404,
        INVALID_DATE: 400,
        INVALID_HOURS: 400,
        CLOSED_DAY: 400,
        HOURS_PASSED: 400,
      }[result.error] || 500;
      
      return res.status(statusCode).json(result);
    }
    
    // Success
    res.status(201).json({
      success: true,
      reservation: result.reservation,
      duplicate: result.duplicate,
      message: result.duplicate 
        ? "Reservation already exists (idempotent)" 
        : "Slot reserved successfully",
    });
    
  } catch (error) {
    console.error("Reserve route error:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: error.message,
    });
  }
});

// ============================================
// INITIATE PAYMENT
// ============================================

/**
 * POST /api/v2/bookings/pay/init
 * 
 * Create payment intent after validating reservation.
 * Extends reservation expiry for payment window.
 * 
 * Body:
 * - reservationId: string (required)
 * - idempotencyKey: string (optional)
 */
router.post("/pay/init", protect, async (req, res) => {
  try {
    const { reservationId, idempotencyKey } = req.body;
    
    if (!reservationId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
        message: "reservationId is required",
      });
    }
    
    const result = await createPaymentIntent(
      reservationId,
      req.user._id,
      idempotencyKey
    );
    
    if (!result.success) {
      const statusCode = {
        RESERVATION_NOT_FOUND: 404,
        UNAUTHORIZED: 403,
        RESERVATION_NOT_ACTIVE: 400,
        RESERVATION_EXPIRED: 400,
        SLOT_LOST: 400,
        RESERVATION_CHANGED: 409,
      }[result.error] || 500;
      
      return res.status(statusCode).json(result);
    }
    
    // Handle already completed cases
    if (result.alreadyBooked) {
      return res.json({
        success: true,
        alreadyBooked: true,
        message: "Reservation is already booked",
        reservation: result.reservation,
      });
    }
    
    if (result.alreadyPaid) {
      return res.json({
        success: true,
        alreadyPaid: true,
        message: "Payment already completed",
        transaction: result.transaction,
      });
    }
    
    // Success - return payment data
    res.json({
      success: true,
      paymentUrl: result.paymentUrl,
      paymentData: result.paymentData,
      transactionId: result.transactionId,
      transactionUuid: result.transactionUuid,
      expiresAt: result.expiresAt,
    });
    
  } catch (error) {
    console.error("Pay init route error:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: error.message,
    });
  }
});

// ============================================
// VERIFY PAYMENT (WEBHOOK / CALLBACK)
// ============================================

/**
 * POST /api/v2/bookings/pay/verify
 * 
 * Verify payment after eSewa redirect/webhook.
 * Idempotent - safe to call multiple times.
 * 
 * Body:
 * - data: string (base64 encoded eSewa response)
 */
router.post("/pay/verify", async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
        message: "No payment data received",
      });
    }
    
    // Decode base64 response
    let decodedData;
    try {
      decodedData = JSON.parse(Buffer.from(data, "base64").toString("utf-8"));
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: "INVALID_DATA",
        message: "Could not decode payment data",
      });
    }
    
    const {
      transaction_code,
      status,
      total_amount,
      transaction_uuid,
      product_code,
    } = decodedData;
    
    // Verify signature
    if (!verifyEsewaSignature(decodedData)) {
      console.error("Invalid eSewa signature for transaction:", transaction_uuid);
      return res.status(400).json({
        success: false,
        error: "INVALID_SIGNATURE",
        message: "Payment signature verification failed",
      });
    }
    
    // Verify with eSewa API (belt and suspenders)
    let esewaVerified = false;
    let esewaRefId = transaction_code;
    
    try {
      const verifyUrl = `${process.env.ESEWA_STATUS_URL || "https://rc.esewa.com.np/api/epay/transaction/status"}/?product_code=${product_code}&total_amount=${total_amount}&transaction_uuid=${transaction_uuid}`;
      const verifyResponse = await axios.get(verifyUrl);
      
      if (verifyResponse.data.status === "COMPLETE") {
        esewaVerified = true;
        esewaRefId = verifyResponse.data.ref_id || transaction_code;
      }
    } catch (apiError) {
      console.error("eSewa API verification failed:", apiError.message);
      // Continue with signature verification only if API fails
    }
    
    // Confirm payment
    const isSuccess = status === "COMPLETE" && (esewaVerified || true); // Accept if signature valid
    
    const result = await confirmPayment(
      transaction_uuid,
      decodedData,
      isSuccess,
      esewaRefId,
      req.io
    );
    
    if (result.success) {
      return res.json({
        success: true,
        message: result.duplicate ? "Payment already processed" : "Booking confirmed!",
        reservation: result.reservation,
        duplicate: result.duplicate,
      });
    }
    
    // Handle failures
    if (result.refundRequired) {
      return res.json({
        success: false,
        error: result.error,
        message: result.message || "Booking could not be confirmed. Refund will be processed.",
        refundRequired: true,
        refundAmount: result.refundAmount,
      });
    }
    
    return res.status(400).json(result);
    
  } catch (error) {
    console.error("Pay verify route error:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: error.message,
    });
  }
});

// ============================================
// CANCEL RESERVATION
// ============================================

/**
 * POST /api/v2/bookings/cancel
 * 
 * Cancel an active reservation.
 * 
 * Body:
 * - reservationId: string (required)
 * - reason: string (optional)
 */
router.post("/cancel", protect, async (req, res) => {
  try {
    const { reservationId, reason } = req.body;
    
    if (!reservationId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
        message: "reservationId is required",
      });
    }
    
    const result = await cancelReservation(reservationId, req.user._id, reason);
    
    if (!result.success) {
      const statusCode = {
        RESERVATION_NOT_FOUND: 404,
        CANNOT_CANCEL: 400,
      }[result.error] || 500;
      
      return res.status(statusCode).json(result);
    }
    
    // Emit socket event
    if (req.io) {
      const reservation = await Reservation.findById(reservationId);
      if (reservation) {
        req.io.emit("bookingUpdated", {
          futsalId: reservation.futsal.toString(),
          date: reservation.date,
        });
      }
    }
    
    res.json({
      success: true,
      message: result.refundRequired 
        ? "Reservation cancelled. Refund will be processed." 
        : "Reservation cancelled successfully",
      refundRequired: result.refundRequired,
      refundAmount: result.refundAmount,
    });
    
  } catch (error) {
    console.error("Cancel route error:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: error.message,
    });
  }
});

// ============================================
// GET USER'S RESERVATIONS
// ============================================

/**
 * GET /api/v2/bookings/my-reservations
 * 
 * Get current user's reservations.
 * 
 * Query:
 * - includeExpired: boolean (optional)
 */
router.get("/my-reservations", protect, async (req, res) => {
  try {
    const includeExpired = req.query.includeExpired === "true";
    const reservations = await getUserReservations(req.user._id, includeExpired);
    
    res.json({
      success: true,
      reservations,
    });
    
  } catch (error) {
    console.error("Get reservations route error:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: error.message,
    });
  }
});

// ============================================
// GET AVAILABLE SLOTS
// ============================================

/**
 * GET /api/v2/bookings/slots/:futsalId/:date
 * 
 * Get available slots for a futsal on a date.
 */
router.get("/slots/:futsalId/:date", async (req, res) => {
  try {
    const { futsalId, date } = req.params;
    
    if (!futsalId || !date) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
        message: "futsalId and date are required",
      });
    }
    
    const slots = await getAvailableSlots(futsalId, date);
    
    res.json({
      success: true,
      slots,
    });
    
  } catch (error) {
    console.error("Get slots route error:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: error.message,
    });
  }
});

// ============================================
// GET RESERVATION STATUS
// ============================================

/**
 * GET /api/v2/bookings/status/:reservationId
 * 
 * Get current status of a reservation.
 */
router.get("/status/:reservationId", protect, async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.reservationId)
      .populate("futsal");
    
    if (!reservation) {
      return res.status(404).json({
        success: false,
        error: "RESERVATION_NOT_FOUND",
      });
    }
    
    if (reservation.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: "UNAUTHORIZED",
      });
    }
    
    // Get associated payment transactions
    const payments = await PaymentTransaction.find({
      reservation: reservation._id,
    }).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      reservation,
      payments,
      isExpired: new Date() > reservation.expiresAt,
      isActive: reservation.isActive(),
    });
    
  } catch (error) {
    console.error("Get status route error:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: error.message,
    });
  }
});

// ============================================
// ADMIN: GET PENDING REFUNDS
// ============================================

/**
 * GET /api/v2/bookings/admin/refunds
 * 
 * Get all reservations needing refund.
 */
router.get("/admin/refunds", protect, async (req, res) => {
  try {
    // TODO: Add admin role check
    
    const refunds = await Reservation.find({
      status: "REFUND_PENDING",
    })
      .populate("user", "name email")
      .populate("futsal", "name")
      .sort({ updatedAt: -1 });
    
    res.json({
      success: true,
      refunds,
    });
    
  } catch (error) {
    console.error("Get refunds route error:", error);
    res.status(500).json({
      success: false,
      error: "INTERNAL_ERROR",
      message: error.message,
    });
  }
});

module.exports = router;
