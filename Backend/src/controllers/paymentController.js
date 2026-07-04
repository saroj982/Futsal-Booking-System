import crypto from "crypto";
import axios from "axios";
import Booking from "../models/Booking.js";
import { Reservation, ReservationStatus } from "../models/Reservation.js";
import { PaymentTransaction, PaymentStatus } from "../models/PaymentTransaction.js";
import config from "../config/config.js";
import { sendBookingConfirmationEmails } from "../services/email.service.js";

// Generate HMAC SHA256 signature for eSewa
const generateSignature = (message) => {
  const secret = config.esewa.secretKey;
  const hash = crypto.createHmac("sha256", secret).update(message).digest("base64");
  return hash;
};

// Generate unique transaction UUID (alphanumeric and hyphen only as per eSewa docs)
const generateTransactionUuid = (bookingId) => {
  const timestamp = Date.now();
  // Use only last 8 chars of bookingId to keep it short and simple
  const shortId = bookingId.toString().slice(-8);
  return `${shortId}-${timestamp}`;
};

// Generate idempotency key
const generateIdempotencyKey = (userId, reservationId) => {
  return `PAY-${userId}-${reservationId}-${Date.now()}`;
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
    const paymentGracePeriod = 0.5 * 60 * 1000; // 10sec
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

        sendBookingConfirmationEmails({
          userId: result.booking.user,
          futsalId: result.booking.futsal,
          date: result.booking.date,
          timeSlots: result.booking.timeSlots,
          totalPrice: result.booking.totalPrice,
          transactionRef: booking.esewaRefId || transaction_code,
        });

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

// ===========================================
// V2 PAYMENT FLOW - Uses Reservation Model
// Designed to prevent double payments
// ===========================================

/**
 * @desc    Initiate eSewa payment (V2 - Race-safe)
 * @route   POST /api/payments/v2/esewa/initiate
 * @access  Private
 * 
 * Key safeguards:
 * 1. Validates reservation ownership and status
 * 2. Checks reservation hasn't expired
 * 3. Atomically transitions to PAYMENT_PENDING (blocking others)
 * 4. Creates PaymentTransaction for audit trail
 * 5. Uses idempotency key to prevent duplicate payments
 */
const initiateEsewaPaymentV2 = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { reservationId, idempotencyKey: clientIdempotencyKey } = req.body;
    const userId = req.user._id;
    const now = new Date();
    
    // 1. Find and validate reservation
    const reservation = await Reservation.findOne({
      _id: reservationId,
      user: userId,
    }).populate("futsal").session(session);
    
    if (!reservation) {
      await session.abortTransaction();
      return res.status(404).json({ 
        message: "Reservation not found",
        code: "RESERVATION_NOT_FOUND"
      });
    }
    
    // 2. Check if already in payment or booked (idempotent response)
    if (reservation.status === ReservationStatus.BOOKED) {
      await session.abortTransaction();
      return res.json({
        success: true,
        message: "Already booked",
        status: "BOOKED",
        reservation,
      });
    }
    
    if (reservation.status === ReservationStatus.PAYMENT_PENDING) {
      // Return existing payment data if already in payment flow
      const existingTransaction = await PaymentTransaction.findOne({
        reservation: reservationId,
        status: { $in: [PaymentStatus.INITIATED, PaymentStatus.PENDING] },
      }).session(session);
      
      if (existingTransaction) {
        await session.abortTransaction();
        
        // Re-generate payment form data for the existing transaction
        const amount = reservation.totalPrice;
        const totalAmount = amount;
        const productCode = process.env.ESEWA_PRODUCT_CODE;
        const signatureMessage = `total_amount=${totalAmount},transaction_uuid=${existingTransaction.transactionUuid},product_code=${productCode}`;
        const signature = generateSignature(signatureMessage);
        
        return res.json({
          success: true,
          message: "Payment already initiated",
          duplicate: true,
          paymentUrl: process.env.ESEWA_PAYMENT_URL,
          paymentData: {
            amount: amount.toString(),
            tax_amount: "0",
            total_amount: totalAmount.toString(),
            transaction_uuid: existingTransaction.transactionUuid,
            product_code: productCode,
            product_service_charge: "0",
            product_delivery_charge: "0",
            success_url: `${process.env.FRONTEND_URL}/payment/success`,
            failure_url: `${process.env.FRONTEND_URL}/payment/failure`,
            signed_field_names: "total_amount,transaction_uuid,product_code",
            signature: signature,
          },
          transactionId: existingTransaction.transactionId,
          reservationId: reservation._id,
        });
      }
    }
    
    // 3. Check if reservation is in valid state
    if (reservation.status !== ReservationStatus.RESERVED) {
      await session.abortTransaction();
      return res.status(400).json({
        message: `Cannot initiate payment: reservation is ${reservation.status}`,
        code: "INVALID_RESERVATION_STATUS",
        status: reservation.status,
      });
    }
    
    // 4. Check if reservation has expired
    if (now > reservation.expiresAt) {
      // Mark as expired
      await Reservation.findByIdAndUpdate(
        reservationId,
        {
          $set: {
            status: ReservationStatus.EXPIRED,
            expiredAt: now,
          },
          $inc: { version: 1 },
        },
        { session }
      );
      
      await session.commitTransaction();
      return res.status(400).json({
        message: "Reservation has expired. Please create a new reservation.",
        code: "RESERVATION_EXPIRED",
        expired: true,
      });
    }
    
    // 5. Generate unique transaction UUID and idempotency key
    const transactionUuid = generateTransactionUuid(reservationId);
    const idempotencyKey = clientIdempotencyKey || generateIdempotencyKey(userId, reservationId);
    
    // 6. Create PaymentTransaction with idempotency check
    const { transaction, duplicate } = await PaymentTransaction.createWithIdempotency(
      reservationId,
      userId,
      reservation.totalPrice,
      "ESEWA",
      idempotencyKey,
      transactionUuid
    );
    
    if (duplicate) {
      await session.abortTransaction();
      return res.json({
        success: true,
        message: "Payment already initiated (idempotent)",
        duplicate: true,
        transactionId: transaction.transactionId,
      });
    }
    
    // 7. Atomically transition reservation to PAYMENT_PENDING
    // This BLOCKS other users from reserving the same slot
    const paymentExtensionMinutes = parseInt(process.env.PAYMENT_EXTENSION_MINUTES) || 5;
    const updatedReservation = await Reservation.atomicStartPayment(
      reservationId,
      userId,
      transaction.transactionId,
      paymentExtensionMinutes
    );
    
    if (!updatedReservation) {
      // Reservation was modified/expired concurrently
      await PaymentTransaction.findByIdAndUpdate(transaction._id, {
        $set: { status: PaymentStatus.CANCELLED, errorMessage: "Reservation no longer valid" },
      });
      
      await session.abortTransaction();
      return res.status(400).json({
        message: "Reservation is no longer valid. It may have expired or been modified.",
        code: "RESERVATION_INVALID",
      });
    }
    
    // 8. Prepare eSewa payment data
    const amount = reservation.totalPrice;
    const totalAmount = amount;
    const productCode = process.env.ESEWA_PRODUCT_CODE;
    
    const signatureMessage = `total_amount=${totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
    const signature = generateSignature(signatureMessage);
    
    const paymentData = {
      amount: amount.toString(),
      tax_amount: "0",
      total_amount: totalAmount.toString(),
      transaction_uuid: transactionUuid,
      product_code: productCode,
      product_service_charge: "0",
      product_delivery_charge: "0",
      success_url: `${process.env.FRONTEND_URL}/payment/success`,
      failure_url: `${process.env.FRONTEND_URL}/payment/failure`,
      signed_field_names: "total_amount,transaction_uuid,product_code",
      signature: signature,
    };
    
    // 9. Update transaction with gateway request data
    await PaymentTransaction.markPending(transaction._id, paymentData);
    
    await session.commitTransaction();
    
    res.json({
      success: true,
      paymentUrl: process.env.ESEWA_PAYMENT_URL,
      paymentData,
      transactionId: transaction.transactionId,
      reservationId: reservation._id,
      expiresAt: updatedReservation.expiresAt,
    });
    
  } catch (err) {
    await session.abortTransaction();
    console.error("eSewa V2 initiate error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

/**
 * @desc    Verify eSewa payment callback (V2 - Race-safe)
 * @route   POST /api/payments/v2/esewa/verify
 * @access  Public (called after eSewa redirect)
 * 
 * Key safeguards:
 * 1. Processes webhook idempotently (only once per transactionUuid)
 * 2. Re-validates reservation status AFTER payment success
 * 3. Uses atomic confirmation to ensure only one winner
 * 4. Queues for refund if payment succeeded but reservation is invalid
 */
const verifyEsewaPaymentV2 = async (req, res) => {
  try {
    const { data } = req.body;
    
    if (!data) {
      return res.status(400).json({ message: "No payment data received" });
    }
    
    // 1. Decode Base64 response from eSewa
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
    
    // 2. Find payment transaction by UUID
    const transaction = await PaymentTransaction.findOne({ transactionUuid: transaction_uuid });
    
    if (!transaction) {
      console.error(`Transaction not found for UUID: ${transaction_uuid}`);
      return res.status(404).json({ 
        message: "Transaction not found",
        code: "TRANSACTION_NOT_FOUND"
      });
    }
    
    // 3. Check if already processed (idempotent)
    if (transaction.webhookProcessed) {
      console.log(`Duplicate webhook for transaction: ${transaction.transactionId}`);
      
      // Return appropriate response based on final status
      const reservation = await Reservation.findById(transaction.reservation);
      
      if (reservation?.status === ReservationStatus.BOOKED) {
        return res.json({
          success: true,
          message: "Booking already confirmed",
          duplicate: true,
          reservation,
          transactionId: transaction.transactionId,
        });
      }
      
      if (reservation?.status === ReservationStatus.REFUND_PENDING || 
          transaction.status === PaymentStatus.STALE) {
        return res.json({
          success: false,
          message: "Payment received but slot was lost. Refund will be processed.",
          refundRequired: true,
          refundAmount: transaction.refundAmount || transaction.amount,
          transactionId: transaction.transactionId,
        });
      }
      
      return res.json({
        success: false,
        message: "Payment already processed",
        duplicate: true,
        status: transaction.status,
      });
    }
    
    // 4. Verify eSewa signature
    const signatureMessage = `transaction_code=${transaction_code},status=${status},total_amount=${total_amount},transaction_uuid=${transaction_uuid},product_code=${product_code},signed_field_names=${signed_field_names}`;
    const expectedSignature = generateSignature(signatureMessage);
    
    if (responseSignature !== expectedSignature) {
      console.error("eSewa signature mismatch!");
      
      await PaymentTransaction.processWebhook(
        transaction_uuid,
        decodedData,
        false,
        transaction_code
      );
      
      return res.status(400).json({ 
        message: "Invalid payment signature",
        code: "SIGNATURE_MISMATCH"
      });
    }
    
    // 5. Verify with eSewa API
    const verifyUrl = `${process.env.ESEWA_STATUS_URL}/?product_code=${product_code}&total_amount=${total_amount}&transaction_uuid=${transaction_uuid}`;
    
    let verifyData;
    try {
      const verifyResponse = await axios.get(verifyUrl);
      verifyData = verifyResponse.data;
    } catch (apiError) {
      console.error("eSewa verification API error:", apiError);
      
      // Can't verify - mark as failed
      await PaymentTransaction.processWebhook(
        transaction_uuid,
        decodedData,
        false,
        transaction_code
      );
      
      return res.status(400).json({
        message: "Could not verify payment with eSewa. Please contact support.",
        code: "VERIFICATION_FAILED",
        transactionCode: transaction_code,
      });
    }
    
    // 6. Payment NOT complete
    if (verifyData.status !== "COMPLETE") {
      await PaymentTransaction.processWebhook(
        transaction_uuid,
        { ...decodedData, verifyData },
        false,
        transaction_code
      );
      
      // Update reservation status
      await Reservation.findByIdAndUpdate(transaction.reservation, {
        $set: { paymentStatus: "FAILED" },
        $inc: { version: 1 },
      });
      
      return res.status(400).json({
        success: false,
        message: `Payment ${verifyData.status.toLowerCase()}`,
        status: verifyData.status,
      });
    }
    
    // =====================================
    // PAYMENT SUCCESS - Critical Section
    // =====================================
    
    // 7. Process webhook atomically (marks as processed to prevent duplicates)
    const webhookResult = await PaymentTransaction.processWebhook(
      transaction_uuid,
      { ...decodedData, verifyData },
      true,
      verifyData.ref_id || transaction_code
    );
    
    if (webhookResult.duplicate) {
      console.log(`Webhook already processed: ${transaction_uuid}`);
      // Continue to return status
    }
    
    // 8. CRITICAL: Attempt to confirm booking atomically
    // This is the FINAL gate that prevents double booking
    const confirmResult = await Reservation.atomicConfirmBooking(
      transaction.reservation,
      transaction.user,
      transaction.transactionId,
      verifyData.ref_id || transaction_code
    );
    
    // 9. Emit socket events
    const reservation = await Reservation.findById(transaction.reservation);
    if (req.io && reservation) {
      req.io.emit("bookingUpdated", {
        futsalId: reservation.futsal.toString(),
        date: reservation.date,
      });
    }
    
    // 10. Handle confirmation result
    if (confirmResult.success) {
      if (!confirmResult.duplicate && confirmResult.reservation) {
        sendBookingConfirmationEmails({
          userId: confirmResult.reservation.user,
          futsalId: confirmResult.reservation.futsal,
          date: confirmResult.reservation.date,
          hours: confirmResult.reservation.hours,
          totalPrice: confirmResult.reservation.totalPrice,
          transactionRef: verifyData.ref_id || transaction_code,
        });
      }

      return res.json({
        success: true,
        message: "Payment successful! Booking confirmed.",
        reservation: confirmResult.reservation,
        transactionId: transaction.transactionId,
      });
    }
    
    // 11. Booking failed - payment succeeded but reservation invalid
    // This is the DOUBLE PAYMENT scenario - queue for refund
    console.log(`Booking confirmation failed for transaction ${transaction.transactionId}:`, confirmResult.error);
    
    // Mark transaction as STALE (payment succeeded but booking failed)
    await PaymentTransaction.findByIdAndUpdate(transaction._id, {
      $set: {
        status: PaymentStatus.REFUND_PENDING,
        refundReason: confirmResult.message || confirmResult.error,
        refundAmount: transaction.amount,
      },
      $inc: { version: 1 },
    });
    
    return res.json({
      success: false,
      message: confirmResult.message || "Reservation is no longer valid. Your payment will be refunded within 3-5 business days.",
      refundRequired: true,
      refundAmount: transaction.amount,
      reason: confirmResult.error,
      transactionId: transaction.transactionId,
    });
    
  } catch (err) {
    console.error("eSewa V2 verify error:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc    Check V2 payment status
 * @route   GET /api/payments/v2/status/:reservationId
 * @access  Private
 */
const checkPaymentStatusV2 = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const userId = req.user._id;
    
    const reservation = await Reservation.findOne({
      _id: reservationId,
      user: userId,
    }).populate("futsal");
    
    if (!reservation) {
      return res.status(404).json({ message: "Reservation not found" });
    }
    
    const transaction = await PaymentTransaction.findOne({
      reservation: reservationId,
    }).sort({ createdAt: -1 });
    
    res.json({
      reservationStatus: reservation.status,
      paymentStatus: reservation.paymentStatus,
      transactionStatus: transaction?.status,
      refundRequired: reservation.status === ReservationStatus.REFUND_PENDING || 
                      transaction?.status === PaymentStatus.REFUND_PENDING,
      refundAmount: reservation.refundAmount || transaction?.refundAmount,
      refundReason: reservation.refundReason || transaction?.refundReason,
      expiresAt: reservation.expiresAt,
      isExpired: new Date() > reservation.expiresAt,
    });
    
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc    Get all V2 transactions requiring refund
 * @route   GET /api/payments/v2/refunds/pending
 * @access  Private (Admin)
 */
const getPendingRefundsV2 = async (req, res) => {
  try {
    // Get from both Reservation and PaymentTransaction
    const [reservationRefunds, transactionRefunds] = await Promise.all([
      Reservation.find({
        status: ReservationStatus.REFUND_PENDING,
      }).populate("user", "name email").populate("futsal", "name"),
      
      PaymentTransaction.find({
        status: PaymentStatus.REFUND_PENDING,
      }).populate("user", "name email").populate({
        path: "reservation",
        populate: { path: "futsal", select: "name" },
      }),
    ]);
    
    // Combine and dedupe
    const refundMap = new Map();
    
    for (const r of reservationRefunds) {
      refundMap.set(r._id.toString(), {
        type: "reservation",
        id: r._id,
        reservationId: r.reservationId,
        user: r.user,
        futsal: r.futsal,
        amount: r.refundAmount,
        reason: r.refundReason,
        date: r.date,
        hours: r.hours,
        createdAt: r.createdAt,
      });
    }
    
    for (const t of transactionRefunds) {
      const key = t.reservation?._id?.toString() || t._id.toString();
      if (!refundMap.has(key)) {
        refundMap.set(key, {
          type: "transaction",
          id: t._id,
          transactionId: t.transactionId,
          reservationId: t.reservation?.reservationId,
          user: t.user,
          futsal: t.reservation?.futsal,
          amount: t.refundAmount,
          reason: t.refundReason,
          esewaRefId: t.esewaRefId,
          createdAt: t.createdAt,
        });
      }
    }
    
    res.json(Array.from(refundMap.values()));
    
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc    Mark V2 refund as completed
 * @route   POST /api/payments/v2/refunds/:id/complete
 * @access  Private (Admin)
 */
const completeRefundV2 = async (req, res) => {
  try {
    const { id } = req.params;
    const { refundTransactionId, notes } = req.body;
    const now = new Date();
    
    // Try to find as reservation first
    let reservation = await Reservation.findById(id);
    
    if (reservation && reservation.status === ReservationStatus.REFUND_PENDING) {
      reservation.status = ReservationStatus.CANCELLED;
      reservation.paymentStatus = "REFUNDED";
      await reservation.save();
      
      // Also update related transaction
      await PaymentTransaction.findOneAndUpdate(
        { reservation: id },
        {
          $set: {
            status: PaymentStatus.REFUNDED,
            refundedAt: now,
            refundTransactionId,
          },
        }
      );
      
      return res.json({
        message: "Refund marked as completed",
        reservation,
      });
    }
    
    // Try as transaction
    const transaction = await PaymentTransaction.findById(id);
    
    if (transaction && transaction.status === PaymentStatus.REFUND_PENDING) {
      transaction.status = PaymentStatus.REFUNDED;
      transaction.refundedAt = now;
      transaction.refundTransactionId = refundTransactionId;
      await transaction.save();
      
      // Update related reservation
      await Reservation.findByIdAndUpdate(
        transaction.reservation,
        {
          $set: {
            status: ReservationStatus.CANCELLED,
            paymentStatus: "REFUNDED",
          },
        }
      );
      
      return res.json({
        message: "Refund marked as completed",
        transaction,
      });
    }
    
    return res.status(404).json({ message: "Refund request not found or already processed" });
    
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc    Cancel pending payment (V2)
 * @route   POST /api/payments/v2/cancel/:reservationId
 * @access  Private
 */
const cancelPaymentV2 = async (req, res) => {
  try {
    const { reservationId } = req.params;
    const userId = req.user._id;
    
    const result = await Reservation.cancelReservation(reservationId, userId, "User cancelled payment");
    
    if (!result.success) {
      return res.status(400).json({
        message: result.message || result.error,
        code: result.error,
      });
    }
    
    // Cancel related transactions
    await PaymentTransaction.updateMany(
      {
        reservation: reservationId,
        status: { $in: [PaymentStatus.INITIATED, PaymentStatus.PENDING] },
      },
      {
        $set: {
          status: PaymentStatus.CANCELLED,
          errorMessage: "User cancelled",
        },
      }
    );
    
    if (req.io) {
      const reservation = await Reservation.findById(reservationId);
      if (reservation) {
        req.io.emit("bookingUpdated", {
          futsalId: reservation.futsal.toString(),
          date: reservation.date,
        });
      }
    }
    
    res.json({
      success: true,
      message: result.refundRequired 
        ? "Payment cancelled. Refund will be processed." 
        : "Reservation cancelled.",
      refundRequired: result.refundRequired,
      refundAmount: result.refundAmount,
    });
    
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export {
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
};
