import mongoose from "mongoose";

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
  facilities: {
    changingRooms: {
      type: Boolean,
      default: false,
    },
    freeWater: {
      type: Boolean,
      default: false,
    },
    nightLight: {
      type: Boolean,
      default: false,
    },
    parking: {
      type: Boolean,
      default: false,
    },
  },
  rules: {
    type: [String],
    default: [
      "Indoor sports shoes only",
      "No food or drinks on the field",
      "Arrive 15 minutes before your booking",
      "Maximum 10 players per field",
    ],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Configure geospatial index for location
futsalSchema.index({ location: "2dsphere" });

export default mongoose.model("Futsal", futsalSchema);
