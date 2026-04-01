import React, { useState, useEffect } from "react";
import axios from "axios";
import { format, differenceInSeconds } from "date-fns";
import { toast } from "react-hot-toast";
import {
  MapPin,
  Calendar,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  CreditCard,
  RefreshCw,
} from "lucide-react";

const BookingItem = ({ booking, onPaymentSuccess }) => {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (booking.status === "pending" && booking.expiresAt) {
      const calculateTimeLeft = () => {
        const now = new Date();
        const expiration = new Date(booking.expiresAt);
        const diff = differenceInSeconds(expiration, now);
        return diff > 0 ? diff : 0;
      };

      setTimeLeft(calculateTimeLeft());

      const timer = setInterval(() => {
        const remaining = calculateTimeLeft();
        setTimeLeft(remaining);
        if (remaining <= 0) clearInterval(timer);
      }, 1000);

      return () => clearInterval(timer);
    } else {
      setTimeLeft(0);
    }
  }, [booking]);

  const handlePay = async () => {
    try {
      // Initiate eSewa payment
      const { data } = await axios.post("/api/payments/esewa/initiate", {
        bookingId: booking._id,
      });

      // Create and submit eSewa payment form
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.paymentUrl;

      Object.entries(data.paymentData).forEach(([key, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      console.error(error);
      const errorData = error.response?.data;
      
      if (errorData?.expired || errorData?.slotConflict) {
        toast.error(errorData.message);
        if (onPaymentSuccess) onPaymentSuccess(); // Refresh list
      } else {
        toast.error(errorData?.message || "Payment initiation failed");
      }
    }
  };

  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  const statusConfig = {
    confirmed: {
      bg: "bg-green-500/10",
      text: "text-green-400",
      border: "border-green-500/20",
      icon: CheckCircle,
      label: "Confirmed",
    },
    pending: {
      bg: "bg-yellow-500/10",
      text: "text-yellow-400",
      border: "border-yellow-500/20",
      icon: Clock,
      label: "Pending Payment",
    },
    cancelled: {
      bg: "bg-red-500/10",
      text: "text-red-400",
      border: "border-red-500/20",
      icon: XCircle,
      label: "Cancelled",
    },
    refund_pending: {
      bg: "bg-orange-500/10",
      text: "text-orange-400",
      border: "border-orange-500/20",
      icon: RefreshCw,
      label: "Refund Pending",
    },
  };

  const status = statusConfig[booking.status] || statusConfig.cancelled;
  const StatusIcon = status.icon;

  return (
    <div className="glass-card p-6 rounded-[2rem] mb-4 group hover:bg-white/60 transition-all border border-slate-200 relative overflow-hidden animate-fade-in">
      {/* Background Glow based on status */}
      <div
        className={`absolute -right-10 -top-10 w-40 h-40 rounded-full blur-[60px] opacity-10 pointer-events-none transition-colors duration-500 ${
          booking.status === "confirmed"
            ? "bg-green-500"
            : booking.status === "pending"
              ? "bg-yellow-500"
              : booking.status === "refund_pending"
                ? "bg-orange-500"
                : "bg-red-500"
        }`}
      ></div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10 gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="font-display font-bold text-xl text-slate-900 group-hover:text-primary transition-colors">
              {booking.futsal ? booking.futsal.name : "Unknown Futsal"}
            </h3>
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border flex items-center gap-1.5 ${status.bg} ${status.text} ${status.border}`}
            >
              <StatusIcon size={12} /> {status.label}
            </span>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Calendar size={14} className="text-secondary" />
              <span className="font-medium text-slate-600">{booking.date}</span>
            </span>
            <span className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              <Clock size={14} className="text-secondary" />
              <span className="font-medium text-slate-600">
                {booking.timeSlots.map((t) => `${t}:00`).join(", ")}
              </span>
            </span>
          </div>

          {/* Refund reason if applicable */}
          {booking.status === "refund_pending" && booking.refundReason && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm">
              <p className="text-orange-700">
                <span className="font-medium">Refund reason:</span> {booking.refundReason}
              </p>
              {booking.refundAmount && (
                <p className="text-orange-600 mt-1">
                  Refund amount: <span className="font-bold">Rs. {booking.refundAmount}</span>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-3 w-full md:w-auto mt-2 md:mt-0">
          <div className="flex items-baseline gap-1 bg-white px-4 py-2 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Total
            </span>
            <span className="text-2xl font-display font-bold text-slate-900">
              Rs. {booking.totalPrice}
            </span>
          </div>

          {booking.status === "pending" && timeLeft > 0 && (
            <div className="flex flex-col items-end gap-2 w-full">
              <p className="text-xs font-bold text-yellow-500 animate-pulse flex items-center gap-1 bg-yellow-500/10 px-2 py-1 rounded">
                <Clock size={12} /> Expires in {formatTime(timeLeft)}
              </p>
              <button
                onClick={handlePay}
                className="bg-[#60BB46] hover:bg-[#4da936] text-white py-2.5 px-6 text-sm w-full md:w-auto flex items-center justify-center gap-2 rounded-xl font-bold transition-all"
              >
                <CreditCard size={16} /> Pay with eSewa
              </button>
            </div>
          )}

          {booking.status === "refund_pending" && (
            <div className="text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded-lg text-center">
              Refund processing (3-5 business days)
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingItem;
