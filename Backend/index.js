const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
dotenv.config();

const authRoutes = require("./routes/auth");
const futsalRoutes = require("./routes/futsal");
const bookingRoutes = require("./routes/booking");
const paymentRoutes = require("./routes/payment");
const { checkExpiredBookings } = require("./controllers/bookingController");

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

app.use("/api/auth", authRoutes);
app.use("/api/futsals", futsalRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);

const PORT = 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Check for expired bookings every 10 seconds
  setInterval(() => {
    checkExpiredBookings(io);
  }, 10000);
});
