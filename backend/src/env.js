import { z } from "zod/v4";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(8080),
  JWT_SECRET: z.string().default("your-secret-key-change-in-production"),

  // API documentation: "true"/"false" overrides the default (off in production)
  ENABLE_API_DOCS: z.enum(["true", "false"]).optional(),

  // Frontend URL configuration
  FEURL: z.string().default("http://localhost"),
  FEPORT: z.coerce.number().default(5173),

  // Database configuration for production (PostgreSQL)
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default("beermachine"),
  DB_USER: z.string().default("postgres"),
  DB_PASSWORD: z.string().default("hd?m6&p$KG$Sbg7T"),

  // WebAuthn configuration
  RP_NAME: z.string().default("Beer-Machine"),
  RP_ID: z.string().optional(),
  DOMAIN: z.string().optional(),
});

try {
  // eslint-disable-next-line node/no-process-env
  envSchema.parse(process.env);
}
catch (error) {
  if (error instanceof z.ZodError) {
    console.error("Missing environment variables:", error.issues.flatMap(issue => issue.path));
  }
  else {
    console.error(error);
  }
  process.exit(1);
}

// eslint-disable-next-line node/no-process-env
export const env = envSchema.parse(process.env);

/**
 * Whether the Swagger docs route should be served.
 * Reads live process.env (not the parsed snapshot) so it can be toggled at
 * request time — e.g. by tests — without re-parsing the whole schema.
 * Default: enabled everywhere except production; ENABLE_API_DOCS overrides.
 */
export function apiDocsEnabled() {
  const raw = process.env.ENABLE_API_DOCS; // eslint-disable-line node/no-process-env
  if (raw !== undefined)
    return raw === "true";
  // eslint-disable-next-line node/no-process-env
  return process.env.NODE_ENV !== "production";
}
