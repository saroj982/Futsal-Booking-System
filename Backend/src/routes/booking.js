import express from "express";
import { protect, owner } from "../middleware/authMiddleware.js";
import {
  createBooking,
  cancelBooking,
  getBookedSlots,
  getMyBookings,
  getOwnerDashboardBookings,
  getOwnerRefunds,
  completeOwnerRefund,
  confirmBooking,
} from "../controllers/bookingController.js";

const router = express.Router();

router.get("/owner/dashboard", protect, owner, getOwnerDashboardBookings);
router.get("/owner/refunds", protect, owner, getOwnerRefunds);
router.put("/owner/refunds/:id/complete", protect, owner, completeOwnerRefund);
router.route("/").post(protect, createBooking).get(protect, getMyBookings);
router.post("/:id/pay", protect, confirmBooking);
router.post("/:id/cancel", protect, cancelBooking);
router.get("/:futsalId", getBookedSlots);

export default router;
