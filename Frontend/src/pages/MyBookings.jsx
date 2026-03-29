import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import AuthContext from "../context/AuthContext";
import BookingItem from "../components/bookings/BookingItem";
import { Ticket, CalendarClock, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

function MyBookings() {
  const { user } = useContext(AuthContext);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = async () => {
    try {
      const { data } = await axios.get("/api/bookings");
      // Sort by date/created at descending
      const sorted = data.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );
      setBookings(sorted);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  if (loading)
    return (
      <div className="flex justify-center items-center h-[50vh] animate-pulse">
        <div className="text-slate-900 font-display text-xl tracking-tight">
          Loading bookings...
        </div>
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 animate-fade-in pb-20">
      <div className="flex items-center gap-4 mb-10 bg-white p-6 rounded-[2rem] border border-slate-200 backdrop-blur-md shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg">
          <CalendarClock size={32} />
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-slate-900 tracking-tight">
            My Bookings
          </h1>
          <p className="text-slate-500 text-sm md:text-base font-light mt-1">
            Track your past games and upcoming reservations
          </p>
        </div>
      </div>

      {bookings.length === 0 ? (
        <div className="glass p-12 rounded-[2.5rem] border border-slate-200 flex flex-col items-center justify-center text-center min-h-[400px]">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-200">
            <Ticket size={48} className="text-slate-600" />
          </div>
          <h3 className="text-2xl font-display font-bold text-slate-900 mb-3">
            No Bookings Yet
          </h3>
          <p className="text-slate-500 max-w-sm mx-auto mb-8 font-light">
            Looks like you haven't booked any futsal venues yet. Explore venues
            and book your first game today!
          </p>
          <Link
            to="/"
            className="btn-primary py-3 px-8 rounded-xl flex items-center gap-2 group"
          >
            Find Venues{" "}
            <ArrowUpRight
              size={18}
              className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform"
            />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking, index) => (
            <div
              key={booking._id}
              style={{ animationDelay: `${index * 100}ms` }}
              className="animate-fade-in"
            >
              <BookingItem booking={booking} onPaymentSuccess={fetchBookings} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyBookings;
