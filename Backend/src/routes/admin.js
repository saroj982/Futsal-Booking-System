/**
 * Admin Routes - Full system management
 */

import express from "express";
import { protect, admin } from "../middleware/authMiddleware.js";
import { ROLE_ADMIN, ROLE_OWNER, ROLE_USER } from "../constants/roles.js";
import User from "../models/User.js";
import Futsal from "../models/Futsal.js";
import Booking from "../models/Booking.js";
import { Reservation, ReservationStatus } from "../models/Reservation.js";
import { PaymentTransaction, PaymentStatus } from "../models/PaymentTransaction.js";

const router = express.Router();

// ============================================
// DASHBOARD STATS
// ============================================

/**
 * GET /api/admin/stats
 * Get dashboard statistics
 */
router.get("/stats", protect, admin, async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get counts
    const [
      totalUsers,
      totalOwners,
      totalFutsals,
      activeFutsals,
      totalBookings,
      confirmedBookings,
      pendingRefunds,
      monthlyBookings,
      lastMonthBookings,
    ] = await Promise.all([
      User.countDocuments({ role: ROLE_USER }),
      User.countDocuments({ role: ROLE_OWNER }),
      Futsal.countDocuments(),
      Futsal.countDocuments({ isActive: true }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: "confirmed" }),
      Booking.countDocuments({ status: "refund_pending" }),
      Booking.countDocuments({ createdAt: { $gte: startOfMonth } }),
      Booking.countDocuments({ 
        createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } 
      }),
    ]);

    // Calculate revenue
    const revenueResult = await Booking.aggregate([
      { $match: { status: "confirmed" } },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;

    const monthlyRevenueResult = await Booking.aggregate([
      { 
        $match: { 
          status: "confirmed",
          createdAt: { $gte: startOfMonth }
        } 
      },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);
    const monthlyRevenue = monthlyRevenueResult[0]?.total || 0;

    // Recent activity
    const recentBookings = await Booking.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("user", "name email")
      .populate("futsal", "name");

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name email role createdAt");

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          owners: totalOwners,
        },
        futsals: {
          total: totalFutsals,
          active: activeFutsals,
        },
        bookings: {
          total: totalBookings,
          confirmed: confirmedBookings,
          pendingRefunds,
          thisMonth: monthlyBookings,
          lastMonth: lastMonthBookings,
          growth: lastMonthBookings > 0 
            ? Math.round(((monthlyBookings - lastMonthBookings) / lastMonthBookings) * 100)
            : 100,
        },
        revenue: {
          total: totalRevenue,
          thisMonth: monthlyRevenue,
        },
      },
      recentBookings,
      recentUsers,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * GET /api/admin/users
 * Get all users with pagination
 */
router.get("/users", protect, admin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const role = req.query.role;
    const search = req.query.search;

    // Exclude admin users from the list
    let query = { role: { $ne: ROLE_ADMIN } };
    if (role && role !== "all") {
      query.role = role;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query),
    ]);

    // Get booking counts for each user
    const userIds = users.map(u => u._id);
    const bookingCounts = await Booking.aggregate([
      { $match: { user: { $in: userIds } } },
      { $group: { _id: "$user", count: { $sum: 1 } } },
    ]);
    const bookingMap = new Map(bookingCounts.map(b => [b._id.toString(), b.count]));

    const usersWithBookings = users.map(u => ({
      ...u.toObject(),
      bookingCount: bookingMap.get(u._id.toString()) || 0,
    }));

    res.json({
      success: true,
      users: usersWithBookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * PUT /api/admin/users/:id/block
 * Block/Unblock a user
 */
router.put("/users/:id/block", protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === ROLE_ADMIN) {
      return res.status(400).json({ message: "Cannot block an admin" });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    res.json({
      success: true,
      message: user.isBlocked ? "User blocked" : "User unblocked",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isBlocked: user.isBlocked,
      },
    });
  } catch (error) {
    console.error("Block user error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user
 */
router.delete("/users/:id", protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === ROLE_ADMIN) {
      return res.status(400).json({ message: "Cannot delete an admin" });
    }

    // Check for active bookings
    const activeBookings = await Booking.countDocuments({
      user: user._id,
      status: { $in: ["pending", "confirmed"] },
    });

    if (activeBookings > 0) {
      return res.status(400).json({ 
        message: "User has active bookings. Cancel them first." 
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// VENUE MANAGEMENT
// ============================================

/**
 * GET /api/admin/futsals
 * Get all futsals with owner info
 */
router.get("/futsals", protect, admin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search;

    let query = {};
    if (status === "active") {
      query.isActive = true;
    } else if (status === "inactive") {
      query.isActive = false;
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
      ];
    }

    const [futsals, total] = await Promise.all([
      Futsal.find(query)
        .populate("owner", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Futsal.countDocuments(query),
    ]);

    // Get booking counts
    const futsalIds = futsals.map(f => f._id);
    const bookingCounts = await Booking.aggregate([
      { $match: { futsal: { $in: futsalIds } } },
      { $group: { _id: "$futsal", count: { $sum: 1 } } },
    ]);
    const bookingMap = new Map(bookingCounts.map(b => [b._id.toString(), b.count]));

    const futsalsWithBookings = futsals.map(f => ({
      ...f.toObject(),
      bookingCount: bookingMap.get(f._id.toString()) || 0,
    }));

    res.json({
      success: true,
      futsals: futsalsWithBookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get futsals error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * PUT /api/admin/futsals/:id/toggle
 * Activate/Deactivate a futsal
 */
router.put("/futsals/:id/toggle", protect, admin, async (req, res) => {
  try {
    const futsal = await Futsal.findById(req.params.id);
    if (!futsal) {
      return res.status(404).json({ message: "Futsal not found" });
    }

    futsal.isActive = !futsal.isActive;
    await futsal.save();

    res.json({
      success: true,
      message: futsal.isActive ? "Futsal activated" : "Futsal deactivated",
      futsal,
    });
  } catch (error) {
    console.error("Toggle futsal error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * DELETE /api/admin/futsals/:id
 * Delete a futsal
 */
router.delete("/futsals/:id", protect, admin, async (req, res) => {
  try {
    const futsal = await Futsal.findById(req.params.id);
    if (!futsal) {
      return res.status(404).json({ message: "Futsal not found" });
    }

    // Check for active bookings
    const activeBookings = await Booking.countDocuments({
      futsal: futsal._id,
      status: { $in: ["pending", "confirmed"] },
    });

    if (activeBookings > 0) {
      return res.status(400).json({ 
        message: "Futsal has active bookings. Cancel them first." 
      });
    }

    await Futsal.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Futsal deleted successfully",
    });
  } catch (error) {
    console.error("Delete futsal error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// BOOKING MANAGEMENT
// ============================================

/**
 * GET /api/admin/bookings
 * Get all bookings
 */
router.get("/bookings", protect, admin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status;

    let query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate("user", "name email")
        .populate("futsal", "name address")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments(query),
    ]);

    res.json({
      success: true,
      bookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get bookings error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * PUT /api/admin/bookings/:id/cancel
 * Cancel a booking (admin override)
 */
router.put("/bookings/:id/cancel", protect, admin, async (req, res) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "Booking already cancelled" });
    }

    // If confirmed, mark for refund
    if (booking.status === "confirmed" && booking.paymentStatus === "paid") {
      booking.status = "refund_pending";
      booking.paymentStatus = "refund_pending";
      booking.refundReason = reason || "Cancelled by admin";
      booking.refundAmount = booking.totalPrice;
    } else {
      booking.status = "cancelled";
    }

    await booking.save();

    res.json({
      success: true,
      message: booking.status === "refund_pending" 
        ? "Booking marked for refund" 
        : "Booking cancelled",
      booking,
    });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// REFUND MANAGEMENT
// ============================================

/**
 * GET /api/admin/refunds
 * Get all pending refunds
 */
router.get("/refunds", protect, admin, async (req, res) => {
  try {
    const [bookingRefunds, reservationRefunds] = await Promise.all([
      Booking.find({ status: "refund_pending" })
        .populate("user", "name email")
        .populate("futsal", "name")
        .sort({ updatedAt: -1 }),
      Reservation.find({ status: ReservationStatus.REFUND_PENDING })
        .populate("user", "name email")
        .populate("futsal", "name")
        .sort({ updatedAt: -1 }),
    ]);

    // Combine refunds
    const refunds = [
      ...bookingRefunds.map(b => ({
        type: "booking",
        id: b._id,
        user: b.user,
        futsal: b.futsal,
        amount: b.refundAmount || b.totalPrice,
        reason: b.refundReason,
        date: b.date,
        timeSlots: b.timeSlots,
        esewaRefId: b.esewaRefId,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })),
      ...reservationRefunds.map(r => ({
        type: "reservation",
        id: r._id,
        reservationId: r.reservationId,
        user: r.user,
        futsal: r.futsal,
        amount: r.refundAmount || r.totalPrice,
        reason: r.refundReason,
        date: r.date,
        hours: r.hours,
        esewaRefId: r.esewaRefId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
    ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.json({
      success: true,
      refunds,
      total: refunds.length,
    });
  } catch (error) {
    console.error("Get refunds error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * PUT /api/admin/refunds/:id/complete
 * Mark refund as completed
 */
router.put("/refunds/:id/complete", protect, admin, async (req, res) => {
  try {
    const { type, refundTransactionId, notes } = req.body;

    if (type === "booking") {
      const booking = await Booking.findById(req.params.id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      booking.status = "cancelled";
      booking.paymentStatus = "refunded";
      await booking.save();

      return res.json({
        success: true,
        message: "Refund marked as completed",
      });
    } else if (type === "reservation") {
      const reservation = await Reservation.findById(req.params.id);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }

      reservation.status = ReservationStatus.CANCELLED;
      reservation.paymentStatus = "REFUNDED";
      await reservation.save();

      // Update payment transaction
      await PaymentTransaction.findOneAndUpdate(
        { reservation: req.params.id },
        {
          $set: {
            status: PaymentStatus.REFUNDED,
            refundedAt: new Date(),
            refundTransactionId,
          },
        }
      );

      return res.json({
        success: true,
        message: "Refund marked as completed",
      });
    }

    res.status(400).json({ message: "Invalid refund type" });
  } catch (error) {
    console.error("Complete refund error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ============================================
// REPORTS
// ============================================

/**
 * GET /api/admin/reports/revenue
 * Get revenue report by date range
 */
router.get("/reports/revenue", protect, admin, async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query;

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    let dateFormat;
    if (groupBy === "month") {
      dateFormat = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
    } else if (groupBy === "week") {
      dateFormat = { $dateToString: { format: "%Y-W%V", date: "$createdAt" } };
    } else {
      dateFormat = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
    }

    const revenue = await Booking.aggregate([
      {
        $match: {
          status: "confirmed",
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: dateFormat,
          revenue: { $sum: "$totalPrice" },
          bookings: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      success: true,
      revenue,
      period: { start, end, groupBy },
    });
  } catch (error) {
    console.error("Revenue report error:", error);
    res.status(500).json({ message: error.message });
  }
});

/**
 * GET /api/admin/reports/popular-venues
 * Get most popular venues
 */
router.get("/reports/popular-venues", protect, admin, async (req, res) => {
  try {
    const popularVenues = await Booking.aggregate([
      { $match: { status: "confirmed" } },
      {
        $group: {
          _id: "$futsal",
          bookings: { $sum: 1 },
          revenue: { $sum: "$totalPrice" },
        },
      },
      { $sort: { bookings: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "futsals",
          localField: "_id",
          foreignField: "_id",
          as: "futsal",
        },
      },
      { $unwind: "$futsal" },
      {
        $project: {
          name: "$futsal.name",
          address: "$futsal.address",
          bookings: 1,
          revenue: 1,
        },
      },
    ]);

    res.json({
      success: true,
      venues: popularVenues,
    });
  } catch (error) {
    console.error("Popular venues report error:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
