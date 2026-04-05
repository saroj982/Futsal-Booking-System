import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import ChangeMapView from "../hooks/useMap";
import SearchField from "../components/map/SearchField";
import {
  Calendar,
  Clock,
  MapPin,
  Shield,
  Star,
  Trophy,
  Menu,
  X,
  Search,
  Filter,
  ChevronRight,
  Map as MapIcon,
  Image,
  Navigation,
} from "lucide-react";

// Location Permission Modal Component
function LocationPermissionModal({ onAllow, onDeny }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-scale-in">
        {/* Header with icon */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-8 text-center">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Navigation className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Enable Location</h2>
          <p className="text-blue-100 mt-2">Find futsal courts near you</p>
        </div>
        
        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-600 text-center mb-6">
            Allow Futsal Arena to access your location to show nearby futsal courts and help you find the best venues in your area.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={onAllow}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
            >
              <MapPin className="w-5 h-5" />
              Allow Location Access
            </button>
            <button
              onClick={onDeny}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 px-6 rounded-xl font-medium transition-all duration-200"
            >
              Maybe Later
            </button>
          </div>
          
          <p className="text-xs text-gray-400 text-center mt-4">
            Your location data is only used to find nearby venues and is never stored.
          </p>
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  // Venue search state (from Home.jsx)
  const [futsals, setFutsals] = useState([]);
  const [location, setLocation] = useState({ lat: 27.7172, lng: 85.324 });
  const [keyword, setKeyword] = useState("");
  const [radius, setRadius] = useState(10);
  const [loading, setLoading] = useState(true);
  const [locationPermission, setLocationPermission] = useState("prompt");
  const [showLocationModal, setShowLocationModal] = useState(false);

  // Check if we should show location modal on mount
  useEffect(() => {
    const checkLocationPermission = async () => {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        console.log("Geolocation is not supported by this browser.");
        return;
      }

      // Always try to get fresh location on every launch
      if (navigator.permissions) {
        try {
          const permission = await navigator.permissions.query({ name: "geolocation" });
          setLocationPermission(permission.state);
          
          if (permission.state === "granted") {
            // Already granted, get fresh location directly
            getCurrentLocation();
          } else if (permission.state === "prompt") {
            // Show our custom modal
            setShowLocationModal(true);
          }
          // If denied, use default location (already set in state)
          
          // Listen for permission changes
          permission.onchange = () => {
            setLocationPermission(permission.state);
            if (permission.state === "granted") {
              setShowLocationModal(false);
              getCurrentLocation();
            }
          };
        } catch (err) {
          // Permission API not supported, try getting location directly
          getCurrentLocation();
        }
      } else {
        // Permission API not available, try getting location directly
        getCurrentLocation();
      }
    };

    checkLocationPermission();
  }, []);

  // Function to get current location
  const getCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationPermission("granted");
        setShowLocationModal(false);
      },
      (err) => {
        console.log("Location error:", err.message);
        if (err.code === err.PERMISSION_DENIED) {
          setLocationPermission("denied");
        }
        setShowLocationModal(false);
      },
      { 
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  // Handle allow location from modal
  const handleAllowLocation = () => {
    getCurrentLocation();
  };

  // Handle deny location from modal
  const handleDenyLocation = () => {
    setShowLocationModal(false);
  };

  // Fetch futsals from backend
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

  const handleGetStarted = () => {
    navigate("/register");
  };

  const handleLogin = () => {
    navigate("/login");
  };

  const handleViewCourts = () => {
    navigate("/home");
  };

  const scrollToSection = (sectionId) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Location Permission Modal */}
      {showLocationModal && (
        <LocationPermissionModal
          onAllow={handleAllowLocation}
          onDeny={handleDenyLocation}
        />
      )}

      {/* Header/Navigation */}
      <header className="fixed top-0 left-0 right-0 bg-gray-50 z-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            {/* Logo - Click to refresh */}
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="bg-blue-500 p-2 rounded-lg">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-semibold text-gray-900">
                Futsal Arena
              </span>
            </button>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-10">
              <button
                onClick={() => scrollToSection("home")}
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection("location")}
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                Location
              </button>
              <button
                onClick={() => scrollToSection("features")}
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                Feature
              </button>
              <button
                onClick={() => scrollToSection("contact")}
                className="text-gray-700 hover:text-blue-600 transition-colors"
              >
                Contact
              </button>
              <button
                onClick={() => navigate("/login")}
                className="border-2 border-blue-500 text-blue-600 hover:bg-blue-50 px-6 py-2 rounded-lg font-medium transition-all duration-200"
              >
                Login
              </button>
              <button
                onClick={handleGetStarted}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-200"
              >
                Get Started
              </button>
            </nav>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-gray-700" />
              ) : (
                <Menu className="w-6 h-6 text-gray-700" />
              )}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav className="md:hidden py-4 border-t border-gray-300 animate-fade-in bg-gray-50">
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => scrollToSection("home")}
                  className="text-gray-700 hover:text-blue-600 hover:bg-white transition-colors py-3 px-4 rounded-lg text-left"
                >
                  Home
                </button>
                <button
                  onClick={() => scrollToSection("location")}
                  className="text-gray-700 hover:text-blue-600 hover:bg-white transition-colors py-3 px-4 rounded-lg text-left"
                >
                  Location
                </button>
                <button
                  onClick={() => scrollToSection("features")}
                  className="text-gray-700 hover:text-blue-600 hover:bg-white transition-colors py-3 px-4 rounded-lg text-left"
                >
                  Feature
                </button>
                <button
                  onClick={() => scrollToSection("contact")}
                  className="text-gray-700 hover:text-blue-600 hover:bg-white transition-colors py-3 px-4 rounded-lg text-left"
                >
                  Contact
                </button>
                <div className="mt-4 px-4 flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      navigate("/login");
                    }}
                    className="w-full border-2 border-blue-500 text-blue-600 hover:bg-blue-50 py-3 rounded-lg font-medium transition-all"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleGetStarted();
                    }}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 rounded-lg font-medium transition-all"
                  >
                    Get Started
                  </button>
                </div>
              </div>
            </nav>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section
        id="home"
        className="relative flex items-center justify-center overflow-hidden pt-20"
        style={{ height: "45.9rem" }}
      >
        {/* Background Image */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url('/herosection.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
        {/* Dark Overlay */}
        <div className="absolute inset-0 bg-slate-900/60 z-10" />

        <div className="relative z-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-left">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-blue-500/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6 border border-blue-400/30">
            <Trophy className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-white">
              Premium Futsal Courts
            </span>
          </div>

          {/* Main Heading */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-5 leading-tight">
            Book Your Perfect{" "}
            <span className="text-blue-400">
              Futsal Court
            </span>
          </h1>

          {/* Subheading */}
          <p className="text-base sm:text-lg text-gray-300 mb-8 leading-relaxed max-w-2xl mx-auto">
            Reserve premium indoor futsal courts in minutes. Play with your
            team on professional-grade facilities.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleGetStarted}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-8 py-3.5 rounded-full transition-all duration-300 shadow-lg hover:shadow-blue-500/30"
            >
              Book Now
            </button>
            <button
              onClick={handleViewCourts}
              className="border-2 border-white/50 text-white hover:bg-white/10 font-semibold px-8 py-3.5 rounded-full transition-all duration-300 backdrop-blur-sm"
            >
              View Courts
            </button>
          </div>
        </div>

      </section>

      {/* Stats Section */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-1">
                5
              </div>
              <div className="text-sm text-gray-600 font-medium">Premium Courts</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-1">
                1000+
              </div>
              <div className="text-sm text-gray-600 font-medium">Happy Players</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-1">
                24/7
              </div>
              <div className="text-sm text-gray-600 font-medium">Online Booking</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-blue-600 mb-1">
                100%
              </div>
              <div className="text-sm text-gray-600 font-medium">Satisfaction</div>
            </div>
          </div>
        </div>
      </section>

      {/* Find Us Section - Real Booking Interface */}
      <section id="location" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              Find Us
            </h2>
            <p className="text-sm text-gray-600 max-w-xl mx-auto">
              Search for nearby futsal venues and book your court
            </p>
          </div>

          {/* Search Bar */}
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-center mb-6">
            <div className="relative flex-grow w-full group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
              </div>
              <input
                type="text"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-11 pr-4 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 placeholder:text-gray-400 transition-all"
                placeholder="Search for a venue..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>

            <div className="relative w-full md:w-auto min-w-[160px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter className="h-5 w-5 text-gray-400" />
              </div>
              <select
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-10 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 appearance-none cursor-pointer"
              >
                <option value="5">Within 5km</option>
                <option value="10">Within 10km</option>
                <option value="20">Within 20km</option>
                <option value="50">Within 50km</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                <ChevronRight className="h-4 w-4 rotate-90" />
              </div>
            </div>
          </div>

          {/* Main Content - Venues List + Map */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Nearby Venues List */}
            <div className="lg:col-span-4 max-h-[420px] overflow-y-auto pr-2 space-y-4 custom-scrollbar">
              <div className="flex justify-between items-center mb-2 px-1 sticky top-0 bg-white py-2">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <MapIcon size={20} className="text-blue-600" />
                  Nearby Venues
                </h3>
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                  {futsals.length} FOUND
                </span>
              </div>

              {loading && futsals.length === 0 ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="bg-gray-50 rounded-2xl p-5 h-32 animate-pulse border border-gray-200"
                    ></div>
                  ))}
                </div>
              ) : futsals.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <p className="text-gray-500 font-medium">
                    No venues found nearby.
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    Try increasing your search radius.
                  </p>
                </div>
              ) : (
                futsals.map((futsal, index) => (
                  <div
                    key={futsal._id}
                    className="bg-white rounded-2xl border border-gray-200 group cursor-pointer relative overflow-hidden hover:shadow-lg hover:border-blue-300 transition-all duration-300"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    {/* Futsal Image */}
                    <div className="relative h-32 w-full overflow-hidden">
                      {futsal.images && futsal.images.length > 0 ? (
                        <img
                          src={futsal.images[0]}
                          alt={futsal.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
                          <Image size={32} className="text-blue-200" />
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
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm p-1.5 rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-bold text-gray-900">
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
                        <h3 className="font-bold text-base text-gray-900 group-hover:text-blue-600 transition-colors">
                          {futsal.name}
                        </h3>
                        <div className="flex items-center gap-1 text-gray-500 text-xs mt-1">
                          <MapPin size={12} className="text-blue-500" />
                          <span className="truncate max-w-[180px]">
                            {futsal.location.address}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-end justify-between pt-3 border-t border-gray-100">
                        <div>
                          <p className="text-gray-400 text-[10px] uppercase tracking-wider font-bold mb-0.5">
                            Starting from
                          </p>
                          <p className="font-bold text-lg text-gray-900">
                            <span className="text-blue-600">Rs.</span>
                            {futsal.pricePerHour}
                            <span className="text-sm text-gray-500 font-medium">
                              /hr
                            </span>
                          </p>
                        </div>
                        <Link
                          to={`/futsal/${futsal._id}`}
                          className="bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white p-2.5 rounded-xl transition-all duration-300 border border-blue-200 hover:border-blue-600"
                        >
                          <ChevronRight size={18} />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Map View */}
            <div className="lg:col-span-8 rounded-2xl overflow-hidden border border-gray-200 shadow-sm h-[350px] lg:h-[420px] relative">
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
                        <span className="font-bold text-blue-600">You are here</span>
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
                        <h3 className="font-bold text-gray-900 mb-1">
                          {futsal.name}
                        </h3>
                        <p className="text-xs text-gray-600 mb-2">
                          Rs.{futsal.pricePerHour}/hr
                        </p>
                        <Link
                          to={`/futsal/${futsal._id}`}
                          className="block bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          View Details
                        </Link>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>

              {/* Decorative overlay for depth */}
              <div className="absolute inset-0 pointer-events-none rounded-2xl shadow-[inset_0_0_20px_rgba(0,0,0,0.05)] z-[400]"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              Why Choose Futsal Arena?
            </h2>
            <p className="text-sm text-gray-600 max-w-xl mx-auto">
              Experience the best futsal facilities with hassle-free booking and
              premium amenities
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Feature Card 1 */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-100 transition-all duration-300 group">
              <div className="bg-blue-50 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Easy Booking
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Book your court in just a few clicks. Choose your preferred time
                slot and get instant confirmation.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-100 transition-all duration-300 group">
              <div className="bg-blue-50 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                <MapPin className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Prime Location
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Conveniently located indoor courts with ample parking and easy
                access to public transport.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-100 transition-all duration-300 group">
              <div className="bg-blue-50 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Premium Quality
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Professional-grade artificial turf, quality equipment, and
                well-maintained facilities.
              </p>
            </div>

            {/* Feature Card 4 */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-100 transition-all duration-300 group">
              <div className="bg-blue-50 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Flexible Hours
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Open 7 days a week from early morning to late night. Find the
                perfect time for your game.
              </p>
            </div>

            {/* Feature Card 5 */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-100 transition-all duration-300 group">
              <div className="bg-blue-50 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                <Star className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Top Rated
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Highly rated by players for court quality, cleanliness, and
                customer service excellence.
              </p>
            </div>

            {/* Feature Card 6 */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-100 transition-all duration-300 group">
              <div className="bg-blue-50 w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-100 transition-colors">
                <Trophy className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Host Tournaments
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Perfect venue for tournaments and league games. Special packages
                available for regular teams.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        id="contact"
        className="py-16"
        style={{
          background: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)",
        }}
      >
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Ready to Play?
          </h2>
          <p className="text-base text-blue-100 mb-8">
            Book your court now and experience the best futsal facilities in
            town
          </p>
          <button
            onClick={handleGetStarted}
            className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-blue-600 text-sm font-semibold px-8 py-3 rounded-full transition-all duration-300"
          >
            Get Started
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-blue-500 p-2 rounded-lg">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <span className="text-white text-lg font-semibold">
                  Futsal Arena
                </span>
              </div>
              <p className="text-sm leading-relaxed">
                Your trusted futsal booking platform. We connect players with
                the best futsal venues. Book online 24/7.
              </p>
            </div>

            {/* About */}
            <div>
              <h4 className="text-white font-semibold mb-4">About Us</h4>
              <div className="space-y-2 text-sm">
                <p>We are a futsal booking service provider.</p>
                <p>Connecting players with premium courts.</p>
                <p>Email: support@futsalarena.com</p>
                <p>Phone: +977 980-1234567</p>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <div className="space-y-2 text-sm">
                <p className="hover:text-white cursor-pointer transition-colors">Find Venues</p>
                <p className="hover:text-white cursor-pointer transition-colors">How It Works</p>
                <p className="hover:text-white cursor-pointer transition-colors">For Venue Owners</p>
                <p className="hover:text-white cursor-pointer transition-colors">Support</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-10 pt-6 text-center text-xs">
            <p>&copy; 2026 Futsal Arena. A futsal booking service. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
