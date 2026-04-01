/**
 * SlotBooking Component - Race-condition-safe booking UI
 * 
 * Features:
 * - Real-time slot availability
 * - Countdown timer for reservation
 * - Atomic reserve/pay flow
 * - Handles race conditions gracefully
 */

import React, { useState, useMemo } from "react";
import { useBooking } from "../../hooks/useBooking";
import { 
  Clock, 
  Calendar, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  X,
  Loader2 
} from "lucide-react";

export function SlotBookingV2({ futsalId, date, futsal }) {
  const {
    reservation,
    loading,
    timeLeft,
    availableSlots,
    reserveSlot,
    submitPayment,
    cancelReservation,
    refreshSlots,
    formatTimeLeft,
    isReserved,
  } = useBooking(futsalId, date);

  const [selectedHours, setSelectedHours] = useState([]);

  // Generate all hours for the day
  const allHours = useMemo(() => {
    if (!futsal) return [];
    const hours = [];
    for (let h = futsal.openTime; h < futsal.closeTime; h++) {
      hours.push(h);
    }
    return hours;
  }, [futsal]);

  // Map available hours
  const availableHourSet = useMemo(() => {
    return new Set(availableSlots.map(s => s.hour));
  }, [availableSlots]);

  // Reserved hours (from current reservation)
  const reservedHours = useMemo(() => {
    return new Set(reservation?.hours || []);
  }, [reservation]);

  // Handle slot selection
  const toggleHour = (hour) => {
    if (isReserved) return; // Can't change selection when reserved
    
    setSelectedHours(prev => {
      if (prev.includes(hour)) {
        return prev.filter(h => h !== hour);
      }
      return [...prev, hour].sort((a, b) => a - b);
    });
  };

  // Handle reserve
  const handleReserve = async () => {
    if (selectedHours.length === 0) return;
    
    const result = await reserveSlot(selectedHours);
    if (result.success) {
      setSelectedHours([]);
    }
  };

  // Handle payment
  const handlePayment = async () => {
    await submitPayment();
  };

  // Handle cancel
  const handleCancel = async () => {
    await cancelReservation("User cancelled");
  };

  // Format hour display
  const formatHour = (hour) => {
    const h = hour % 12 || 12;
    const ampm = hour >= 12 ? "PM" : "AM";
    return `${h}:00 ${ampm}`;
  };

  // Calculate total price
  const totalPrice = useMemo(() => {
    if (reservation) {
      return reservation.totalPrice;
    }
    return selectedHours.length * (futsal?.pricePerHour || 0);
  }, [reservation, selectedHours, futsal]);

  // Urgency indicator for timer
  const isUrgent = timeLeft > 0 && timeLeft < 60;
  const isWarning = timeLeft > 0 && timeLeft < 180;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Calendar className="text-primary" size={20} />
          Select Time Slots
        </h3>
        <button 
          onClick={refreshSlots}
          className="text-sm text-blue-500 hover:text-blue-600"
        >
          Refresh
        </button>
      </div>

      {/* Active Reservation Banner */}
      {isReserved && (
        <div className={`p-4 rounded-xl border ${
          isUrgent 
            ? "bg-red-50 border-red-200" 
            : isWarning 
              ? "bg-yellow-50 border-yellow-200"
              : "bg-blue-50 border-blue-200"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className={`${
                isUrgent ? "text-red-500" : isWarning ? "text-yellow-500" : "text-blue-500"
              } ${isUrgent ? "animate-pulse" : ""}`} size={24} />
              <div>
                <p className="font-semibold text-slate-900">
                  Reservation Active
                </p>
                <p className="text-sm text-slate-600">
                  Hours: {reservation.hours.map(formatHour).join(", ")}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-2xl font-mono font-bold ${
                isUrgent ? "text-red-500" : isWarning ? "text-yellow-500" : "text-blue-600"
              }`}>
                {formatTimeLeft()}
              </p>
              <p className="text-xs text-slate-500">Time remaining</p>
            </div>
          </div>
          
          <div className="mt-4 flex gap-3">
            <button
              onClick={handlePayment}
              disabled={loading}
              className="flex-1 bg-[#60BB46] hover:bg-[#4da936] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <CreditCard size={20} />
              )}
              Pay with eSewa - Rs. {totalPrice}
            </button>
            <button
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-3 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Slot Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {allHours.map(hour => {
          const isAvailable = availableHourSet.has(hour);
          const isSelected = selectedHours.includes(hour);
          const isMyReservation = reservedHours.has(hour);
          
          return (
            <button
              key={hour}
              onClick={() => isAvailable && !isReserved && toggleHour(hour)}
              disabled={!isAvailable || isReserved}
              className={`
                p-3 rounded-xl text-center transition-all border-2
                ${isMyReservation 
                  ? "bg-blue-100 border-blue-400 text-blue-700 cursor-not-allowed"
                  : isAvailable
                    ? isSelected
                      ? "bg-primary text-white border-primary shadow-lg scale-105"
                      : "bg-white border-slate-200 hover:border-primary hover:bg-primary/5 cursor-pointer"
                    : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                }
              `}
            >
              <span className="text-sm font-medium block">
                {formatHour(hour)}
              </span>
              {isMyReservation && (
                <span className="text-xs mt-1 block">Reserved</span>
              )}
              {!isAvailable && !isMyReservation && (
                <span className="text-xs mt-1 block">Booked</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selection Summary & Reserve Button */}
      {!isReserved && selectedHours.length > 0 && (
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-slate-500">Selected</p>
              <p className="font-medium text-slate-900">
                {selectedHours.map(formatHour).join(", ")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-500">Total</p>
              <p className="text-xl font-bold text-slate-900">
                Rs. {totalPrice}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleReserve}
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <CheckCircle size={20} />
            )}
            Reserve & Proceed to Payment
          </button>
          
          <p className="text-xs text-slate-500 text-center mt-2">
            <AlertTriangle size={12} className="inline mr-1" />
            Reservation will expire in 5 minutes if not paid
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isReserved && selectedHours.length === 0 && (
        <p className="text-center text-slate-500 py-4">
          Select time slots to book
        </p>
      )}
    </div>
  );
}

export default SlotBookingV2;
