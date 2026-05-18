import { z } from "zod";

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export const sellRequestSchema = z.object({
  userId: z.coerce.number().int().positive(),
  drinkId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive().optional().default(1),
});

const registrationCredentialSchema = z.object({
  id: z.string().min(1),
  rawId: z.string().min(1),
  response: z.object({
    clientDataJSON: z.string().optional(),
    attestationObject: z.string().optional(),
    transports: z.array(z.string()).optional(),
  }).passthrough(),
}).passthrough();

const authenticationCredentialSchema = z.object({
  id: z.string().min(1).optional(),
  rawId: z.string().min(1).optional(),
  response: z.object({
    clientDataJSON: z.string().min(1),
  }).passthrough(),
}).passthrough().refine(
  credential => Boolean(credential.id || credential.rawId),
  {
    message: "Credential ID is required",
    path: ["id"],
  },
);

export const passkeyRegisterVerifySchema = z.object({
  credential: registrationCredentialSchema,
  deviceName: z.string().trim().min(1).max(100).optional(),
});

export const passkeyLoginOptionsSchema = z.object({
  username: z.string().trim().min(1).optional(),
});

export const passkeyLoginVerifySchema = z.object({
  credential: authenticationCredentialSchema,
});
