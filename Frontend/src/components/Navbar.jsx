import React, { useContext } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import { LayoutDashboard, Calendar, LogOut, User, MapPin } from "lucide-react";

function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => location.pathname === path;

  const handleLogoClick = () => {
    if (user) {
      // If logged in, go to home and refresh
      navigate("/home");
      window.location.reload();
    } else {
      // If not logged in, go to landing page
      navigate("/");
      window.location.reload();
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300">
      <div className="absolute inset-0 glass border-b border-slate-200 shadow-2xl"></div>

      <div className="container mx-auto px-6 py-4 flex justify-between items-center relative z-10">
        <button
          onClick={handleLogoClick}
          className="text-2xl font-bold tracking-tight font-display hover:opacity-80 transition-opacity flex items-center gap-2"
        >
          <div className="bg-blue-500 p-2 rounded-lg">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <span className="text-slate-900">Futsal Arena</span>
        </button>

        <div className="flex items-center gap-8">
          {user ? (
            <>
              {user.role === "owner" ? (
                <Link
                  to="/owner"
                  className={`flex items-center gap-2 text-sm font-semibold transition-all duration-300 ${isActive("/owner") ? "text-secondary" : "text-slate-500 hover:text-slate-900"}`}
                >
                  <LayoutDashboard size={18} />
                  <span>Dashboard</span>
                </Link>
              ) : (
                <div className="hidden md:flex items-center gap-6">
                  <Link
                    to="/home"
                    className={`flex items-center gap-2 text-sm font-semibold transition-all duration-300 relative group ${isActive("/home") ? "text-secondary" : "text-slate-500 hover:text-slate-900"}`}
                  >
                    <MapPin size={18} />
                    <span>Locations</span>
                    {isActive("/home") && (
                      <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-secondary rounded-full shadow-[0_0_10px_#06b6d4]"></span>
                    )}
                  </Link>
                  <Link
                    to="/my-bookings"
                    className={`flex items-center gap-2 text-sm font-semibold transition-all duration-300 relative group ${isActive("/my-bookings") ? "text-secondary" : "text-slate-500 hover:text-slate-900"}`}
                  >
                    <Calendar size={18} />
                    <span>My Bookings</span>
                    {isActive("/my-bookings") && (
                      <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-secondary rounded-full shadow-[0_0_10px_#06b6d4]"></span>
                    )}
                  </Link>
                </div>
              )}

              <div className="h-6 w-px bg-slate-50 mx-2 hidden md:block"></div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-slate-600 pl-2 md:pl-0">
                  <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden md:flex flex-col items-start leading-none">
                    <span className="text-sm font-bold text-slate-900">
                      {user.name}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                      {user.role}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                  className="p-2.5 text-slate-500 hover:text-accent transition-colors rounded-xl hover:bg-slate-100 border border-transparent hover:border-slate-200"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-6">
              <Link
                to="/login"
                className="text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="bg-primary text-white px-6 py-2 rounded-xl font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
