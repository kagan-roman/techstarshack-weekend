import { sql } from "../../lib/db";

const TABLE = "hackathon.user_profiles";

export type ProfileData = {
  userId?: string;
  identity?: {
    displayName?: string | null;
    homeBase?: string | null;
    preferredLanguages?: string[];
    bioSummary?: string;
  };
  macroPreferences?: Record<string, number>;
  latentTraits?: Record<string, number | string>;
  budget?: {
    explicit?: Record<string, unknown>;
    inferred?: Record<string, unknown>;
    final?: { score: number; level: string };
  };
  interests?: Array<{
    id: string;
    label: string;
    description?: string;
    tags?: string[];
    macroFocus?: string[];
    preferredFormats?: string[];
    weight: number;
  }>;
  trip?: Record<string, unknown>;
  outputPreferences?: Record<string, unknown>;
};

export type SaveUserProfileInput = {
  userId: string;
  agentRunId?: string;
  profileData: ProfileData;
};

export const saveUserProfile = async (input: SaveUserProfileInput) => {
  // Get current max version for this user
  const [current] = await sql.unsafe(`
    SELECT COALESCE(MAX(version), 0) as max_version
    FROM ${TABLE}
    WHERE user_id = $1::uuid
  `, [input.userId]);

  const nextVersion = (current?.max_version ?? 0) + 1;

  const [row] = await sql.unsafe(`
    INSERT INTO ${TABLE} (user_id, agent_run_id, profile_data, version)
    VALUES ($1::uuid, $2::uuid, $3, $4)
    RETURNING *
  `, [input.userId, input.agentRunId ?? null, JSON.stringify(input.profileData), nextVersion]);

  return row;
};

export const getLatestUserProfile = async (userId: string) => {
  const [row] = await sql.unsafe(`
    SELECT * FROM ${TABLE}
    WHERE user_id = $1::uuid
    ORDER BY version DESC
    LIMIT 1
  `, [userId]);

  return row ?? null;
};

export const getUserProfileHistory = async (userId: string, limit = 10) => {
  const rows = await sql.unsafe(`
    SELECT * FROM ${TABLE}
    WHERE user_id = $1::uuid
    ORDER BY version DESC
    LIMIT $2
  `, [userId, limit]);

  return rows;
};
