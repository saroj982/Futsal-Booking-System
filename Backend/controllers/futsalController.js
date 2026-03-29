const Futsal = require("../models/Futsal");
const Booking = require("../models/Booking");

// @desc    Register a new futsal
// @route   POST /api/futsals
// @access  Private/Owner
const createFutsal = async (req, res) => {
  const {
    name,
    description,
    pricePerHour,
    lat,
    lng,
    address,
    openTime,
    closeTime,
    openDays,
  } = req.body;

  if (openTime >= closeTime) {
    return res
      .status(400)
      .json({ message: "Closing time must be after opening time" });
  }

  const futsal = new Futsal({
    owner: req.user._id,
    name,
    description,
    pricePerHour,
    location: {
      type: "Point",
      coordinates: [lng, lat], // GeoJSON order is [longitude, latitude]
      address,
    },
    openTime,
    closeTime,
    openDays,
  });

  try {
    const createdFutsal = await futsal.save();
    res.status(201).json(createdFutsal);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get all futsals (with optional search)
// @route   GET /api/futsals
// @access  Public
const getFutsals = async (req, res) => {
  const { keyword, lat, lng, radius } = req.query; // Radius in km

  let query = {};

  // If geo-searching
  if (lat && lng) {
    const maxDistance = (radius || 10) * 1000; // Default 10km
    query.location = {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [parseFloat(lng), parseFloat(lat)],
        },
        $maxDistance: maxDistance,
      },
    };
  } else if (keyword) {
    // Basic text search on name or address (if not using geo)
    query = {
      $or: [
        { name: { $regex: keyword, $options: "i" } },
        { "location.address": { $regex: keyword, $options: "i" } },
      ],
    };
  }

  try {
    const futsals = await Futsal.find(query);
    res.json(futsals);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get futsal by ID
// @route   GET /api/futsals/:id
// @access  Public
const getFutsalById = async (req, res) => {
  try {
    const futsal = await Futsal.findById(req.params.id).populate(
      "owner",
      "name email",
    );
    if (futsal) {
      res.json(futsal);
    } else {
      res.status(404).json({ message: "Futsal not found" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get futsals by owner
// @route   GET /api/futsals/my
// @access  Private/Owner
const getMyFutsals = async (req, res) => {
  try {
    const futsals = await Futsal.find({ owner: req.user._id });
    res.json(futsals);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Update futsal
// @route   PUT /api/futsals/:id
// @access  Private/Owner
const updateFutsal = async (req, res) => {
  const {
    name,
    description,
    pricePerHour,
    lat,
    lng,
    address,
    openTime,
    closeTime,
    openDays,
  } = req.body;

  try {
    const futsal = await Futsal.findById(req.params.id);

    if (!futsal) {
      return res.status(404).json({ message: "Futsal not found" });
    }

    // Check ownership
    if (futsal.owner.toString() !== req.user._id.toString()) {
      return res
        .status(401)
        .json({ message: "Not authorized to update this futsal" });
    }

    futsal.name = name || futsal.name;
    futsal.description = description || futsal.description;
    futsal.pricePerHour = pricePerHour || futsal.pricePerHour;
    futsal.openTime = openTime || futsal.openTime;
    futsal.closeTime = closeTime || futsal.closeTime;
    futsal.openDays = openDays || futsal.openDays;

    if (lat && lng) {
      futsal.location = {
        type: "Point",
        coordinates: [lng, lat],
        address: address || futsal.location.address,
      };
    } else if (address) {
      // Keep coordinates but update address text
      futsal.location.address = address;
    }

    const updatedFutsal = await futsal.save();
    res.json(updatedFutsal);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createFutsal,
  getFutsals,
  getFutsalById,
  getMyFutsals,
  updateFutsal,
};
