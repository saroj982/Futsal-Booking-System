import Futsal from "../models/Futsal.js";
import Booking from "../models/Booking.js";
import { createFutsalSchema, updateFutsalSchema } from "../libs/schemas/futsal.schemas.js";

const getValidationMessage = (result) =>
  result.error.issues[0]?.message || "Invalid request data";

// @desc    Register a new futsal
// @route   POST /api/futsals
// @access  Private/Owner
const createFutsal = async (req, res) => {
  const parsed = createFutsalSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: getValidationMessage(parsed) });
  }

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
    images,
    facilities,
    rules,
  } = parsed.data;

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
    images,
    facilities: {
      changingRooms: !!facilities?.changingRooms,
      freeWater: !!facilities?.freeWater,
      nightLight: !!facilities?.nightLight,
      parking: !!facilities?.parking,
    },
    rules,
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

  // If a keyword is provided, prioritize text search across all venues (no geo filter)
  // so users can always find owner-listed venues by name/address.
  let query = {};

  if (keyword) {
    query = {
      $or: [
        { name: { $regex: keyword, $options: "i" } },
        { "location.address": { $regex: keyword, $options: "i" } },
      ],
    };
  } else if (lat && lng) {
    const maxDistance = (parseFloat(radius) || 10) * 1000; // Default 10km
    query.location = {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [parseFloat(lng), parseFloat(lat)],
        },
        $maxDistance: maxDistance,
      },
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
  const parsed = updateFutsalSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: getValidationMessage(parsed) });
  }

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
    facilities,
    rules,
  } = parsed.data;

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

    futsal.name = name ?? futsal.name;
    futsal.description = description ?? futsal.description;
    futsal.pricePerHour = pricePerHour ?? futsal.pricePerHour;
    futsal.openTime = openTime ?? futsal.openTime;
    futsal.closeTime = closeTime ?? futsal.closeTime;
    futsal.openDays = openDays ?? futsal.openDays;
    if (facilities) {
      futsal.facilities = {
        changingRooms: !!facilities.changingRooms,
        freeWater: !!facilities.freeWater,
        nightLight: !!facilities.nightLight,
        parking: !!facilities.parking,
      };
    }
    if (Array.isArray(rules)) {
      futsal.rules = rules;
    }

    if (lat !== undefined && lng !== undefined) {
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

// @desc    Add Cloudinary image URLs for futsal
// @route   POST /api/futsals/:id/images
// @access  Private/Owner
const uploadImages = async (req, res) => {
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

    const { imageUrls } = req.body;

    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res.status(400).json({ message: "No image URLs provided" });
    }

    // Add new images to existing ones (max 10 total)
    const currentImages = futsal.images || [];
    const newImages = [...currentImages, ...imageUrls].slice(0, 10);

    futsal.images = newImages;
    await futsal.save();

    res.json({
      message: "Images added successfully",
      images: futsal.images,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Delete an image from futsal
// @route   DELETE /api/futsals/:id/images
// @access  Private/Owner
const deleteImage = async (req, res) => {
  try {
    const { imageUrl } = req.body;
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

    // Remove image from array
    futsal.images = futsal.images.filter((img) => img !== imageUrl);
    await futsal.save();

    res.json({
      message: "Image deleted successfully",
      images: futsal.images,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export {
  createFutsal,
  getFutsals,
  getFutsalById,
  getMyFutsals,
  updateFutsal,
  uploadImages,
  deleteImage,
};
