import React from "react";
import { useNavigate } from "react-router-dom";
import { XCircle } from "lucide-react";

function PaymentFailure() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="bg-white rounded-3xl p-10 shadow-xl border border-gray-200 text-center max-w-md w-full">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-12 h-12 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Failed
        </h2>
        <p className="text-gray-600 mb-6">
          Your payment could not be processed. The reserved slots will be
          released if payment is not completed before the reservation expires.
        </p>
        <div className="space-y-3">
          <button
            onClick={() => navigate(-1)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl transition-all w-full"
          >
            Try Again
          </button>
          <button
            onClick={() => navigate("/my-bookings")}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-8 py-3 rounded-xl transition-all w-full"
          >
            View My Bookings
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentFailure;
