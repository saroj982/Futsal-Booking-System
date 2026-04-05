import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import {
  UserPlus,
  User,
  Mail,
  Lock,
  Briefcase,
  ArrowRight,
  Check,
  AlertCircle,
} from "lucide-react";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [errors, setErrors] = useState({});
  const { register } = useContext(AuthContext);
  const navigate = useNavigate();

  // Validate full name - first 3 chars must be letters, no numbers only
  const validateName = (value) => {
    if (!value.trim()) {
      return "Full name is required";
    }
    if (value.trim().length < 3) {
      return "Full name must be at least 3 characters";
    }
    if (!/^[a-zA-Z]{3}/.test(value.trim())) {
      return "First three characters must be letters";
    }
    if (/^[0-9\s]+$/.test(value)) {
      return "Full name cannot be only numbers";
    }
    return null;
  };

  // Validate password - min 8 chars, uppercase, lowercase, number, special char
  const validatePassword = (value) => {
    const requirements = [];
    if (value.length < 8) {
      requirements.push("at least 8 characters");
    }
    if (!/[A-Z]/.test(value)) {
      requirements.push("one uppercase letter");
    }
    if (!/[a-z]/.test(value)) {
      requirements.push("one lowercase letter");
    }
    if (!/[0-9]/.test(value)) {
      requirements.push("one number");
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) {
      requirements.push("one special character");
    }
    if (requirements.length > 0) {
      return `Password must contain ${requirements.join(", ")}`;
    }
    return null;
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    setName(value);
    const error = validateName(value);
    setErrors((prev) => ({ ...prev, name: error }));
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    const error = validatePassword(value);
    setErrors((prev) => ({ ...prev, password: error }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all fields
    const nameError = validateName(name);
    const passwordError = validatePassword(password);
    
    if (nameError || passwordError) {
      setErrors({ name: nameError, password: passwordError });
      return;
    }

    try {
      await register(name, email, password, role);
      navigate(role === "owner" ? "/owner" : "/");
    } catch (err) {
      console.error(err);
      alert("Registration failed");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full max-w-lg mx-auto py-12 px-4 animate-fade-in">
      {/* Brand Header */}
      <div className="text-center mb-10 space-y-2">
        <h2 className="text-4xl md:text-5xl font-display font-bold text-slate-900 tracking-tight">
          Get <span className="text-primary">Started</span>
        </h2>
        <p className="text-slate-500 text-lg font-light">
          Join the platform to book or rent venues
        </p>
      </div>

      <div className="glass p-8 md:p-10 rounded-[2.5rem] w-full relative overflow-hidden group">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-secondary/20 blur-3xl rounded-full pointer-events-none group-hover:bg-secondary/30 transition-colors duration-700"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary/20 blur-3xl rounded-full pointer-events-none group-hover:bg-primary/30 transition-colors duration-700"></div>

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div className="relative group/input">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">
              Full Name
            </label>
            <div className="relative">
              <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${errors.name ? "text-red-500" : "text-slate-500 group-focus-within/input:text-secondary"}`}>
                <User size={20} />
              </div>
              <input
                type="text"
                value={name}
                onChange={handleNameChange}
                className={`w-full bg-slate-1000 border rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:ring-2 outline-none transition-all placeholder:text-slate-600 shadow-inner ${
                  errors.name 
                    ? "border-red-500 focus:ring-red-500/50 focus:border-red-500" 
                    : "border-slate-700 focus:ring-secondary/50 focus:border-secondary"
                }`}
                placeholder="John Doe"
                required
              />
            </div>
            {errors.name && (
              <p className="mt-2 text-sm text-red-500 flex items-center gap-1 ml-1">
                <AlertCircle size={14} />
                {errors.name}
              </p>
            )}
          </div>

          <div className="relative group/input">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-secondary transition-colors">
                <Mail size={20} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-1000 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:ring-2 focus:ring-secondary/50 focus:border-secondary outline-none transition-all placeholder:text-slate-600 shadow-inner"
                placeholder="name@example.com"
                required
              />
            </div>
          </div>

          <div className="relative group/input">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">
              Password
            </label>
            <div className="relative">
              <div className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${errors.password ? "text-red-500" : "text-slate-500 group-focus-within/input:text-secondary"}`}>
                <Lock size={20} />
              </div>
              <input
                type="password"
                value={password}
                onChange={handlePasswordChange}
                className={`w-full bg-slate-1000 border rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:ring-2 outline-none transition-all placeholder:text-slate-600 shadow-inner ${
                  errors.password 
                    ? "border-red-500 focus:ring-red-500/50 focus:border-red-500" 
                    : "border-slate-700 focus:ring-secondary/50 focus:border-secondary"
                }`}
                placeholder="••••••••"
                required
              />
            </div>
            {errors.password && (
              <p className="mt-2 text-sm text-red-500 flex items-center gap-1 ml-1">
                <AlertCircle size={14} />
                {errors.password}
              </p>
            )}
            {!errors.password && password && (
              <p className="mt-2 text-sm text-green-600 flex items-center gap-1 ml-1">
                <Check size={14} />
                Password meets all requirements
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 block ml-1">
              I want to...
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole("user")}
                className={`relative p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-3 group/role ${
                  role === "user"
                    ? "bg-primary/20 border-primary text-slate-900 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                    : "bg-white border-slate-700 text-slate-500 hover:bg-slate-100"
                }`}
              >
                {role === "user" && (
                  <div className="absolute top-2 right-2 bg-primary text-slate-900 rounded-full p-0.5">
                    <Check size={12} />
                  </div>
                )}
                <User
                  size={32}
                  className={`transition-colors ${role === "user" ? "text-primary" : "text-slate-500 group-hover/role:text-slate-600"}`}
                />
                <span className="text-sm font-bold">Book Venues</span>
              </button>

              <button
                type="button"
                onClick={() => setRole("owner")}
                className={`relative p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center gap-3 group/role ${
                  role === "owner"
                    ? "bg-secondary/20 border-secondary text-slate-900 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                    : "bg-white border-slate-700 text-slate-500 hover:bg-slate-100"
                }`}
              >
                {role === "owner" && (
                  <div className="absolute top-2 right-2 bg-secondary text-slate-900 rounded-full p-0.5">
                    <Check size={12} />
                  </div>
                )}
                <Briefcase
                  size={32}
                  className={`transition-colors ${role === "owner" ? "text-secondary" : "text-slate-500 group-hover/role:text-slate-600"}`}
                />
                <span className="text-sm font-bold">List Venues</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full btn-primary py-4 text-lg rounded-2xl flex justify-center items-center gap-3 group/btn mt-4"
          >
            <span>Create Account</span>
            <UserPlus
              size={20}
              className="group-hover/btn:translate-x-1 transition-transform"
            />
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          <p className="text-slate-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-slate-900 hover:text-secondary font-bold transition-colors inline-flex items-center gap-1 group/link"
            >
              Log In
              <ArrowRight
                size={14}
                className="group-hover/link:translate-x-1 transition-transform text-secondary"
              />
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
