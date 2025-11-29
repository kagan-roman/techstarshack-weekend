import { createClient, SupabaseClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

export type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
  jwtSecret: string;
  schema?: string;
};

let adminClient: SupabaseClient | null = null;

export const getSupabaseAdminClient = (config: SupabaseConfig): SupabaseClient => {
  if (!adminClient) {
    adminClient = createClient(config.url, config.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      db: config.schema ? { schema: config.schema } : undefined,
    });
  }

  return adminClient;
};

export type AuthenticatedUser = {
  id: string;
  email?: string;
};

export const verifySupabaseJwt = (token: string, jwtSecret: string): AuthenticatedUser => {
  try {
    const payload = jwt.verify(token, jwtSecret) as jwt.JwtPayload;
    if (!payload.sub) {
      throw new Error("Missing subject in Supabase JWT");
    }

    return {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
  } catch (error) {
    throw new Error(`Supabase JWT verification failed: ${(error as Error).message}`);
  }
};

