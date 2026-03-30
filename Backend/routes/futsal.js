const express = require("express");
const router = express.Router();
const {
  createFutsal,
  getFutsals,
  getFutsalById,
  getMyFutsals,
  updateFutsal,
  uploadImages,
  deleteImage,
} = require("../controllers/futsalController");
const { protect, owner } = require("../middleware/authMiddleware");

router.route("/").get(getFutsals).post(protect, owner, createFutsal);

router.route("/my").get(protect, owner, getMyFutsals);
router.route("/:id").get(getFutsalById).put(protect, owner, updateFutsal);

// Image routes (now accepts Cloudinary URLs)
router.post("/:id/images", protect, owner, uploadImages);
router.delete("/:id/images", protect, owner, deleteImage);

module.exports = router;
