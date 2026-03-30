const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  // Legacy V1 endpoints
  initiateEsewaPayment,
  verifyEsewaPayment,
  checkPaymentStatus,
  getPendingRefunds,
  completeRefund,
  
  // V2 Race-safe endpoints
  initiateEsewaPaymentV2,
  verifyEsewaPaymentV2,
  checkPaymentStatusV2,
  getPendingRefundsV2,
  completeRefundV2,
  cancelPaymentV2,
} = require("../controllers/paymentController");

// ============================
// V1 LEGACY ROUTES (Booking model)
// ============================

// Initiate eSewa payment (requires auth)
router.post("/esewa/initiate", protect, initiateEsewaPayment);

// Verify eSewa payment callback (public - called after redirect)
router.post("/esewa/verify", verifyEsewaPayment);

// Check payment status (requires auth)
router.get("/esewa/status/:bookingId", protect, checkPaymentStatus);

// Refund management (requires auth - should be admin only in production)
router.get("/refunds/pending", protect, getPendingRefunds);
router.post("/refunds/:bookingId/complete", protect, completeRefund);

// ============================
// V2 RACE-SAFE ROUTES (Reservation model)
// Designed to prevent double payments
// ============================

// Initiate eSewa payment with slot locking
router.post("/v2/esewa/initiate", protect, initiateEsewaPaymentV2);

// Verify eSewa payment with atomic confirmation
router.post("/v2/esewa/verify", verifyEsewaPaymentV2);

// Check V2 payment status
router.get("/v2/status/:reservationId", protect, checkPaymentStatusV2);

// Cancel pending payment
router.post("/v2/cancel/:reservationId", protect, cancelPaymentV2);

// V2 Refund management
router.get("/v2/refunds/pending", protect, getPendingRefundsV2);
router.post("/v2/refunds/:id/complete", protect, completeRefundV2);

module.exports = router;
