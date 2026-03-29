import { useEffect } from "react";
import { Marker, useMapEvents } from "react-leaflet";

const LocationMarker = ({ position, setPosition }) => {
  const map = useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
    locationfound(e) {
      setPosition(e.latlng);
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  useEffect(() => {
    if (position === null) {
      map.locate();
    } else {
      map.setView(position, map.getZoom());
    }
  }, [map]);

  return position === null ? null : <Marker position={position}></Marker>;
};

export default LocationMarker;
