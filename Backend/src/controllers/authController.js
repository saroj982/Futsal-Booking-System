import User from "../models/User.js";
import { generateToken } from "../utils/jwt.js";
import authService from "../services/auth.service.js";
import { ROLE_USER } from "../constants/roles.js";
import { registerUserSchema } from "../libs/schemas/user.schemas.js";
import {
  loginUserSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../libs/schemas/auth.schemas.js";

const getValidationMessage = (result) =>
  result.error.issues[0]?.message || "Invalid request data";

const registerUser = async (req, res) => {
  const parsed = registerUserSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: getValidationMessage(parsed) });
  }

  const { name, email, password, role } = parsed.data;

  try {
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || ROLE_USER,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const authUser = async (req, res) => {
  const parsed = loginUserSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: getValidationMessage(parsed) });
  }

  const { email, password } = parsed.data;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        message: "Your account has been blocked. Please contact support.",
      });
    }

    if (await user.matchPassword(password)) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ message: getValidationMessage(parsed) });
    }

    const data = await authService.forgotPassword(parsed.data.email);
    res.json(data);
  } catch (error) {
    res.status(error.status || 400).send(error.message);
  }
};

const resetPassword = async (req, res) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ message: getValidationMessage(parsed) });
    }

    const data = await authService.resetPassword(parsed.data);
    res.json(data);
  } catch (error) {
    res.status(error.status || 400).send(error.message);
  }
};

export { registerUser, authUser, forgotPassword, resetPassword };
