const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const {
  initiateEsewaPayment,
  verifyEsewaPayment,
  checkPaymentStatus,
  getPendingRefunds,
  completeRefund,
} = require("../controllers/paymentController");

// Initiate eSewa payment (requires auth)
router.post("/esewa/initiate", protect, initiateEsewaPayment);

// Verify eSewa payment callback (public - called after redirect)
router.post("/esewa/verify", verifyEsewaPayment);

// Check payment status (requires auth)
router.get("/esewa/status/:bookingId", protect, checkPaymentStatus);

// Refund management (requires auth - should be admin only in production)
router.get("/refunds/pending", protect, getPendingRefunds);
router.post("/refunds/:bookingId/complete", protect, completeRefund);

module.exports = router;
