import { z } from "zod";

const defaultFutsalRules = [
  "Indoor sports shoes only",
  "No food or drinks on the field",
  "Arrive 15 minutes before your booking",
  "Maximum 10 players per field",
];

const facilitiesSchema = z.object({
  changingRooms: z.coerce.boolean().optional().default(false),
  freeWater: z.coerce.boolean().optional().default(false),
  nightLight: z.coerce.boolean().optional().default(false),
  parking: z.coerce.boolean().optional().default(false),
});

const baseFutsalSchema = {
  name: z.string().trim().min(3, "Venue name must be at least 3 characters long.").max(100, "Venue name must be at most 100 characters long."),
  description: z.string().trim().max(1000, "Description is too long.").optional().or(z.literal("")),
  pricePerHour: z.coerce.number().positive("Price must be greater than 0."),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  address: z.string().trim().min(3, "Address is required.").max(255, "Address is too long."),
  openTime: z.coerce.number().int().min(0, "Open time must be between 0 and 23.").max(23, "Open time must be between 0 and 23."),
  closeTime: z.coerce.number().int().min(1, "Close time must be between 1 and 23.").max(23, "Close time must be between 1 and 23."),
  openDays: z.array(z.string().min(3)).min(1, "Please select at least one open day."),
  images: z.array(z.string().url().or(z.string().min(1))).optional().default([]),
  facilities: facilitiesSchema.optional().default({}),
  rules: z.array(z.string().trim().min(1, "Rule cannot be empty.")).max(20, "Add up to 20 rules only.").optional().default(defaultFutsalRules),
};

export const createFutsalSchema = z.object(baseFutsalSchema).superRefine((data, ctx) => {
  if (data.openTime >= data.closeTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["closeTime"],
      message: "Closing time must be after opening time.",
    });
  }
});

export const updateFutsalSchema = z.object({
  name: baseFutsalSchema.name.optional(),
  description: baseFutsalSchema.description.optional(),
  pricePerHour: baseFutsalSchema.pricePerHour.optional(),
  lat: baseFutsalSchema.lat.optional(),
  lng: baseFutsalSchema.lng.optional(),
  address: baseFutsalSchema.address.optional(),
  openTime: baseFutsalSchema.openTime.optional(),
  closeTime: baseFutsalSchema.closeTime.optional(),
  openDays: baseFutsalSchema.openDays.optional(),
  images: baseFutsalSchema.images.optional(),
  facilities: facilitiesSchema.optional(),
  rules: baseFutsalSchema.rules.optional(),
}).superRefine((data, ctx) => {
  if (data.openTime !== undefined && data.closeTime !== undefined && data.openTime >= data.closeTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["closeTime"],
      message: "Closing time must be after opening time.",
    });
  }
});

export { defaultFutsalRules, facilitiesSchema };

export default {
  createFutsalSchema,
  updateFutsalSchema,
  defaultFutsalRules,
  facilitiesSchema,
};