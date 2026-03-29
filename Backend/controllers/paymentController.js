const crypto = require("crypto");
const axios = require("axios");
const Booking = require("../models/Booking");

// Generate HMAC SHA256 signature for eSewa
const generateSignature = (message) => {
  const secret = process.env.ESEWA_SECRET_KEY;
  const hash = crypto.createHmac("sha256", secret).update(message).digest("base64");
  return hash;
};

// Generate unique transaction UUID
const generateTransactionUuid = (bookingId) => {
  const timestamp = Date.now();
  return `${bookingId}-${timestamp}`;
};

// @desc    Initiate eSewa payment
// @route   POST /api/payments/esewa/initiate
// @access  Private
const initiateEsewaPayment = async (req, res) => {
  try {
    const { bookingId } = req.body;

    const booking = await Booking.findById(bookingId).populate("futsal");
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: "Not authorized" });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({ message: `Booking is already ${booking.status}` });
    }

    // Check if reservation has expired
    const now = new Date();
    if (now > booking.expiresAt) {
      booking.status = "cancelled";
      await booking.save();
      return res.status(400).json({ 
        message: "Booking reservation expired. Please create a new booking.",
        expired: true
      });
    }

    // IMPORTANT: Check if the slots are still available (not confirmed by someone else)
    const conflict = await Booking.hasConfirmedConflict(
      booking.futsal._id || booking.futsal,
      booking.date,
      booking.timeSlots
    );

    if (conflict) {
      // Slots were taken while this user was waiting
      booking.status = "cancelled";
      await booking.save();
      return res.status(400).json({ 
        message: "Sorry, these slots were just booked by another user. Please select different slots.",
        slotConflict: true
      });
    }

    // Generate transaction UUID
    const transactionUuid = generateTransactionUuid(booking._id);
    
    // Save transaction UUID and mark payment as initiated
    // This extends the effective reservation during payment
    booking.transactionUuid = transactionUuid;
    booking.paymentInitiatedAt = now;
    
    // Extend reservation by 5 more minutes when payment is initiated
    const paymentGracePeriod = 5 * 60 * 1000; // 5 minutes
    const newExpiry = new Date(now.getTime() + paymentGracePeriod);
    if (newExpiry > booking.expiresAt) {
      booking.expiresAt = newExpiry;
    }
    
    await booking.save();

    // Prepare eSewa payment data
    const amount = booking.totalPrice;
    const taxAmount = 0;
    const productServiceCharge = 0;
    const productDeliveryCharge = 0;
    const totalAmount = amount + taxAmount + productServiceCharge + productDeliveryCharge;
    const productCode = process.env.ESEWA_PRODUCT_CODE;

    // Generate signature
    const signatureMessage = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
    const signature = generateSignature(signatureMessage);

    // Payment form data
    const paymentData = {
      amount: amount.toString(),
      tax_amount: taxAmount.toString(),
      total_amount: totalAmount.toString(),
      transaction_uuid: transactionUuid,
      product_code: productCode,
      product_service_charge: productServiceCharge.toString(),
      product_delivery_charge: productDeliveryCharge.toString(),
      success_url: `${process.env.FRONTEND_URL}/payment/success`,
      failure_url: `${process.env.FRONTEND_URL}/payment/failure`,
      signed_field_names: "total_amount,transaction_uuid,product_code",
      signature: signature,
    };

    res.json({
      paymentUrl: process.env.ESEWA_PAYMENT_URL,
      paymentData,
      bookingId: booking._id,
      version: booking.version, // Send version for optimistic locking
    });
  } catch (err) {
    console.error("eSewa initiate error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc    Verify eSewa payment callback
// @route   POST /api/payments/esewa/verify
// @access  Public (called after eSewa redirect)
const verifyEsewaPayment = async (req, res) => {
  try {
    const { data } = req.body; // Base64 encoded response from eSewa

    if (!data) {
      return res.status(400).json({ message: "No payment data received" });
    }

    // Decode Base64 response
    const decodedData = JSON.parse(Buffer.from(data, "base64").toString("utf-8"));
    
    const {
      transaction_code,
      status,
      total_amount,
      transaction_uuid,
      product_code,
      signed_field_names,
      signature: responseSignature,
    } = decodedData;

    // Find booking by transaction UUID
    const booking = await Booking.findOne({ transactionUuid: transaction_uuid });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found for this transaction" });
    }

    // Already processed?
    if (booking.status === "confirmed") {
      return res.json({
        success: true,
        message: "Booking already confirmed",
        booking,
      });
    }

    if (booking.status === "refund_pending") {
      return res.json({
        success: false,
        message: "This booking requires a refund - slots were taken",
        refundRequired: true,
        booking,
      });
    }

    // Verify signature
    const signatureMessage = `transaction_code=${transaction_code},status=${status},total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${product_code},signed_field_names=${signed_field_names}`;
    const expectedSignature = generateSignature(signatureMessage);

    if (responseSignature !== expectedSignature) {
      console.error("Signature mismatch!");
      booking.paymentStatus = "failed";
      await booking.save();
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // Verify transaction status with eSewa API
    const verifyUrl = `${process.env.ESEWA_STATUS_URL}/?product_code=${product_code}&total_amount=${total_amount}&transaction_uuid=${transaction_uuid}`;
    
    let verifyData;
    try {
      const verifyResponse = await axios.get(verifyUrl);
      verifyData = verifyResponse.data;
    } catch (apiError) {
      console.error("eSewa verification API error:", apiError);
      // If we can't verify, don't confirm - but save the ref for manual check
      booking.esewaRefId = transaction_code;
      booking.paymentStatus = "failed";
      await booking.save();
      return res.status(400).json({ 
        message: "Could not verify payment with eSewa. Please contact support.",
        transactionCode: transaction_code 
      });
    }

    if (verifyData.status === "COMPLETE") {
      // Save the eSewa reference ID
      booking.esewaRefId = verifyData.ref_id || transaction_code;

      // Use atomic confirmation to prevent race conditions
      const result = await Booking.atomicConfirm(booking._id, booking.version);

      if (result.success) {
        // Emit socket event for real-time updates
        if (req.io) {
          req.io.emit("bookingUpdated", {
            futsalId: result.booking.futsal.toString(),
            date: result.booking.date,
          });
        }

        return res.json({
          success: true,
          message: "Payment successful! Booking confirmed.",
          booking: result.booking,
        });
      } else if (result.refundRequired) {
        // Another user's payment was confirmed first
        // This payment needs to be refunded
        console.log(`Refund required for booking ${booking._id}: ${result.error}`);
        
        if (req.io) {
          req.io.emit("bookingUpdated", {
            futsalId: result.booking.futsal.toString(),
            date: result.booking.date,
          });
        }

        return res.json({
          success: false,
          message: "Sorry, these slots were just confirmed by another user. Your payment will be refunded within 3-5 business days.",
          refundRequired: true,
          refundAmount: result.booking.refundAmount,
          booking: result.booking,
        });
      } else {
        // Other error (version mismatch, etc.)
        return res.status(400).json({
          success: false,
          message: result.error,
        });
      }
    } else {
      // Payment failed or pending
      booking.paymentStatus = "failed";
      await booking.save();

      return res.status(400).json({
        success: false,
        message: `Payment ${verifyData.status.toLowerCase()}`,
        status: verifyData.status,
      });
    }
  } catch (err) {
    console.error("eSewa verify error:", err);
    res.status(500).json({ message: err.message });
  }
};

// @desc    Check payment status
// @route   GET /api/payments/esewa/status/:bookingId
// @access  Private
const checkPaymentStatus = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (!booking.transactionUuid) {
      return res.json({
        paymentStatus: booking.paymentStatus,
        bookingStatus: booking.status,
        message: "Payment not initiated",
      });
    }

    // Check with eSewa API
    const verifyUrl = `${process.env.ESEWA_STATUS_URL}/?product_code=${process.env.ESEWA_PRODUCT_CODE}&total_amount=${booking.totalPrice}&transaction_uuid=${booking.transactionUuid}`;
    
    try {
      const verifyResponse = await axios.get(verifyUrl);
      const verifyData = verifyResponse.data;

      return res.json({
        paymentStatus: booking.paymentStatus,
        bookingStatus: booking.status,
        esewaStatus: verifyData.status,
        refId: verifyData.ref_id,
        refundRequired: booking.status === "refund_pending",
        refundAmount: booking.refundAmount,
        refundReason: booking.refundReason,
      });
    } catch (apiError) {
      return res.json({
        paymentStatus: booking.paymentStatus,
        bookingStatus: booking.status,
        message: "Could not verify with eSewa",
        refundRequired: booking.status === "refund_pending",
        refundAmount: booking.refundAmount,
      });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get all bookings requiring refund (for admin)
// @route   GET /api/payments/refunds/pending
// @access  Private (Admin only - implement admin check as needed)
const getPendingRefunds = async (req, res) => {
  try {
    const refunds = await Booking.find({
      status: "refund_pending",
    }).populate("user", "name email").populate("futsal", "name");

    res.json(refunds);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Mark refund as completed
// @route   POST /api/payments/refunds/:bookingId/complete
// @access  Private (Admin only)
const completeRefund = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.status !== "refund_pending") {
      return res.status(400).json({ message: "Booking is not pending refund" });
    }

    booking.status = "cancelled";
    booking.paymentStatus = "refunded";
    await booking.save();

    res.json({ message: "Refund marked as completed", booking });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  initiateEsewaPayment,
  verifyEsewaPayment,
  checkPaymentStatus,
  getPendingRefunds,
  completeRefund,
};
