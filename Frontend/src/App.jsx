import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useContext } from "react";
import AuthContext from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import LandingPage from "./pages/LandingPage";
import OwnerDashboard from "./pages/OwnerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import FutsalDetails from "./pages/FutsalDetails";
import MyBookings from "./pages/MyBookings";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentFailure from "./pages/PaymentFailure";
import Navbar from "./components/Navbar";
import { Toaster } from "react-hot-toast";

function AppContent() {
  const { user } = useContext(AuthContext);
  const location = useLocation();

  // Hide navbar on landing page, payment pages, and admin dashboard
  const isLandingPage = location.pathname === "/";
  const isPaymentPage = location.pathname.startsWith("/payment");
  const isAdminPage = location.pathname.startsWith("/admin");
  const showNavbar = user && !isLandingPage && !isPaymentPage && !isAdminPage;

  return (
    <>
      <Toaster
        position="top-center"
        reverseOrder={false}
        toastOptions={{
          style: {
            background: "#1e293b",
            color: "#fff",
            border: "1px solid #334155",
          },
        }}
      />
      <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-secondary selection:text-white">
        {showNavbar && <Navbar />}
        <div className={showNavbar ? "pt-24 px-4 md:px-8 pb-12 max-w-7xl mx-auto" : ""}>
          <Routes>
            <Route
              path="/"
              element={
                user?.role === "admin" ? (
                  <Navigate to="/admin" />
                ) : user?.role === "owner" ? (
                  <Navigate to="/owner" />
                ) : user?.role === "user" ? (
                  <Navigate to="/home" />
                ) : (
                  <LandingPage />
                )
              }
            />
            <Route
              path="/home"
              element={<Home />}
            />
            <Route
              path="/login"
              element={!user ? <Login /> : <Navigate to="/" />}
            />
            <Route
              path="/register"
              element={!user ? <Register /> : <Navigate to="/" />}
            />
            <Route
              path="/owner"
              element={
                user?.role === "owner" ? (
                  <OwnerDashboard />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route
              path="/admin"
              element={
                user?.role === "admin" ? (
                  <AdminDashboard />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route
              path="/my-bookings"
              element={
                user && user.role === "user" ? (
                  <MyBookings />
                ) : (
                  <Navigate to="/" />
                )
              }
            />
            <Route path="/futsal/:id" element={<FutsalDetails />} />
            <Route path="/payment/success" element={<PaymentSuccess />} />
            <Route path="/payment/failure" element={<PaymentFailure />} />
          </Routes>
        </div>
      </div>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
