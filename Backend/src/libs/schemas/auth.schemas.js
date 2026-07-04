export const forgotPasswordSchema = z.object({
  email: z
    .string({ error: "Email is required." })
    .regex(emailRegex, { error: "Invalid email address." }),
});

export const resetPasswordSchema = z.object({
  password: z.string(),
  userId: z.string(),
  token: z.string(),
});