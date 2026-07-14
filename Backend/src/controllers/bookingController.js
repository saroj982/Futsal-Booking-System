import Booking from "../models/Booking.js";
import Futsal from "../models/Futsal.js";
import config from "../config/config.js";
import { ROLE_OWNER } from "../constants/roles.js";

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Private
const createBooking = async (req, res) => {
  // Check if user is an owner
  if (req.user.role === ROLE_OWNER) {
    return res
      .status(403)
      .json({ message: "Futsal owners are not allowed to make bookings." });
  }

  const { futsalId, date, timeSlots } = req.body; // timeSlots is array of numbers [8, 9]

  try {
    const futsal = await Futsal.findById(futsalId);
    if (!futsal) {
      return res.status(404).json({ message: "Futsal not found" });
    }

    // Check if day is open
    // Create a date object from the date string (YYYY-MM-DD)
    const bookingDate = new Date(date);
    const dayOfWeek = bookingDate.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC",
    });

    // Ensure accurate day check mapping to what's stored (e.g., "Sunday")
    // We use UTC to avoid timezone shifts on the server side when just checking the date string

    if (!futsal.openDays.includes(dayOfWeek)) {
      return res
        .status(400)
        .json({ message: `Futsal is closed on ${dayOfWeek}` });
    }

    const now = new Date();

    // Verify no existing pending bookings for user across ALL futsals
    const userPendingBookings = await Booking.findOne({
      user: req.user._id,
      status: "pending",
      expiresAt: { $gt: now },
    });

    if (userPendingBookings) {
      return res.status(400).json({
        message:
          "You already have a pending reservation. Please pay or wait for it to expire.",
      });
    }

    // Verify slots are not already booked
    const existingBookings = await Booking.find({
      futsal: futsalId,
      date: date,
      $or: [
        { status: "confirmed" },
        { status: "pending", expiresAt: { $gt: now } },
      ],
    });

    const bookedSlots = existingBookings.reduce(
      (acc, booking) => [...acc, ...booking.timeSlots],
      [],
    );
    const doubleBooked = timeSlots.some((slot) => bookedSlots.includes(slot));

    if (doubleBooked) {
      return res.status(400).json({
        message: "One or more selected slots are already booked or reserved.",
      });
    }

    // Check if slot time has passed for today
    const currentDate = new Date();
    const isToday =
      currentDate.toISOString().split("T")[0] ===
      bookingDate.toISOString().split("T")[0];

    if (isToday) {
      const currentHour = currentDate.getHours();
      const hasPassed = timeSlots.some((slot) => slot <= currentHour);
      if (hasPassed) {
        return res
          .status(400)
          .json({ message: "Cannot book slots in the past." });
      }
    }

    const totalPrice = timeSlots.length * futsal.pricePerHour;
    const expiresAt = new Date(
      now.getTime() + config.slotExpireTime * 60 * 1000,
    );

    const booking = new Booking({
      user: req.user._id,
      futsal: futsalId,
      date,
      timeSlots,
      totalPrice,
      status: "pending",
      expiresAt: expiresAt,
    });

    const savedBooking = await booking.save();

    // Emit socket event for real-time updates
    if (req.io) {
      req.io.emit("bookingUpdated", { futsalId, date });

      // Schedule expiration check (in-memory for demo)
      setTimeout(
        async () => {
          try {
            const b = await Booking.findById(savedBooking._id);
            if (b && b.status === "pending") {
              // It has expired
              if (req.io)
                req.io.emit("bookingUpdated", {
                  futsalId: futsalId.toString(),
                  date,
                });
            }
          } catch (e) {
            console.error(e);
          }
        },
        config.slotExpireTime * 60 * 1000,
      );
    }
    res.status(201).json(savedBooking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Confirm booking (Payment simulation)
// @route   POST /api/bookings/:id/pay
// @access  Private
const confirmBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    if (booking.status !== "pending") {
      return res
        .status(400)
        .json({ message: `Booking is already ${booking.status}` });
    }

    if (new Date() > booking.expiresAt) {
      booking.status = "cancelled";
      await booking.save();
      return res.status(400).json({ message: "Booking reservation expired" });
    }

    booking.status = "confirmed";
    const updatedBooking = await booking.save();

    if (req.io) {
      req.io.emit("bookingUpdated", {
        futsalId: booking.futsal,
        date: booking.date,
      });
    }

    res.json(updatedBooking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get booked slots for a futsal on a date
// @route   GET /api/bookings/:futsalId
// @access  Public
const getBookedSlots = async (req, res) => {
  const { date } = req.query;
  try {
    const bookings = await Booking.find({
      futsal: req.params.futsalId,
      date: date,
      $or: [
        { status: "confirmed" },
        { status: "pending", expiresAt: { $gt: new Date() } },
      ],
    });

    const bookedSlots = bookings.reduce(
      (acc, booking) => [...acc, ...booking.timeSlots],
      [],
    );
    res.json(bookedSlots);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get owner booking dashboard overview
// @route   GET /api/bookings/owner/dashboard
// @access  Private (Owner)
const getOwnerDashboardBookings = async (req, res) => {
  try {
    const futsals = await Futsal.find({ owner: req.user._id }).select("_id name");
    const futsalIds = futsals.map((futsal) => futsal._id);

    const bookings = await Booking.find({ futsal: { $in: futsalIds } })
      .populate("futsal", "name")
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    const today = new Date().toISOString().split("T")[0];

    const stats = {
      totalBookings: bookings.length,
      pending: bookings.filter((booking) => booking.status === "pending").length,
      active: bookings.filter(
        (booking) => booking.status === "confirmed" && booking.date >= today,
      ).length,
      completed: bookings.filter(
        (booking) => booking.status === "confirmed" && booking.date < today,
      ).length,
    };

    const formattedBookings = bookings.map((booking) => ({
      ...booking.toObject(),
      customerName: booking.user?.name || "Unknown guest",
      customerEmail: booking.user?.email || "",
      futsalName: booking.futsal?.name || "Unknown venue",
    }));

    const recentBookings = formattedBookings.slice(0, 10);

    res.json({ stats, bookings: formattedBookings, recentBookings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get refund requests for owner's venues
// @route   GET /api/bookings/owner/refunds
// @access  Private (Owner)
const getOwnerRefunds = async (req, res) => {
  try {
    const futsals = await Futsal.find({ owner: req.user._id }).select("_id");
    const futsalIds = futsals.map((futsal) => futsal._id);

    const refunds = await Booking.find({
      futsal: { $in: futsalIds },
      status: "refund_pending",
    })
      .populate("user", "name email")
      .populate("futsal", "name")
      .sort({ updatedAt: -1 });

    const formattedRefunds = refunds.map((refund) => ({
      _id: refund._id,
      user: refund.user,
      futsal: refund.futsal,
      amount: refund.refundAmount || refund.totalPrice,
      reason: refund.refundReason || "Double booking conflict",
      date: refund.date,
      timeSlots: refund.timeSlots,
      esewaRefId: refund.esewaRefId,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
    }));

    res.json({ success: true, refunds: formattedRefunds, total: formattedRefunds.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Mark an owner refund as completed
// @route   PUT /api/bookings/owner/refunds/:id/complete
// @access  Private (Owner)
const completeOwnerRefund = async (req, res) => {
  try {
    const futsals = await Futsal.find({ owner: req.user._id }).select("_id");
    const futsalIds = futsals.map((futsal) => futsal._id);

    const refund = await Booking.findOne({
      _id: req.params.id,
      futsal: { $in: futsalIds },
      status: "refund_pending",
    });

    if (!refund) {
      return res.status(404).json({ message: "Refund request not found" });
    }

    refund.status = "cancelled";
    refund.paymentStatus = "refunded";
    await refund.save();

    res.json({ success: true, message: "Refund marked as completed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get user bookings
// @route   GET /api/bookings/mys
// @access  Private
const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id }).populate(
      "futsal",
    );
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const checkExpiredBookings = async (io) => {
  try {
    const expiredBookings = await Booking.find({
      status: "pending",
      expiresAt: { $lt: new Date() },
    });

    if (expiredBookings.length > 0) {
      for (const booking of expiredBookings) {
        booking.status = "cancelled";
        await booking.save();
        io.emit("bookingUpdated", {
          futsalId: booking.futsal.toString(),
          date: booking.date,
        });
      }
      console.log(`Cleaned up ${expiredBookings.length} expired bookings.`);
    }
  } catch (error) {
    console.error("Error cleaning up expired bookings:", error);
  }
};

export {
  createBooking,
  getBookedSlots,
  getMyBookings,
  getOwnerDashboardBookings,
  getOwnerRefunds,
  completeOwnerRefund,
  confirmBooking,
  checkExpiredBookings,
};
