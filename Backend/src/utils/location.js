export const haversineDistanceKm = (lat1, lng1, lat2, lng2) => {
  if (
    [lat1, lng1, lat2, lng2].some((value) => Number.isNaN(Number(value))) ||
    lat1 === undefined ||
    lng1 === undefined ||
    lat2 === undefined ||
    lng2 === undefined
  ) {
    return null;
  }

  const toRadians = (value) => (Number(value) * Math.PI) / 180;
  const earthRadiusKm = 6371;

  const startLat = toRadians(lat1);
  const startLng = toRadians(lng1);
  const endLat = toRadians(lat2);
  const endLng = toRadians(lng2);

  const latDelta = endLat - startLat;
  const lngDelta = endLng - startLng;

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(lngDelta / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Number((earthRadiusKm * c).toFixed(1));
};
