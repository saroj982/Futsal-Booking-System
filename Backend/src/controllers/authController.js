import User from "../models/User.js";
import { generateToken } from "../utils/jwt.js";
import {
  registerUserSchema,
  userSchema,
} from "../libs/schemas/user.schemas.js";
import {
  loginUserSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../libs/schemas/auth.schemas.js";
import authService from "../services/auth.service.js";

const buildUserResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  token: generateToken(user._id),
});

export const registerUser = async (req, res) => {
  try {
    const parsed = registerUserSchema.parse(req.body);

    const existingUser = await User.findOne({ email: parsed.email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      name: parsed.name.trim(),
      email: parsed.email.toLowerCase(),
      password: parsed.password,
      role: parsed.role || "user",
    });

    return res.status(201).json(buildUserResponse(user));
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.issues.map((issue) => issue.message),
      });
    }

    return res.status(500).json({ message: error.message || "Registration failed" });
  }
};

export const authUser = async (req, res) => {
  try {
    const parsed = loginUserSchema.parse(req.body);

    const user = await User.findOne({ email: parsed.email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await user.matchPassword(parsed.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked" });
    }

    return res.json(buildUserResponse(user));
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.issues.map((issue) => issue.message),
      });
    }

    return res.status(500).json({ message: error.message || "Login failed" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const parsed = forgotPasswordSchema.parse(req.body);
    const result = await authService.forgotPassword(parsed.email.toLowerCase());
    return res.json(result);
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.issues.map((issue) => issue.message),
      });
    }

    return res.status(500).json({ message: error.message || "Forgot password failed" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const parsed = resetPasswordSchema.parse(req.body);
    const result = await authService.resetPassword({
      userId: parsed.userId,
      token: parsed.token,
      password: parsed.password,
    });

    return res.json(result);
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "Validation failed",
        errors: error.issues.map((issue) => issue.message),
      });
    }

    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }

    return res.status(500).json({ message: error.message || "Reset password failed" });
  }
};

export default {
  registerUser,
  authUser,
  forgotPassword,
  resetPassword,
};
