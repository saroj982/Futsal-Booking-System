import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createBooking,
  getBookedSlots,
  getMyBookings,
  confirmBooking,
} from "../controllers/bookingController.js";

const router = express.Router();

router.route("/").post(protect, createBooking).get(protect, getMyBookings);
router.post("/:id/pay", protect, confirmBooking);
router.get("/:futsalId", getBookedSlots);

export default router;
