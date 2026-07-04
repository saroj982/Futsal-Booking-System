import express from "express";
import {
  createFutsal,
  getFutsals,
  getFutsalById,
  getMyFutsals,
  updateFutsal,
  uploadImages,
  deleteImage,
} from "../controllers/futsalController.js";
import { protect, owner } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/").get(getFutsals).post(protect, owner, createFutsal);
router.route("/my").get(protect, owner, getMyFutsals);
router.route("/:id").get(getFutsalById).put(protect, owner, updateFutsal);
router.post("/:id/images", protect, owner, uploadImages);
router.delete("/:id/images", protect, owner, deleteImage);

export default router;
