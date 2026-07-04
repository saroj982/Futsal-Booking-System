import crypto from "crypto";
import User from "../models/User.js";
import ResetPassword from "../models/ResetPassword.js";
import sendEmail from "../utils/email.js";
import config from "../config/config.js";

const forgotPassword = async (email) => {
  const user = await User.findOne({ email });

  if (!user) {
    return {
      message: "If an account with that email exists, a reset link has been sent.",
    };
  }

  const token = crypto.randomBytes(32).toString("hex");

  await ResetPassword.create({
    userId: user._id,
    token,
  });

  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}&userId=${user._id}`;

  await sendEmail({
    recipient: user.email,
    subject: "Reset your password",
    html: `
      <h2>Password Reset</h2>
      <p>Hi ${user.name},</p>
      <p>Click the link below to reset your password (valid for 1 hour):</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you did not request this, please ignore this email.</p>
    `,
  });

  return {
    message: "If an account with that email exists, a reset link has been sent.",
  };
};

const resetPassword = async ({ userId, token, password }) => {
  if (!userId || !token || !password) {
    const error = new Error("userId, token, and password are required");
    error.status = 400;
    throw error;
  }

  const resetRecord = await ResetPassword.findOne({
    userId,
    token,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  });

  if (!resetRecord) {
    const error = new Error("Invalid or expired reset token");
    error.status = 400;
    throw error;
  }

  const user = await User.findById(userId);
  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }

  user.password = password;
  await user.save();

  resetRecord.isUsed = true;
  await resetRecord.save();

  return { message: "Password reset successfully" };
};

export default { forgotPassword, resetPassword };
