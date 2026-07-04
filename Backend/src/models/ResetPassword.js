import mongoose from "mongoose";

const resetPasswordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "User id is required."],
  },
  token: {
    type: String,
    required: [true, "Reset password token is required."],
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 3600000),
    immutable: true,
  },
  isUsed: {
    type: Boolean,
    default: false,
  },
});

export default mongoose.model("ResetPassword", resetPasswordSchema);
