import { useEffect } from "react";
import { useMapEvents } from "react-leaflet";
import { GeoSearchControl, OpenStreetMapProvider } from "leaflet-geosearch";
import "leaflet-geosearch/dist/geosearch.css";
import L from "leaflet";

const SearchField = ({ setLocation }) => {
  const map = useMapEvents({});

  useEffect(() => {
    const provider = new OpenStreetMapProvider();
    const searchControl = new GeoSearchControl({
      provider: provider,
      style: "bar",
      showMarker: true,
      showPopup: false,
      marker: {
        icon: new L.Icon.Default(),
        draggable: false,
      },
      popupFormat: ({ query, result }) => result.label,
      maxMarkers: 1,
      retainZoomLevel: false,
      animateZoom: true,
      autoClose: true,
      searchLabel: "Enter address",
      keepResult: true,
    });

    map.addControl(searchControl);

    map.on("geosearch/showlocation", (result) => {
      if (result.location) {
        setLocation({ lat: result.location.y, lng: result.location.x });
      }
    });

    return () => map.removeControl(searchControl);
  }, [map, setLocation]);

  return null;
};

export default SearchField;
