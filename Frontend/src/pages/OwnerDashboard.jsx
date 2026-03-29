import React, { useState, useEffect } from "react";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import LocationMarker from "../components/map/LocationMarker";
import { Plus, Edit, MapPin, DollarSign, X } from "lucide-react";
import { toast } from "react-hot-toast";

function OwnerDashboard() {
  const [futsals, setFutsals] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    pricePerHour: "",
    openTime: 8,
    closeTime: 18,
    openDays: [],
    address: "",
  });
  const [position, setPosition] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  useEffect(() => {
    fetchMyFutsals();
  }, []);

  const fetchMyFutsals = async () => {
    try {
      const { data } = await axios.get("/api/futsals/my");
      setFutsals(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handleEdit = (futsal) => {
    setEditingId(futsal._id);
    setFormData({
      name: futsal.name,
      description: futsal.description || "",
      pricePerHour: futsal.pricePerHour,
      openTime: futsal.openTime,
      closeTime: futsal.closeTime,
      openDays: futsal.openDays,
      address: futsal.location.address || "",
    });
    // Coordinates are [lng, lat]
    setPosition({
      lat: futsal.location.coordinates[1],
      lng: futsal.location.coordinates[0],
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDayChange = (day) => {
    setFormData((prev) => {
      let newDays;
      if (prev.openDays.includes(day)) {
        newDays = prev.openDays.filter((d) => d !== day);
      } else {
        newDays = [...prev.openDays, day];
      }
      return { ...prev, openDays: newDays };
    });
  };

  const handleLocationSelect = async (latlng) => {
    setPosition(latlng);
    try {
      const { data } = await axios.get(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}`,
      );
      if (data && data.display_name) {
        setFormData((prev) => ({ ...prev, address: data.display_name }));
      }
    } catch (error) {
      console.error("Failed to fetch address", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      pricePerHour: "",
      openTime: 8,
      closeTime: 18,
      openDays: [],
      address: "",
    });
    setPosition(null);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!position) return alert("Please select a location on the map");

    try {
      const payload = {
        ...formData,
        lat: position.lat,
        lng: position.lng,
      };

      if (editingId) {
        await axios.put(`/api/futsals/${editingId}`, payload);
        toast.success("Futsal updated!");
      } else {
        await axios.post("/api/futsals", payload);
        toast.success("Futsal added!");
      }

      resetForm();
      fetchMyFutsals();
    } catch (error) {
      console.error(error);
      alert(editingId ? "Error updating futsal" : "Error adding futsal");
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4 bg-white p-8 rounded-[2rem] border border-slate-200 backdrop-blur-sm shadow-xl">
        <div>
          <h1 className="text-4xl font-display font-bold text-slate-900 tracking-tight">
            Owner <span className="text-primary">Dashboard</span>
          </h1>
          <p className="text-slate-500 mt-2 font-light text-lg ">
            Manage your venues and settings
          </p>
        </div>
        <button
          onClick={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
          className={`flex items-center gap-2 px-6 py-4 rounded-xl font-bold transition-all duration-300 ${
            showForm
              ? "bg-slate-100 text-slate-600 hover:bg-slate-700 hover:text-slate-900"
              : "btn-primary"
          }`}
        >
          {showForm ? (
            <>
              <X size={20} /> Cancel
            </>
          ) : (
            <>
              <Plus size={20} /> Add New Venue
            </>
          )}
        </button>
      </div>

      {showForm && (
        <div className="glass p-8 md:p-10 rounded-[2.5rem] animate-fade-in relative overflow-hidden">
          {/* Background decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-3xl rounded-full pointer-events-none"></div>

          <h2 className="text-2xl font-display font-bold text-slate-900 mb-8 border-b border-slate-200 pb-4 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-primary border border-slate-300">
              {editingId ? <Edit size={16} /> : <Plus size={16} />}
            </span>
            {editingId ? "Edit Venue Details" : "Create New Venue"}
          </h2>

          <form
            onSubmit={handleSubmit}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10"
          >
            {/* Left Column: Inputs */}
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">
                  Venue Name
                </label>
                <input
                  type="text"
                  className="input-primary"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g. Galaxy Futsal Arena"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">
                    Price (Rs./hr)
                  </label>
                  <div className="relative">
                    <DollarSign
                      className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-500"
                      size={16}
                    />
                    <input
                      type="number"
                      className="input-primary pl-25"
                      value={formData.pricePerHour}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          pricePerHour: e.target.value,
                        })
                      }
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">
                    Address
                  </label>
                  <div className="relative">
                    <MapPin
                      className="absolute left-1 top-1/2 -translate-y-1/2 text-slate-500"
                      size={16}
                    />
                    <input
                      type="text"
                      className="input-primary pl-10"
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      placeholder="City, Street"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">
                  Operating Hours (24h)
                </label>
                <div className="flex gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex-1 text-center">
                    <span className="text-xs text-slate-500 block mb-1 font-medium">
                      Open
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      className="bg-transparent text-center text-2xl font-bold text-slate-900 focus:outline-none w-full border-b border-slate-300 focus:border-primary transition-colors"
                      value={formData.openTime}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          openTime: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="text-slate-600">-</div>
                  <div className="flex-1 text-center">
                    <span className="text-xs text-slate-500 block mb-1 font-medium">
                      Close
                    </span>
                    <input
                      type="number"
                      min="0"
                      max="23"
                      className="bg-transparent text-center text-2xl font-bold text-slate-900 focus:outline-none w-full border-b border-slate-300 focus:border-primary transition-colors"
                      value={formData.closeTime}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          closeTime: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">
                  Open Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {days.map((day) => (
                    <button
                      type="button"
                      key={day}
                      onClick={() => handleDayChange(day)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${
                        formData.openDays.includes(day)
                          ? "bg-secondary text-white shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                          : "bg-white border border-slate-700 text-slate-500 hover:bg-slate-700 hover:text-white"
                      }`}
                    >
                      {day.substring(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">
                  Description
                </label>
                <textarea
                  className="w-full bg-slate-50 border border-border/20 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all placeholder:text-slate-500 h-32 resize-none"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe your venue..."
                />
              </div>
            </div>

            {/* Right Column: Map */}
            <div className="flex flex-col h-full">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">
                Pin Location
              </label>
              <div className="flex-1 rounded-[2rem] overflow-hidden border border-slate-300 relative min-h-[400px] shadow-2xl">
                <MapContainer
                  center={[27.7172, 85.324]}
                  zoom={13}
                  scrollWheelZoom={true}
                  style={{
                    height: "100%",
                    width: "100%",
                    background: "#e5e7eb",
                  }}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                  />
                  <LocationMarker
                    position={position}
                    setPosition={handleLocationSelect}
                  />
                  {position && <Marker position={position} />}
                </MapContainer>

                {/* Map overlay helper */}
                {!position && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none z-[400]">
                    <div className="bg-white/90 border border-slate-300 px-6 py-4 rounded-2xl shadow-xl flex items-center gap-2">
                      <MapPin className="text-accent animate-bounce" />
                      <span className="text-slate-900 font-medium">
                        Click on map to set location
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 flex justify-end">
                <button
                  type="submit"
                  className="btn-primary py-3 px-8 text-lg w-full md:w-auto"
                >
                  {editingId ? "Update Venue" : "Create Venue"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* List of Venues */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {futsals.length === 0 && !showForm && (
          <div className="col-span-full text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-700">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="text-slate-500" size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900">No Venues Yet</h3>
            <p className="text-slate-500 mt-2">
              Add your first futsal venue to get started.
            </p>
          </div>
        )}

        {futsals.map((futsal, index) => (
          <div
            key={futsal._id}
            className="glass-card p-6 flex flex-col items-start gap-4 hover:border-cyan-500/30 group"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex justify-between items-start w-full">
              <div>
                <h3 className="text-xl font-display font-bold text-slate-900 group-hover:text-cyan-400 transition-colors">
                  {futsal.name}
                </h3>
                <div className="flex items-center gap-1 text-slate-500 text-xs mt-1">
                  <MapPin size={12} className="text-cyan-500" />
                  <span className="truncate max-w-[200px]">
                    {futsal.location.address}
                  </span>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 p-2 rounded-lg">
                <span className="text-lg font-bold text-cyan-400">
                  ${futsal.pricePerHour}
                </span>
                <span className="text-xs text-slate-500">/hr</span>
              </div>
            </div>

            <p className="text-sm text-slate-500 line-clamp-2">
              {futsal.description || "No description provided."}
            </p>

            <div className="mt-auto pt-4 border-t border-slate-200 w-full flex items-center justify-between">
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-slate-100 rounded text-[10px] text-slate-500 uppercase tracking-wide font-bold">
                  {futsal.openTime}:00 - {futsal.closeTime}:00
                </span>
                <span className="px-2 py-1 bg-slate-100 rounded text-[10px] text-slate-500 uppercase tracking-wide font-bold">
                  {futsal.openDays.length} Days
                </span>
              </div>

              <button
                onClick={() => handleEdit(futsal)}
                className="p-2 hover:bg-cyan-500 hover:text-slate-900 rounded-lg transition-colors text-cyan-400"
              >
                <Edit size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default OwnerDashboard;
