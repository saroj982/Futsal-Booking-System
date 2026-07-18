export const normalizeFutsalForAdmin = (futsal, bookingCount = 0) => ({
  ...futsal,
  address: futsal.location?.address || futsal.address || "Address not available",
  owner: futsal.owner || null,
  bookingCount,
});

export const getActiveVenueQuery = () => ({
  approvalStatus: "APPROVED",
  isActive: true,
});
