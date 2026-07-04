import jwt from "jsonwebtoken";
import User from "../models/User.js";
import config from "../config/config.js";
import { ROLE_OWNER, ROLE_ADMIN } from "../constants/roles.js";

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, config.jwtSecret);

      req.user = await User.findById(decoded.id).select("-password");

      if (req.user && req.user.isBlocked) {
        return res.status(403).json({
          message: "Your account has been blocked. Please contact support.",
        });
      }

      return next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }
};

const owner = (req, res, next) => {
  if (req.user && req.user.role === ROLE_OWNER) {
    next();
  } else {
    res.status(401).json({ message: "Not authorized as an owner" });
  }
};

const admin = (req, res, next) => {
  if (req.user && req.user.role === ROLE_ADMIN) {
    next();
  } else {
    res.status(401).json({ message: "Not authorized as an admin" });
  }
};

export { protect, owner, admin };
