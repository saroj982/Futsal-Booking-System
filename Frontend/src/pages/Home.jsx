import React, { useState, useEffect } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import ChangeMapView from "../hooks/useMap";
import SearchField from "../components/map/SearchField";
import {
  Search,
  Map as MapIcon,
  ChevronRight,
  Star,
  MapPin,
  Filter,
  Image,
} from "lucide-react";

function Home() {
  const [futsals, setFutsals] = useState([]);
  const [location, setLocation] = useState({ lat: 27.7172, lng: 85.324 });
  const [keyword, setKeyword] = useState("");
  const [radius, setRadius] = useState(10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => console.log(err),
      { enableHighAccuracy: true },
    );
  }, []);

  useEffect(() => {
    fetchFutsals();
  }, [location, keyword, radius]);

  const fetchFutsals = async () => {
    setLoading(true);
    try {
      let params = {};
      if (location) {
        params.lat = location.lat;
        params.lng = location.lng;
        params.radius = radius;
      }
      if (keyword) {
        params.keyword = keyword;
      }
      const { data } = await axios.get("/api/futsals", { params });
      setFutsals(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-10rem)] animate-fade-in">
      {/* Search Bar - Floating Glass */}
      <div className="glass p-4 rounded-3xl flex flex-col md:flex-row gap-4 items-center z-10 sticky top-0 md:static shrink-0">
        <div className="relative flex-grow w-full group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-500 group-focus-within:text-primary transition-colors" />
          </div>
          <input
            type="text"
            className="w-full bg-slate-1000 border border-slate-700 rounded-2xl py-3 pl-10 pr-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary placeholder:text-slate-500 transition-all shadow-inner"
            placeholder="Search for a venue..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        <div className="relative w-full md:w-auto min-w-[180px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Filter className="h-5 w-5 text-slate-500" />
          </div>
          <select
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="w-full bg-slate-1000 border border-slate-700 rounded-2xl py-3 pl-10 pr-10 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary appearance-none cursor-pointer hover:bg-slate-100/50 transition-colors"
          >
            <option value="5">Within 5km</option>
            <option value="10">Within 10km</option>
            <option value="20">Within 20km</option>
            <option value="50">Within 50km</option>
          </select>
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-500">
            <ChevronRight className="h-4 w-4 rotate-90" />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Results List */}
        <div className="lg:col-span-4 h-full overflow-y-auto pr-2 space-y-4 pb-20 custom-scrollbar">
          <div className="flex justify-between items-center mb-2 px-1">
            <h2 className="text-xl font-display font-medium text-slate-900 flex items-center gap-2">
              <MapIcon size={20} className="text-secondary" />
              Nearby Venues
            </h2>
            <span className="text-xs font-bold font-mono text-secondary bg-secondary/10 px-3 py-1 rounded-full border border-secondary/20">
              {futsals.length} FOUND
            </span>
          </div>

          {loading && futsals.length === 0 ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-3xl p-5 h-32 animate-pulse border border-slate-200"
                ></div>
              ))}
            </div>
          ) : futsals.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-800">
              <p className="text-slate-500 font-medium">
                No venues found nearby.
              </p>
              <p className="text-xs text-slate-600 mt-2">
                Try increasing your search radius.
              </p>
            </div>
          ) : (
            futsals.map((futsal, index) => (
              <div
                key={futsal._id}
                className="glass-card p-0 group cursor-pointer relative overflow-hidden"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Futsal Image */}
                <div className="relative h-36 w-full overflow-hidden">
                  {futsal.images && futsal.images.length > 0 ? (
                    <img
                      src={futsal.images[0]}
                      alt={futsal.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                      <Image size={36} className="text-slate-300" />
                    </div>
                  )}
                  {/* Image count badge */}
                  {futsal.images && futsal.images.length > 1 && (
                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                      <Image size={12} />
                      {futsal.images.length}
                    </div>
                  )}
                  {/* Rating badge */}
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm p-1.5 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-slate-900">
                        4.5
                      </span>
                      <Star
                        size={12}
                        className="text-yellow-500 fill-yellow-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <div className="mb-3">
                    <h3 className="font-display font-bold text-lg text-slate-900 group-hover:text-primary transition-colors">
                      {futsal.name}
                    </h3>
                    <div className="flex items-center gap-1 text-slate-500 text-xs mt-1">
                      <MapPin size={12} className="text-secondary" />
                      <span className="truncate max-w-[180px]">
                        {futsal.location.address}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-end justify-between pt-3 border-t border-slate-200">
                    <div>
                      <p className="text-slate-500 text-[10px] uppercase tracking-wider font-bold mb-0.5">
                        Starting from
                      </p>
                      <p className="font-display font-bold text-xl text-slate-900">
                        <span className="text-secondary">Rs.</span>
                        {futsal.pricePerHour}
                        <span className="text-sm text-slate-500 font-medium font-sans">
                          /hr
                        </span>
                      </p>
                    </div>
                    <Link
                      to={`/futsal/${futsal._id}`}
                      className="bg-white hover:bg-primary text-primary hover:text-slate-900 p-2.5 rounded-xl transition-all duration-300 shadow-lg hover:shadow-primary/25 border border-primary/20 hover:border-primary group-hover:translate-x-1"
                    >
                      <ChevronRight size={20} />
                    </Link>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Map View */}
        <div className="hidden lg:block lg:col-span-8 rounded-[2rem] overflow-hidden border border-slate-300 shadow-xl relative h-full">
          <MapContainer
            center={[location.lat, location.lng]}
            zoom={14}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%", background: "#e5e7eb" }}
            zoomControl={false}
          >
            <ChangeMapView center={location} />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            />
            <SearchField setLocation={setLocation} />

            {location && (
              <Marker position={[location.lat, location.lng]}>
                <Popup className="custom-popup">
                  <div className="text-center font-sans">
                    <span className="font-bold text-primary">You are here</span>
                  </div>
                </Popup>
              </Marker>
            )}

            {futsals.map((futsal) => (
              <Marker
                key={futsal._id}
                position={[
                  futsal.location.coordinates[1],
                  futsal.location.coordinates[0],
                ]}
              >
                <Popup>
                  <div className="text-center p-1 font-sans">
                    <h3 className="font-bold text-slate-900 mb-1">
                      {futsal.name}
                    </h3>
                    <p className="text-xs text-slate-600 mb-2">
                      Rs.{futsal.pricePerHour}/hr
                    </p>
                    <Link
                      to={`/futsal/${futsal._id}`}
                      className="block bg-indigo-600 text-slate-900 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      View Details
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Decorative overlay for depth */}
          <div className="absolute inset-0 pointer-events-none rounded-[2.5rem] shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] z-[400]"></div>
        </div>
      </div>
    </div>
  );
}

export default Home;
