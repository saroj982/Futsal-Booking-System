import express from "express";
import cors from "cors";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

import config from "./src/config/config.js";
import connectDB from "./src/config/database.js";
import attachSocket from "./src/middleware/socketMiddleware.js";
import authRoutes from "./src/routes/auth.js";
import futsalRoutes from "./src/routes/futsal.js";
import bookingRoutes from "./src/routes/booking.js";
import paymentRoutes from "./src/routes/payment.js";
import bookingV2Routes from "./src/routes/bookingV2.js";
import adminRoutes from "./src/routes/admin.js";
import { checkExpiredBookings } from "./src/controllers/bookingController.js";
import { expireReservations } from "./src/services/bookingService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.frontendUrl || "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(attachSocket(io));

app.use("/api/auth", authRoutes);
app.use("/api/futsals", futsalRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/v2/bookings", bookingV2Routes);
app.use("/api/admin", adminRoutes);

const runExpiryJobs = () => {
  setInterval(() => {
    checkExpiredBookings(io).catch((error) => {
      console.error("Legacy expiry job error:", error);
    });
  }, 10000);

  setInterval(() => {
    expireReservations(io).catch((error) => {
      console.error("Expiry job error:", error);
    });
  }, 10000);
};

const startServer = async () => {
  await connectDB();

  server.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    runExpiryJobs();
  });
};

startServer().catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});
