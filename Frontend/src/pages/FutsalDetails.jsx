import React, { useState, useEffect, useContext, useRef } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import {
  startOfToday,
  addDays,
  format,
  isSameDay,
  differenceInSeconds,
} from "date-fns";
import AuthContext from "../context/AuthContext";
import { io } from "socket.io-client";
import { toast } from "react-hot-toast";
import Modal from "../components/common/Modal";
import FutsalInfo from "../components/futsal/FutsalInfo";
import {
  Calendar,
  Clock,
  CreditCard,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Image,
} from "lucide-react";

function FutsalDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [futsal, setFutsal] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [totalPrice, setTotalPrice] = useState(0);
  const [pendingBooking, setPendingBooking] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const socketRef = useRef();

  const today = startOfToday();
  const next7Days = Array.from({ length: 7 }, (_, i) => addDays(today, i));

  // Check for existing pending bookings on mount
  useEffect(() => {
    const checkPendingBookings = async () => {
      if (!user) return;
      try {
        const { data } = await axios.get("/api/bookings");
        // Find if there is a pending booking for THIS futsal
        const pending = data.find((b) => {
          const bookingFutsalId =
            typeof b.futsal === "object" ? b.futsal._id : b.futsal;
          return (
            String(bookingFutsalId) === String(id) && b.status === "pending"
          );
        });

        if (pending) {
          const now = new Date();
          const expiration = new Date(pending.expiresAt);
          if (expiration > now) {
            const diff = differenceInSeconds(expiration, now);
            setTimeLeft(diff > 0 ? diff : 0);
            setPendingBooking(pending);
          }
        }
      } catch (error) {
        console.error("Failed to fetch user bookings", error);
      }
    };

    if (id) {
      checkPendingBookings();
    }
  }, [id, user]);

  useEffect(() => {
    let interval;
    if (pendingBooking && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => {
          if (time <= 1) {
            clearInterval(interval);
            setPendingBooking(null);
            toast.error("Reservation expired");
            if (selectedDate) fetchBookedSlots(selectedDate);
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [pendingBooking]);

  useEffect(() => {
    // Socket connection
    socketRef.current = io("http://localhost:5000/");

    socketRef.current.on("bookingUpdated", (data) => {
      if (data.futsalId === id) {
        setSelectedDate((curr) => {
          if (curr && format(curr, "yyyy-MM-dd") === data.date) {
            fetchBookedSlots(curr);
          }
          return curr;
        });
      }
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [id]);

  useEffect(() => {
    fetchFutsal();
  }, [id]);

  useEffect(() => {
    if (selectedDate && futsal) {
      fetchBookedSlots(selectedDate);
      setSelectedSlots([]);
    }
  }, [selectedDate, futsal]);

  useEffect(() => {
    if (futsal) {
      setTotalPrice(selectedSlots.length * futsal.pricePerHour);
    }
  }, [selectedSlots, futsal]);

  const fetchFutsal = async () => {
    try {
      const { data } = await axios.get(`/api/futsals/${id}`);
      setFutsal(data);
      // Auto-select first available day
      const firstAvailable = next7Days.find((date) =>
        data.openDays.includes(format(date, "EEEE")),
      );
      if (firstAvailable) setSelectedDate(firstAvailable);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchBookedSlots = async (date) => {
    try {
      const formattedDate = format(date, "yyyy-MM-dd");
      const { data } = await axios.get(
        `/api/bookings/${id}?date=${formattedDate}`,
      );
      setBookings(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSlotClick = (hour) => {
    if (bookings.includes(hour)) return;

    if (selectedSlots.includes(hour)) {
      setSelectedSlots(selectedSlots.filter((s) => s !== hour));
    } else {
      setSelectedSlots([...selectedSlots, hour]);
    }
  };

  const handleReservation = async () => {
    if (!user) return navigate("/login");
    if (selectedSlots.length === 0)
      return toast.error("Select at least one slot");

    try {
      const { data } = await axios.post("/api/bookings", {
        futsalId: id,
        date: format(selectedDate, "yyyy-MM-dd"),
        timeSlots: selectedSlots,
      });
      setPendingBooking(data);
      const expiresAt = new Date(data.expiresAt);
      const now = new Date();
      const diff = differenceInSeconds(expiresAt, now);
      const secondsLeft = diff > 0 ? diff : 0;
      setTimeLeft(secondsLeft);

      const minutes = Math.ceil(secondsLeft / 60);
      toast.success(
        `Slots Reserved! Please pay within ${minutes} minute${minutes !== 1 ? "s" : ""}.`,
      );

      fetchBookedSlots(selectedDate);
      setSelectedSlots([]);
      setIsModalOpen(false); // Close the modal
    } catch (error) {
      toast.error(error.response?.data?.message || "Booking Failed");
    }
  };

  const handlePayment = async () => {
    if (!pendingBooking) return;
    try {
      // Initiate eSewa payment
      const { data } = await axios.post("/api/payments/esewa/initiate", {
        bookingId: pendingBooking._id,
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
      
      if (errorData?.expired) {
        // Reservation expired - clear pending booking and refresh
        toast.error("Reservation expired. Please book again.");
        setPendingBooking(null);
        setTimeLeft(0);
        fetchBookedSlots(selectedDate);
      } else if (errorData?.slotConflict) {
        // Slots taken by someone else
        toast.error("These slots were just booked. Please select different times.");
        setPendingBooking(null);
        setTimeLeft(0);
        fetchBookedSlots(selectedDate);
      } else {
        toast.error(errorData?.message || "Payment initiation failed");
      }
    }
  };

  const formatTime = (seconds) => {
    const match = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${match}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const formatSlotTime = (hour) => {
    const h = hour % 24;
    const ampm = h >= 12 ? "pm" : "am";
    const formattedHour = h % 12 || 12;
    return `${formattedHour}${ampm}`;
  };

  const getSlotRange = (startHour) => {
    return `${formatSlotTime(startHour)} - ${formatSlotTime(startHour + 1)}`;
  };

  if (!futsal)
    return (
      <div className="text-slate-900 text-center mt-20 animate-pulse font-display text-xl">
        Loading details...
      </div>
    );

  const availableHours = [];
  for (let i = futsal.openTime; i < futsal.closeTime; i++) {
    availableHours.push(i);
  }

  const images = futsal.images || [];
  const hasMultipleImages = images.length > 1;

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-20 animate-fade-in text-slate-900/90">
      <div className="md:col-span-2 space-y-8">
        {/* Image Gallery Section */}
        {images.length > 0 && (
          <div className="glass rounded-[2rem] overflow-hidden border border-slate-200 relative">
            {/* Main Image */}
            <div className="relative aspect-video bg-slate-100">
              <img
                src={images[currentImageIndex]}
                alt={`${futsal.name} - Image ${currentImageIndex + 1}`}
                className="w-full h-full object-cover transition-opacity duration-300"
              />
              
              {/* Navigation Arrows - Only show if multiple images */}
              {hasMultipleImages && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full backdrop-blur-sm transition-all"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}

              {/* Image Counter */}
              <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2">
                <Image size={16} />
                {currentImageIndex + 1} / {images.length}
              </div>
            </div>

            {/* Thumbnail Strip - Only show if multiple images */}
            {hasMultipleImages && (
              <div className="p-4 bg-slate-50 border-t border-slate-200">
                <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                        idx === currentImageIndex
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-transparent hover:border-slate-300"
                      }`}
                    >
                      <img
                        src={img}
                        alt={`Thumbnail ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* No Images Placeholder */}
        {images.length === 0 && (
          <div className="glass rounded-[2rem] overflow-hidden border border-slate-200">
            <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <div className="text-center">
                <Image size={64} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-400 font-medium">No images available</p>
              </div>
            </div>
          </div>
        )}

        <FutsalInfo futsal={futsal} />

        <div className="glass p-8 md:p-10 rounded-[2.5rem] border border-slate-200 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 blur-3xl rounded-full pointer-events-none"></div>

          <h2 className="text-2xl font-display font-bold text-slate-900 mb-8 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-300 text-secondary">
              <Calendar size={20} />
            </div>
            Select Date & Time
          </h2>

          {/* Date Selection */}
          <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide">
            {next7Days.map((date) => {
              const dayName = format(date, "EEEE");
              const isAvailable = futsal.openDays.includes(dayName);
              const isSelected = selectedDate && isSameDay(date, selectedDate);

              return (
                <button
                  key={date.toString()}
                  disabled={!isAvailable}
                  onClick={() => setSelectedDate(date)}
                  className={`flex flex-col items-center min-w-[5.5rem] p-4 rounded-2xl border transition-all duration-300 ${
                    !isAvailable
                      ? "opacity-30 cursor-not-allowed bg-white border-slate-800 text-slate-500 grayscale"
                      : isSelected
                        ? "bg-primary text-white"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-white/80 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider mb-1 opacity-80">
                    {format(date, "MMM")}
                  </span>
                  <span className="text-2xl font-display font-bold mb-1">
                    {format(date, "d")}
                  </span>
                  <span className="text-xs font-medium">
                    {dayName.substring(0, 3)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Time Selection Trigger */}
          {selectedDate && (
            <div className="mt-8 border-t border-slate-200 pt-8 grid place-items-center">
              <button
                onClick={() => setIsModalOpen(true)}
                disabled={!!pendingBooking}
                className={`w-full max-w-md py-4 px-6 rounded-2xl font-bold flex items-center justify-between transition-all group ${
                  pendingBooking
                    ? "bg-slate-50 text-slate-500 cursor-not-allowed border border-slate-700/50"
                    : "bg-white hover:bg-white/80 text-slate-900 border border-slate-300 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(99,102,241,0.15)]"
                }`}
              >
                {pendingBooking ? (
                  <div className="flex items-center gap-3 w-full justify-center">
                    <AlertCircle size={20} />
                    <span>Complete Pending Payment First</span>
                  </div>
                ) : (
                  <>
                    <span className="text-lg font-bold text-slate-900">
                      Select Hours
                    </span>
                    <div className="flex items-center gap-3 text-slate-500">
                      <span className="text-sm font-light">
                        for {format(selectedDate, "MMMM d")}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-white border border-slate-300 flex items-center justify-center group-hover:bg-primary group-hover:text-slate-900 group-hover:border-primary transition-all">
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="md:col-span-1">
        {/* Sticky Sidebar */}
        <div className="sticky top-24 space-y-6">
          {/* Pending Booking / Checkout Section */}
          {pendingBooking ? (
            <div className="glass bg-white p-6 rounded-[2rem] border border-secondary/20 shadow-[0_0_30px_rgba(6,182,212,0.1)] relative overflow-hidden animate-pulse-glow">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-secondary/10 blur-3xl rounded-full pointer-events-none"></div>

              <div className="flex items-center gap-2 text-secondary mb-4 font-bold uppercase tracking-wider text-xs">
                <Clock size={14} /> Pending Payment
              </div>

              <h3 className="text-slate-900 text-lg font-bold mb-1">
                Reservation Held
              </h3>
              <p className="text-slate-500 text-xs mb-6">
                Complete payment to confirm your booking.
              </p>

              <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-200">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-slate-500 text-sm">Time Remaining</span>
                  <span className="text-xl font-mono font-bold text-yellow-500">
                    {formatTime(timeLeft)}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-yellow-500 h-1.5 rounded-full transition-all duration-1000"
                    style={{ width: `${(timeLeft / 600) * 100}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex justify-between items-center mb-6 pt-4 border-t border-slate-200">
                <span className="text-slate-600 font-medium">Total Amount</span>
                <span className="text-2xl font-display font-bold text-slate-900">
                  Rs.{pendingBooking.totalPrice}
                </span>
              </div>

              <button
                onClick={handlePayment}
                className="w-full bg-[#60BB46] hover:bg-[#4da936] text-white py-4 rounded-xl flex items-center justify-center gap-3 group transition-all font-bold"
              >
                <img 
                  src="https://esewa.com.np/common/images/esewa-logo.png" 
                  alt="eSewa" 
                  className="h-5 invert brightness-0 group-hover:scale-110 transition-transform"
                  onError={(e) => e.target.style.display = 'none'}
                />
                <span>Pay with eSewa</span>
              </button>
            </div>
          ) : (
            <div className="glass p-6 rounded-[2rem] border border-slate-200 flex flex-col items-center justify-center text-center py-12">
              <div className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center mb-4 text-slate-500">
                <Calendar size={32} />
              </div>
              <h3 className="text-slate-900 font-bold mb-2">
                No Active Booking
              </h3>
              <p className="text-slate-500 text-sm font-light">
                Select a date and time slots to start your reservation.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal for Slot Selection */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          <div className="flex flex-col">
            <span>Available Slots</span>
            <span className="text-sm font-normal text-slate-500 mt-1">
              {selectedDate ? format(selectedDate, "EEEE, MMMM d") : ""}
            </span>
          </div>
        }
        footer={
          <div className="flex flex-col md:flex-row md:justify-between items-center w-full gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex flex-col">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider font-bold mb-0.5">
                  Total Amount
                </p>
                <p className="text-2xl font-display font-bold text-slate-900 leading-none">
                  <span className="text-secondary">Rs.</span>
                  {totalPrice}
                </p>
              </div>
              <div className="h-8 w-px bg-slate-50"></div>
              <div className="text-xs text-slate-500">
                {selectedSlots.length} slot{selectedSlots.length !== 1 && "s"}{" "}
                selected
              </div>
            </div>

            <button
              onClick={handleReservation}
              disabled={selectedSlots.length === 0}
              className={`w-full md:w-auto px-8 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                selectedSlots.length > 0
                  ? "btn-primary shadow-lg shadow-primary/25"
                  : "bg-slate-100 text-slate-500 cursor-not-allowed"
              }`}
            >
              <span>Proceed to Payment</span>
              <ChevronRight size={16} />
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          {availableHours.map((hour) => {
            const isBooked = bookings.includes(hour);
            const isSelected = selectedSlots.includes(hour);
            const now = new Date();
            const isToday = isSameDay(selectedDate, now);
            const isPassed = isToday && hour <= now.getHours();

            return (
              <button
                key={hour}
                disabled={isBooked || isPassed}
                onClick={() => handleSlotClick(hour)}
                className={`py-3 px-2 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all duration-200 border relative overflow-hidden group ${
                  isBooked || isPassed
                    ? "bg-white/40 border-slate-800 text-slate-600 cursor-not-allowed opacity-60"
                    : isSelected
                      ? "bg-primary text-white"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300 hover:shadow-lg"
                }`}
              >
                {/* Diagonal strip for booked or passed */}
                {(isBooked || isPassed) && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-full h-px bg-slate-700 rotate-45 transform scale-150"></div>
                  </div>
                )}

                <span className="text-xs font-mono">{getSlotRange(hour)}</span>
                <span
                  className={`text-[9px] uppercase font-bold tracking-wider ${isSelected ? "text-slate-900/90" : "text-slate-500 group-hover:text-slate-500"}`}
                >
                  {isBooked
                    ? "Booked"
                    : isPassed
                      ? "Passed"
                      : isSelected
                        ? "Selected"
                        : "Available"}
                </span>

                {isSelected && (
                  <div className="absolute top-1 right-1">
                    <CheckCircle
                      size={12}
                      className="text-slate-900 fill-white/20"
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

export default FutsalDetails;
