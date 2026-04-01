import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { CheckCircle, Loader2, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "react-hot-toast";

function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [refundRequired, setRefundRequired] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [message, setMessage] = useState("Verifying payment...");

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        // Get the base64 encoded data from URL
        const data = searchParams.get("data");
        
        if (!data) {
          setMessage("No payment data received");
          setVerifying(false);
          return;
        }

        // Send to backend for verification
        const response = await axios.post("/api/payments/esewa/verify", { data });

        if (response.data.success) {
          setSuccess(true);
          setMessage("Payment successful! Your booking is confirmed.");
          toast.success("Booking confirmed!");
        } else if (response.data.refundRequired) {
          // Payment went through but slot was taken by another user
          setRefundRequired(true);
          setRefundAmount(response.data.refundAmount || 0);
          setMessage(response.data.message || "Slot was taken. Refund will be processed.");
          toast.error("Slot no longer available - refund will be processed");
        } else {
          setMessage(response.data.message || "Payment verification failed");
        }
      } catch (error) {
        console.error("Payment verification error:", error);
        const errorData = error.response?.data;
        
        if (errorData?.refundRequired) {
          setRefundRequired(true);
          setRefundAmount(errorData.refundAmount || 0);
          setMessage(errorData.message || "Slot was taken. Refund will be processed.");
        } else {
          setMessage(errorData?.message || "Payment verification failed");
        }
      } finally {
        setVerifying(false);
      }
    };

    verifyPayment();
  }, [searchParams]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl p-10 shadow-xl border border-gray-200 text-center max-w-md w-full">
        {verifying ? (
          <>
            <Loader2 className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Verifying Payment
            </h2>
            <p className="text-gray-600">Please wait while we confirm your booking...</p>
          </>
        ) : success ? (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Payment Successful!
            </h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => navigate("/my-bookings")}
              className="bg-green-500 hover:bg-green-600 text-white font-semibold px-8 py-3 rounded-xl transition-all w-full"
            >
              View My Bookings
            </button>
          </>
        ) : refundRequired ? (
          <>
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-12 h-12 text-yellow-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Slot No Longer Available
            </h2>
            <p className="text-gray-600 mb-4">{message}</p>
            {refundAmount > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                <p className="text-yellow-800 font-medium">
                  Refund Amount: Rs. {refundAmount}
                </p>
                <p className="text-yellow-700 text-sm mt-1">
                  Your refund will be processed within 3-5 business days.
                </p>
              </div>
            )}
            <div className="space-y-3">
              <button
                onClick={() => navigate("/home")}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl transition-all w-full"
              >
                Book Another Slot
              </button>
              <button
                onClick={() => navigate("/my-bookings")}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-8 py-3 rounded-xl transition-all w-full"
              >
                View My Bookings
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Verification Issue
            </h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => navigate("/my-bookings")}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl transition-all w-full"
            >
              Check Booking Status
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default PaymentSuccess;
