import express from "express";
import { protect, owner } from "../middleware/authMiddleware.js";
import {
  createBooking,
  getBookedSlots,
  getMyBookings,
  getOwnerDashboardBookings,
  confirmBooking,
} from "../controllers/bookingController.js";

const router = express.Router();

router.get("/owner/dashboard", protect, owner, getOwnerDashboardBookings);
router.route("/").post(protect, createBooking).get(protect, getMyBookings);
router.post("/:id/pay", protect, confirmBooking);
router.get("/:futsalId", getBookedSlots);

export default router;
