import { z } from "zod";

export const loginUserSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").email("Invalid email address."),
  password: z.string().min(1, "Password is required."),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").email("Invalid email address."),
});

export const resetPasswordSchema = z.object({
  userId: z.string().trim().min(1, "userId is required."),
  token: z.string().trim().min(1, "token is required."),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long.")
    .max(100, "Password is too long."),
});

export default {
  loginUserSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};