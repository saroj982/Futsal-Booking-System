const express = require("express");
const router = express.Router();
const {
  createFutsal,
  getFutsals,
  getFutsalById,
  getMyFutsals,
  updateFutsal,
} = require("../controllers/futsalController");
const { protect, owner } = require("../middleware/authMiddleware");

router.route("/").get(getFutsals).post(protect, owner, createFutsal);

router.route("/my").get(protect, owner, getMyFutsals);
router.route("/:id").get(getFutsalById).put(protect, owner, updateFutsal);

module.exports = router;
