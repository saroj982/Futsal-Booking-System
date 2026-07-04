import mongoose from "mongoose";
import config from "./config.js";

async function connectDB() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log("MongoDB Connected");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
}

export default connectDB;
