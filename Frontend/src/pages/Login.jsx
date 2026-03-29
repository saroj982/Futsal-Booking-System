import React, { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import { LogIn as LogInIcon, Mail, Lock, ArrowRight } from "lucide-react";
import { toast } from "react-hot-toast";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      console.error(err);
      toast("Login failed");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] w-full max-w-lg mx-auto py-12 px-4 animate-fade-in">
      {/* Brand Header */}
      <div className="text-center mb-10 space-y-2">
        <h2 className="text-4xl md:text-5xl font-display font-bold text-slate-900 tracking-tight">
          Welcome <span className="text-primary">Back</span>
        </h2>
        <p className="text-slate-500 text-lg font-light">
          Manage your bookings and venues in one place
        </p>
      </div>

      <div className="glass p-8 md:p-10 rounded-[2.5rem] w-full relative overflow-hidden group">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 blur-3xl rounded-full pointer-events-none group-hover:bg-primary/30 transition-colors duration-700"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary/20 blur-3xl rounded-full pointer-events-none group-hover:bg-secondary/30 transition-colors duration-700"></div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div className="space-y-4">
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
              <div className="flex justify-between items-center mb-1.5 ml-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">
                  Password
                </label>
                <a
                  href="#"
                  className="text-xs text-secondary hover:text-primary transition-colors font-medium"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within/input:text-secondary transition-colors">
                  <Lock size={20} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-1000 border border-slate-700 rounded-2xl py-4 pl-12 pr-4 text-slate-900 focus:ring-2 focus:ring-secondary/50 focus:border-secondary outline-none transition-all placeholder:text-slate-600 shadow-inner"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full btn-primary py-4 text-lg rounded-2xl flex justify-center items-center gap-3 group/btn mt-2"
          >
            <span>Sign In</span>
            <LogInIcon
              size={20}
              className="group-hover/btn:translate-x-1 transition-transform"
            />
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          <p className="text-slate-500">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="text-slate-900 hover:text-secondary font-bold transition-colors inline-flex items-center gap-1 group/link"
            >
              Create Account
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

export default Login;
