import dotenv from "dotenv";

dotenv.config();

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGO_URI || "",
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  slotExpireTime: parseFloat(process.env.slotExpireTime) || 5,
  paymentExtensionMinutes: parseFloat(process.env.PAYMENT_EXTENSION_MINUTES) || 5,
  esewa: {
    secretKey: process.env.ESEWA_SECRET_KEY || "",
    productCode: process.env.ESEWA_PRODUCT_CODE || "EPAYTEST",
    paymentUrl:
      process.env.ESEWA_PAYMENT_URL ||
      "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
    statusUrl:
      process.env.ESEWA_STATUS_URL ||
      "https://rc.esewa.com.np/api/epay/transaction/status",
  },
  resend: {
    apiKey: process.env.RESEND_EMAIL_API_KEY || "",
    fromEmail: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
  },
};

export default config;
