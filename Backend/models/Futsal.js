const mongoose = require("mongoose");

const futsalSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  pricePerHour: {
    type: Number,
    required: true,
  },
  images: {
    type: [String], // Array of image URLs/paths
    default: [],
  },
  location: {
    type: {
      type: String,
      enum: ["Point"],
      required: true,
    },
    coordinates: {
      type: [Number],
      required: true,
    },
    address: String,
  },
  openTime: {
    type: Number, // Store as hour (0-23)
    required: true,
  },
  closeTime: {
    type: Number, // Store as hour (0-23)
    required: true,
  },
  openDays: {
    type: [String], // Array of day names: ['Sunday', 'Monday', ...]
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Configure geospatial index for location
futsalSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Futsal", futsalSchema);
