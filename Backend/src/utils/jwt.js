import jwt from "jsonwebtoken";
import config from "../config/config.js";

export const generateToken = (id) => {
  return jwt.sign({ id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
};

export const verifyToken = (token) => {
  return jwt.verify(token, config.jwtSecret);
};

export default { generateToken, verifyToken };
