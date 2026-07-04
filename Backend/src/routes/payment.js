import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  initiateEsewaPayment,
  verifyEsewaPayment,
  checkPaymentStatus,
  getPendingRefunds,
  completeRefund,
  initiateEsewaPaymentV2,
  verifyEsewaPaymentV2,
  checkPaymentStatusV2,
  getPendingRefundsV2,
  completeRefundV2,
  cancelPaymentV2,
} from "../controllers/paymentController.js";

const router = express.Router();

router.post("/esewa/initiate", protect, initiateEsewaPayment);
router.post("/esewa/verify", verifyEsewaPayment);
router.get("/esewa/status/:bookingId", protect, checkPaymentStatus);
router.get("/refunds/pending", protect, getPendingRefunds);
router.post("/refunds/:bookingId/complete", protect, completeRefund);

router.post("/v2/esewa/initiate", protect, initiateEsewaPaymentV2);
router.post("/v2/esewa/verify", verifyEsewaPaymentV2);
router.get("/v2/status/:reservationId", protect, checkPaymentStatusV2);
router.post("/v2/cancel/:reservationId", protect, cancelPaymentV2);
router.get("/v2/refunds/pending", protect, getPendingRefundsV2);
router.post("/v2/refunds/:id/complete", protect, completeRefundV2);

export default router;
