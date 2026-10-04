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
    clientDataJSON: z.string().min(1),
    attestationObject: z.string().min(1),
    transports: z.array(z.string()).optional(),
  }).passthrough(),
}).passthrough();

const authenticationCredentialSchema = z.object({
  id: z.string().min(1).optional(),
  rawId: z.string().min(1).optional(),
  type: z.literal("public-key"),
  response: z.object({
    clientDataJSON: z.string().min(1),
    authenticatorData: z.string().min(1),
    signature: z.string().min(1),
    userHandle: z.union([z.string().min(1), z.null().nullish()]).optional(),
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

export const apiKeyScopeEnum = z.enum(["admin", "seller"]);

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(50),
  scope: apiKeyScopeEnum.optional().default("admin"),
  expiresAt: z.coerce.date().optional(),
}).refine(
  data => data.expiresAt === undefined || data.expiresAt.getTime() > Date.now(),
  { message: "expiresAt must be in the future", path: ["expiresAt"] },
);

export const apiKeyIdParamSchema = z.coerce.number().int().positive();
