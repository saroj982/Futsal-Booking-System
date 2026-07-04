import multer from "multer";
import path from "path";
import fs from "fs";
import { getDirname } from "../utils/pathHelpers.js";

const __dirname = getDirname(import.meta.url);
const uploadDir = path.join(__dirname, "../../uploads/futsals");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename(_req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `futsal-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, webp, gif)"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
});

export default upload;
