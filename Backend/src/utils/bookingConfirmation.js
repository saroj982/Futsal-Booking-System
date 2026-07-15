const shouldTreatBookingAsConfirmed = (booking, expectedVersion) => {
  if (!booking) {
    return false;
  }

  if (booking.status === "confirmed" || booking.paymentStatus === "paid") {
    return true;
  }

  return false;
};

export { shouldTreatBookingAsConfirmed };
