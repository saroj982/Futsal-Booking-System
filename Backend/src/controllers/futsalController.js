import axios from "axios";
import Futsal from "../models/Futsal.js";
import Booking from "../models/Booking.js";
import { createFutsalSchema, updateFutsalSchema } from "../libs/schemas/futsal.schemas.js";
import { haversineDistanceKm } from "../utils/location.js";
import { isFuzzyMatch } from "../utils/fuzzySearch.js";

const getValidationMessage = (result) =>
  result.error.issues[0]?.message || "Invalid request data";

export const normalizeFacilities = (facilities = []) => {
  if (Array.isArray(facilities)) {
    return [...new Set(facilities.map((item) => item?.trim()).filter(Boolean))];
  }

  if (facilities && typeof facilities === "object") {
    const entries = Object.entries(facilities)
      .filter(([, enabled]) => enabled)
      .map(([key]) => {
        switch (key) {
          case "changingRooms":
            return "Changing rooms";
          case "freeWater":
            return "Free water";
          case "nightLight":
            return "Night light";
          case "parking":
            return "Parking";
          default:
            return null;
        }
      })
      .filter(Boolean);

    return [...new Set(entries)];
  }

  return [];
};

export const buildPublicFutsalQuery = ({ keyword, lat, lng, radius }) => {
  const approvalFilters = [
    { approvalStatus: "APPROVED" },
    { isActive: true },
  ];

  if (keyword) {
    return {
      $and: [
        ...approvalFilters,
        {
          $or: [
            { name: { $regex: keyword, $options: "i" } },
            { "location.address": { $regex: keyword, $options: "i" } },
          ],
        },
      ],
    };
  }

  if (lat && lng) {
    const maxDistance = (parseFloat(radius) || 10) * 1000;
    return {
      $and: [
        ...approvalFilters,
        {
          location: {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: [parseFloat(lng), parseFloat(lat)],
              },
              $maxDistance: maxDistance,
            },
          },
        },
      ],
    };
  }

  return { $and: approvalFilters };
};

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
    facilities: normalizeFacilities(facilities),
    rules,
    approvalStatus: "PENDING",
    isActive: false,
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
  const query = buildPublicFutsalQuery({ keyword, lat, lng, radius });

  try {
    let futsals = await Futsal.find(query);

    if (keyword) {
      const normalizedKeyword = keyword.trim().toLowerCase();
      futsals = futsals.filter((futsal) => {
        const haystacks = [
          futsal.name || "",
          futsal.location?.address || "",
          futsal.description || "",
        ];

        return haystacks.some((text) => isFuzzyMatch(normalizedKeyword, text));
      });
    }

    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);

      const futsalsWithDistance = futsals.map((futsal) => {
        const [venueLng, venueLat] = futsal.location?.coordinates || [];
        const distance = haversineDistanceKm(
          userLat,
          userLng,
          venueLat,
          venueLng,
        );

        return {
          ...futsal.toObject(),
          distanceKm: distance,
        };
      });

      return res.json(futsalsWithDistance);
    }

    res.json(futsals);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Get driving route between two coordinates
// @route   GET /api/futsals/route
// @access  Public
const getRoute = async (req, res) => {
  const { startLat, startLng, endLat, endLng } = req.query;

  if (!startLat || !startLng || !endLat || !endLng) {
    return res.status(400).json({ message: "Missing route coordinates" });
  }

  try {
    const response = await axios.get(
      `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`,
    );

    const route = response?.data?.routes?.[0];

    if (!route?.geometry?.coordinates?.length) {
      return res.status(404).json({ message: "No route found" });
    }

    const coordinates = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

    res.json({
      coordinates,
      distanceKm: Number((route.distance / 1000).toFixed(1)),
      durationMin: Math.max(1, Math.round(route.duration / 60)),
    });
  } catch (error) {
    console.error("Route generation failed", error.message);
    res.status(502).json({ message: "Unable to generate route" });
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
    const futsals = await Futsal.find({ owner: req.user._id }).sort({ createdAt: -1 });
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
    if (facilities !== undefined) {
      futsal.facilities = normalizeFacilities(facilities);
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
  getRoute,
  updateFutsal,
  uploadImages,
  deleteImage,
};
