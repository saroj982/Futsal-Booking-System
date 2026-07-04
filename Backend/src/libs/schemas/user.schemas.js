import { ROLE_ADMIN, ROLE_CUSTOMER, ROLE_MERCHANT, ROLE_SUPER_ADMIN } from "../../constants/roles.js";

//this is registerschema
export const userSchema = z.object({
    name: z.string().check(minLength(3), maxLength(30)),
    email: z.string().check(minLength(3)).regex(emailRegex, { error: "Invalid email address" }),
    phone: z.string().check(minLength(6), maxLength(15)),
    password: z.string().check(minLength(6)).regex(passwordRegex, { error: "password must contain uppercase,lowercase,number and special charactes." }),
    isActive: z.boolean().default(true),
    roles: z.array(z.enum([ROLE_CUSTOMER,ROLE_ADMIN,ROLE_MERCHANT,ROLE_SUPER_ADMIN])).default(ROLE_CUSTOMER),
    address: z.object({
        city: z.string(),
        provience: z.string().optional(),
        street: z.string().optional(),
        country: z.string().default("Nepal"),

    }),
});