const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  futsal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Futsal",
    required: true,
  },
  date: {
    type: String, // YYYY-MM-DD
    required: true,
  },
  timeSlots: {
    type: [Number], // Array of starting hours, e.g., [8, 9] for 8-9 and 9-10
    required: true,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled"],
    default: "pending",
  },
  expiresAt: {
    type: Date,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Booking", bookingSchema);
