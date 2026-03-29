const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
// Assuming bookingController functions are imported like this:
const {
  createBooking,
  getBookedSlots,
  getMyBookings,
  confirmBooking,
} = require("../controllers/bookingController"); // Fix: Import corrected

router.route("/").post(protect, createBooking).get(protect, getMyBookings);

router.post("/:id/pay", protect, confirmBooking);

router.get("/:futsalId", getBookedSlots);

module.exports = router;
