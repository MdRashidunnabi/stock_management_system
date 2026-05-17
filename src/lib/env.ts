import { z } from "zod";

/**
 * Type-safe environment variables.
 *
 * - Server vars are validated only when running on the server.
 * - Client vars (NEXT_PUBLIC_*) are validated everywhere.
 * - Throws at startup if required variables are missing or malformed.
 *
 * Usage: `import { env } from "@/lib/env";`
 */

const isServer = typeof window === "undefined";

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_ENV: z.enum(["development", "preview", "production"]).default("development"),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.string().default("en-IE"),
  NEXT_PUBLIC_DEFAULT_CURRENCY: z.string().default("EUR"),
  NEXT_PUBLIC_DEFAULT_TIMEZONE: z.string().default("Europe/Dublin"),
  NEXT_PUBLIC_DEFAULT_COUNTRY: z.string().default("IE"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(16).optional(),
  EMAIL_FROM: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

const clientEnv = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
  NEXT_PUBLIC_DEFAULT_CURRENCY: process.env.NEXT_PUBLIC_DEFAULT_CURRENCY,
  NEXT_PUBLIC_DEFAULT_TIMEZONE: process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE,
  NEXT_PUBLIC_DEFAULT_COUNTRY: process.env.NEXT_PUBLIC_DEFAULT_COUNTRY,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
};

const parsedClient = clientSchema.safeParse(clientEnv);
if (!parsedClient.success) {
  console.error(
    "Invalid client environment variables:\n",
    JSON.stringify(parsedClient.error.flatten().fieldErrors, null, 2),
  );
  throw new Error("Invalid client environment variables. See errors above.");
}

let parsedServer: z.infer<typeof serverSchema> | null = null;
if (isServer) {
  const serverEnv = {
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    EMAIL_FROM: process.env.EMAIL_FROM,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    SENTRY_DSN: process.env.SENTRY_DSN,
  };

  const parsed = serverSchema.safeParse(serverEnv);
  if (!parsed.success) {
    console.error(
      "Invalid server environment variables:\n",
      JSON.stringify(parsed.error.flatten().fieldErrors, null, 2),
    );
    throw new Error("Invalid server environment variables. See errors above.");
  }
  parsedServer = parsed.data;
}

export const env = {
  ...parsedClient.data,
  ...(parsedServer ?? ({} as z.infer<typeof serverSchema>)),
} as const;

export type Env = typeof env;
