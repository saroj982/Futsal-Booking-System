/**
 * useBooking Hook - Race-condition-safe booking flow
 * 
 * This hook provides:
 * - reserveSlot() - Atomic slot reservation
 * - initiatePayment() - Payment initiation with validation
 * - cancelReservation() - Cancel active reservation
 * - Automatic expiry countdown
 * - Real-time updates via socket
 */

import { useState, useEffect, useCallback, useRef, useContext } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { toast } from "react-hot-toast";
import AuthContext from "../context/AuthContext";

const API_BASE = "/api/v2/bookings";

export function useBooking(futsalId, date) {
  const { user } = useContext(AuthContext);
  const [reservation, setReservation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [availableSlots, setAvailableSlots] = useState([]);
  const socketRef = useRef(null);
  const timerRef = useRef(null);

  // Fetch available slots
  const fetchSlots = useCallback(async () => {
    if (!futsalId || !date) return;
    
    try {
      const { data } = await axios.get(`${API_BASE}/slots/${futsalId}/${date}`);
      if (data.success) {
        setAvailableSlots(data.slots);
      }
    } catch (err) {
      console.error("Failed to fetch slots:", err);
    }
  }, [futsalId, date]);

  // Check for existing active reservation
  const checkExistingReservation = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data } = await axios.get(`${API_BASE}/my-reservations`);
      if (data.success) {
        // Find active reservation for this futsal/date
        const active = data.reservations.find(r => 
          r.futsal?._id === futsalId &&
          r.date === date &&
          ["RESERVED", "PAYMENT_PENDING"].includes(r.status)
        );
        
        if (active) {
          setReservation(active);
          updateTimeLeft(active.expiresAt);
        }
      }
    } catch (err) {
      console.error("Failed to check reservations:", err);
    }
  }, [futsalId, date, user]);

  // Update countdown timer
  const updateTimeLeft = useCallback((expiresAt) => {
    if (!expiresAt) {
      setTimeLeft(0);
      return;
    }
    
    const expiry = new Date(expiresAt);
    const now = new Date();
    const diff = Math.max(0, Math.floor((expiry - now) / 1000));
    setTimeLeft(diff);
  }, []);

  // Countdown effect
  useEffect(() => {
    if (reservation?.expiresAt && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            // Reservation expired
            setReservation(null);
            toast.error("Reservation expired");
            fetchSlots();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timerRef.current);
    }
  }, [reservation?.expiresAt, timeLeft, fetchSlots]);

  // Socket connection for real-time updates
  useEffect(() => {
    socketRef.current = io("http://localhost:5000");
    
    socketRef.current.on("bookingUpdated", (data) => {
      if (data.futsalId === futsalId && data.date === date) {
        fetchSlots();
      }
    });
    
    socketRef.current.on("bookingConfirmed", (data) => {
      if (reservation && data.reservationId === reservation._id) {
        toast.success("Booking confirmed!");
      }
    });
    
    return () => {
      socketRef.current?.disconnect();
    };
  }, [futsalId, date, reservation, fetchSlots]);

  // Initial fetch
  useEffect(() => {
    fetchSlots();
    checkExistingReservation();
  }, [fetchSlots, checkExistingReservation]);

  /**
   * Reserve slots atomically
   * @param {number[]} hours - Hours to reserve
   * @param {string} idempotencyKey - Optional idempotency key
   */
  const reserveSlot = useCallback(async (hours, idempotencyKey = null) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data } = await axios.post(`${API_BASE}/reserve`, {
        futsalId,
        date,
        hours,
        idempotencyKey,
      });
      
      if (data.success) {
        setReservation(data.reservation);
        updateTimeLeft(data.reservation.expiresAt);
        fetchSlots();
        
        if (data.duplicate) {
          toast.success("Reservation already exists");
        } else {
          const minutes = Math.ceil(timeLeft / 60) || 5;
          toast.success(`Slots reserved! Pay within ${minutes} minutes.`);
        }
        
        return { success: true, reservation: data.reservation };
      }
      
      return { success: false, error: data.error };
      
    } catch (err) {
      const errorData = err.response?.data || {};
      const errorMessage = errorData.message || "Failed to reserve slot";
      
      setError(errorMessage);
      
      // Handle specific errors
      if (errorData.error === "SLOT_ALREADY_RESERVED") {
        toast.error("This slot was just taken by another user");
        fetchSlots();
      } else if (errorData.error === "SLOT_RACE_CONDITION") {
        toast.error("Slot taken! Please try again.");
        fetchSlots();
      } else {
        toast.error(errorMessage);
      }
      
      return { success: false, error: errorData.error, message: errorMessage };
      
    } finally {
      setLoading(false);
    }
  }, [futsalId, date, fetchSlots, updateTimeLeft, timeLeft]);

  /**
   * Initiate payment for reservation
   * @param {string} idempotencyKey - Optional idempotency key
   */
  const initiatePayment = useCallback(async (idempotencyKey = null) => {
    if (!reservation) {
      toast.error("No active reservation");
      return { success: false, error: "NO_RESERVATION" };
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const { data } = await axios.post(`${API_BASE}/pay/init`, {
        reservationId: reservation._id,
        idempotencyKey,
      });
      
      if (!data.success) {
        // Handle specific errors
        if (data.error === "RESERVATION_EXPIRED") {
          toast.error("Reservation expired. Please book again.");
          setReservation(null);
          fetchSlots();
        } else if (data.error === "SLOT_LOST") {
          toast.error("Slot was released. Please book again.");
          setReservation(null);
          fetchSlots();
        } else {
          toast.error(data.message || "Failed to initiate payment");
        }
        return { success: false, error: data.error };
      }
      
      // Handle already completed
      if (data.alreadyBooked) {
        toast.success("Already booked!");
        return { success: true, alreadyBooked: true };
      }
      
      if (data.alreadyPaid) {
        toast.success("Payment already completed");
        return { success: true, alreadyPaid: true };
      }
      
      // Update expiry (extended for payment)
      if (data.expiresAt) {
        updateTimeLeft(data.expiresAt);
        setReservation(prev => ({ ...prev, expiresAt: data.expiresAt }));
      }
      
      return {
        success: true,
        paymentUrl: data.paymentUrl,
        paymentData: data.paymentData,
        transactionUuid: data.transactionUuid,
      };
      
    } catch (err) {
      const errorData = err.response?.data || {};
      const errorMessage = errorData.message || "Failed to initiate payment";
      
      setError(errorMessage);
      toast.error(errorMessage);
      
      if (["RESERVATION_EXPIRED", "SLOT_LOST"].includes(errorData.error)) {
        setReservation(null);
        fetchSlots();
      }
      
      return { success: false, error: errorData.error, message: errorMessage };
      
    } finally {
      setLoading(false);
    }
  }, [reservation, fetchSlots, updateTimeLeft]);

  /**
   * Submit payment to eSewa
   */
  const submitPayment = useCallback(async () => {
    const result = await initiatePayment();
    
    if (!result.success) {
      return result;
    }
    
    if (result.alreadyBooked || result.alreadyPaid) {
      return result;
    }
    
    // Create and submit form to eSewa
    const form = document.createElement("form");
    form.method = "POST";
    form.action = result.paymentUrl;
    
    Object.entries(result.paymentData).forEach(([key, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value;
      form.appendChild(input);
    });
    
    document.body.appendChild(form);
    form.submit();
    
    return { success: true, redirected: true };
  }, [initiatePayment]);

  /**
   * Cancel active reservation
   * @param {string} reason - Optional cancellation reason
   */
  const cancelCurrentReservation = useCallback(async (reason = null) => {
    if (!reservation) return { success: false, error: "NO_RESERVATION" };
    
    setLoading(true);
    
    try {
      const { data } = await axios.post(`${API_BASE}/cancel`, {
        reservationId: reservation._id,
        reason,
      });
      
      if (data.success) {
        setReservation(null);
        setTimeLeft(0);
        fetchSlots();
        
        if (data.refundRequired) {
          toast.success("Reservation cancelled. Refund will be processed.");
        } else {
          toast.success("Reservation cancelled");
        }
        
        return { success: true, refundRequired: data.refundRequired };
      }
      
      toast.error(data.message || "Failed to cancel");
      return { success: false, error: data.error };
      
    } catch (err) {
      const errorMessage = err.response?.data?.message || "Failed to cancel";
      toast.error(errorMessage);
      return { success: false, error: "CANCEL_FAILED", message: errorMessage };
      
    } finally {
      setLoading(false);
    }
  }, [reservation, fetchSlots]);

  /**
   * Format time left as MM:SS
   */
  const formatTimeLeft = useCallback(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, [timeLeft]);

  return {
    // State
    reservation,
    loading,
    error,
    timeLeft,
    availableSlots,
    
    // Actions
    reserveSlot,
    initiatePayment,
    submitPayment,
    cancelReservation: cancelCurrentReservation,
    refreshSlots: fetchSlots,
    
    // Helpers
    formatTimeLeft,
    isReserved: !!reservation,
    isExpired: reservation && timeLeft <= 0,
  };
}

export default useBooking;
