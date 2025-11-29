import { getSupabaseAdminClient } from "@weekend/core";
import { env } from "../config/env";

export const supabaseAdmin = getSupabaseAdminClient({
  url: env.supabaseUrl,
  serviceRoleKey: env.supabaseServiceRoleKey,
  jwtSecret: env.supabaseJwtSecret,
  schema: env.supabaseDbSchema,
});

