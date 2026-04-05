import React, { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Users,
  MapPin,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  MoreVertical,
  Eye,
  Ban,
  Trash2,
  CheckCircle,
  XCircle,
  RefreshCw,
  Building2,
  CreditCard,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Activity,
} from "lucide-react";
import { toast } from "react-hot-toast";
import AuthContext from "../context/AuthContext";

// Stats Card Component
function StatCard({ title, value, icon: Icon, trend, trendValue, color = "blue" }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    green: "bg-green-50 text-green-600 border-green-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
    red: "bg-red-50 text-red-600 border-red-100",
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
          <p className="text-3xl font-bold text-slate-900">{value}</p>
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${trend === "up" ? "text-green-600" : "text-red-600"}`}>
              {trend === "up" ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl border ${colors[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

// Tab Navigation
function TabNav({ tabs, activeTab, onChange }) {
  return (
    <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
            activeTab === tab.id
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <tab.icon size={18} />
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// User Management Tab
function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await axios.get("/api/admin/users", {
        params: { page, search, role: roleFilter },
      });
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (error) {
      toast.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter]);

  const handleBlock = async (userId) => {
    try {
      const { data } = await axios.put(`/api/admin/users/${userId}/block`);
      toast.success(data.message);
      fetchUsers(pagination.page);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update user");
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    
    try {
      await axios.delete(`/api/admin/users/${userId}`);
      toast.success("User deleted");
      fetchUsers(pagination.page);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete user");
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
        >
          <option value="all">All Roles</option>
          <option value="user">Users</option>
          <option value="owner">Owners</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">User</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Role</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Bookings</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Joined</th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                  Loading...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user._id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{user.name}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      user.role === "owner" 
                        ? "bg-purple-100 text-purple-700" 
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{user.bookingCount}</td>
                  <td className="px-6 py-4">
                    {user.isBlocked ? (
                      <span className="flex items-center gap-1 text-red-600 text-sm">
                        <XCircle size={16} /> Blocked
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle size={16} /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleBlock(user._id)}
                        className={`p-2 rounded-lg transition-colors ${
                          user.isBlocked 
                            ? "text-green-600 hover:bg-green-50" 
                            : "text-orange-600 hover:bg-orange-50"
                        }`}
                        title={user.isBlocked ? "Unblock" : "Block"}
                      >
                        <Ban size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(user._id)}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
            <p className="text-sm text-slate-600">
              Showing {(pagination.page - 1) * 20 + 1} to {Math.min(pagination.page * 20, pagination.total)} of {pagination.total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => fetchUsers(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => fetchUsers(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="p-2 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Venue Management Tab
function VenueManagement() {
  const [futsals, setFutsals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const fetchFutsals = async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await axios.get("/api/admin/futsals", {
        params: { page, search, status: statusFilter },
      });
      setFutsals(data.futsals);
      setPagination(data.pagination);
    } catch (error) {
      toast.error("Failed to fetch venues");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFutsals();
  }, [search, statusFilter]);

  const handleToggle = async (futsalId) => {
    try {
      const { data } = await axios.put(`/api/admin/futsals/${futsalId}/toggle`);
      toast.success(data.message);
      fetchFutsals(pagination.page);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update venue");
    }
  };

  const handleDelete = async (futsalId) => {
    if (!window.confirm("Are you sure you want to delete this venue?")) return;
    
    try {
      await axios.delete(`/api/admin/futsals/${futsalId}`);
      toast.success("Venue deleted");
      fetchFutsals(pagination.page);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete venue");
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search venues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-12">
            <RefreshCw className="animate-spin text-slate-400" size={32} />
          </div>
        ) : futsals.length === 0 ? (
          <div className="col-span-full text-center py-12 text-slate-500">
            No venues found
          </div>
        ) : (
          futsals.map((futsal) => (
            <div key={futsal._id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all">
              <div className="h-40 bg-slate-100 relative">
                {futsal.images?.[0] ? (
                  <img src={futsal.images[0]} alt={futsal.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <Building2 size={48} />
                  </div>
                )}
                <span className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold ${
                  futsal.isActive !== false
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}>
                  {futsal.isActive !== false ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-slate-900 mb-1">{futsal.name}</h3>
                <p className="text-sm text-slate-500 mb-2 flex items-center gap-1">
                  <MapPin size={14} /> {futsal.address}
                </p>
                <div className="flex items-center justify-between text-sm mb-4">
                  <span className="text-slate-600">Owner: {futsal.owner?.name}</span>
                  <span className="font-semibold text-blue-600">Rs. {futsal.pricePerHour}/hr</span>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <span className="text-sm text-slate-500">{futsal.bookingCount} bookings</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggle(futsal._id)}
                      className={`p-2 rounded-lg transition-colors ${
                        futsal.isActive !== false
                          ? "text-orange-600 hover:bg-orange-50"
                          : "text-green-600 hover:bg-green-50"
                      }`}
                      title={futsal.isActive !== false ? "Deactivate" : "Activate"}
                    >
                      {futsal.isActive !== false ? <XCircle size={18} /> : <CheckCircle size={18} />}
                    </button>
                    <button
                      onClick={() => handleDelete(futsal._id)}
                      className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Booking Management Tab
function BookingManagement() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const fetchBookings = async (page = 1) => {
    setLoading(true);
    try {
      const { data } = await axios.get("/api/admin/bookings", {
        params: { page, status: statusFilter },
      });
      setBookings(data.bookings);
      setPagination(data.pagination);
    } catch (error) {
      toast.error("Failed to fetch bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [statusFilter]);

  const handleCancel = async (bookingId) => {
    const reason = window.prompt("Enter cancellation reason:");
    if (!reason) return;
    
    try {
      const { data } = await axios.put(`/api/admin/bookings/${bookingId}/cancel`, { reason });
      toast.success(data.message);
      fetchBookings(pagination.page);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to cancel booking");
    }
  };

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-700",
    confirmed: "bg-green-100 text-green-700",
    cancelled: "bg-slate-100 text-slate-700",
    refund_pending: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 outline-none"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="refund_pending">Refund Pending</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Booking</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">User</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Venue</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Date & Time</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Amount</th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
              <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  <RefreshCw className="animate-spin mx-auto mb-2" size={24} />
                  Loading...
                </td>
              </tr>
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                  No bookings found
                </td>
              </tr>
            ) : (
              bookings.map((booking) => (
                <tr key={booking._id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-slate-600">
                      {booking._id.slice(-8).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{booking.user?.name}</p>
                      <p className="text-sm text-slate-500">{booking.user?.email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{booking.futsal?.name}</td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-slate-900">{booking.date}</p>
                      <p className="text-sm text-slate-500">
                        {booking.timeSlots?.map(t => `${t}:00`).join(", ")}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900">
                    Rs. {booking.totalPrice}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[booking.status] || "bg-slate-100 text-slate-700"}`}>
                      {booking.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {booking.status !== "cancelled" && booking.status !== "refund_pending" && (
                        <button
                          onClick={() => handleCancel(booking._id)}
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                          title="Cancel Booking"
                        >
                          <XCircle size={18} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200">
            <p className="text-sm text-slate-600">
              Page {pagination.page} of {pagination.pages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => fetchBookings(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => fetchBookings(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="p-2 rounded-lg border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Refund Management Tab
function RefundManagement() {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRefunds = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get("/api/admin/refunds");
      setRefunds(data.refunds);
    } catch (error) {
      toast.error("Failed to fetch refunds");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, []);

  const handleComplete = async (refund) => {
    const transactionId = window.prompt("Enter eSewa refund transaction ID (optional):");
    
    try {
      await axios.put(`/api/admin/refunds/${refund.id}/complete`, {
        type: refund.type,
        refundTransactionId: transactionId,
      });
      toast.success("Refund marked as completed");
      fetchRefunds();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to complete refund");
    }
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="animate-spin text-slate-400" size={32} />
        </div>
      ) : refunds.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <CheckCircle className="mx-auto mb-4 text-green-500" size={48} />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No Pending Refunds</h3>
          <p className="text-slate-500">All refunds have been processed.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {refunds.map((refund) => (
            <div key={refund.id} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-all">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <AlertTriangle className="text-orange-500" size={20} />
                    <span className="font-semibold text-slate-900">
                      {refund.user?.name} - {refund.futsal?.name}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Amount</p>
                      <p className="font-semibold text-slate-900">Rs. {refund.amount}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Date</p>
                      <p className="text-slate-900">{refund.date}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">eSewa Ref</p>
                      <p className="font-mono text-slate-900">{refund.esewaRefId || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Reason</p>
                      <p className="text-slate-900">{refund.reason || "N/A"}</p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleComplete(refund)}
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-colors flex items-center gap-2"
                >
                  <CheckCircle size={18} />
                  Mark Completed
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Main Admin Dashboard Component
export default function AdminDashboard() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/login");
      return;
    }
    fetchStats();
  }, [user, navigate]);

  const fetchStats = async () => {
    try {
      const { data } = await axios.get("/api/admin/stats");
      setStats(data.stats);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
      if (error.response?.status === 401) {
        logout();
        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "users", label: "Users", icon: Users },
    { id: "venues", label: "Venues", icon: Building2 },
    { id: "bookings", label: "Bookings", icon: Calendar },
    { id: "refunds", label: "Refunds", icon: CreditCard },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 p-2 rounded-xl">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Admin Dashboard</h1>
                <p className="text-sm text-slate-500">Futsal Booking System</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">Welcome, {user?.name}</span>
              <button
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="mb-8">
          <TabNav tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && stats && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Total Users"
                value={stats.users.total}
                icon={Users}
                color="blue"
              />
              <StatCard
                title="Futsal Owners"
                value={stats.users.owners}
                icon={Building2}
                color="purple"
              />
              <StatCard
                title="Active Venues"
                value={stats.futsals.active}
                icon={MapPin}
                color="green"
              />
              <StatCard
                title="Total Revenue"
                value={`Rs. ${stats.revenue.total.toLocaleString()}`}
                icon={DollarSign}
                color="orange"
              />
            </div>

            {/* Bookings Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard
                title="Total Bookings"
                value={stats.bookings.total}
                icon={Calendar}
                color="blue"
              />
              <StatCard
                title="This Month"
                value={stats.bookings.thisMonth}
                icon={TrendingUp}
                trend={stats.bookings.growth >= 0 ? "up" : "down"}
                trendValue={`${Math.abs(stats.bookings.growth)}% vs last month`}
                color="green"
              />
              <StatCard
                title="Pending Refunds"
                value={stats.bookings.pendingRefunds}
                icon={AlertTriangle}
                color={stats.bookings.pendingRefunds > 0 ? "red" : "green"}
              />
            </div>

            {/* Monthly Revenue */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">This Month</h3>
              <div className="flex items-center gap-8">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Revenue</p>
                  <p className="text-3xl font-bold text-slate-900">
                    Rs. {stats.revenue.thisMonth.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Bookings</p>
                  <p className="text-3xl font-bold text-slate-900">{stats.bookings.thisMonth}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Confirmed</p>
                  <p className="text-3xl font-bold text-green-600">{stats.bookings.confirmed}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Other Tabs */}
        {activeTab === "users" && <UserManagement />}
        {activeTab === "venues" && <VenueManagement />}
        {activeTab === "bookings" && <BookingManagement />}
        {activeTab === "refunds" && <RefundManagement />}
      </main>
    </div>
  );
}
