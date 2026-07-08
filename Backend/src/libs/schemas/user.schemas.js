import { z } from "zod";
import { ROLE_USER, ROLE_OWNER, ROLE_ADMIN } from "../../constants/roles.js";

const roleValues = [ROLE_USER, ROLE_OWNER, ROLE_ADMIN];

export const registerUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters long.").max(30, "Name must be at most 30 characters long."),
  email: z.string().trim().min(1, "Email is required.").email("Invalid email address."),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long.")
    .max(100, "Password is too long."),
  role: z.enum(roleValues).optional().default(ROLE_USER),
});


export const userSchema = registerUserSchema;

export default {
  registerUserSchema,
  userSchema,
};