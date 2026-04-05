const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
dotenv.config();

const authRoutes = require("./routes/auth");
const futsalRoutes = require("./routes/futsal");
const bookingRoutes = require("./routes/booking");
const paymentRoutes = require("./routes/payment");
const bookingV2Routes = require("./routes/bookingV2");
const adminRoutes = require("./routes/admin");
const { checkExpiredBookings } = require("./controllers/bookingController");
const { expireReservations } = require("./services/bookingService");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // URL of your frontend
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Pass io to routes via middleware
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// Legacy routes (v1)
app.use("/api/auth", authRoutes);
app.use("/api/futsals", futsalRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);

// New race-condition-safe routes (v2)
app.use("/api/v2/bookings", bookingV2Routes);

// Admin routes
app.use("/api/admin", adminRoutes);

const PORT = 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Legacy expiry check (for existing bookings)
  setInterval(() => {
    checkExpiredBookings(io);
  }, 10000);
  
  // New race-safe expiry check (for Reservation model)
  setInterval(() => {
    expireReservations(io).catch(err => {
      console.error("Expiry job error:", err);
    });
  }, 10000);
});
