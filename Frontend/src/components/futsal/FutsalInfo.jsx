import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Info, DollarSign } from "lucide-react";

const FutsalInfo = ({ futsal }) => {
  return (
    <div className="glass p-8 rounded-[2rem] border border-slate-200 relative overflow-hidden group animate-fade-in">
      {/* Background glow */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-secondary/10 blur-3xl rounded-full pointer-events-none group-hover:bg-secondary/20 transition-colors duration-700"></div>

      <div className="relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-display font-bold text-slate-900 tracking-tight leading-tight">
              {futsal.name}
            </h1>
            <div className="flex items-center gap-2 text-slate-500">
              <div className="p-2 rounded-full bg-white border border-slate-200 text-secondary">
                <MapPin size={18} />
              </div>
              <p className="text-lg font-light">{futsal.location.address}</p>
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 text-center min-w-[120px] shadow-lg backdrop-blur-md">
            <span className="text-slate-500 text-[10px] uppercase tracking-widest font-bold block mb-1">
              Price
            </span>
            <div className="flex items-center justify-center gap-0.5 text-slate-900">
              <span className="text-lg font-bold text-secondary">Rs.</span>
              <span className="text-3xl font-display font-bold">
                {futsal.pricePerHour}
              </span>
            </div>
            <span className="text-slate-500 text-xs font-medium block mt-1">
              per hour
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <div className="rounded-[2rem] overflow-hidden border border-slate-300 relative h-72 shadow-2xl group/map">
            <MapContainer
              center={[
                futsal.location.coordinates[1],
                futsal.location.coordinates[0],
              ]}
              zoom={15}
              scrollWheelZoom={false}
              style={{ height: "100%", width: "100%", background: "#e5e7eb" }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
              <Marker
                position={[
                  futsal.location.coordinates[1],
                  futsal.location.coordinates[0],
                ]}
              >
                <Popup className="text-slate-900 font-bold font-sans">
                  <div className="text-center">
                    <span className="font-bold text-primary block mb-1">
                      {futsal.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      {futsal.location.address}
                    </span>
                  </div>
                </Popup>
              </Marker>
            </MapContainer>

            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_40px_rgba(0,0,0,0.5)] z-[400]"></div>

            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-mono text-slate-600 z-[1000] border border-slate-300 shadow-lg flex items-center gap-2">
              <MapPin size={12} className="text-primary" />
              {futsal.location.coordinates[1].toFixed(4)},{" "}
              {futsal.location.coordinates[0].toFixed(4)}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 backdrop-blur-sm">
            <h3 className="text-lg font-display font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Info size={18} className="text-primary" /> About Venue
            </h3>
            <p className="text-slate-500 leading-relaxed text-base font-light">
              {futsal.description || "No description provided for this venue."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FutsalInfo;
