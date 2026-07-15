const calculateRefundForCancellation = (cancelledAt, bookingStartTime, totalPrice) => {
  if (!cancelledAt || !bookingStartTime || typeof totalPrice !== 'number') {
    return {
      refundPercentage: 0,
      refundAmount: 0,
      refundType: 'none',
    };
  }

  const msUntilStart = bookingStartTime.getTime() - cancelledAt.getTime();
  const hoursUntilStart = msUntilStart / (1000 * 60 * 60);

  if (hoursUntilStart >= 24) {
    return {
      refundPercentage: 100,
      refundAmount: totalPrice,
      refundType: 'full',
    };
  }

  if (hoursUntilStart >= 12) {
    return {
      refundPercentage: 70,
      refundAmount: Number((totalPrice * 0.7).toFixed(2)),
      refundType: 'partial',
    };
  }

  return {
    refundPercentage: 0,
    refundAmount: 0,
    refundType: 'none',
  };
};

export { calculateRefundForCancellation };
